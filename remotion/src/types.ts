/**
 * types.ts — TypeScript interfaces for Motion Design v2.
 *
 * The old per-template discriminated union (HookParams, StatsGridParams, …)
 * and BeatRouter are removed in Phase 2. Layout is now fully self-describing
 * via LayoutNode trees — see MOTION_DESIGN_V2_TDD.md §PILLAR 1.
 *
 * Python contract (param_extractor.py output):
 *   params.json: { "beat_1": BeatLayout, "beat_2": BeatLayout, ... }
 */

// ── Timing ────────────────────────────────────────────────────────────────────

/** One entry from narration_timing.json */
export interface TimingEntry {
  start: number;    // seconds from video start
  duration: number; // seconds this beat plays
  end: number;      // start + duration
  text?: string;    // narration text (informational only)
}

// ── Cue map — semantic animation triggers from audio word-alignment ───────────

/**
 * Maps intent label → global frame number.
 * Built by build_cue_map() in animator.py from word_timings.json (T5).
 * Optional: components degrade gracefully when cues are absent.
 *
 * Example: { "gpu_split": 312, "metric_reveal": 489, "tp_dim": 213 }
 */
export type CueMap = Record<string, number>;

// ── Root props passed from animator.py via --props ────────────────────────────

export interface RemotionProps {
  /** Ordered beat list */
  beats: Array<{ beat: number }>;
  /**
   * v3 — ScenePayload per beat (new pipeline path, preferred).
   * Keyed "beat_1", "beat_2", …  Written by animator.py as `scenes`.
   */
  scenes?: Record<string, ScenePayload>;
  /**
   * v2 — BeatLayout / LayoutNode trees (legacy fallback).
   * VideoComposition prefers `scenes` when present.
   */
  params?: Record<string, BeatLayout>;
  /** Narration timing: keys = "hook", "concept_1", ..., "takeaway_cta" */
  timing: Record<string, TimingEntry>;
  /** Filename of audio in remotion/public/ (e.g. "narration.wav") */
  audioSrc: string;
  /** Total frames = round(totalDuration * 30) */
  totalFrames: number;
  /** Active visual theme */
  themeName?: string;
  /**
   * Semantic cue map from word-level audio alignment (T5).
   * Optional — absent before word_aligner runs.
   */
  cues?: CueMap;
}

// ── Motion Design v2 — LayoutNode types ──────────────────────────────────────

export type NodeType =
  | "column" | "row" | "grid"
  // Tier 2 primitives — devtool design system
  | "MetricCard"      // glassmorphism card: label + value + spring-in
  | "GPUNode"         // GPU tile: idle / active / bottleneck states
  | "NumberCounter"   // hero metric: huge number + scale spring
  | "SectionLabel"    // section header: accent bar + uppercase label
  // Legacy primitives — kept for fallback compatibility
  | "TerminalPrompt" | "TerminalText"
  | "StatBox" | "LabelValueCard"
  | "CodeBlock" | "Chip"
  | "Divider" | "Spacer";

export type NodeColor = "green" | "cyan" | "yellow" | "red" | "white";
export type NodeSize  = "xs" | "sm" | "md" | "lg" | "xl";
export type AnimateIn = "spring_in" | "spring_scale" | "typewriter" | "fade" | "slide_up" | "none";

export interface LayoutNode {
  type: NodeType;

  // Container props (column / row / grid only)
  gap?: number;
  justify?: "flex-start" | "center" | "flex-end" | "space-between";
  align?: "flex-start" | "center" | "flex-end";
  padding?: number;
  columns?: 2 | 3;
  children?: LayoutNode[];

  // Primitive content props
  text?: string;
  value?: string;
  label?: string;
  lines?: string[];
  highlight_line?: number;

  // Style props
  color?: NodeColor;
  border_color?: NodeColor;
  size?: NodeSize | number;  // NodeSize for TerminalText font-size; number (px) for Spacer height
  glow?: boolean;
  opacity?: number;

  // Animation props
  animate?: AnimateIn;
  delay?: number;       // frame offset for stagger (ignored when cue is set)
  cue?: string;         // T5: named cue label from cue_definitions.json; when set, animation
                        // starts when the cue fires (useCue(cue).elapsed), overriding delay
  typewriter?: boolean;
  cursor?: boolean;

  // GPUNode state (drives border/glow/opacity variant)
  state?: "idle" | "active" | "bottleneck";
}

export interface BeatLayout {
  animate_in: AnimateIn;
  layout: LayoutNode;
}

// ── Motion Design v3 — ScenePayload (replaces BeatLayout in new pipeline) ────
//
// The LLM outputs a ScenePayload per beat. SceneData is a discriminated union
// on the `layout` field — TypeScript narrows automatically in switch/if checks.
//
// Python contract (param_extractor.py v3 output):
//   params.json: { "beat_1": ScenePayload, "beat_2": ScenePayload, ... }
//   animator.py assembles_props() writes this as the `scenes` key.

export type LayoutKind =
  | "ComparisonSplit"
  | "MetricFocus"
  | "PipelineFlow"
  | "DataGrid"
  | "TakeawayScene"
  | "KineticBridge"
  | "StatementSlam"
  | "TimelineFlow"
  | "TriStat"
  | "LeaderboardRank"
  | "BarComparison"
  | "CodeDiff"
  | "TerminalScene";

export interface MetricItem {
  label:  string;         // ≤ 8 chars — renders at 60px on phone
  value:  string;         // ≤ 8 chars
  color?: NodeColor;
  glow?:  boolean;
}

export interface PipelineStep {
  label:    string;                             // node name ≤ 12 chars
  sublabel?: string;                            // e.g. "12ms" — shown below label
  state:    "idle" | "active" | "bottleneck";
}

export interface ComparisonSplitData {
  layout:        "ComparisonSplit";
  section_label: string;
  left:          { heading: string; color: NodeColor; metrics: MetricItem[] };
  right:         { heading: string; color: NodeColor; metrics: MetricItem[] };
  divider_label?: string;                       // e.g. "vs" (default)
}

export interface MetricFocusData {
  layout:        "MetricFocus";
  section_label: string;
  hero:          { value: string; label: string; color: NodeColor };
  context:       string;                        // 1–2 sentence supporting claim
  chips?:        string[];                      // 2–3 short tags
}

export interface PipelineFlowData {
  layout:           "PipelineFlow";
  section_label:    string;
  steps:            PipelineStep[];             // 3–5 nodes
  flow_direction:   "horizontal" | "vertical";
  bottleneck_label?: string;                    // annotation below bottleneck step
}

export interface DataGridData {
  layout:           "DataGrid";
  section_label:    string;
  metrics:          MetricItem[];               // 2–4 items
  highlight_index?: number;                     // card index that gets glow
  caption?:         string;
}

export interface TakeawaySceneData {
  layout:        "TakeawayScene";
  section_label: string;
  headline:      string;                        // key insight ≤ 14 words
  cta?:          string;                        // e.g. "Follow for daily ML breakdowns"
  accent_color?: "cyan" | "green" | "yellow";
}

/**
 * KineticBridgeData — legacy; kept for backward compat with old params.json.
 * New pipeline generates StatementSlam for beat_3.
 */
export interface KineticBridgeData {
  layout:        "KineticBridge";
  section_label: string;
  keywords:      string[];
  accent_color?: "cyan" | "green" | "yellow";
}

/**
 * StatementSlamData — 2-3 punchy insight lines that spring in sequentially.
 * Replaces KineticBridge for beat_3.
 */
export interface StatementSlamData {
  layout:        "StatementSlam";
  section_label: string;
  lines:         string[];                      // 2-3 lines, ≤ 35 chars each
  accent_color?: "cyan" | "green" | "yellow";
}

/** One milestone in a TimelineFlow beat. */
export interface TimelineItem {
  date:       string;   // ≤ 12 chars, e.g. "Nov 2025"
  label:      string;   // ≤ 20 chars, event name
  value?:     string;   // ≤ 10 chars, optional metric
  highlight?: boolean;  // accented milestone
}

/**
 * TimelineFlowData — chronological sequence with 3-5 milestones.
 * Use for topics with a clear narrative arc: launches, collapses, lifecycles.
 */
export interface TimelineFlowData {
  layout:        "TimelineFlow";
  section_label: string;
  items:         TimelineItem[];
  accent_color?: "cyan" | "green" | "yellow";
}

/** One stat card in a TriStat beat. */
export interface TriStatItem {
  value:     string;    // ≤ 10 chars, e.g. "$130"
  label:     string;    // ≤ 20 chars, e.g. "compute/clip"
  sublabel?: string;    // ≤ 32 chars, supporting detail
  color?:    NodeColor;
  glow?:     boolean;
}

/**
 * TriStatData — 2-3 key numbers stacked as cards.
 * Use when a topic has distinct metrics that don't fit a left-vs-right comparison.
 */
export interface TriStatData {
  layout:        "TriStat";
  section_label: string;
  stats:         TriStatItem[];                 // 2-3 items
  accent_color?: "cyan" | "green" | "yellow";
}

/** One row in a LeaderboardRank beat. */
export interface LeaderboardRankItem {
  rank:       number;
  name:       string;   // ≤ 24 chars
  score:      string;   // ≤ 10 chars, e.g. "86.9%"
  highlight?: boolean;
}

/**
 * LeaderboardRankData — ordered ranking table.
 * Items should be provided rank-order (rank 1 first).
 * Animation is reversed so the winner arrives last.
 */
export interface LeaderboardRankData {
  layout:        "LeaderboardRank";
  section_label: string;
  metric_label:  string;   // what's being ranked, e.g. "GPQA Diamond"
  items:         LeaderboardRankItem[];
  accent_color?: "cyan" | "green" | "yellow";
}

/** One bar in a BarComparison beat. */
export interface BarComparisonItem {
  label:      string;   // ≤ 24 chars
  value:      string;   // numeric string, e.g. "382"
  unit?:      string;   // ≤ 8 chars, e.g. "tok/s"
  highlight?: boolean;
}

/**
 * BarComparisonData — horizontal bar chart for N items on one metric.
 * Use when the SIZE of the gap between values is the story.
 */
export interface BarComparisonData {
  layout:        "BarComparison";
  section_label: string;
  items:         BarComparisonItem[];
  accent_color?: "cyan" | "green" | "yellow";
}

/** One code block (before or after) in a CodeDiff beat. */
export interface CodeBlock {
  label: string;    // ≤ 10 chars, e.g. "BEFORE"
  lines: string[];  // code lines, ≤ 50 chars each
}

/**
 * CodeDiffData — before/after code comparison.
 * Use for drop-in replacements, API migrations, single-line fixes.
 */
export interface CodeDiffData {
  layout:        "CodeDiff";
  section_label: string;
  before:        CodeBlock;
  after:         CodeBlock;
  accent_color?: "cyan" | "green" | "yellow";
}

/** One line in a TerminalScene beat. */
export interface TerminalLine {
  /** "command" — types in with $ prompt. "output" — fades in. "comment" — muted # line. */
  type:    "command" | "output" | "comment";
  text:    string;
  /** Optional color override for output lines. */
  color?:  "green" | "yellow" | "red" | "white";
}

/**
 * TerminalSceneData — macOS-style terminal window.
 * Use for install commands, git clone steps, CLI walkthroughs.
 */
export interface TerminalSceneData {
  layout:        "TerminalScene";
  section_label: string;
  /** Terminal window title bar text (default "bash") */
  title?:        string;
  lines:         TerminalLine[];
  accent_color?: "cyan" | "green" | "yellow";
  /** Index of the line to pulse-highlight (0-based) */
  pulse_line?:   number;
  /** Beat-local frames at which to fire the pulse on pulse_line */
  pulse_frames?: number[];
}

export type SceneData =
  | ComparisonSplitData
  | MetricFocusData
  | PipelineFlowData
  | DataGridData
  | TakeawaySceneData
  | KineticBridgeData
  | StatementSlamData
  | TimelineFlowData
  | TriStatData
  | LeaderboardRankData
  | BarComparisonData
  | CodeDiffData
  | TerminalSceneData;

export interface ScenePayload {
  animate_in: AnimateIn;
  cue?:       string;       // optional cue label from cue_definitions.json
  data:       SceneData;
}
