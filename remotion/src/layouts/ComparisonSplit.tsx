/**
 * ComparisonSplit — A vs B side-by-side layout.
 *
 * Motion upgrades (design pass):
 *   • Divider becomes a data conduit: bright pixels travel up and down continuously
 *   • Panel slide uses MEDIUM spring (single-frame overshoot)
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import type { ComparisonSplitData, MetricItem } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { slideUp, springIn, staggerDelay } from "../utils/springIn";
import { COLOR, FONT, SectionLabelRow, HRule, ParticleBackground, TelemetryFrame } from "./_shared";

// ── Divider with traveling data pixels ───────────────────────────────────────

// Pre-computed deterministic pixel positions along the divider
const DIVIDER_PIXELS = Array.from({ length: 6 }, (_, i) => {
  const v = Math.sin(i * 127.1) * 43758.5453;
  const frac = v - Math.floor(v);
  return {
    startY:   frac * 1920,         // starting Y position (px)
    speed:    1.2 + frac * 1.6,    // px per frame (up or down)
    dir:      i % 2 === 0 ? -1 : 1,// up or down
    size:     i % 2 === 0 ? 3 : 2, // height of pixel dot
    bright:   i % 3 === 0,         // brighter every 3rd
  };
});

const AnimatedDivider: React.FC<{ frame: number; color: string }> = ({ frame, color }) => (
  <div style={{
    width:          2,
    background:     "rgba(255,255,255,0.06)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    position:       "relative",
    overflow:       "hidden",
  }}>
    {/* Traveling data pixels */}
    {DIVIDER_PIXELS.map((p, i) => {
      const y = ((p.startY + p.dir * frame * p.speed) % 1920 + 1920) % 1920;
      return (
        <div key={i} style={{
          position:   "absolute",
          top:        y,
          left:       0,
          width:      2,
          height:     p.size,
          background: color,
          opacity:    p.bright ? 0.9 : 0.5,
          filter:     p.bright ? `blur(0.5px) drop-shadow(0 0 3px ${color})` : "none",
          borderRadius: 1,
        }} />
      );
    })}

    {/* VS label */}
    <div style={{
      position:      "absolute",
      background:    "#0C0C0D",
      padding:       "12px 0",
      color:         "rgba(255,255,255,0.3)",
      fontSize:      20,
      fontWeight:    500,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      fontFamily:    FONT,
      writingMode:   "vertical-rl",
      zIndex:        2,
    }}>
      vs
    </div>
  </div>
);

// ── Metric Card ───────────────────────────────────────────────────────────────

const Card: React.FC<{ m: MetricItem; frame: number; fps: number; delay: number }> =
  ({ m, frame, fps, delay }) => {
  const accent = COLOR[m.color ?? "cyan"];
  const { opacity, translateY } = slideUp(frame, fps, delay, "medium");
  return (
    <div style={{
      background:   "rgba(255,255,255,0.03)",
      border:       `1px solid ${accent}35`,
      borderRadius: 12,
      padding:      "24px 28px",
      opacity,
      transform:    `translateY(${translateY}px)`,
      boxShadow:    m.glow ? `0 0 32px ${accent}15` : undefined,
      boxSizing:    "border-box",
    }}>
      <div style={{
        fontSize: 22, fontWeight: 500, color: "#F9FAFB", opacity: 0.4,
        textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: FONT, marginBottom: 8,
      }}>
        {m.label}
      </div>
      <div style={{
        fontSize: 60, fontWeight: 700, color: accent,
        lineHeight: 1.05, letterSpacing: "-0.03em", fontFamily: FONT,
      }}>
        {m.value}
      </div>
    </div>
  );
};

// ── Panel ─────────────────────────────────────────────────────────────────────

const Panel: React.FC<{
  heading:    string;
  color:      string;
  metrics:    MetricItem[];
  frame:      number;
  fps:        number;
  enterDelay: number;
  slideDir:   "left" | "right";
  isLast?:    boolean;
}> = ({ heading, color, metrics, frame, fps, enterDelay, slideDir, isLast }) => {
  const prog = springIn(frame, fps, enterDelay, "medium");
  const tx   = (slideDir === "left" ? -1 : 1) * (1 - prog) * 40;

  return (
    <div style={{
      flex:           1,
      display:        "flex",
      flexDirection:  "column",
      justifyContent: "center",
      gap:            20,
      padding:        "32px 28px",
      background:     `${color}07`,
      border:         `1px solid ${color}22`,
      borderRadius:   isLast ? "0 16px 16px 0" : "16px 0 0 16px",
      opacity:        Math.min(1, prog + 0.001), // keep visible if overshoot goes >1
      transform:      `translateX(${tx}px)`,
      boxSizing:      "border-box",
    }}>
      <div style={{
        fontSize:      28, fontWeight: 600, color,
        letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: FONT,
      }}>
        {heading}
      </div>
      {metrics.map((m, i) => (
        <Card key={i} m={m} frame={frame} fps={fps}
          delay={staggerDelay(i, metrics.length, 16, enterDelay + 10)} />
      ))}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const ComparisonSplit: React.FC<{ data: ComparisonSplitData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const { left, right, section_label } = data;

  // Use the accent of whichever side is "winning" (right, typically) for divider
  const dividerColor = COLOR[right.color] ?? COLOR.cyan;

  return (
    <div style={{
      paddingTop:    120,
      paddingBottom: 180,
      paddingLeft:   72,
      paddingRight:  72,
      display:       "flex",
      flexDirection: "column",
      gap:           32,
      height:        "100%",
      boxSizing:     "border-box",
      background:    "linear-gradient(180deg, #111112 0%, #080809 100%)",
      position:      "relative",
      overflow:      "hidden",
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
        <SectionLabelRow text={section_label} color="cyan" />
        <HRule />

        <div style={{ display: "flex", flex: 1, alignItems: "stretch", gap: 0 }}>
          <Panel
            heading={left.heading}
            color={COLOR[left.color]}
            metrics={left.metrics}
            frame={frame} fps={fps}
            enterDelay={6}
            slideDir="left"
          />

          <AnimatedDivider frame={frame} color={dividerColor} />

          <Panel
            heading={right.heading}
            color={COLOR[right.color]}
            metrics={right.metrics}
            frame={frame} fps={fps}
            enterDelay={14}
            slideDir="right"
            isLast
          />
        </div>
      </div>

      <TelemetryFrame frame={frame} />
    </div>
  );
};
