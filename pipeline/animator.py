"""
animator.py — Remotion rendering bridge.

Flow:
  1. Load params.json + scene_plan.json + narration_timing.json
  2. Load word_timings.json (optional — from word_aligner.py) + cue_definitions.json
  3. Build cue_map: segment cues (always) + word cues (if word_timings available)
  4. Copy narration.wav → remotion/public/narration.wav (staticFile resolution)
  5. Write output/remotion_props.json (merged props including cues)
  6. Render: local npx remotion render OR @remotion/lambda if USE_REMOTION_LAMBDA=1
  7. Output → output/video.mp4

Lambda setup (one-time, when USE_REMOTION_LAMBDA=1):
  cd remotion && npm install @remotion/lambda
  npx remotion lambda functions deploy --region us-east-1
  npx remotion lambda buckets create
  npx remotion lambda sites create src/index.ts --site-name adamax
  Set in .env: REMOTION_LAMBDA_FUNCTION_NAME, REMOTION_LAMBDA_REGION, REMOTION_SERVE_URL
"""
import json
import math
import os
import shutil
import subprocess
import sys
import threading
import time

from pipeline.theme_config import read_theme_selection

_ROOT         = os.path.join(os.path.dirname(__file__), "..")
PARAMS_INPUT  = os.path.join(_ROOT, "output", "params.json")
SCENE_PLAN    = os.path.join(_ROOT, "output", "scene_plan.json")
TIMING_INPUT  = os.path.join(_ROOT, "output", "narration_timing.json")
WORD_TIMINGS  = os.path.join(_ROOT, "output", "word_timings.json")
CUE_DEFS      = os.path.join(_ROOT, "cue_definitions.json")
AUDIO_INPUT   = os.path.join(_ROOT, "output", "narration.wav")
PROPS_PATH    = os.path.join(_ROOT, "output", "remotion_props.json")
OUTPUT_VIDEO  = os.path.join(_ROOT, "output", "video.mp4")
REMOTION_DIR  = os.path.join(_ROOT, "remotion")

FPS = 30


# ── Cue map builder ────────────────────────────────────────────────────────────

def build_cue_map(timing: dict, word_timings: list[dict], cue_defs: dict) -> dict[str, int]:
    """
    Build {label: frame_number} from two sources:

    1. Segment cues (always available):
       Fire at the start of a narration segment (hook, concept_1, etc.)
       from narration_timing.json. offset_frames shifts the trigger.

    2. Word cues (requires word_timings.json from word_aligner.py):
       Fire when a specific trigger word is spoken. occurrence selects
       which match (0=first, 1=second, -1=last). offset_frames fine-tunes.

    Components consume cues via useCue("label") in Remotion — zero
    frame numbers ever appear in component code.
    """
    cue_map: dict[str, int] = {}

    # ── Segment cues ─────────────────────────────────────────────────────────
    for cue in cue_defs.get("segment_cues", []):
        label   = cue.get("label")
        segment = cue.get("segment")
        offset  = cue.get("offset_frames", 0)
        if not label or not segment:
            continue
        entry = timing.get(segment)
        if not entry:
            continue
        frame = round(entry["start"] * FPS) + offset
        cue_map[label] = max(0, frame)

    # ── Word cues (optional — skip if no word_timings) ───────────────────────
    if not word_timings:
        return cue_map

    for cue in cue_defs.get("word_cues", []):
        label    = cue.get("label")
        keyword  = (cue.get("trigger_word") or "").lower()
        occ      = cue.get("occurrence", 0)
        offset   = cue.get("offset_frames", 0)
        if not label or not keyword:
            continue

        matches = [w for w in word_timings if keyword in w["word"].lower()]
        if not matches:
            continue

        match = matches[-1] if occ == -1 else (matches[occ] if len(matches) > occ else None)
        if not match:
            continue

        frame = round(match["start"] * FPS) + offset
        cue_map[label] = max(0, frame)

    return cue_map

RENDER_TIMEOUT = 300   # seconds — Remotion is ~3-5× faster than Manim


# ── Spinner ───────────────────────────────────────────────────────────────────

class Spinner:
    CHARS = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

    def __init__(self, message: str):
        self.message = message
        self._stop   = threading.Event()
        self._thread = threading.Thread(target=self._spin, daemon=True)

    def _spin(self):
        i = 0
        start = time.time()
        while not self._stop.is_set():
            elapsed = int(time.time() - start)
            sys.stdout.write(f"\r{self.CHARS[i % len(self.CHARS)]}  {self.message} ({elapsed}s elapsed)  ")
            sys.stdout.flush()
            i += 1
            time.sleep(0.1)
        sys.stdout.write("\r" + " " * 70 + "\r")
        sys.stdout.flush()

    def __enter__(self):
        self._thread.start()
        return self

    def __exit__(self, *args):
        self._stop.set()
        self._thread.join()


# ── Props assembly ─────────────────────────────────────────────────────────────

def assemble_props(
    params: dict,
    scene_plan: dict,
    timing: dict,
    cue_map: dict[str, int],
) -> dict:
    """
    Merge pipeline outputs into the single RemotionProps object consumed by
    VideoComposition.tsx via --props.

    audioSrc is a filename (not a path) because Remotion resolves it via
    staticFile() against remotion/public/. The file is copied there before render.

    totalFrames is a fallback — calculateMetadata() in Root.tsx auto-computes
    duration from the actual audio file and overrides this value at render time.
    """
    total_dur = max(
        v.get("end", v.get("start", 0) + v.get("duration", 0))
        for v in timing.values()
    )
    total_frames = math.ceil(total_dur * FPS) + FPS  # +1s breathing room

    return {
        "beats":       scene_plan.get("beats", []),
        "scenes":      params,   # v3 ScenePayload format — routed by SceneRouter in Remotion
        "timing":      timing,
        "audioSrc":    "narration.wav",
        "totalFrames": total_frames,
        "themeName":   read_theme_selection(),
        "cues":        cue_map,
    }


# ── Remotion execution ─────────────────────────────────────────────────────────

def run_remotion_lambda(props_path: str, output_path: str) -> tuple[bool, str]:
    """
    Render via @remotion/lambda for ~5× speed-up through parallel frame chunks.
    Requires one-time AWS setup — see module docstring for setup commands.

    Env vars required:
      REMOTION_LAMBDA_FUNCTION_NAME  — from: npx remotion lambda functions deploy
      REMOTION_LAMBDA_REGION         — e.g. us-east-1
      REMOTION_SERVE_URL             — from: npx remotion lambda sites create
    """
    fn   = os.environ.get("REMOTION_LAMBDA_FUNCTION_NAME", "")
    region = os.environ.get("REMOTION_LAMBDA_REGION", "us-east-1")
    serve  = os.environ.get("REMOTION_SERVE_URL", "")

    missing = [k for k, v in {
        "REMOTION_LAMBDA_FUNCTION_NAME": fn,
        "REMOTION_SERVE_URL":            serve,
    }.items() if not v]

    if missing:
        return False, (
            f"Lambda env vars not set: {missing}\n"
            "Run the one-time setup:\n"
            "  cd remotion && npm install @remotion/lambda\n"
            "  npx remotion lambda functions deploy --region us-east-1\n"
            "  npx remotion lambda buckets create\n"
            "  npx remotion lambda sites create src/index.ts --site-name adamax\n"
            "Then set REMOTION_LAMBDA_FUNCTION_NAME, REMOTION_SERVE_URL in .env"
        )

    cmd = [
        "npx", "remotion", "lambda", "render",
        serve,
        "VideoComposition",
        f"--props={os.path.abspath(props_path)}",
        f"--function-name={fn}",
        f"--region={region}",
        f"--frames-per-lambda=90",
        f"--out={os.path.abspath(output_path)}",
        "--log=verbose",
    ]

    with Spinner("Remotion Lambda rendering"):
        try:
            result = subprocess.run(
                cmd,
                cwd=REMOTION_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=300,
            )
        except subprocess.TimeoutExpired:
            return False, "Lambda render timed out after 300s"

    output = result.stdout or ""
    if result.returncode != 0:
        return False, output[-3000:]
    return True, output


def run_remotion(props_path: str, output_path: str) -> tuple[bool, str]:
    """
    Execute: npx remotion render src/index.ts VideoComposition <output> --props <props>
    cwd = remotion/ so that src/index.ts resolves correctly.
    """
    if not shutil.which("npx"):
        return False, "npx not found — install Node.js 18+ (https://nodejs.org)"

    if not os.path.isdir(os.path.join(REMOTION_DIR, "node_modules", "remotion")):
        return False, (
            "remotion/node_modules not found. "
            "Run: cd remotion && npm install"
        )

    cmd = [
        "npx", "remotion", "render",
        "src/index.ts",
        "VideoComposition",
        os.path.abspath(output_path),
        f"--props={os.path.abspath(props_path)}",
        "--concurrency=4",
        "--log=verbose",
        "--gl=angle",
    ]

    with Spinner("Remotion rendering"):
        try:
            result = subprocess.run(
                cmd,
                cwd=REMOTION_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=RENDER_TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            return False, f"Remotion timed out after {RENDER_TIMEOUT}s"

    output = result.stdout or ""
    if result.returncode != 0:
        return False, output[-3000:]
    return True, output


def run_remotion_custom(compositor_file: str, output_path: str) -> tuple[bool, str]:
    """
    Copy compositor-generated CustomVideo.tsx into remotion/src/ and render
    the CustomVideo composition (no props needed — all data is hardcoded in the file).
    """
    if not shutil.which("npx"):
        return False, "npx not found — install Node.js 18+ (https://nodejs.org)"

    if not os.path.isdir(os.path.join(REMOTION_DIR, "node_modules", "remotion")):
        return False, "remotion/node_modules not found. Run: cd remotion && npm install"

    # Copy custom file into remotion/src/
    dest = os.path.join(REMOTION_DIR, "src", "CustomVideo.tsx")
    shutil.copy2(compositor_file, dest)
    print(f"✓ CustomVideo.tsx → {dest}")

    cmd = [
        "npx", "remotion", "render",
        "src/index.ts",
        "CustomVideo",
        os.path.abspath(output_path),
        "--concurrency=4",
        "--log=verbose",
        "--gl=angle",
    ]

    with Spinner("Remotion rendering (custom compositor)"):
        try:
            result = subprocess.run(
                cmd,
                cwd=REMOTION_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=RENDER_TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            return False, f"Remotion timed out after {RENDER_TIMEOUT}s"

    output = result.stdout or ""
    if result.returncode != 0:
        return False, output[-3000:]
    return True, output


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # ── Load inputs ──────────────────────────────────────────────────────────
    with open(PARAMS_INPUT) as f:
        params = json.load(f)
    with open(SCENE_PLAN) as f:
        scene_plan = json.load(f)

    if not os.path.exists(TIMING_INPUT):
        raise RuntimeError(f"narration_timing.json not found. Run narrator first.")
    with open(TIMING_INPUT) as f:
        timing = json.load(f)

    # ── Load cue inputs (both optional — degrade gracefully) ─────────────────
    word_timings: list[dict] = []
    if os.path.exists(WORD_TIMINGS):
        with open(WORD_TIMINGS) as f:
            word_timings = json.load(f)
        print(f"✓ Word timings loaded  ({len(word_timings)} words)")
    else:
        print("[animator] word_timings.json not found — using segment-level cues only")

    cue_defs: dict = {}
    if os.path.exists(CUE_DEFS):
        with open(CUE_DEFS) as f:
            cue_defs = json.load(f)
    else:
        print("[animator] cue_definitions.json not found — cues disabled")

    cue_map = build_cue_map(timing, word_timings, cue_defs)
    if cue_map:
        print(f"✓ Cue map built  ({len(cue_map)} cues)")
        for label, frame in sorted(cue_map.items(), key=lambda x: x[1]):
            print(f"  {label:<22} → frame {frame:>4}  ({frame / FPS:.2f}s)")

    # ── Copy audio to remotion/public/ ───────────────────────────────────────
    if not os.path.exists(AUDIO_INPUT):
        raise RuntimeError(f"narration.wav not found. Run narrator first.")

    public_dir = os.path.join(REMOTION_DIR, "public")
    os.makedirs(public_dir, exist_ok=True)
    shutil.copy2(AUDIO_INPUT, os.path.join(public_dir, "narration.wav"))
    print("✓ narration.wav → remotion/public/narration.wav")

    # ── Assemble props ────────────────────────────────────────────────────────
    props = assemble_props(params, scene_plan, timing, cue_map)

    total_dur      = props["totalFrames"] / FPS
    beat_templates = [b["template"] for b in props["beats"]]
    print(f"Video duration: {total_dur:.1f}s  ({props['totalFrames']} frames @ {FPS}fps)")
    print(f"Scene plan:     {' → '.join(beat_templates)}")

    # ── Beat / timing segment count validation ────────────────────────────────
    # beats.length must equal timing.length: each narration segment needs a beat
    # or the camera pan schedule fires at the wrong time and TakeawayScene shows
    # as a black screen until its beatStartFrame is reached.
    n_beats   = len(props["beats"])
    n_timing  = len(timing)
    if n_beats != n_timing:
        print(
            f"\n[animator] ⚠️  BEAT/TIMING MISMATCH: {n_beats} beats vs {n_timing} timing segments.\n"
            f"  Timing keys:  {list(timing.keys())}\n"
            f"  Beat count:   {n_beats}\n"
            f"  The camera pan schedule will be misaligned — expect dead-air or early-cut on last beat.\n"
            f"  Fix: content generation must emit exactly {n_timing} beats for {n_timing} narration segments."
        )

    os.makedirs(os.path.dirname(PROPS_PATH), exist_ok=True)
    with open(PROPS_PATH, "w") as f:
        json.dump(props, f, indent=2)
    print(f"✓ Props written → {PROPS_PATH}")

    # ── Render — compositor / local / Lambda ─────────────────────────────────
    os.makedirs(os.path.dirname(OUTPUT_VIDEO), exist_ok=True)

    compositor_file = os.environ.get("COMPOSITOR_FILE", "").strip()
    if compositor_file and os.path.exists(compositor_file):
        print(f"[animator] Compositor mode — rendering CustomVideo from {compositor_file}")
        success, log = run_remotion_custom(compositor_file, OUTPUT_VIDEO)
    else:
        use_lambda = os.environ.get("USE_REMOTION_LAMBDA", "").strip() == "1"
        if use_lambda:
            print("[animator] USE_REMOTION_LAMBDA=1 — using @remotion/lambda")
            success, log = run_remotion_lambda(PROPS_PATH, OUTPUT_VIDEO)
        else:
            success, log = run_remotion(PROPS_PATH, OUTPUT_VIDEO)

    if not success:
        raise RuntimeError(f"Remotion render failed:\n{log}")

    size_mb = os.path.getsize(OUTPUT_VIDEO) / 1_000_000
    print(f"\n✓ Video saved → {OUTPUT_VIDEO}  ({size_mb:.1f} MB)")
    return OUTPUT_VIDEO


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
