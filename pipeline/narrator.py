"""
narrator.py — generates a segmented voiceover using OpenAI text + TTS.

Three steps:
  1. LLM rewrites the visual script into spoken sections (one per script segment)
  2. OpenAI TTS converts each section to audio → measures duration
  3. PCM segments stitched into output/narration.wav
     output/narration_timing.json saved with per-section timecodes
"""
import json
import os
import time
import wave

import requests

from pipeline import claude_client

SCRIPT_PATH = os.path.join(os.path.dirname(
    __file__), "..", "output", "script.json")
TOPIC_PATH = os.path.join(os.path.dirname(
    __file__), "..", "output", "topic.json")
AUDIO_PATH = os.path.join(os.path.dirname(
    __file__), "..", "output", "narration.wav")
TIMING_PATH = os.path.join(os.path.dirname(
    __file__), "..", "output", "narration_timing.json")

TTS_MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
VOICE_NAME = os.environ.get("OPENAI_TTS_VOICE", "coral")

# Directorial prompt sent to OpenAI TTS to shape delivery.
_DEFAULT_VOICE_DIRECTIVE = (
    "You are a sharp, confident tech journalist who just found a story worth telling. "
    "You are not performing excitement — you are delivering a fact that genuinely surprised you, "
    "and your voice carries the quiet gravity of someone who knows what it means. "
    "The hook is the most important line. Say the brand name or the surprising number first, "
    "then let the implication land. Speak it like a headline being read aloud — "
    "punchy, clear, slightly faster than normal to hold attention. "
    "After the hook, shift to steady and precise: full flowing sentences, "
    "natural breath pauses after every number or named concept so it registers. "
    "Never perform enthusiasm. Never slow-drag the opening. "
    "The listener should feel like they caught something important before everyone else did. "
    "When you hit the takeaway, drop pace slightly — that is the line they will screenshot. "
    "Do not sound like a YouTuber, a news anchor, or a podcast host. "
    "Sound like someone who read the paper, ran the benchmark, and is telling you what it actually means. "
)


def _get_voice_directive() -> str:
    """Return custom tone if --tone was passed via env, otherwise the default."""
    override = os.environ.get("NARRATOR_TONE_OVERRIDE", "").strip()
    if override:
        return override + " "
    return _DEFAULT_VOICE_DIRECTIVE


VOICE_DIRECTIVE = _DEFAULT_VOICE_DIRECTIVE  # kept for backward compat imports


# ── Step 1: LLM rewrites visual script → segmented narration ─────────────────

def build_narration_prompt(topic: dict, script: dict) -> str:
    n = len(script["concept_bullets"])
    bullets = "\n".join(
        f"  bullet_{i+1}: {b}" for i, b in enumerate(script["concept_bullets"])
    )
    concept_keys = ", ".join(f'"concept_{i+1}"' for i in range(n))
    return f"""\
You are writing a segmented voiceover for a 25–35 second AI short-form reel (Instagram/TikTok/Shorts).
Target topics: GitHub repos and AI tools people can run TODAY, model releases with dramatic claims.
The goal: stop the scroll in 2 seconds, deliver the key fact, trigger a save.

TOPIC: {topic['title']}

SOURCE MATERIAL:
  hook:          {script['hook']}
  concepts:
{bullets}
  takeaway:      {script['takeaway']}

TOTAL TARGET: 25–35 seconds spoken. Every section must be tight. Cut every word that does not earn its place.

Write spoken narration in this structure:

  "hook" (4–6 seconds — ≤20 words spoken):
    First word or two: the brand name, repo name, or surprising number.
    One punchy sentence. That is it. No preamble. No "today we look at."
    Create the "wait, what?" moment in under 3 seconds.
    GOOD: "Someone just built a local GPT-4 replacement using Llama 4. It's free."
    GOOD: "Google's AlphaEvolve just broke a 56-year-old math record — by rewriting its own code."
    GOOD: "119 billion parameters. Only 6 billion activate per token. That's Mistral Small 4."
    BAD:  "Your GPU had plenty of memory. Your RAM had plenty of memory. So why did the process die?" ← no brand, no drama
    BAD:  "Today we examine memory allocation patterns in PyTorch training pipelines." ← news anchor opener

  {concept_keys} (6–9 seconds each — ≤35 words per concept):
    Start mid-thought — no "so", no "now", no preamble.
    For REPO topics: concept_1 = what it does + model it's built on.
                     concept_2 = the install or run command read aloud naturally.
                     concept_3 = what you can build or automate with it today.
    For MODEL topics: mechanism first, then the number, then the implication.
    Mix short punchy sentences (3-5 words) with one medium sentence for rhythm.
    GOOD: "AgentKit wraps Llama 4 into a one-command local agent. pip install, point it at a folder, it starts reasoning."
    GOOD: "Two environment variables. That's it. Set MALLOC_ARENA_MAX to 2 — RSS drops without touching model code."
    BAD:  "The mechanism involves setting environment variables that control memory allocation behavior."

  "takeaway_cta" (5–8 seconds — ≤25 words spoken):
    For REPO topics: repo name + "Pull it. Run it." + one-line what changes for the viewer.
    For MODEL topics: the specific rule or number the viewer will act on or save.
    Actionable line first. Save-trigger quality. No questions alone.
    GOOD: "It's on GitHub — search AgentKit. Pull it. Run it. No API key, no subscription, just your machine."
    GOOD: "Set MALLOC_ARENA_MAX=2 before any PyTorch job. One env var. Forty percent RSS drop."
    BAD:  "In conclusion, these optimizations can significantly improve your training pipeline."
    BAD:  "What else are you not measuring?" (question alone — no anchor)

RULES — non-negotiable:
- Write for speaking, not reading. Use natural rhythm and breath pauses.
- No hedging: "basically", "kind of", "essentially", "in a sense" — cut them all.
- NEVER say "video", "animation", "screen", "visual", "watch", "see", "subscribe", "follow".
- No news-anchor phrasing: "Today we look at...", "In this segment...", "As we can see..."
- Use contractions naturally: "it's", "that's", "you're", "doesn't"
- Each section must stand alone — it will be spliced independently
- BANNED adjectives — use the actual number instead: "incredibly", "massive", "huge",
  "enormous", "groundbreaking", "revolutionary", "mind-blowing", "next level", "powerful"
- BANNED phrases: "This changes everything", "game changer", "at its core", "simply put"
- Hook: stop-scroll in 3 seconds. Lead with the famous brand OR the surprising number OR the dramatic event.
  Three patterns — use the one that fits the topic:
  Famous brand + reversal:  "OpenAI's Sora lasted six months. The unit economics killed it."
  Surprising number first:  "119 billion parameters. Only 6 billion activate per token. That's Mistral Small 4."
  Dramatic event + context: "Google's AlphaEvolve just broke a 56-year-old math record — by rewriting its own code."
  BAD: "Every 1-bit LLM kept embeddings at 16-bit." ← no brand, too niche, no drama
  BAD: "Run your own ChatGPT on your iPhone." ← command/feature pitch, no surprise
  BAD: "Today we look at Bonsai 8B..." ← news-anchor opener

Return ONLY valid JSON with EXACTLY these keys:
  "hook", {concept_keys}, "takeaway_cta"
No markdown, no extra text.
"""


def generate_segmented_script(topic: dict, script: dict) -> dict:
    # content_generator.py writes spoken_narration.json with the exact segment
    # keys narrator needs for TTS. Only use it if the key set matches what the
    # current script requires — stale files from a different pipeline mode or a
    # different bullet count would cause a beat/timing mismatch downstream.
    _spoken_path = os.path.join(os.path.dirname(
        __file__), "..", "output", "spoken_narration.json")
    if os.path.exists(_spoken_path):
        with open(_spoken_path) as _f:
            _spoken = json.load(_f)
        n_bullets = len(script.get("concept_bullets", []))
        _expected_keys = set(
            ["hook"] +
            [f"concept_{i+1}" for i in range(n_bullets)] + ["takeaway_cta"]
        )
        if set(_spoken.keys()) == _expected_keys:
            print(
                "[narrator] spoken_narration.json matches script — skipping LLM rewrite step.")
            return _spoken
        else:
            print(
                f"[narrator] spoken_narration.json key mismatch "
                f"(have {sorted(_spoken.keys())}, need {sorted(_expected_keys)}) "
                f"— falling through to LLM rewrite."
            )

    import re as _re
    prompt = build_narration_prompt(topic, script)
    last_err = None
    for attempt in range(1, 4):
        try:
            raw = claude_client.call(
                prompt, stage="narrator", json_mode=True).strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
            # Find first { ... } block and repair trailing commas
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start != -1 and end > start:
                raw = raw[start:end]
            raw = _re.sub(r',\s*([\]}])', r'\1', raw)
            return json.loads(raw)
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            last_err = e
            print(
                f"[narrator] JSON parse failed (attempt {attempt}/3): {e} — retrying...")
    raise RuntimeError(
        f"Narrator failed to produce valid JSON after 3 attempts. Last error: {last_err}")


# ── Step 2: OpenAI TTS ────────────────────────────────────────────────────────

class _TTSRateLimited(Exception):
    pass


def call_tts(text: str, api_key: str) -> bytes:
    payload = {
        "model": TTS_MODEL,
        "voice": VOICE_NAME,
        "input": text,
        "instructions": _get_voice_directive(),
        "response_format": "pcm",
    }

    response = requests.post(
        "https://api.openai.com/v1/audio/speech",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )

    if response.status_code in (429, 500, 502, 503, 504):
        raise _TTSRateLimited(response.text[:400])
    if response.status_code >= 400:
        raise RuntimeError(f"OpenAI TTS HTTP {response.status_code}: {response.text[:800]}")

    return response.content


def pcm_duration(pcm_data: bytes, sample_rate: int = 24000) -> float:
    return len(pcm_data) / (sample_rate * 2)  # 16-bit PCM = 2 bytes/sample


def save_wav(pcm_data: bytes, path: str, sample_rate: int = 24000):
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)


# ── Main ──────────────────────────────────────────────────────────────────────

def call_tts_with_retries(text: str, api_key: str, max_attempts: int = 4) -> bytes:
    wait_seconds = 8
    last_err: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return call_tts(text, api_key)
        except _TTSRateLimited as e:
            last_err = e
            if attempt == max_attempts:
                break
            print(f" [retry in {wait_seconds}s]", end="", flush=True)
            time.sleep(wait_seconds)
    raise RuntimeError(f"TTS failed after {max_attempts} attempts. Last error: {last_err}")


def main():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set — narrator requires OpenAI TTS.")

    with open(SCRIPT_PATH) as f:
        script = json.load(f)
    with open(TOPIC_PATH) as f:
        topic = json.load(f)

    # Step 1 — generate segmented narration via LLM
    print("Generating segmented narration script...")
    segments = generate_segmented_script(topic, script)

    n_bullets = len(script["concept_bullets"])
    segment_keys = ["hook"] + \
        [f"concept_{i+1}" for i in range(n_bullets)] + ["takeaway_cta"]

    # Step 2 — TTS each segment with key rotation, measure duration, stitch PCM
    print(f"Calling OpenAI TTS  model={TTS_MODEL}  voice={VOICE_NAME}...")
    timing = {}
    all_pcm = b""
    cursor = 0.0

    for key in segment_keys:
        text = segments.get(key, "").strip()
        if not text:
            print(f"  [WARN] Missing segment '{key}' — skipping")
            continue
        word_count = len(text.split())
        print(f"  {key} ({word_count} words)...", end="", flush=True)
        pcm = call_tts_with_retries(text, api_key)
        dur = pcm_duration(pcm)
        timing[key] = {
            "start":    round(cursor, 3),
            "duration": round(dur, 3),
            "end":      round(cursor + dur, 3),
            "text":     text,
        }
        all_pcm += pcm
        cursor += dur
        print(f" {dur:.1f}s")

    # Step 3 — save stitched audio
    os.makedirs(os.path.dirname(AUDIO_PATH), exist_ok=True)
    save_wav(all_pcm, AUDIO_PATH)

    # Step 4 — save timing for animator
    with open(TIMING_PATH, "w") as f:
        json.dump(timing, f, indent=2)

    total = cursor
    print(f"✓ Narration saved → {AUDIO_PATH}  ({total:.1f}s total)")
    print(f"✓ Timing saved   → {TIMING_PATH}")
    return AUDIO_PATH


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
