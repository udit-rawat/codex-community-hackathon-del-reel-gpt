/**
 * DataGrid — 2–4 metric cards in a responsive grid layout.
 *
 * Motion upgrades (design pass):
 *   • MEDIUM spring tier for card entrances
 *   • Highlighted card: continuous border glow pulse after entrance
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { useVideoConfig } from "remotion";
import type { DataGridData, MetricItem } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { slideUp, staggerDelay } from "../utils/springIn";
import { COLOR, FONT, SectionLabelRow, HRule, ParticleBackground, TelemetryFrame } from "./_shared";

const GridCard: React.FC<{
  m:           MetricItem;
  highlighted: boolean;
  frame:       number;
  fps:         number;
  delay:       number;
}> = ({ m, highlighted, frame, fps, delay }) => {
  const accent = COLOR[m.color ?? "cyan"];
  const { opacity, translateY } = slideUp(frame, fps, delay, "medium");

  // Glow pulse: slow sin wave on highlighted card after entrance settles
  const glowPulse = highlighted
    ? Math.sin((frame / fps) * Math.PI * 2 * 0.3) * 0.5 + 0.5
    : 0;
  const glowRadius = highlighted ? 20 + glowPulse * 28 : 0;

  return (
    <div style={{
      opacity,
      transform:    `translateY(${translateY}px)`,
      background:   highlighted ? `${accent}0A` : "rgba(255,255,255,0.03)",
      border:       `1px solid ${highlighted || m.glow ? `${accent}45` : "rgba(255,255,255,0.08)"}`,
      borderRadius: 14,
      padding:      "28px 32px",
      boxShadow:    highlighted
        ? `0 0 ${glowRadius}px ${accent}18, inset 0 1px 0 ${accent}10`
        : m.glow ? `0 0 40px ${accent}10` : undefined,
      boxSizing:    "border-box",
    }}>
      <div style={{
        fontSize:      24, fontWeight: 500, color: "#F9FAFB", opacity: 0.4,
        textTransform: "uppercase", letterSpacing: "0.12em",
        fontFamily:    FONT, marginBottom: 10,
      }}>
        {m.label}
      </div>
      <div style={{
        fontSize:      68, fontWeight: 700, color: accent,
        lineHeight:    1.05, letterSpacing: "-0.03em", fontFamily: FONT,
      }}>
        {m.value}
      </div>
    </div>
  );
};

export const DataGrid: React.FC<{ data: DataGridData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const cols    = data.metrics.length <= 2 ? 2
                : data.metrics.length === 3 ? 3
                : 2;

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
        <SectionLabelRow text={data.section_label} color="yellow" />
        <HRule />

        <div style={{
          display:             "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap:                 20,
        }}>
          {data.metrics.map((m, i) => (
            <GridCard
              key={i}
              m={m}
              highlighted={i === data.highlight_index}
              frame={frame}
              fps={fps}
              delay={staggerDelay(i, data.metrics.length, 24, 0)}
            />
          ))}
        </div>

        {data.caption && (
          <div style={{ fontSize: 28, color: "#F9FAFB", opacity: 0.35, fontFamily: FONT }}>
            {data.caption}
          </div>
        )}
      </div>

      <TelemetryFrame frame={frame} />
    </div>
  );
};
