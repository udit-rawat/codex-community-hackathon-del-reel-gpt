/**
 * LayoutRenderer.tsx — Recursive LayoutNode renderer (Motion Design v2 — Phase 0)
 *
 * Replaces the fixed BeatRouter + individual beat files (Phase 1 will delete those).
 * Phase 0 scope: full container support + key primitives for gate test.
 *   Implemented: column, row, grid, Spacer, Divider, Chip
 *                TerminalPrompt, TerminalText, StatBox, LabelValueCard, CodeBlock
 *
 * Usage:
 *   <LayoutRenderer node={beatLayout.layout} />
 */

import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { LayoutNode, NodeColor, NodeSize } from "./types";
import { COLOR } from "./layouts/_shared";
import { useBeatFrame } from "./hooks/useBeatFrame";
import { useCue } from "./hooks/useCue";
import { slideUp, scaleIn, popIn, staggerDelay as calcStagger } from "./utils/springIn";

/**
 * useNodeFrame — resolves the effective animation frame + delay for a LayoutNode.
 *
 * Priority:
 *   1. node.cue is set AND cue has fired  → use useCue(label).elapsed, delay=0
 *   2. node.cue is set but not yet fired  → return frame=0, delay=0 (hold pre-animation)
 *   3. no cue                             → use beat-local useBeatFrame(), delay=node.delay
 *
 * Rules of Hooks: useCue is always called (unconditional), result is conditionally used.
 */
function useNodeFrame(node: LayoutNode): { frame: number; delay: number } {
  const beatFrame = useBeatFrame();
  const { elapsed, active } = useCue(node.cue ?? "");
  if (node.cue) {
    return { frame: active ? elapsed : 0, delay: 0 };
  }
  return { frame: beatFrame, delay: node.delay ?? 0 };
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const SIZE_MAP: Record<NodeSize, number> = {
  xs: 36,
  sm: 48,
  md: 64,
  lg: 90,
  xl: 120,
};

function color(c: NodeColor | undefined, fallback: NodeColor = "white"): string {
  return COLOR[c ?? fallback] ?? COLOR[fallback];
}

// ── Root dispatcher ────────────────────────────────────────────────────────────

export const LayoutRenderer: React.FC<{ node: LayoutNode }> = ({ node }) => {
  switch (node.type) {
    // Containers
    case "column":         return <ColumnNode node={node} />;
    case "row":            return <RowNode node={node} />;
    case "grid":           return <GridNode node={node} />;
    // Tier 2 — devtool design system primitives
    case "MetricCard":     return <MetricCardNode node={node} />;
    case "GPUNode":        return <GPUNodeComponent node={node} />;
    case "NumberCounter":  return <NumberCounterNode node={node} />;
    case "SectionLabel":   return <SectionLabelNode node={node} />;
    // Structural primitives
    case "Spacer":         return <SpacerNode node={node} />;
    case "Divider":        return <DividerNode node={node} />;
    case "Chip":           return <ChipNode node={node} />;
    // Legacy primitives (kept for fallback compatibility)
    case "TerminalPrompt": return <TerminalPromptNode node={node} />;
    case "TerminalText":   return <TerminalTextNode node={node} />;
    case "StatBox":        return <StatBoxNode node={node} />;
    case "LabelValueCard": return <LabelValueCardNode node={node} />;
    case "CodeBlock":      return <CodeBlockNode node={node} />;
    default:
      return null;
  }
};

// ── Containers ─────────────────────────────────────────────────────────────────

const ColumnNode: React.FC<{ node: LayoutNode }> = ({ node }) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    gap: node.gap ?? 24,
    justifyContent: node.justify ?? "flex-start",
    alignItems: node.align ?? "flex-start",
    padding: node.padding ?? 0,
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
  }}>
    {node.children?.map((child, i) => (
      <LayoutRenderer key={i} node={child} />
    ))}
  </div>
);

const RowNode: React.FC<{ node: LayoutNode }> = ({ node }) => (
  <div style={{
    display: "flex",
    flexDirection: "row",
    gap: node.gap ?? 24,
    justifyContent: node.justify ?? "flex-start",
    alignItems: node.align ?? "flex-start",
    padding: node.padding ?? 0,
    width: "100%",
    boxSizing: "border-box",
  }}>
    {node.children?.map((child, i) => (
      <LayoutRenderer key={i} node={child} />
    ))}
  </div>
);

const GridNode: React.FC<{ node: LayoutNode }> = ({ node }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: `repeat(${node.columns ?? 2}, 1fr)`,
    gap: node.gap ?? 24,
    padding: node.padding ?? 0,
    width: "100%",
    boxSizing: "border-box",
  }}>
    {node.children?.map((child, i) => (
      <LayoutRenderer key={i} node={child} />
    ))}
  </div>
);

// ── Structural primitives ──────────────────────────────────────────────────────

const SpacerNode: React.FC<{ node: LayoutNode }> = ({ node }) => (
  <div style={{
    height: typeof node.size === "number" ? node.size : 24,
    flexShrink: 0,
  }} />
);

const DividerNode: React.FC<{ node: LayoutNode }> = ({ node }) => (
  <div style={{
    width: "100%",
    height: 2,
    background: color(node.color, "white"),
    opacity: node.opacity ?? 0.25,
    flexShrink: 0,
  }} />
);

const ChipNode: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const chipColor = color(node.color, "cyan");
  return (
    <span style={{
      display: "inline-block",
      background: `${chipColor}14`,
      border: `1px solid ${chipColor}40`,
      color: chipColor,
      padding: "8px 20px",
      borderRadius: 100,
      fontSize: 30,
      fontWeight: 500,
      fontFamily: "'Inter', 'system-ui', sans-serif",
      letterSpacing: "0.06em",
    }}>
      {node.text}
    </span>
  );
};

// ── Content primitives ─────────────────────────────────────────────────────────

/** Section identifier — uppercase micro-label in indigo, no animation */
const TerminalPromptNode: React.FC<{ node: LayoutNode }> = ({ node }) => (
  <div style={{
    fontSize: 22,
    fontWeight: 500,
    color: color("cyan"),
    fontFamily: "'Inter', 'system-ui', sans-serif",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    opacity: 0.7,
    flexShrink: 0,
  }}>
    {node.text ?? "adamax.ai"}
  </div>
);

/**
 * TerminalText — typewriter reveal + optional blinking cursor.
 *   typewriter: true  → reveal chars at 1.5 chars/frame starting at `delay` frame
 *   cursor: true      → show blinking "_" after typewriter completes
 */
const TerminalTextNode: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const { frame, delay } = useNodeFrame(node);
  const text      = node.text ?? "";
  const fontSize  = typeof node.size === "number" ? node.size : SIZE_MAP[node.size ?? "md"];
  const textColor = color(node.color, "white");

  const CHARS_PER_FRAME = 1.5;

  const charsVisible = node.typewriter
    ? Math.floor(
        interpolate(
          frame,
          [delay, delay + text.length / CHARS_PER_FRAME],
          [0, text.length],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      )
    : text.length;

  const typewriterDone = charsVisible >= text.length;
  const cursorOn = node.cursor && typewriterDone && Math.floor(frame / 15) % 2 === 0;

  return (
    <div style={{
      fontSize,
      color: textColor,
      lineHeight: 1.3,
      maxWidth: "100%",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontFamily: "'Inter', 'system-ui', sans-serif",
      fontWeight: 400,
    }}>
      {text.slice(0, charsVisible)}
      {node.cursor && (
        <span style={{
          color: color("cyan"),
          opacity: cursorOn ? 1 : 0,
        }}>
          |
        </span>
      )}
    </div>
  );
};

/**
 * StatBox — hero metric display.
 * Overdamped spring scale 0.5→1.0 starting at `delay` frame.
 */
const StatBoxNode: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const { frame, delay } = useNodeFrame(node);
  const { fps } = useVideoConfig();
  const statColor         = color(node.color, "green");
  const { opacity, scale } = scaleIn(frame, fps, delay);

  return (
    <div style={{ opacity, transform: `scale(${scale})`, transformOrigin: "left center" }}>
      <div style={{
        fontSize: 240,
        fontWeight: "bold",
        color: statColor,
        lineHeight: 1,
        fontFamily: "'Inter', 'system-ui', sans-serif",
        textShadow: `0 0 60px ${statColor}30`,
      }}>
        {node.value}
      </div>
      {node.label && (
        <div style={{
          fontSize: 48,
          color: color("white"),
          opacity: 0.55,
          marginTop: 8,
          fontFamily: "'Inter', 'system-ui', sans-serif",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {node.label}
        </div>
      )}
    </div>
  );
};

/**
 * LabelValueCard — bordered card with slide-up spring animation.
 * Stagger via `delay` prop (frame offset).
 */
const LabelValueCardNode: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const { frame, delay } = useNodeFrame(node);
  const { fps } = useVideoConfig();
  const borderColor               = color(node.border_color, "cyan");
  const valueColor                = color(node.color, "cyan");
  const { opacity, translateY }   = slideUp(frame, fps, delay);

  // Glassmorphism card: semi-transparent fill + low-opacity border tinted by accent color
  const accentHex = borderColor; // e.g. "#6366F1"
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accentHex}40`,
      padding: "28px 36px",
      borderRadius: 12,
      opacity,
      transform: `translateY(${translateY}px)`,
      boxShadow: node.glow ? `0 0 24px ${accentHex}18` : undefined,
      boxSizing: "border-box",
      flex: 1,
    }}>
      <div style={{
        fontSize: 28,
        fontWeight: 500,
        color: color("white"),
        opacity: 0.45,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontFamily: "'Inter', 'system-ui', sans-serif",
        marginBottom: 8,
      }}>
        {node.label}
      </div>
      <div style={{
        fontSize: 68,
        color: valueColor,
        fontWeight: 700,
        lineHeight: 1.1,
        fontFamily: "'Inter', 'system-ui', sans-serif",
        letterSpacing: "-0.02em",
      }}>
        {node.value}
      </div>
    </div>
  );
};

/** CodeBlock — code display block with optional line highlight */
const CodeBlockNode: React.FC<{ node: LayoutNode }> = ({ node }) => (
  <pre style={{
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: SIZE_MAP.sm,
    color: color("white"),
    background: "rgba(255,255,255,0.03)",
    padding: 28,
    borderRadius: 12,
    margin: 0,
    overflowX: "hidden",
    border: "1px solid rgba(255,255,255,0.06)",
    width: "100%",
    boxSizing: "border-box",
  }}>
    {node.lines?.map((line, i) => (
      <div
        key={i}
        style={{
          color: i === node.highlight_line ? color("yellow") : color("white"),
          background: i === node.highlight_line ? `${color("yellow")}12` : undefined,
          padding: i === node.highlight_line ? "2px 8px" : "2px 0",
          borderRadius: i === node.highlight_line ? 4 : undefined,
          opacity: i === node.highlight_line ? 1 : 0.65,
        }}
      >
        {line}
      </div>
    ))}
  </pre>
);

// ── Tier 2 primitives — devtool design system ──────────────────────────────────

/**
 * MetricCard — glassmorphism card with spring-in slide-up animation.
 * Replaces LabelValueCard as the primary data display primitive.
 * Props: label, value, color (accent), border_color (alias), glow, delay
 */
const MetricCardNode: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const { frame, delay } = useNodeFrame(node);
  const { fps } = useVideoConfig();
  const accentColor           = color(node.color ?? node.border_color, "cyan");
  const { opacity, translateY } = slideUp(frame, fps, delay);

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accentColor}35`,
      borderRadius: 12,
      padding: "28px 32px",
      opacity,
      transform: `translateY(${translateY}px)`,
      boxShadow: node.glow
        ? `0 0 32px ${accentColor}12, inset 0 1px 0 rgba(255,255,255,0.06)`
        : `inset 0 1px 0 rgba(255,255,255,0.06)`,
      boxSizing: "border-box",
      flex: 1,
    }}>
      {node.label && (
        <div style={{
          fontSize: 24,
          fontWeight: 500,
          color: "#F9FAFB",
          opacity: 0.4,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontFamily: "'Inter', 'system-ui', sans-serif",
          marginBottom: 10,
        }}>
          {node.label}
        </div>
      )}
      <div style={{
        fontSize: 64,
        color: accentColor,
        fontWeight: 700,
        lineHeight: 1.05,
        fontFamily: "'Inter', 'system-ui', sans-serif",
        letterSpacing: "-0.03em",
      }}>
        {node.value}
      </div>
    </div>
  );
};

/**
 * GPUNode — compact GPU tile for parallelism / cluster visualizations.
 * state: "idle" (dim) | "active" (indigo glow) | "bottleneck" (red glow)
 * Props: label, value (sublabel), state, delay
 */
const GPU_STYLES = {
  idle:       { border: "rgba(255,255,255,0.10)", glow: "transparent",  text: "rgba(255,255,255,0.30)", bg: "rgba(255,255,255,0.02)" },
  active:     { border: "#6366F178",              glow: "#6366F114",    text: "#6366F1",                bg: "rgba(99,102,241,0.08)"  },
  bottleneck: { border: "#EF444478",              glow: "#EF444414",    text: "#EF4444",                bg: "rgba(239,68,68,0.08)"   },
} as const;

const GPUNodeComponent: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const { frame, delay } = useNodeFrame(node);
  const { fps } = useVideoConfig();
  const state   = (node.state ?? "idle") as keyof typeof GPU_STYLES;
  const s       = GPU_STYLES[state] ?? GPU_STYLES.idle;

  const { opacity, scale } = popIn(frame, fps, delay);

  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 10,
      padding: "20px 16px",
      opacity,
      transform: `scale(${scale})`,
      boxShadow: state !== "idle" ? `0 0 24px ${s.glow}` : undefined,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 110,
    }}>
      <div style={{
        fontSize: 22,
        fontWeight: 600,
        color: s.text,
        fontFamily: "'Inter', 'system-ui', sans-serif",
        letterSpacing: "0.04em",
        textAlign: "center",
      }}>
        {node.label ?? "GPU"}
      </div>
      {node.value && (
        <div style={{
          fontSize: 18,
          fontWeight: 400,
          color: s.text,
          opacity: 0.65,
          fontFamily: "'Inter', 'system-ui', sans-serif",
          textAlign: "center",
        }}>
          {node.value}
        </div>
      )}
    </div>
  );
};

/**
 * NumberCounter — hero metric with scale spring animation.
 * Replaces StatBox as the primary large-number display.
 * Props: value, label, color, delay
 */
const NumberCounterNode: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const { frame, delay } = useNodeFrame(node);
  const { fps } = useVideoConfig();
  const accentColor = color(node.color, "cyan");

  const { opacity, scale } = scaleIn(frame, fps, delay);

  return (
    <div style={{ opacity, transform: `scale(${scale})`, transformOrigin: "left center" }}>
      <div style={{
        fontSize: 200,
        fontWeight: 800,
        color: accentColor,
        lineHeight: 0.95,
        letterSpacing: "-0.04em",
        fontFamily: "'Inter', 'system-ui', sans-serif",
        textShadow: `0 0 80px ${accentColor}20`,
      }}>
        {node.value}
      </div>
      {node.label && (
        <div style={{
          fontSize: 32,
          fontWeight: 500,
          color: "#F9FAFB",
          opacity: 0.45,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: "'Inter', 'system-ui', sans-serif",
          marginTop: 16,
        }}>
          {node.label}
        </div>
      )}
    </div>
  );
};

/**
 * SectionLabel — section header with accent bar.
 * Replaces TerminalPrompt as the primary section identifier.
 * Props: text, color (accent bar + text color)
 */
const SectionLabelNode: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const accentColor = color(node.color, "yellow"); // violet by default
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexShrink: 0,
    }}>
      <div style={{
        width: 3,
        height: 22,
        background: accentColor,
        borderRadius: 2,
        opacity: 0.9,
        flexShrink: 0,
      }} />
      <div style={{
        fontSize: 22,
        fontWeight: 600,
        color: accentColor,
        fontFamily: "'Inter', 'system-ui', sans-serif",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        opacity: 0.85,
      }}>
        {node.text}
      </div>
    </div>
  );
};
