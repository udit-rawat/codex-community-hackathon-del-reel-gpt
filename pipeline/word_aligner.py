"""
word_aligner.py — word-level timestamp extraction from narration audio.

Runs AFTER narrator, BEFORE animator.
Produces output/word_timings.json consumed by build_cue_map() in animator.py.

Primary method: openai-whisper transcription with word_timestamps=True.
No HuggingFace token required. Base model is ~150MB, runs in ~5s on CPU.

If whisper is not installed, the stage exits cleanly with an empty
word_timings.json — the cue system degrades to segment-level timing only
(still functional, just less precise visual sync).

Output format:
  [
    { "word": "your",  "start": 0.12, "end": 0.28 },
    { "word": "GPU",   "start": 0.28, "end": 0.54 },
    ...
  ]
"""
import json
import os
import sys

AUDIO_PATH  = os.path.join(os.path.dirname(__file__), "..", "output", "narration.wav")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "output", "word_timings.json")


def _write_empty(reason: str) -> None:
    with open(OUTPUT_PATH, "w") as f:
        json.dump([], f)
    print(f"[word_aligner] {reason} — writing empty word_timings.json (segment-level cues only)")


def main() -> list[dict]:
    if not os.path.exists(AUDIO_PATH):
        _write_empty("narration.wav not found")
        return []

    # ── Attempt whisper import ────────────────────────────────────────────────
    try:
        import whisper  # openai-whisper: pip install openai-whisper
    except ImportError:
        _write_empty(
            "openai-whisper not installed — "
            "run: pip install openai-whisper  (or pip install -q openai-whisper)"
        )
        return []

    print("[word_aligner] Loading whisper base model…")
    try:
        model = whisper.load_model("base")
    except Exception as e:
        _write_empty(f"whisper model load failed: {e}")
        return []

    print("[word_aligner] Transcribing with word timestamps…")
    try:
        result = model.transcribe(
            AUDIO_PATH,
            word_timestamps=True,
            language="en",          # skip language detection — we know it's English
            fp16=False,             # CPU-safe (no CUDA required)
            verbose=False,
        )
    except Exception as e:
        _write_empty(f"whisper transcribe failed: {e}")
        return []

    # ── Extract word-level timing ─────────────────────────────────────────────
    word_timings: list[dict] = []
    for segment in result.get("segments", []):
        for word in segment.get("words", []):
            raw = word.get("word", "").strip()
            if not raw:
                continue
            word_timings.append({
                "word":  raw,
                "start": round(float(word["start"]), 3),
                "end":   round(float(word["end"]),   3),
            })

    with open(OUTPUT_PATH, "w") as f:
        json.dump(word_timings, f, indent=2)

    print(f"✓ Word timings → {OUTPUT_PATH}  ({len(word_timings)} words)")

    # Preview first 5 words for sanity check
    for w in word_timings[:5]:
        print(f"  {w['start']:.2f}s  {w['word']!r}")

    return word_timings


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
