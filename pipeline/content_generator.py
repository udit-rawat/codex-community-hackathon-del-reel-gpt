"""
content_generator.py — Structured content generation for the active infographic pipeline.

Generates the full content payload in one validated LLM call.

Outputs:
    output/script.json
    output/spoken_narration.json
    output/params.json
    output/scene_plan.json
    cue_definitions.json

Usage:
    python -m pipeline.content_generator          # uses FORCE_PROVIDER env var
    python -m pipeline.content_generator --topic "KV Cache Dequantization"

Install deps:
    pip install -r requirements.txt
"""
from __future__ import annotations

import json
import os
import sys
import textwrap
from enum import Enum
from typing import Annotated, Literal, Union

import requests
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

# ── Paths ──────────────────────────────────────────────────────────────────────

_ROOT       = os.path.join(os.path.dirname(__file__), "..")
TOPIC_PATH  = os.path.join(_ROOT, "output", "topic.json")
SCRIPT_OUT  = os.path.join(_ROOT, "output", "script.json")
SPOKEN_OUT  = os.path.join(_ROOT, "output", "spoken_narration.json")
PARAMS_OUT  = os.path.join(_ROOT, "output", "params.json")
PLAN_OUT    = os.path.join(_ROOT, "output", "scene_plan.json")
CUES_OUT    = os.path.join(_ROOT, "cue_definitions.json")

# ══════════════════════════════════════════════════════════════════════════════
# § 1  PYDANTIC SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class LayoutMode(str, Enum):
    METRIC      = "metric"
    COMPARISON  = "comparison"
    PIPELINE    = "pipeline"
    TIMELINE    = "timeline"
    TRISTAT     = "tristat"
    LEADERBOARD = "leaderboard"
    BAR         = "bar"
    CODEDIFF    = "codediff"


# ── Shared sub-objects ────────────────────────────────────────────────────────

class MetricItem(BaseModel):
    """One data point on a card (≤ 8 chars each for mobile legibility)."""
    label: str = Field(max_length=10, description="Short axis label, e.g. 'dequant %'")
    value: str = Field(max_length=10, description="Formatted value, e.g. '40 %'")
    color: Literal["green", "cyan", "yellow", "red", "white"] = "white"
    glow: bool = False


class PipelineStep(BaseModel):
    label:    str = Field(max_length=14, description="Node name shown on screen")
    sublabel: str | None = Field(default=None, max_length=10, description="e.g. '12 ms'")
    state:    Literal["idle", "active", "bottleneck"] = "idle"


class ComparisonPanel(BaseModel):
    heading: str = Field(max_length=16)
    color:   Literal["green", "cyan", "yellow", "red", "white"]
    metrics: list[MetricItem] = Field(min_length=1, max_length=4)


# ── Per-layout UIContent types ────────────────────────────────────────────────
# Discriminated union on the `layout` literal field.
# Each type maps 1-to-1 to a Remotion layout component.

class MetricUIContent(BaseModel):
    """Hero metric card — single big number + supporting context."""
    layout:        Literal["MetricFocus"]
    section_label: str = Field(max_length=24, description="UPPERCASE micro-label, e.g. 'THE BOTTLENECK'")
    hero:          MetricItem = Field(description="The ONE number that lands the point")
    context:       str  = Field(
        max_length=140,
        description=(
            "1-2 declarative sentences. No markdown. "
            "Separate sentences with a single space — React renders this verbatim."
        ),
    )
    chips: list[str] = Field(
        min_length=2, max_length=3,
        description="2-3 short tags ≤ 16 chars each, e.g. ['llama.cpp', 'M5 Max', '32K ctx']",
    )
    supporting_metrics: list[MetricItem] = Field(
        default_factory=list,
        max_length=3,
        description=(
            "1-3 additional data points shown alongside the hero in a grid. "
            "Use only numbers present in the topic summary — do NOT invent values. "
            "E.g. if summary mentions '14 ms before, 8 ms after', use those as two items. "
            "Leave empty if the summary contains no other usable numbers."
        ),
    )

    @field_validator("chips")
    @classmethod
    def chips_length(cls, v: list[str]) -> list[str]:
        for chip in v:
            if len(chip) > 16:
                raise ValueError(f"Chip '{chip}' exceeds 16 chars — shorten it.")
        return v


class ComparisonUIContent(BaseModel):
    """Side-by-side A vs B panel."""
    layout:         Literal["ComparisonSplit"]
    section_label:  str = Field(max_length=24)
    left:           ComparisonPanel
    right:          ComparisonPanel
    divider_label:  str = Field(default="vs", max_length=5)


class PipelineUIContent(BaseModel):
    """Step-by-step process flow with bottleneck annotation."""
    layout:             Literal["PipelineFlow"]
    section_label:      str = Field(max_length=24)
    steps:              list[PipelineStep] = Field(min_length=3, max_length=5)
    flow_direction:     Literal["horizontal", "vertical"] = "horizontal"
    bottleneck_label:   str | None = Field(
        default=None, max_length=30,
        description="Short annotation below the bottleneck step, e.g. '40 % of decode time'",
    )


class TimelineMilestone(BaseModel):
    """One milestone in a TimelineFlow beat."""
    date:      str  = Field(max_length=12, description="e.g. 'Nov 2025' or 'Day 1'")
    label:     str  = Field(max_length=20, description="Event name, e.g. 'Peak Downloads'")
    value:     str | None = Field(default=None, max_length=10, description="Optional metric, e.g. '3.3M'")
    highlight: bool = Field(default=False, description="Accent this milestone — use for the key inflection point")


class TimelineUIContent(BaseModel):
    """Chronological sequence of 3-5 milestones with optional metrics."""
    layout:        Literal["TimelineFlow"]
    section_label: str = Field(max_length=24)
    items:         list[TimelineMilestone] = Field(min_length=3, max_length=5)
    accent_color:  Literal["green", "cyan", "yellow"] = "cyan"


class TriStatItem(BaseModel):
    """One stat card in a TriStat beat."""
    value:    str      = Field(max_length=10, description="Formatted number, e.g. '$130' or '64%'")
    label:    str      = Field(max_length=20, description="What this number measures, e.g. 'compute/clip'")
    sublabel: str | None = Field(default=None, max_length=32, description="Supporting detail, e.g. 'per 10-second video'")
    color:    Literal["green", "cyan", "yellow", "red", "white"] = "white"
    glow:     bool = False


class TriStatUIContent(BaseModel):
    """2-3 key numbers stacked as cards — for topics with distinct metrics."""
    layout:        Literal["TriStat"]
    section_label: str = Field(max_length=24)
    stats:         list[TriStatItem] = Field(min_length=2, max_length=3)
    accent_color:  Literal["green", "cyan", "yellow"] = "cyan"


class LeaderboardItem(BaseModel):
    """One row in a LeaderboardRank beat."""
    rank:      int  = Field(ge=1, le=10)
    name:      str  = Field(max_length=24, description="Model or item name")
    score:     str  = Field(max_length=10, description="Benchmark result, e.g. '86.9%'")
    highlight: bool = Field(default=False, description="Accent this row — use for the notable result, not necessarily rank 1")


class LeaderboardUIContent(BaseModel):
    """Ordered ranking table — for benchmark comparisons and model rankings."""
    layout:        Literal["LeaderboardRank"]
    section_label: str = Field(max_length=24)
    metric_label:  str = Field(max_length=20, description="What's being ranked, e.g. 'GPQA Diamond' or 'tok/s'")
    items:         list[LeaderboardItem] = Field(min_length=2, max_length=6)
    accent_color:  Literal["green", "cyan", "yellow"] = "cyan"


class BarItem(BaseModel):
    """One bar in a BarComparison beat."""
    label:     str       = Field(max_length=24, description="Item name")
    value:     str       = Field(max_length=10, description="Numeric string ONLY — no units here, e.g. '382' not '382 tok/s'")
    unit:      str | None = Field(default=None, max_length=8, description="Unit label, e.g. 'tok/s' or '%'")
    highlight: bool = Field(default=False, description="Accent the standout bar")


class BarComparisonUIContent(BaseModel):
    """Horizontal bar chart — use when the SIZE of the gap between values is the story."""
    layout:        Literal["BarComparison"]
    section_label: str = Field(max_length=24)
    items:         list[BarItem] = Field(min_length=2, max_length=5)
    accent_color:  Literal["green", "cyan", "yellow"] = "cyan"


class CodeBlock(BaseModel):
    """One code block (before or after)."""
    label: str       = Field(max_length=10, description="e.g. 'BEFORE' or 'AFTER'")
    lines: list[str] = Field(min_length=1, max_length=6, description="Code lines ≤ 50 chars each — simplified for visual impact")


class CodeDiffUIContent(BaseModel):
    """Before/after code comparison — for drop-in replacements, API migrations, single-line fixes."""
    layout:        Literal["CodeDiff"]
    section_label: str = Field(max_length=24)
    before:        CodeBlock
    after:         CodeBlock
    accent_color:  Literal["green", "cyan", "yellow"] = "green"


# Discriminated union — Pydantic narrows automatically on `layout` field
UIContent = Annotated[
    Union[MetricUIContent, ComparisonUIContent, PipelineUIContent,
          TimelineUIContent, TriStatUIContent,
          LeaderboardUIContent, BarComparisonUIContent, CodeDiffUIContent],
    Field(discriminator="layout"),
]


# ── Narration schema ──────────────────────────────────────────────────────────

class NarrationScript(BaseModel):
    """
    Four spoken blocks — total MUST land between 50 and 60 words.

    Timing targets (Aoede TTS at ~1.4 wps with natural pauses):
        hook     →  5-7 s  ≈  7-10 words
        context  →  7-9 s  ≈  10-13 words
        insight  →  9-12 s ≈  13-17 words
        takeaway →  5-7 s  ≈  7-10 words
    """
    hook: str = Field(
        description=(
            "Stop-scroll in 3 seconds. ≤ 10 words. "
            "ONE fragment OR one short sentence — fragments are allowed and encouraged here. "
            "GOOD: '$49 per month. Gone.' "
            "GOOD: '119B parameters. Only 6B fire.' "
            "GOOD: 'Google just broke a 56-year math record.' "
            "BAD: 'Have you ever wondered why your GPU memory is wasted even though...' "
            "ONE concrete number minimum. No adjectives. No 'Imagine', no 'What if'."
        ),
    )
    context: str = Field(
        description=(
            "Name the exact mechanism — the variable, layer, or operation causing it. "
            "No analogies. No 'basically'. ≤ 14 words."
        ),
    )
    insight: str = Field(
        description=(
            "The non-obvious implication — what specifically changes for builders. "
            "GOOD: 'Set MALLOC_ARENA_MAX=2. RSS drops 40%. No code change required.' "
            "Mix one short sentence with one medium sentence. ≤ 18 words."
        ),
    )
    takeaway: str = Field(
        description=(
            "≤ 10 words. The save-trigger line. Rotate CTA — use ONE of these three patterns: "
            "1. Repo CTA: '[repo name]. Pull it. Run it.' "
            "2. Share trigger: 'Send this to the guy still paying twenty a month.' "
            "3. Hard cut (no CTA): end on the sharpest number or fact — forces rewatch. "
            "NEVER use the same pattern twice in a row. Actionable line always. No questions alone."
        ),
    )
    statement_lines: list[str] = Field(
        description=(
            "2-3 punchy display lines for the StatementSlam beat_3 visual. "
            "Each line ≤ 35 chars — must fit on one screen line at 80px bold. "
            "Line 0: the sharpest number or verdict — the line an engineer would screenshot. "
            "Line 1: the mechanism or condition in one fragment. "
            "Line 2 (optional): the implication or rule. "
            "These three lines together should work as a reference card — "
            "someone should be able to save the screenshot and remember the lesson. "
            "GOOD: ['MALLOC_ARENA_MAX=2', 'Default is 8. Cut it.', '40% RSS. No code change.'] "
            "GOOD: ['56-year record. Broken.', 'AI rewrote the algorithm.', 'Verifiable = evolvable.'] "
            "BAD: ['This is very impressive', 'Major breakthrough achieved', 'Changes everything']"
        ),
        min_length=2,
        max_length=3,
    )
    hashtags: list[str] = Field(
        description=(
            "4-6 topic-specific hashtags for Instagram/YouTube Shorts. "
            "Include the exact technology name, the domain, and 1-2 broader reach tags. "
            "Each tag starts with #. No spaces inside tags. "
            "Example for Flash Attention: ['#FlashAttention', '#TransformerOptimization', "
            "'#MLSystems', '#PyTorch', '#DeepLearning', '#AI']. "
            "Do NOT use generic tags like #MachineLearning or #MLOps unless they are "
            "genuinely the most specific fit for this specific topic."
        ),
        min_length=4,
        max_length=6,
    )

    @model_validator(mode="after")
    def enforce_word_budget(self) -> "NarrationScript":
        # Skip when --narration override is active — LLM-generated script is replaced anyway
        if os.environ.get("NARRATION_OVERRIDE") == "1":
            return self
        full = f"{self.hook} {self.context} {self.insight} {self.takeaway}"
        total = len(full.split())
        if not (50 <= total <= 60):
            raise ValueError(
                f"Total narration is {total} words — must be 50-60. "
                f"Adjust sections: hook={len(self.hook.split())}, "
                f"context={len(self.context.split())}, "
                f"insight={len(self.insight.split())}, "
                f"takeaway={len(self.takeaway.split())}."
            )
        return self


# ── Cue definitions ───────────────────────────────────────────────────────────

class CueDefinition(BaseModel):
    """
    Intent-based animation trigger aligned to a word in the narration.

    Convention for `label` — use verb_noun:
        metric_reveal, split_enter, bottleneck_show, insight_drop, takeaway_flash
    """
    label:         str = Field(
        pattern=r"^[a-z][a-z0-9_]{2,29}$",
        description="Snake-case intent label, e.g. 'metric_reveal'",
    )
    trigger_word:  str = Field(
        min_length=3,
        description="Exact word in the narration that fires this cue",
    )
    occurrence:    int = Field(
        default=0,
        ge=-1,
        description="0 = first match, 1 = second, -1 = last match in narration",
    )
    offset_frames: int = Field(
        default=0,
        ge=-30, le=30,
        description="Frame offset from trigger word onset. Negative = anticipate.",
    )


# ── Root payload ──────────────────────────────────────────────────────────────

class VideoPayload(BaseModel):
    """
    Complete structured payload for one short-form AI explainer video.

    layout_mode selects the Remotion layout component for concept beats.
    ui_content is auto-narrowed by Pydantic to the matching sub-type.
    """
    layout_mode:     LayoutMode
    ui_content:      UIContent
    narration:       NarrationScript
    cue_definitions: list[CueDefinition] = Field(
        min_length=2, max_length=5,
        description="2-5 cues aligned to meaningful moments in the narration",
    )

    @model_validator(mode="after")
    def layout_content_agreement(self) -> "VideoPayload":
        """layout_mode and ui_content.layout must refer to the same template."""
        mapping = {
            LayoutMode.METRIC:       "MetricFocus",
            LayoutMode.COMPARISON:   "ComparisonSplit",
            LayoutMode.PIPELINE:     "PipelineFlow",
            LayoutMode.TIMELINE:     "TimelineFlow",
            LayoutMode.TRISTAT:      "TriStat",
            LayoutMode.LEADERBOARD:  "LeaderboardRank",
            LayoutMode.BAR:          "BarComparison",
            LayoutMode.CODEDIFF:     "CodeDiff",
        }
        expected = mapping[self.layout_mode]
        actual   = self.ui_content.layout
        if actual != expected:
            raise ValueError(
                f"layout_mode='{self.layout_mode}' expects ui_content.layout='{expected}' "
                f"but got '{actual}'."
            )
        return self


# ══════════════════════════════════════════════════════════════════════════════
# § 2  SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = textwrap.dedent("""
    You are writing a 60-second AI explainer for Instagram Reels / YouTube Shorts.
    Your audience: anyone technically curious — from a Python developer who has never touched ML
    to a seasoned data scientist who wants a sharp refresher. Write so both can follow.
    The non-expert must understand the WHAT. The expert must feel the WHY is worth their time.

    ═══════════════════════════════════════════════════════
     VOICE  —  TL;DR to a smart colleague, not a lecture
    ═══════════════════════════════════════════════════════
    • Speak like you're at a whiteboard after a postmortem, not presenting at a conference.
    • Staccato, declarative sentences. Short. Punchy. One idea per sentence.
    • You may use one medium-length sentence per block for rhythm — not more.
    • Contractions only: "it's", "that's", "you're", "doesn't". No formal conjugations.

    ═══════════════════════════════════════════════════════
     WORD BUDGET  —  HARD LIMIT, NO EXCEPTIONS
    ═══════════════════════════════════════════════════════
    Total narration (hook + context + insight + takeaway): 50-60 words.
    • hook:     ≤ 10 words  (fragment allowed — "$49/month. Gone." is valid)
    • context:  ≤ 14 words
    • insight:  ≤ 18 words
    • takeaway: ≤ 10 words

    Count every word. If you are over, cut adverbs first, then adjectives, then clauses.
    Never pad to hit a minimum — dead words are worse than being 2 words short.

    ═══════════════════════════════════════════════════════
     TONE VARIANCE  —  ROTATE, DO NOT REPEAT
    ═══════════════════════════════════════════════════════
    2 out of 3 videos: calm + measured (default Aoede delivery).
    1 out of 3 videos: deadpan + dry. No hype. Understate the drama.
    GOOD (deadpan): "Meta spent 2 billion dollars. A teenager on GitHub did it for free."
    This is set via --tone in the run command. The SYSTEM_PROMPT applies to both.

    ═══════════════════════════════════════════════════════
     THE 10-SECOND RULE  —  EVERY BLOCK MUST ADVANCE
    ═══════════════════════════════════════════════════════
    Hook     → surface the broken assumption or surprising metric (the "wait, what?")
    Context  → name the exact mechanism — the variable, layer, operation, or line of code
    Insight  → state the non-obvious implication — what changes for how engineers build
    Takeaway → one sharp reframe + a provocation that leaves them thinking

    If a block does NOT advance the concept, DELETE it. There is no "warm up" section.
    The viewer's attention is a debt that must be repaid every 10 seconds.

    ═══════════════════════════════════════════════════════
     BANNED PHRASES  —  INSTANT REJECT IF ANY APPEAR
    ═══════════════════════════════════════════════════════
    "Imagine"                   "What if I told you"
    "Have you ever"             "Let's dive in"
    "In this video"             "Today we're going to"
    "At its core"               "Essentially"
    "Basically"                 "Kind of"
    "In a nutshell"             "The bottom line is"
    "In conclusion"             "As we can see"
    "It's worth noting"         "Interestingly"
    "Needless to say"           "Simply put"
    "This changes everything"   "Game changer"
    "Revolutionary"             "Groundbreaking"
    "Incredibly"                "Mind-blowing"
    "Massive" (use the number)  "Huge" (use the number)
    "Next level"                "Powerful" (unless quoting a benchmark)

    ═══════════════════════════════════════════════════════
     ON-SCREEN TEXT RULES  (ui_content field)
    ═══════════════════════════════════════════════════════
    • section_label: ALL CAPS, ≤ 24 chars, describes the visual frame not the topic.
      GOOD: "THE BOTTLENECK" / "BEFORE vs AFTER" / "THE FIX"
      BAD:  "TurboQuant Algorithm" / "Memory Optimization"

    • MetricFocus context: TWO short sentences separated by ONE space. No line breaks.
      React renders this verbatim — spaces matter.

    • MetricFocus chips: 2-3 tags ≤ 16 chars. These are environment or context tags,
      not summaries: ["M5 Max", "llama.cpp", "32K ctx"] not ["Faster", "Better", "Cheaper"].

    • MetricFocus supporting_metrics: 1-3 real data points from the topic summary shown
      in a grid below the hero. label ≤ 8 chars, value ≤ 8 chars.
      GOOD: [{"label":"before","value":"14 ms"},{"label":"after","value":"8 ms"}]
      BAD:  leave empty or invent numbers not in the summary.

    • ComparisonSplit metrics: 2-4 items per panel. label ≤ 8 chars, value ≤ 8 chars.
      Use real numbers from the topic summary. Never invent benchmarks.
      IMPORTANT: each panel must have ≥ 2 metrics. If each side only has 1 number,
      use "bar" instead of "comparison".

    • PipelineFlow steps: 3-5 nodes. Exactly ONE step should have state="bottleneck".
      bottleneck_label annotates it with the cost, e.g. "40 % decode time".

    • TimelineFlow items: 3-5 milestones in chronological order. Mark exactly ONE as
      highlight=true (the key inflection point). value is an optional short metric, e.g. "3.3M".
      Only use dates/events present in the topic summary.

    • TriStat stats: 2-3 cards. Card 0 is the primary stat — set glow=true and choose
      the most impactful color (red for alarming, cyan for neutral, green for positive).
      sublabel should add one line of context, e.g. "per 10-second video".
      Only use numbers from the topic summary.

    • LeaderboardRank items: 2-6 rows in rank order (rank 1 first). Mark exactly ONE as
      highlight=true — the noteworthy result (not necessarily rank 1). metric_label names
      the benchmark, e.g. "GPQA Diamond" or "throughput (tok/s)".

    • BarComparison items: 2-5 bars. value MUST be a numeric string only (e.g. "382" not
      "382 tok/s" — put the unit in the separate unit field). Highlight the standout bar.
      Items are rendered top-to-bottom in the order provided.

    • CodeDiff before/after: lines ≤ 50 chars each. Max 5 lines before, max 3 lines after.
      Write realistic but simplified code — this is visual impact, not a tutorial.
      before.label = "BEFORE", after.label = "AFTER" (or the actual API/function name).

    • statement_lines (narration field): 2-3 punchy fragments for the insight visual.
      Each line ≤ 35 chars. Line 0 is the sharpest — make it the number or verdict.
      GOOD: ["$130 compute cost.", "$8 in revenue.", "Math doesn't close."]
      BAD:  ["This is a structural problem with no fix", "very expensive"]

    ═══════════════════════════════════════════════════════
     CUE DEFINITIONS  (animation sync)
    ═══════════════════════════════════════════════════════
    Provide 2-5 cues. Each cue fires an animation when a specific word is spoken.
    • label: snake_case intent verb, e.g. "metric_reveal", "bottleneck_show", "split_enter"
    • trigger_word: a content word (noun/verb) from the NARRATION, not a function word
    • occurrence: 0=first match, -1=last match in narration audio
    • offset_frames: use negative to anticipate (-8 to -12 typical), 0 for simultaneous

    The cue for the main visual reveal should use offset_frames: -12 to lead by ~0.4s.
""").strip()


# ══════════════════════════════════════════════════════════════════════════════
# § 3  ORCHESTRATION
# ══════════════════════════════════════════════════════════════════════════════

_LAYOUT_HISTORY_PATH = os.path.join(_ROOT, "output", "layout_history.json")


def _load_last_layout() -> str | None:
    if not os.path.exists(_LAYOUT_HISTORY_PATH):
        return None
    try:
        with open(_LAYOUT_HISTORY_PATH) as f:
            return json.load(f).get("last_layout")
    except Exception:
        return None


def _save_last_layout(layout: str):
    os.makedirs(os.path.dirname(_LAYOUT_HISTORY_PATH), exist_ok=True)
    with open(_LAYOUT_HISTORY_PATH, "w") as f:
        json.dump({"last_layout": layout}, f)


def _user_prompt(topic: dict) -> str:
    """Build the per-run user message from the scraped topic."""
    last_layout = _load_last_layout()
    rotation_hint = (
        f"\n        LAYOUT ROTATION — do NOT use '{last_layout}' again. "
        f"The previous video used it. Pick a different layout_mode.\n"
        if last_layout else ""
    )
    return textwrap.dedent(f"""
        TOPIC:   {topic["title"]}
        SUMMARY: {topic.get("summary", "").strip()}
        {rotation_hint}
        Generate a VideoPayload JSON for this topic.
        Choose the layout_mode that best fits the content — pick the MOST SPECIFIC match:

          - "metric"      → one hero number defines the insight (e.g. "40% overhead")
          - "comparison"  → TWO systems each described by 2-4 DIFFERENT metrics per side.
                            ONLY use when BOTH sides have multiple distinct data points.
                            Do NOT use for single-metric comparisons (use "bar" instead).
          - "pipeline"    → a process with 3-5 named sequential stages and one bottleneck
          - "timeline"    → a chronological narrative arc (3-5 dated milestones with metrics)
          - "tristat"     → 2-3 fundamentally DIFFERENT measurements about ONE system
                            (e.g. total params + active params + price — not comparable, but all important)
          - "leaderboard" → ranked table of 3-6 models/items scored on ONE benchmark
          - "bar"         → 2-5 items compared on ONE numeric metric where the bar gap IS the story.
                            Use "bar" instead of "comparison" when each item has only one number.
          - "codediff"    → before/after code for drop-in replacements or API migrations

        DECISION GUIDE:
          Single number per item, magnitude matters → "bar"
          Multiple numbers per item, two sides → "comparison"
          Different kinds of numbers about same thing → "tristat"
          Ranked benchmark table → "leaderboard"
          Dated milestones → "timeline"
          Named stages with bottleneck → "pipeline"

        Only use numbers that appear in the SUMMARY above.
        Do NOT invent benchmarks, latency figures, or accuracy numbers.
    """).strip()


def generate(topic: dict, max_retries: int = 3) -> VideoPayload:
    """
    Call OpenAI and return a validated VideoPayload.
    """
    return _generate_openai(topic, max_retries)


def _slug_word(text: str, fallback: str) -> str:
    import re

    words = re.findall(r"[A-Za-z0-9]+", text.lower())
    for word in words:
        if len(word) >= 3:
            return word[:20]
    return fallback


def _default_hashtags(topic: dict) -> list[str]:
    import re

    title_words = re.findall(r"[A-Za-z0-9]+", topic.get("title", ""))
    tags = [f"#{w[:18]}" for w in title_words[:3] if w]
    tags.extend(["#OpenAI", "#API", "#TextToSpeech", "#AI"])
    seen: set[str] = set()
    result: list[str] = []
    for tag in tags:
        if tag.lower() not in seen:
            seen.add(tag.lower())
            result.append(tag)
    return result[:6]


def _default_chips(topic: dict) -> list[str]:
    import re

    chips = [w[:16] for w in re.findall(r"[A-Za-z0-9]+", topic.get("title", ""))[:3]]
    chips.extend(["OpenAI", "text", "audio"])
    deduped: list[str] = []
    for chip in chips:
        if chip and chip not in deduped:
            deduped.append(chip)
    return deduped[:3] if len(deduped) >= 3 else (deduped + ["API", "voice"])[:3]


def _extract_number_token(*texts: str) -> str | None:
    import re

    pattern = re.compile(r"[$€£]?\d+(?:\.\d+)?(?:[%KMBkmb]|/[A-Za-z]+)?")
    for text in texts:
        if not isinstance(text, str):
            continue
        match = pattern.search(text)
        if match:
            return match.group(0)[:10]
    return None


def _trim_words(text: str, max_words: int) -> str:
    words = str(text or "").split()
    return " ".join(words[:max_words]).strip()


def _normalize_narration_dict(narration: dict | None, topic: dict) -> dict:
    narration = narration.copy() if isinstance(narration, dict) else {}
    summary = " ".join(str(topic.get("summary", "")).split())
    title = str(topic.get("title", "")).strip()

    hook = str(narration.get("hook") or "").strip()
    context = str(narration.get("context") or "").strip()
    insight = str(narration.get("insight") or "").strip()
    takeaway = str(narration.get("takeaway") or "").strip()

    hero_token = _extract_number_token(hook, summary) or "1 key"
    topic_word = _slug_word(title, "system")

    if not hook:
        hook = f"{hero_token}. One key for text and voice."
    if not context:
        context = f"One OpenAI API key now covers text generation and speech synthesis for the same app."
    if not insight:
        insight = (
            f"Same auth path, same platform, same billing surface. Builders wire narration into existing flows "
            f"without extra provider glue."
        )
    if not takeaway:
        takeaway = f"Ship {topic_word} faster. One key. Less glue."

    filler_words = (
        f"{title}. {summary} Builders keep one auth path, one platform contract, and one deployment flow "
        f"for generated text plus spoken output."
    ).split()
    if not filler_words:
        filler_words = "One key shared across text generation and speech output keeps integration smaller and deployment cleaner.".split()

    segments = {
        "hook": hook.split(),
        "context": context.split(),
        "insight": insight.split(),
        "takeaway": takeaway.split(),
    }

    total = sum(len(words) for words in segments.values())
    fill_order = ["insight", "context", "takeaway"]
    filler_index = 0
    while total < 50:
        target = fill_order[filler_index % len(fill_order)]
        if filler_index >= len(filler_words):
            filler_words.extend(["builders", "keep", "same", "platform", "path"])
        segments[target].append(filler_words[filler_index])
        filler_index += 1
        total += 1

    trim_order = ["insight", "context", "takeaway", "hook"]
    min_words = {"hook": 4, "context": 6, "insight": 8, "takeaway": 4}
    while total > 60:
        trimmed = False
        for target in trim_order:
            if len(segments[target]) > min_words[target]:
                segments[target].pop()
                total -= 1
                trimmed = True
                break
        if not trimmed:
            break

    narration["hook"] = " ".join(segments["hook"]).strip()
    narration["context"] = " ".join(segments["context"]).strip()
    narration["insight"] = " ".join(segments["insight"]).strip()
    narration["takeaway"] = " ".join(segments["takeaway"]).strip()

    if not isinstance(narration.get("statement_lines"), list) or len(narration["statement_lines"]) < 2:
        narration["statement_lines"] = [
            _trim_words(hero_token or "One key", 5)[:35],
            _trim_words(narration["context"], 6)[:35],
            _trim_words(narration["takeaway"], 6)[:35],
        ][:3]

    hashtags = narration.get("hashtags")
    if not isinstance(hashtags, list) or len(hashtags) < 4:
        narration["hashtags"] = _default_hashtags(topic)
    else:
        cleaned = []
        for tag in hashtags:
            if isinstance(tag, str) and tag.strip():
                cleaned.append(tag if tag.startswith("#") else f"#{tag}")
        narration["hashtags"] = cleaned[:6] if len(cleaned) >= 4 else _default_hashtags(topic)

    return narration


def _build_metric_fallback_payload(data: dict, topic: dict) -> dict:
    narration = _normalize_narration_dict(
        data.get("narration") if isinstance(data.get("narration"), dict) else {},
        topic,
    )

    raw_ui = data.get("ui_content")
    if not isinstance(raw_ui, dict):
        raw_ui = data.get("scene") if isinstance(data.get("scene"), dict) else {}

    hero = raw_ui.get("hero")
    hero_value = _extract_number_token(
        hero.get("value") if isinstance(hero, dict) else "",
        hero if isinstance(hero, str) else "",
        narration["hook"],
        topic.get("summary", ""),
    ) or "1 key"
    hero_label = _slug_word(
        hero.get("label") if isinstance(hero, dict) else topic.get("title", ""),
        "impact",
    )[:10]

    context = str(raw_ui.get("context") or narration["context"] or topic.get("summary", "")).strip()
    chips = raw_ui.get("chips")
    if not isinstance(chips, list) or len(chips) < 2:
        chips = _default_chips(topic)
    else:
        chips = [str(chip)[:16] for chip in chips if str(chip).strip()][:3]
        if len(chips) < 2:
            chips = _default_chips(topic)

    supporting_metrics = raw_ui.get("supporting_metrics")
    if not isinstance(supporting_metrics, list):
        supporting_metrics = []

    cue_definitions = data.get("cue_definitions")
    if not isinstance(cue_definitions, list) or len(cue_definitions) < 2:
        cue_definitions = [
            {"label": "hook_reveal", "trigger_word": _slug_word(narration["hook"], "hook"), "occurrence": 0, "offset_frames": -8},
            {"label": "takeaway_hit", "trigger_word": _slug_word(narration["takeaway"], "takeaway"), "occurrence": -1, "offset_frames": 0},
        ]

    return {
        "layout_mode": "metric",
        "ui_content": {
            "layout": "MetricFocus",
            "section_label": str(raw_ui.get("section_label") or _slug_word(topic.get("title", ""), "INSIGHT")).upper()[:24],
            "hero": {
                "value": hero_value[:10],
                "label": hero_label[:10] or "impact",
                "color": "cyan",
                "glow": True,
            },
            "context": context[:140] or "Single platform for text and voice.",
            "chips": chips[:3],
            "supporting_metrics": supporting_metrics[:3],
        },
        "narration": narration,
        "cue_definitions": cue_definitions,
    }


def _normalize_payload_data(data: dict, topic: dict) -> dict:
    if not isinstance(data, dict):
        return data

    layout_map = {
        "MetricFocus": "metric",
        "ComparisonSplit": "comparison",
        "PipelineFlow": "pipeline",
        "TimelineFlow": "timeline",
        "TriStat": "tristat",
        "LeaderboardRank": "leaderboard",
        "BarComparison": "bar",
        "CodeDiff": "codediff",
    }

    ui_content = data.get("ui_content")
    if not isinstance(ui_content, dict):
        scene = data.get("scene") or data.get("visual") or {}
        if isinstance(scene, dict):
            ui_content = scene
            data["ui_content"] = ui_content

    layout_mode = data.get("layout_mode")
    if isinstance(layout_mode, str):
        data["layout_mode"] = layout_map.get(layout_mode, layout_mode.lower())
    elif isinstance(ui_content, dict):
        layout_name = ui_content.get("layout")
        if isinstance(layout_name, str):
            data["layout_mode"] = layout_map.get(layout_name, layout_name.lower())

    if isinstance(ui_content, dict):
        if not ui_content.get("section_label"):
            ui_content["section_label"] = _slug_word(topic.get("title", ""), "INSIGHT").upper()[:24]

        hero = ui_content.get("hero")
        if isinstance(hero, str):
            ui_content["hero"] = {
                "value": hero[:10],
                "label": "metric",
                "color": "cyan",
            }
            hero = ui_content["hero"]
        elif hero is None and ui_content.get("layout") == "MetricFocus":
            ui_content["hero"] = {
                "value": _slug_word(topic.get("title", ""), "openai")[:10],
                "label": "metric",
                "color": "cyan",
            }
            hero = ui_content["hero"]
        if isinstance(hero, dict) and isinstance(hero.get("label"), str):
            hero["label"] = hero["label"][:10]
            if isinstance(hero.get("value"), str):
                hero["value"] = hero["value"][:10]

        if ui_content.get("layout") == "MetricFocus":
            narration = data.get("narration", {}) if isinstance(data.get("narration"), dict) else {}
            if not ui_content.get("context"):
                ui_content["context"] = narration.get("context") or topic.get("summary", "")[:140] or "Single platform for text and voice."
            if not isinstance(ui_content.get("chips"), list) or len(ui_content.get("chips", [])) < 2:
                ui_content["chips"] = _default_chips(topic)
            if not isinstance(ui_content.get("supporting_metrics"), list):
                ui_content["supporting_metrics"] = []

        for side in ("left", "right"):
            panel = ui_content.get(side)
            if isinstance(panel, dict) and isinstance(panel.get("heading"), str):
                panel["heading"] = panel["heading"][:16]
            if isinstance(panel, dict):
                for metric in panel.get("metrics", []) or []:
                    if isinstance(metric, dict):
                        if isinstance(metric.get("label"), str):
                            metric["label"] = metric["label"][:10]
                        if isinstance(metric.get("value"), str):
                            metric["value"] = metric["value"][:10]

    narration = data.get("narration")
    if isinstance(narration, dict):
        if not isinstance(narration.get("statement_lines"), list) or len(narration.get("statement_lines", [])) < 2:
            insight = narration.get("insight", "").strip()
            takeaway = narration.get("takeaway", "").strip()
            line1 = insight[:35] or "One API key."
            line2 = takeaway[:35] or "Text and voice."
            narration["statement_lines"] = [line1, line2][:3]
        hashtags = narration.get("hashtags")
        if not isinstance(hashtags, list) or len(hashtags) < 4:
            narration["hashtags"] = _default_hashtags(topic)

    cues = data.get("cue_definitions")
    if not isinstance(cues, list):
        cues = data.get("cues")
    if not isinstance(cues, list) or len(cues) < 2:
        narration = data.get("narration", {}) if isinstance(data.get("narration"), dict) else {}
        hook_word = _slug_word(narration.get("hook", ""), "hook")
        take_word = _slug_word(narration.get("takeaway", ""), "takeaway")
        data["cue_definitions"] = [
            {"label": "hook_reveal", "trigger_word": hook_word, "occurrence": 0, "offset_frames": -8},
            {"label": "takeaway_hit", "trigger_word": take_word, "occurrence": -1, "offset_frames": 0},
        ]
    else:
        data["cue_definitions"] = cues

    return data


def _extract_openai_json(data: dict) -> str:
    texts: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if text:
                texts.append(text)
    if not texts:
        raise RuntimeError(f"OpenAI response did not contain output text: {json.dumps(data)[:1000]}")
    return "\n".join(texts).strip()


def _call_openai_payload(prompt: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set.")

    model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4.1-mini")
    body = {
        "model": model,
        "input": prompt,
        "max_output_tokens": 3000,
    }

    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=180,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"OpenAI HTTP {response.status_code}: {response.text[:1000]}")

    payload = response.json()
    if payload.get("status") == "incomplete":
        raise RuntimeError(f"OpenAI response incomplete: {json.dumps(payload)[:1200]}")

    return _extract_openai_json(payload)


def _generate_openai(topic: dict, max_retries: int) -> VideoPayload:
    import re

    model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5")
    print(f"[content_generator] OpenAI  model={model}  max_retries={max_retries}")

    base_prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{_user_prompt(topic)}\n\n"
        "CRITICAL VALIDATION RULES:\n"
        "- layout_mode must be one of: metric, comparison, pipeline, timeline, tristat, leaderboard, bar, codediff\n"
        "- ui_content.layout must use Remotion layout names like MetricFocus or ComparisonSplit\n"
        "- Keep all short labels inside their max lengths\n"
        "- Total narration word count must be 50-60 words\n"
        "- Return JSON only\n"
    )

    last_err: Exception | None = None
    retry_feedback = ""
    for attempt in range(1, max_retries + 1):
        try:
            raw = _call_openai_payload(base_prompt + retry_feedback)

            # Strip markdown fences if present
            if "```" in raw:
                for part in raw.split("```"):
                    part = part.strip()
                    if part.startswith("json"):
                        part = part[4:].strip()
                    if part.startswith("{"):
                        raw = part
                        break

            start, end = raw.find("{"), raw.rfind("}") + 1
            if start != -1 and end > start:
                raw = raw[start:end]
            raw = re.sub(r",\s*([\]}])", r"\1", raw)   # repair trailing commas

            data = _normalize_payload_data(json.loads(raw), topic)
            try:
                payload = VideoPayload.model_validate(data)
            except ValidationError as err:
                print("[content_generator] partial payload detected, synthesizing safe fallback.")
                payload = VideoPayload.model_validate(_build_metric_fallback_payload(data, topic))
            print(f"[content_generator] OpenAI  attempt={attempt}  ✓")
            return payload

        except Exception as e:
            last_err = e
            print(f"[content_generator] attempt {attempt}/{max_retries} failed: {e}")
            retry_feedback = (
                "\n\nPREVIOUS OUTPUT FAILED VALIDATION. FIX THESE EXACT ISSUES AND RETURN A FULL NEW JSON OBJECT:\n"
                f"{str(e)}\n"
            )

    raise RuntimeError(
        f"content_generator failed after {max_retries} attempts. "
        f"Last error: {last_err}"
    )
# ══════════════════════════════════════════════════════════════════════════════
# § 4  PIPELINE OUTPUT SERIALISATION
#     Converts VideoPayload → the 4 files that downstream stages expect
# ══════════════════════════════════════════════════════════════════════════════

_LAYOUT_TO_ANIMATE_IN = {
    "MetricFocus":     "spring_scale",
    "ComparisonSplit": "spring_in",
    "PipelineFlow":    "slide_up",
    "TimelineFlow":    "slide_up",
    "TriStat":         "spring_in",
    "LeaderboardRank": "slide_up",
    "BarComparison":   "spring_in",
    "CodeDiff":        "fade",
}

_LAYOUT_TO_TEMPLATE = {
    "MetricFocus":     "stats_grid",
    "ComparisonSplit": "comparison",
    "PipelineFlow":    "pipeline",
    "TimelineFlow":    "pipeline",
    "TriStat":         "stats_grid",
    "LeaderboardRank": "comparison",
    "BarComparison":   "stats_grid",
    "CodeDiff":        "pipeline",
}


def _build_script_json(payload: VideoPayload, topic: dict) -> dict:
    """
    Produce script.json in the active pipeline format.
    narrator.py reads this to count bullets and for the visual hook text.
    """
    ui = payload.ui_content

    # Hook visual: pull the hero value if MetricFocus, else section_label
    if isinstance(ui, MetricUIContent):
        hook_visual = f"{ui.hero.value} {ui.hero.label}. {ui.context}"
    elif isinstance(ui, ComparisonUIContent):
        hook_visual = f"{ui.left.heading} vs {ui.right.heading}. {ui.section_label}."
    elif isinstance(ui, PipelineUIContent):
        hook_visual = f"{ui.section_label}. {ui.steps[0].label} → … → {ui.steps[-1].label}."
    elif isinstance(ui, TimelineUIContent):
        hook_visual = f"{ui.section_label}. {' → '.join(item.label for item in ui.items[:3])}."
    elif isinstance(ui, TriStatUIContent):
        hook_visual = f"{ui.stats[0].value} {ui.stats[0].label}. {ui.section_label}."
    elif isinstance(ui, LeaderboardUIContent):
        hl = next((item for item in ui.items if item.highlight), ui.items[0])
        hook_visual = f"#{hl.rank} {hl.name}: {hl.score}. {ui.metric_label}."
    elif isinstance(ui, BarComparisonUIContent):
        hl = next((item for item in ui.items if item.highlight), ui.items[0])
        hook_visual = f"{hl.value}{' ' + hl.unit if hl.unit else ''} — {hl.label}. {ui.section_label}."
    elif isinstance(ui, CodeDiffUIContent):
        hook_visual = f"{ui.section_label}. {len(ui.before.lines)} lines → {len(ui.after.lines)}."
    else:
        hook_visual = ui.section_label

    # Map narration blocks → concept_bullets for narrator.py's bullet counter
    concept_bullets = [
        payload.narration.context,
        payload.narration.insight,
    ]

    return {
        "hook":            payload.narration.hook,
        "concept_bullets": concept_bullets,
        "takeaway":        payload.narration.takeaway,
        "hook_visual":     hook_visual,  # extra field — narrator.py ignores unknown keys
        "cta":             "",
        "caption": (
            f"{topic['title']}. "
            f"{payload.narration.hook} "
            f"{payload.narration.takeaway}"
        )[:280],
        "hashtags": payload.narration.hashtags,
    }


def _build_spoken_narration(payload: VideoPayload) -> dict:
    """
    Produce spoken_narration.json with keys narrator.py uses for TTS.
    Bypasses narrator.py's LLM-rewrite step entirely.
    """
    return {
        "hook":         payload.narration.hook,
        "concept_1":    payload.narration.context,
        "concept_2":    payload.narration.insight,
        "takeaway_cta": payload.narration.takeaway,
    }


def _build_params_json(payload: VideoPayload) -> dict:
    """
    Produce params.json: { beat_N: ScenePayload } for Remotion's SceneRouter.

    Beat structure (always 4 beats for this 4-segment narration design):
        beat_1: MetricFocus    ← hook — hero number teaser (always)
        beat_2: <layout_mode>  ← main concept visual (Comparison/Pipeline/Timeline/TriStat/DataGrid)
        beat_3: StatementSlam  ← 2-3 punchy insight lines — never a duplicate of beat_2
        beat_4: TakeawayScene  ← outro
    """
    ui   = payload.ui_content
    data = ui.model_dump()
    anim = _LAYOUT_TO_ANIMATE_IN.get(ui.layout, "spring_in")

    hook_section = ui.section_label

    # beat_1: always MetricFocus — the hook number, sourced from real UI content.
    # beat_2: DataGrid (MetricFocus) or the LLM layout (Comparison/Pipeline).
    #         beat_2 is always visually distinct from beat_1.
    if isinstance(ui, MetricUIContent):
        hook_data = data.copy()
        # beat_2: DataGrid — hero metric + any supporting_metrics the LLM provided
        hero_card = {
            "label": ui.hero.label[:8],
            "value": ui.hero.value[:8],
            "color": ui.hero.color,
            "glow":  True,
        }
        support_cards = [
            {"label": m.label[:8], "value": m.value[:8], "color": m.color, "glow": m.glow}
            for m in ui.supporting_metrics
        ]
        beat2_metrics = [hero_card] + support_cards
        # Guarantee at least 2 cards so the grid isn't a single orphan cell
        if len(beat2_metrics) == 1 and ui.chips:
            beat2_metrics.append({"label": "on", "value": ui.chips[0][:8], "color": "white", "glow": False})
        beat2_data = {
            "layout":          "DataGrid",
            "section_label":   hook_section,
            "metrics":         beat2_metrics,
            "highlight_index": 0,
            "caption":         ui.context[:80] if ui.context else "",
        }
    elif isinstance(ui, ComparisonUIContent):
        # beat_1: pull the most salient metric from the comparison panels as hero
        # prefer the panel that represents the "better" outcome (green/cyan)
        best = ui.right if ui.right.color in ("green", "cyan") else ui.left
        hero_m = best.metrics[0]
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": hero_m.value[:8], "label": hero_m.label[:8], "color": best.color},
            "context":       payload.narration.hook,
            "chips":         [ui.left.heading[:16], ui.right.heading[:16]],
        }
        beat2_data = data
    elif isinstance(ui, PipelineUIContent):
        # beat_1: use bottleneck sublabel as hero (if present), else step count
        bottleneck = next((s for s in ui.steps if s.state == "bottleneck"), None)
        hero_value = (bottleneck.sublabel[:8] if bottleneck and bottleneck.sublabel
                      else f"{len(ui.steps)} steps")
        hero_label = bottleneck.label[:8] if bottleneck else "pipeline"
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": hero_value, "label": hero_label,
                              "color": "red" if bottleneck else "cyan"},
            "context":       payload.narration.hook,
            "chips":         [s.label[:16] for s in ui.steps[:3]],
        }
        beat2_data = data
    elif isinstance(ui, TimelineUIContent):
        # beat_1: use highlighted milestone (or last) as hero
        highlighted = next((item for item in ui.items if item.highlight), ui.items[-1])
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": highlighted.value or highlighted.date[:8],
                              "label": highlighted.label[:8], "color": "cyan"},
            "context":       payload.narration.hook,
            "chips":         [item.label[:16] for item in ui.items[:3]],
        }
        beat2_data = data
    elif isinstance(ui, TriStatUIContent):
        # beat_1: use primary stat as hero
        first = ui.stats[0]
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": first.value, "label": first.label[:8], "color": first.color},
            "context":       payload.narration.hook,
            "chips":         [s.label[:16] for s in ui.stats],
        }
        beat2_data = data
    elif isinstance(ui, LeaderboardUIContent):
        # beat_1: highlighted item's score as hero
        hl = next((item for item in ui.items if item.highlight), ui.items[0])
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": hl.score, "label": f"#{hl.rank} rank", "color": "cyan"},
            "context":       payload.narration.hook,
            "chips":         [item.name[:16] for item in ui.items[:3]],
        }
        beat2_data = data
    elif isinstance(ui, BarComparisonUIContent):
        # beat_1: highlighted bar value as hero
        hl = next((item for item in ui.items if item.highlight), ui.items[0])
        hero_val = f"{hl.value}{hl.unit or ''}"
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": hero_val[:8], "label": hl.label[:8], "color": "cyan"},
            "context":       payload.narration.hook,
            "chips":         [item.label[:16] for item in ui.items[:3]],
        }
        beat2_data = data
    elif isinstance(ui, CodeDiffUIContent):
        # beat_1: line count reduction as hero
        before_n = len(ui.before.lines)
        after_n  = len(ui.after.lines)
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": f"{before_n}→{after_n}", "label": "lines", "color": "green"},
            "context":       payload.narration.hook,
            "chips":         [ui.before.label[:16], ui.after.label[:16]],
        }
        beat2_data = data
    else:
        hook_data = {
            "layout":        "MetricFocus",
            "section_label": hook_section,
            "hero":          {"value": "—", "label": ui.section_label[:10], "color": "cyan"},
            "context":       payload.narration.hook,
            "chips":         [ui.section_label[:16]],
        }
        beat2_data = data

    # TakeawayScene headline: first complete sentence, ≤ 16 words, no ellipsis.
    headline = payload.narration.takeaway
    if "." in headline:
        first_sentence = headline.split(".")[0].strip()
        if 4 <= len(first_sentence.split()) <= 18:
            headline = first_sentence
    words = headline.split()
    if len(words) > 16:
        headline = " ".join(words[:16])

    return {
        "beat_1": {
            "animate_in": "spring_scale",
            "data": hook_data,
        },
        "beat_2": {
            "animate_in": "spring_in",
            "data": beat2_data,
        },
        "beat_3": {
            "animate_in": "fade",
            "data": {
                "layout":        "StatementSlam",
                "section_label": hook_section,
                "lines":         payload.narration.statement_lines,
                "accent_color":  "cyan",
            },
        },
        "beat_4": {
            "animate_in": "none",
            "data": {
                "layout":        "TakeawayScene",
                "section_label": "TAKEAWAY",
                "headline":      headline,
                "accent_color":  "cyan",
            },
        },
    }


def _build_scene_plan() -> dict:
    """
    Produce scene_plan.json matching the 4-beat structure above.
    animator.py reads this for beat templates and the beat list.
    """
    return {
        "beats": [
            {"beat": 1, "template": "hook"},
            {"beat": 2, "template": "stats_grid"},
            {"beat": 3, "template": "bridge"},
            {"beat": 4, "template": "takeaway"},
        ]
    }


def _build_cue_definitions(payload: VideoPayload) -> dict:
    """
    Produce cue_definitions.json from the generated cue list +
    fixed segment cues (always present).
    """
    segment_cues = [
        {"label": "hook_start",      "segment": "hook",         "offset_frames": 0},
        {"label": "concept_1_start", "segment": "concept_1",    "offset_frames": 0},
        {"label": "concept_2_start", "segment": "concept_2",    "offset_frames": 0},
        {"label": "takeaway_start",  "segment": "takeaway_cta", "offset_frames": 0},
    ]
    word_cues = [c.model_dump() for c in payload.cue_definitions]
    return {"segment_cues": segment_cues, "word_cues": word_cues}


def save_outputs(payload: VideoPayload, topic: dict) -> None:
    """Write all four pipeline files from a validated VideoPayload."""
    os.makedirs(os.path.join(_ROOT, "output"), exist_ok=True)

    script  = _build_script_json(payload, topic)
    spoken  = _build_spoken_narration(payload)
    params  = _build_params_json(payload)
    plan    = _build_scene_plan()
    cues    = _build_cue_definitions(payload)

    for path, data in [
        (SCRIPT_OUT, script),
        (SPOKEN_OUT, spoken),
        (PARAMS_OUT, params),
        (PLAN_OUT,   plan),
        (CUES_OUT,   cues),
    ]:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  ✓ {os.path.relpath(path, _ROOT)}")


# ══════════════════════════════════════════════════════════════════════════════
# § 5  NARRATOR.PY INTEGRATION PATCH
#     narrator.py checks for spoken_narration.json and skips LLM rewrite
#     when it exists. Add this block at the top of generate_segmented_script():
#
#       spoken_path = os.path.join(os.path.dirname(__file__), "..", "output", "spoken_narration.json")
#       if os.path.exists(spoken_path):
#           with open(spoken_path) as f:
#               print("[narrator] Using pre-generated spoken narration — skipping LLM rewrite.")
#               return json.load(f)
#
# ══════════════════════════════════════════════════════════════════════════════


def main():
    from dotenv import load_dotenv
    load_dotenv()

    # Accept topic on CLI or fall back to output/topic.json
    if len(sys.argv) > 2 and sys.argv[1] == "--topic":
        topic = {"title": " ".join(sys.argv[2:]), "summary": ""}
    else:
        if not os.path.exists(TOPIC_PATH):
            raise RuntimeError(f"topic.json not found at {TOPIC_PATH}. Run `python run.py --title ...` first.")
        with open(TOPIC_PATH) as f:
            topic = json.load(f)

    print(f"\n[content_generator] Topic: {topic['title']}")
    print(f"[content_generator] Provider: {os.environ.get('FORCE_PROVIDER', 'openai')}\n")

    payload = generate(topic)

    print(f"\n  layout_mode : {payload.layout_mode}")
    print(f"  narration   : {len(payload.narration.hook.split())}w hook  "
          f"/ {len(payload.narration.context.split())}w context  "
          f"/ {len(payload.narration.insight.split())}w insight  "
          f"/ {len(payload.narration.takeaway.split())}w takeaway")
    total = sum(len(s.split()) for s in [
        payload.narration.hook, payload.narration.context,
        payload.narration.insight, payload.narration.takeaway,
    ])
    print(f"  total words : {total}  (budget: 50-60)")
    print(f"  cues        : {[c.label for c in payload.cue_definitions]}")
    print()

    save_outputs(payload, topic)
    _save_last_layout(payload.ui_content.layout)
    print(f"  layout saved to rotation history: {payload.ui_content.layout}")
    print("\n✓ content_generator complete.")


if __name__ == "__main__":
    main()
