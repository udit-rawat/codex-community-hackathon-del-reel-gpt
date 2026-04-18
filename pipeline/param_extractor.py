"""
param_extractor.py — extracts per-beat ScenePayload from the scene plan.

Motion Design v3: output format is ScenePayload JSON (discriminated union on
`data.layout`), NOT BeatLayout LayoutNode trees. VideoComposition routes each
beat through SceneRouter → typed layout component (ComparisonSplit, MetricFocus,
PipelineFlow, DataGrid, TakeawayScene).

Reads:
  output/script.json     — narration script
  output/topic.json      — topic metadata
  output/scene_plan.json — beat templates (used as layout hints)

Output: output/params.json
  {
    "beat_1": { "animate_in": "spring_scale", "data": { "layout": "MetricFocus", ... } },
    "beat_2": { "animate_in": "spring_in",    "data": { "layout": "ComparisonSplit", ... } },
    ...
  }

Fallback: if LLM fails 3× validation, STATIC_FALLBACK_TREES are used — video always renders.
"""
import json
import os
import re

from pipeline import claude_client

SCRIPT_PATH     = os.path.join(os.path.dirname(__file__), "..", "output", "script.json")
TOPIC_PATH      = os.path.join(os.path.dirname(__file__), "..", "output", "topic.json")
SCENE_PLAN_PATH = os.path.join(os.path.dirname(__file__), "..", "output", "scene_plan.json")
OUTPUT_PATH     = os.path.join(os.path.dirname(__file__), "..", "output", "params.json")


# ── ScenePayload validation ───────────────────────────────────────────────────

_ALLOWED_LAYOUT_KINDS = {
    "ComparisonSplit", "MetricFocus", "PipelineFlow", "DataGrid", "TakeawayScene", "KineticBridge",
}
_ALLOWED_COLORS = {"green", "cyan", "yellow", "red", "white"}
_ALLOWED_ANIMATE_IN = {
    "spring_in", "spring_scale", "typewriter", "fade", "slide_up", "none",
}
_ALLOWED_PIPELINE_STATES = {"idle", "active", "bottleneck"}
_ALLOWED_FLOW_DIRS = {"horizontal", "vertical"}
_ALLOWED_ACCENT_COLORS = {"cyan", "green", "yellow"}


def _check_color(val, field, errors):
    if val and val not in _ALLOWED_COLORS:
        errors.append(f"{field}: invalid color {val!r}")


def _check_metric(m, prefix, errors):
    if not isinstance(m, dict):
        errors.append(f"{prefix}: must be object")
        return
    if not m.get("label"):
        errors.append(f"{prefix}: missing label")
    if not m.get("value"):
        errors.append(f"{prefix}: missing value")
    if len(str(m.get("label", ""))) > 16:
        errors.append(f"{prefix}.label too long (≤ 16 chars)")
    if len(str(m.get("value", ""))) > 8:
        errors.append(f"{prefix}.value too long (≤ 8 chars)")
    _check_color(m.get("color"), f"{prefix}.color", errors)


def _validate_scene_payload(payload: dict, template: str = "") -> list[str]:
    """Validate a ScenePayload: { animate_in, data: SceneData }."""
    errors: list[str] = []

    animate_in = payload.get("animate_in")
    if animate_in not in _ALLOWED_ANIMATE_IN:
        errors.append(f"Invalid animate_in {animate_in!r}")

    data = payload.get("data")
    if not isinstance(data, dict):
        errors.append("Missing or invalid 'data' object")
        return errors

    kind = data.get("layout")
    if kind not in _ALLOWED_LAYOUT_KINDS:
        errors.append(f"Invalid data.layout {kind!r} — must be one of {sorted(_ALLOWED_LAYOUT_KINDS)}")
        return errors

    if not data.get("section_label"):
        errors.append("data.section_label is required")

    # ── Per-layout validation ────────────────────────────────────────────────

    if kind == "MetricFocus":
        hero = data.get("hero")
        if not isinstance(hero, dict):
            errors.append("MetricFocus.data.hero must be an object")
        else:
            if not hero.get("value"): errors.append("hero.value required")
            if not hero.get("label"): errors.append("hero.label required")
            _check_color(hero.get("color"), "hero.color", errors)
        if not data.get("context"):
            errors.append("MetricFocus.data.context required")
        chips = data.get("chips")
        if chips is not None and not isinstance(chips, list):
            errors.append("MetricFocus.data.chips must be a list")

    elif kind == "ComparisonSplit":
        for side in ("left", "right"):
            panel = data.get(side)
            if not isinstance(panel, dict):
                errors.append(f"ComparisonSplit.data.{side} must be an object")
                continue
            if not panel.get("heading"):
                errors.append(f"ComparisonSplit.data.{side}.heading required")
            _check_color(panel.get("color"), f"{side}.color", errors)
            metrics = panel.get("metrics", [])
            if not isinstance(metrics, list) or len(metrics) == 0:
                errors.append(f"ComparisonSplit.data.{side}.metrics must be non-empty list")
            for i, m in enumerate(metrics):
                _check_metric(m, f"{side}.metrics[{i}]", errors)

    elif kind == "PipelineFlow":
        steps = data.get("steps", [])
        if not isinstance(steps, list) or len(steps) < 2:
            errors.append("PipelineFlow.data.steps must have ≥ 2 items")
        for i, s in enumerate(steps):
            if not isinstance(s, dict):
                errors.append(f"steps[{i}] must be object"); continue
            if not s.get("label"):
                errors.append(f"steps[{i}].label required")
            elif len(str(s["label"])) > 12:
                errors.append(f"steps[{i}].label too long (≤ 12 chars): {s['label']!r}")
            if s.get("state") not in _ALLOWED_PIPELINE_STATES:
                errors.append(f"steps[{i}].state must be idle|active|bottleneck")
        flow_dir = data.get("flow_direction")
        if flow_dir not in _ALLOWED_FLOW_DIRS:
            errors.append("PipelineFlow.data.flow_direction must be horizontal|vertical")
        elif flow_dir == "horizontal" and isinstance(steps, list) and len(steps) >= 5:
            errors.append("PipelineFlow: 5+ steps must use flow_direction 'vertical'")

    elif kind == "DataGrid":
        metrics = data.get("metrics", [])
        if not isinstance(metrics, list) or not (2 <= len(metrics) <= 4):
            errors.append("DataGrid.data.metrics must have 2–4 items")
        for i, m in enumerate(metrics):
            _check_metric(m, f"metrics[{i}]", errors)

    elif kind == "KineticBridge":
        keywords = data.get("keywords", [])
        if not isinstance(keywords, list) or not (2 <= len(keywords) <= 5):
            errors.append("KineticBridge.data.keywords must have 2–5 items")
        for i, kw in enumerate(keywords):
            if not isinstance(kw, str):
                errors.append(f"keywords[{i}] must be a string")
            elif len(kw) > 24:
                errors.append(f"keywords[{i}] too long (≤ 20 chars): {kw!r}")

    elif kind == "TakeawayScene":
        headline = data.get("headline", "")
        if not headline:
            errors.append("TakeawayScene.data.headline required")
        if len(headline.split()) > 16:
            errors.append("TakeawayScene.data.headline too long (≤ 16 words)")
        accent = data.get("accent_color")
        if accent and accent not in _ALLOWED_ACCENT_COLORS:
            errors.append(f"TakeawayScene.data.accent_color must be cyan|green|yellow, got {accent!r}")

    return errors


# ── Static fallback trees (always renders — Option A) ─────────────────────────

STATIC_FALLBACK_TREES: dict[str, dict] = {
    "hook": {
        "animate_in": "spring_scale",
        "data": {
            "layout":        "MetricFocus",
            "section_label": "THE HOOK",
            "hero":          {"value": "N/A", "label": "metric", "color": "cyan"},
            "context":       "Content unavailable — check pipeline logs.",
            "chips":         [],
        },
    },
    "stats_grid": {
        "animate_in": "spring_in",
        "data": {
            "layout":        "DataGrid",
            "section_label": "Key Stats",
            "metrics": [
                {"label": "Stat 1", "value": "N/A", "color": "cyan"},
                {"label": "Stat 2", "value": "N/A", "color": "cyan"},
            ],
            "highlight_index": 0,
        },
    },
    "pipeline": {
        "animate_in": "slide_up",
        "data": {
            "layout":         "PipelineFlow",
            "section_label":  "How It Works",
            "flow_direction": "vertical",
            "steps": [
                {"label": "Step 1", "state": "active"},
                {"label": "Step 2", "state": "active"},
                {"label": "Step 3", "state": "active"},
            ],
        },
    },
    "comparison": {
        "animate_in": "fade",
        "data": {
            "layout":        "ComparisonSplit",
            "section_label": "Before vs After",
            "divider_label": "vs",
            "left":  {"heading": "Before", "color": "red",   "metrics": [{"label": "N/A", "value": "N/A"}]},
            "right": {"heading": "After",  "color": "green", "metrics": [{"label": "N/A", "value": "N/A", "glow": True}]},
        },
    },
    "timeline": {
        "animate_in": "spring_in",
        "data": {
            "layout":        "DataGrid",
            "section_label": "Timeline",
            "metrics": [
                {"label": "v1.0", "value": "Launch", "color": "cyan"},
                {"label": "v2.0", "value": "Scale",  "color": "green", "glow": True},
            ],
        },
    },
    "bridge": {
        "animate_in": "fade",
        "data": {
            "layout":        "KineticBridge",
            "section_label": "context",
            "keywords":      ["Key insight", "Think about it", "Here's why"],
            "accent_color":  "cyan",
        },
    },
    "takeaway": {
        "animate_in": "none",
        "data": {
            "layout":        "TakeawayScene",
            "section_label": "TAKEAWAY",
            "headline":      "Run your own experiments.",
            "accent_color":  "cyan",
        },
    },
}


# ── Prompt ────────────────────────────────────────────────────────────────────

_TEMPLATE_HINTS = {
    "hook":       "MetricFocus — hero number + punchy context. hero.value ≤ 8 chars (e.g. '3.8×', '90ms', '$0.002'). 2–3 chips as short tags.",
    "stats_grid": "DataGrid — 2–4 key metrics. label ≤ 8 chars, value ≤ 8 chars. Set highlight_index on the best metric. Optional caption.",
    "pipeline":   "PipelineFlow — 3–5 steps with state idle|active|bottleneck. flow_direction horizontal if ≤ 4 steps, vertical if ≥ 5. Mark bottleneck step.",
    "comparison": "ComparisonSplit — left=before/baseline, right=after/optimised. Each side has heading + 1–3 MetricItems. Use red for worse, green for better.",
    "timeline":   "DataGrid — chronological. label=year/version, value=milestone keyword. highlight_index on most recent.",
    "takeaway":   "TakeawayScene — headline is the key takeaway ≤ 14 words. Do NOT include a cta field. accent_color cyan|green|yellow.",
}

_SCHEMA_REFERENCE = """\
OUTPUT FORMAT — ScenePayload per beat:
  { "animate_in": "...", "data": { "layout": "<LayoutKind>", ...fields } }

LAYOUT KINDS (pick the best one per beat):

  MetricFocus — hero number + context + chips
    data: { layout, section_label, hero: {value, label, color}, context, chips?: string[] }

  DataGrid — 2–4 metric cards in a grid
    data: { layout, section_label, metrics: [{label, value, color, glow?}], highlight_index?, caption? }

  ComparisonSplit — A vs B side-by-side
    data: { layout, section_label, divider_label?,
            left:  {heading, color, metrics: [{label, value, color?, glow?}]},
            right: {heading, color, metrics: [{label, value, color?, glow?}]} }

  PipelineFlow — sequential steps with connectors
    data: { layout, section_label, flow_direction: "horizontal"|"vertical",
            steps: [{label, sublabel?, state: "idle"|"active"|"bottleneck"}],
            bottleneck_label? }

  TakeawayScene — kinetic outro (MUST be the last beat only)
    data: { layout, section_label, headline, cta?, accent_color?: "cyan"|"green"|"yellow" }

  KineticBridge — conversational/narrative gap filler (NO structured data available)
    Use when the narration is a bridge, analogy, or context-setting sentence with no
    quantitative data to display. 2–5 short keyword phrases pulse sequentially.
    data: { layout, section_label, keywords: string[], accent_color? }

ALLOWED VALUES:
  animate_in: "spring_in" | "spring_scale" | "fade" | "slide_up" | "none"
  color:      "green"(emerald) | "cyan"(indigo) | "yellow"(violet) | "red" | "white"
  state:      "idle" | "active" | "bottleneck"

CONSTRAINTS (validator enforced — violations cause retry):
  - hero.value ≤ 8 chars. MetricItem.value ≤ 8 chars. MetricItem.label ≤ 16 chars.
  - DataGrid.metrics: 2–4 items only.
  - PipelineFlow.steps: 2–5 steps. At least one step must be "active" or "bottleneck".
  - TakeawayScene.headline ≤ 16 words.
  - section_label required on every beat.
  - Last beat MUST be TakeawayScene.
  - All other beats must NOT be TakeawayScene.

REFERENCE EXAMPLES:

hook beat → MetricFocus:
  {"animate_in":"spring_scale","data":{"layout":"MetricFocus","section_label":"THE GAIN",
    "hero":{"value":"3.8×","label":"throughput","color":"cyan"},
    "context":"One config change. Same 96 GPUs. Tensor parallelism changed everything.",
    "chips":["open-source","96 GPUs","no code"]}}

stats beat → DataGrid:
  {"animate_in":"spring_in","data":{"layout":"DataGrid","section_label":"Voxtral TTS",
    "metrics":[{"label":"Params","value":"> 3B","color":"cyan","glow":true},
               {"label":"TTFA","value":"90ms","color":"green","glow":true},
               {"label":"MOS","value":"+12%","color":"green"},
               {"label":"License","value":"Open","color":"cyan"}],
    "highlight_index":1,"caption":"First open-weight model to beat ElevenLabs on MOS."}}

comparison beat → ComparisonSplit:
  {"animate_in":"fade","data":{"layout":"ComparisonSplit","section_label":"Latency",
    "divider_label":"vs",
    "left":{"heading":"Flash v2.5","color":"red","metrics":[{"label":"TTFA","value":"340ms"},{"label":"Quality","value":"Baseline"}]},
    "right":{"heading":"Voxtral","color":"green","metrics":[{"label":"TTFA","value":"90ms","glow":true},{"label":"Quality","value":"+12 MOS"}]}}}

pipeline beat → PipelineFlow:
  {"animate_in":"slide_up","data":{"layout":"PipelineFlow","section_label":"Inference",
    "flow_direction":"horizontal",
    "steps":[{"label":"Tokenize","state":"active"},{"label":"Prefill","state":"bottleneck","sublabel":"340ms"},{"label":"Decode","state":"active"}],
    "bottleneck_label":"Prefill is the latency wall — Voxtral attacks here."}}

takeaway beat → TakeawayScene:
  {"animate_in":"none","data":{"layout":"TakeawayScene","section_label":"TAKEAWAY",
    "headline":"Open weights now beat closed-source. Pick your stack wisely.",
    "accent_color":"cyan"}}"""


def build_prompt(topic: dict, script: dict, scene_plan: dict) -> str:
    hook     = script.get("hook", "")
    bullets  = script.get("concept_bullets", [])
    takeaway = script.get("takeaway", "")
    beats    = scene_plan.get("beats", [])

    middle_beats = [b for b in beats if b["template"] not in ("hook", "takeaway")]
    beat_lines = []
    for beat in beats:
        num      = beat["beat"]
        template = beat["template"]
        hint     = _TEMPLATE_HINTS.get(template, "")
        if template == "hook":
            narration = hook
        elif template == "takeaway":
            narration = takeaway
        else:
            mi = next((i for i, b in enumerate(middle_beats) if b["beat"] == num), None)
            narration = bullets[mi] if mi is not None and mi < len(bullets) else ""
        beat_lines.append(
            f"BEAT {num} (template: {template})\n"
            f"  Narration: {narration}\n"
            f"  Visual layout hint: {hint}"
        )

    beat_content = "\n\n".join(beat_lines)

    json_parts = []
    for beat in beats:
        json_parts.append(
            f'  "beat_{beat["beat"]}": {{"animate_in": "...", "template_variant": "infographic|animation_hook", '
            f'"template_variant_rationale": "...", "data": {{"layout": "...", ...}}}}'
        )
    json_shape = "{\n" + ",\n".join(json_parts) + "\n}"

    return f"""\
You are generating per-beat ScenePayload JSON for a short AI explainer video.
Each beat gets: {{ "animate_in": "...", "data": {{ "layout": "<LayoutKind>", ...fields }} }}

TOPIC: {topic.get('title', '')}
SUMMARY: {topic.get('summary', '')}

SCRIPT:
  hook:     {hook}
  takeaway: {takeaway}

PER-BEAT CONTENT:
{beat_content}

{_SCHEMA_REFERENCE}

TEMPLATE VARIANT (choose per beat):
Each beat must include "template_variant": "infographic" or "animation_hook".

  infographic — text owns the center of the frame. Full opaque layout. Use when:
    - Content is list-based, step-by-step, multi-metric, or pipeline flow
    - No single dominant hero number (DataGrid, ComparisonSplit, PipelineFlow)
    - Takeaway / CTA beats

  animation_hook — text sits in caption zone (bottom 35% of screen). Top 65% is transparent
    so a pre-rendered 3D animation can be composited behind it in editing.
    Use when:
    - Beat has ONE dominant hero number or stat (MetricFocus, TriStat primary)
    - Content is a before/after comparison with a dramatic ratio (e.g. 8.2x)
    - Hook beat with a single punchy metric

  Provide "template_variant_rationale": one sentence explaining why you chose it.

DESIGN RULES (non-negotiable):
- Choose the layout kind that best visualises the narration content for that beat.
- hook beat → MetricFocus (hero stat + punchy context sentence).
- takeaway beat → TakeawayScene (closing insight, kinetic outro — LAST beat only).
- Middle beats → DataGrid, ComparisonSplit, or PipelineFlow based on content structure.
- Keep all text SHORT. Values render at 60–220px on phone screens.
- Extract the single most dramatic number for MetricFocus.hero.value.
- On ComparisonSplit: left=worse/before (red), right=better/after (green).
- On PipelineFlow: mark the bottleneck step with state "bottleneck".
- PipelineFlow with ≥ 5 steps MUST use flow_direction "vertical" — horizontal overflows.
- PipelineFlow step labels: ≤ 12 chars, single word or short abbreviation, no spaces.
- MetricItem value: ≤ 8 chars (renders at 60–220px). Use numbers/symbols, not words.
  BAD: "Improvement", "Optimizing"  GOOD: "+3.2%", "3.8×", "128K", "40ms"
- MetricItem label: ≤ 16 chars (renders at 22px). Full short words are fine.
  GOOD: "throughput", "optimizing", "dequant gain"
- section_label: ALL CAPS, 2–4 words describing the visual frame.
  GOOD: "THE BOTTLENECK", "BEFORE vs AFTER", "THE FIX", "TAKEAWAY"
  BAD:  "adamax.ai", "takeaway", "Experiment Setup"
- Do NOT use TakeawayScene on any beat except the last.

OUTPUT (exact JSON, no markdown fences, no extra fields):
{json_shape}

Return ONLY valid JSON. No explanation. No markdown.
"""


# ── Sanitizer — truncates instead of rejecting ───────────────────────────────

def _sanitize_payload(data: dict) -> dict:
    """
    Truncate strings that would fail length validation rather than rejecting the
    whole beat. Called after JSON parse, before validation.

    Truncation is word-boundary-aware:
      - If the string has a space before the limit, cut there (no mid-word break).
      - If the string is one long token (no spaces), cut with an ellipsis so the
        result looks intentional rather than misspelled.
    """
    # Values render at 60–220px — must be compact numbers/symbols (e.g. "3.8×", "40%").
    # Labels render at 22–24px — can be full short words (e.g. "optimizing", "throughput").
    MAX_VALUE    = 8
    MAX_LABEL    = 16
    MAX_CHIP     = 16
    MAX_STEP_LBL = 12  # PipelineFlow step labels (renders at 26px)

    def _trunc(s: str, n: int) -> str:
        """Truncate at word boundary if possible; hard-cut otherwise (no ellipsis)."""
        s = str(s).strip()
        if len(s) <= n:
            return s
        short      = s[:n]
        last_space = short.rfind(" ")
        if last_space > n // 2:
            return short[:last_space]
        return short  # single long token — hard cut, no ellipsis

    def _sanitize_metric(m: dict) -> dict:
        if not isinstance(m, dict):
            return m
        if "label" in m:
            m["label"] = _trunc(m["label"], MAX_LABEL)
        if "value" in m:
            m["value"] = _trunc(m["value"], MAX_VALUE)
        return m

    for beat_key, payload in data.items():
        if not isinstance(payload, dict):
            continue
        d = payload.get("data", {})
        if not isinstance(d, dict):
            continue
        kind = d.get("layout", "")

        if kind == "MetricFocus":
            hero = d.get("hero")
            if isinstance(hero, dict):
                if "value" in hero:
                    hero["value"] = _trunc(hero["value"], MAX_VALUE)
                if "label" in hero:
                    hero["label"] = _trunc(hero["label"], MAX_LABEL)
            d["chips"] = [_trunc(c, MAX_CHIP) for c in (d.get("chips") or [])]

        elif kind == "DataGrid":
            d["metrics"] = [_sanitize_metric(m) for m in (d.get("metrics") or [])]

        elif kind == "ComparisonSplit":
            for side in ("left", "right"):
                panel = d.get(side)
                if isinstance(panel, dict):
                    panel["metrics"] = [_sanitize_metric(m) for m in (panel.get("metrics") or [])]

        elif kind == "PipelineFlow":
            steps = d.get("steps") or []
            for step in steps:
                if isinstance(step, dict) and "label" in step:
                    step["label"] = _trunc(step["label"], MAX_STEP_LBL)
            # Enforce vertical layout for 5+ steps — horizontal overflows at that count.
            if len(steps) >= 5 and d.get("flow_direction") == "horizontal":
                d["flow_direction"] = "vertical"

    return data


# ── JSON extraction ───────────────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        for part in raw.split("```"):
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                raw = part
                break
    start = raw.find("{")
    end   = raw.rfind("}") + 1
    if start != -1 and end > start:
        raw = raw[start:end]
    raw = re.sub(r",\s*([\]}])", r"\1", raw)
    return json.loads(raw)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(SCRIPT_PATH) as f:
        script = json.load(f)
    with open(TOPIC_PATH) as f:
        topic = json.load(f)
    with open(SCENE_PLAN_PATH) as f:
        scene_plan = json.load(f)

    beats      = scene_plan.get("beats", [])
    prompt     = build_prompt(topic, script, scene_plan)
    last_err   = None
    params: dict = {}
    correction = ""   # injected into retry prompt after first failure

    for attempt in range(1, 4):
        try:
            retry_prompt = prompt if not correction else (
                prompt + f"\n\nCORRECTION (attempt {attempt}/3 — fix these before responding):\n{correction}"
            )
            raw  = claude_client.call(retry_prompt, stage="param_extractor", json_mode=True)
            data = _extract_json(raw)

            # Sanitize string lengths in-place (truncate rather than reject)
            data = _sanitize_payload(data)

            all_errors: list[str] = []
            for beat in beats:
                key      = f"beat_{beat['beat']}"
                template = beat.get("template", "")
                if key not in data:
                    all_errors.append(f"Missing {key}")
                else:
                    errs = _validate_scene_payload(data[key], template=template)
                    all_errors += [f"{key}: {e}" for e in errs]

            if all_errors:
                correction = "\n".join(f"- {e}" for e in all_errors)
                raise ValueError(f"Validation errors: {all_errors}")

            params   = data
            last_err = None
            break

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            last_err = e
            print(f"[param_extractor] attempt {attempt}/3 failed: {e} — retrying...")

    if last_err:
        print("[param_extractor] All 3 attempts failed. Applying static fallback trees.")
        params = {}

    for beat in beats:
        key      = f"beat_{beat['beat']}"
        template = beat.get("template", "hook")
        if key not in params:
            print(f"  ⚠ {key}: using static fallback for template '{template}'")
            params[key] = STATIC_FALLBACK_TREES.get(template, STATIC_FALLBACK_TREES["hook"])

    with open(OUTPUT_PATH, "w") as f:
        json.dump(params, f, indent=2)

    print(f"✓ Params saved → {OUTPUT_PATH}")
    for beat in beats:
        key = f"beat_{beat['beat']}"
        sp  = params.get(key, {})
        d   = sp.get("data", {})
        print(f"  {key}: animate_in={sp.get('animate_in')!r}  layout={d.get('layout')!r}")

    return params


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
