/**
 * StatementSlam — kinetic insight beat.
 *
 * Motion upgrades (design pass):
 *   • MEDIUM spring tier for line entrances (single-frame overshoot)
 *   • Line 0: glow radius pulses with slow sin wave after entry
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { StatementSlamData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../utils/springIn";
import { COLOR, FONT, BROADCAST_TEXT, SectionLabelRow, ParticleBackground, TelemetryFrame, useBreath } from "./_shared";

const LINE_STAGGER = 20;
const LINE_OPACITY = [1.0, 0.88, 0.68];

export const StatementSlam: React.FC<{ data: StatementSlamData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];
  const { scale: breathScale } = useBreath(frame, fps);

  // Glow pulse for line 0
  const glowPulse = Math.sin((frame / fps) * Math.PI * 2 * 0.4) * 0.5 + 0.5;

  return (
    <div style={{
      width:          "100%",
      height:         "100%",
      background:     "linear-gradient(180deg, #111112 0%, #080809 100%)",
      position:       "relative",
      overflow:       "hidden",
      display:        "flex",
      flexDirection:  "column",
      paddingTop:    120,
      paddingBottom: 180,
      paddingLeft:   72,
      paddingRight:  72,
      boxSizing:      "border-box",
      fontFamily:     FONT,
      gap:            40,
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 40, flex: 1 }}>
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "cyan"} />

        {/* Lines container */}
        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "center",
          gap:            28,
        }}>
          {data.lines.map((line, i) => {
            const lineFrame = frame - i * LINE_STAGGER;

            const progress = lineFrame >= 0 ? spring({
              frame:  lineFrame,
              fps,
              config: SPRING_MEDIUM,
            }) : 0;

            const opacity    = interpolate(progress, [0, 0.18], [0, 1], { extrapolateRight: "clamp" });
            const translateY = interpolate(progress, [0, 1],    [40, 0], { extrapolateRight: "clamp" });
            const lineColor  = i === 0 ? accent : COLOR.white;
            const lineOpacity = opacity * (LINE_OPACITY[i] ?? 0.6);

            const applyBreath = i === 0 && lineFrame > 28;

            // Dynamic glow on line 0
            const glowRadius = i === 0 && lineFrame > 20 ? 40 + glowPulse * 40 : 40;

            return (
              <div
                key={i}
                style={{
                  opacity:         lineOpacity,
                  transform:       `translateY(${translateY}px)${applyBreath ? ` scale(${breathScale})` : ""}`,
                  transformOrigin: "left center",
                  willChange:      "transform, opacity",
                }}
              >
                <div style={{
                  ...BROADCAST_TEXT,
                  fontSize:     80,
                  fontWeight:   800,
                  color:        lineColor,
                  lineHeight:   1.05,
                  letterSpacing:"-0.03em",
                  textShadow:   i === 0 ? `0 0 ${glowRadius}px ${accent}30` : "none",
                }}>
                  {line}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accent line at bottom */}
      <div style={{
        position:   "absolute",
        bottom:     0, left: 0, right: 0,
        height:     2,
        background: `linear-gradient(90deg, transparent, ${accent}40, transparent)`,
        zIndex:     2,
      }} />

      <TelemetryFrame frame={frame} />
    </div>
  );
};
