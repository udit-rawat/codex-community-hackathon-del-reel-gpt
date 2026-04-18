import argparse
import json
import os
import sys

from dotenv import load_dotenv
from pipeline.theme_config import DEFAULT_THEME, THEMES, write_theme_selection

load_dotenv()

PIPELINE_STAGES = ["content_generator", "narrator", "word_aligner", "animator"]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
TOPIC_PATH = os.path.join(OUTPUT_DIR, "topic.json")


def apply_provider(provider: str, model: str | None) -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        print("[ERROR] --provider openai requires OPENAI_API_KEY in .env", file=sys.stderr)
        sys.exit(1)

    os.environ["FORCE_PROVIDER"] = "openai"

    if model:
        os.environ["OPENAI_TEXT_MODEL"] = model


def write_topic(title: str, summary: str) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    topic = {
        "title": title,
        "summary": summary,
        "source": "user_input",
        "why_picked": "Provided directly by the user.",
    }
    with open(TOPIC_PATH, "w") as f:
        json.dump(topic, f, indent=2)
    print(f"[input] topic.json written → {title}")


def apply_narration_override(narration_arg: str) -> None:
    if not narration_arg:
        return

    if os.path.exists(narration_arg):
        with open(narration_arg) as f:
            narration = json.load(f)
        print(f"[narration] Loaded override from file → {narration_arg}")
    else:
        cleaned = narration_arg.replace("\n", " ").replace("\r", " ").replace("\t", " ")
        try:
            narration = json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"[ERROR] --narration is not valid JSON and not a file path: {e}", file=sys.stderr)
            sys.exit(1)
        print("[narration] Loaded override from inline JSON")

    required = {"hook", "concept_1", "takeaway_cta"}
    missing = required - set(narration.keys())
    if missing:
        print(f"[ERROR] --narration JSON missing required keys: {sorted(missing)}", file=sys.stderr)
        print('  Required keys: "hook", "concept_1", "takeaway_cta". "concept_2" is optional.', file=sys.stderr)
        sys.exit(1)

    spoken_path = os.path.join(OUTPUT_DIR, "spoken_narration.json")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(spoken_path, "w") as f:
        json.dump(narration, f, indent=2)

    print(f"[narration] Override written → {spoken_path}")


def run_stage(name: str) -> None:
    from pipeline.logger import get as get_log

    get_log().info(f"Stage START: {name}")
    print(f"\n--- Running: {name} ---")

    if name == "content_generator":
        from pipeline.content_generator import main
    elif name == "narrator":
        from pipeline.narrator import main
    elif name == "word_aligner":
        from pipeline.word_aligner import main
    elif name == "animator":
        from pipeline.animator import main
    else:
        raise ValueError(f"Unknown stage: {name}")

    main()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Phase 1 infographic pipeline: user input -> content -> narration -> timing -> render",
    )
    parser.add_argument(
        "--stage",
        choices=PIPELINE_STAGES,
        help="Run a single active stage. Omit to run the full infographic pipeline.",
    )
    parser.add_argument(
        "--provider",
        choices=["openai"],
        default="openai",
        help="Force the active provider for content generation.",
    )
    parser.add_argument("--model", help="Override OpenAI text model for all calls.")
    parser.add_argument(
        "--openai",
        action="store_true",
        help="Force OpenAI provider using OPENAI_API_KEY.",
    )
    parser.add_argument(
        "--title",
        default="",
        help="Topic title. Required for full runs when output/topic.json does not already exist.",
    )
    parser.add_argument(
        "--summary",
        default="",
        help="Optional topic summary or source text used to seed content generation.",
    )
    parser.add_argument(
        "--narration",
        default="",
        help=(
            "JSON string or path to a .json file with spoken narration override. "
            'Expected keys: "hook", "concept_1", "takeaway_cta"; "concept_2" optional.'
        ),
    )
    parser.add_argument(
        "--tone",
        default="",
        help="Optional narrator tone override for OpenAI TTS.",
    )
    parser.add_argument(
        "--theme",
        choices=sorted(THEMES.keys()),
        default=DEFAULT_THEME,
        help="Visual theme used for preview and final Remotion render.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.openai:
        apply_provider("openai", None)

    apply_provider(args.provider, args.model)

    theme_name = write_theme_selection(args.theme)
    os.environ["REELGPT_THEME"] = theme_name
    print(f"[theme] Active theme → {theme_name}")

    if args.tone:
        os.environ["NARRATOR_TONE_OVERRIDE"] = args.tone
        print(f"[tone] Custom tone set → \"{args.tone[:80]}\"")

    if args.narration:
        os.environ["NARRATION_OVERRIDE"] = "1"

    needs_topic = args.stage in (None, "content_generator")
    if args.title:
        write_topic(args.title, args.summary)
    elif needs_topic and not os.path.exists(TOPIC_PATH):
        print("[ERROR] Missing input topic. Pass --title and optional --summary.", file=sys.stderr)
        sys.exit(1)

    from pipeline.logger import setup as log_setup
    log = log_setup()

    from pipeline.claude_client import get_mode

    mode = get_mode()
    log.info(f"Pipeline starting — LLM mode: {mode}")
    print(f"\n[mode] {mode}\n")

    stages_to_run = [args.stage] if args.stage else PIPELINE_STAGES

    if args.stage == "narrator" and args.narration:
        apply_narration_override(args.narration)

    for stage in stages_to_run:
        try:
            run_stage(stage)
        except Exception as e:
            from pipeline.logger import get as get_log

            get_log().error(f"Stage FAILED: {stage} — {e}", exc_info=True)
            print(f"\n[ERROR] Stage '{stage}' failed: {e}", file=sys.stderr)
            sys.exit(1)

        if stage == "content_generator" and args.narration:
            apply_narration_override(args.narration)

    print("\n[done] Infographic pipeline complete.")


if __name__ == "__main__":
    main()
