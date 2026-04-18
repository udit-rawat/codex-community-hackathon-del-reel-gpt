/**
 * TriStat — three-metric card stack.
 *
 * Motion upgrades (design pass):
 *   • MEDIUM spring tier for card entrances
 *   • Primary card (index 0): count-up value during entrance + continuous glow pulse
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { TriStatData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../utils/springIn";
import { COLOR, FONT, HERO_NUMBER, BROADCAST_TEXT, SectionLabelRow, ParticleBackground, TelemetryFrame, countUp } from "./_shared";

const CARD_STAGGER = 18;

export const TriStat: React.FC<{ data: TriStatData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];

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
      gap:            28,
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 28, flex: 1 }}>
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "cyan"} />

        {/* Card stack */}
        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "center",
          gap:            18,
        }}>
          {data.stats.map((stat, i) => {
            const cardFrame = frame - i * CARD_STAGGER;
            const progress  = cardFrame >= 0 ? spring({
              frame:  cardFrame,
              fps,
              config: SPRING_MEDIUM,
            }) : 0;

            const opacity   = interpolate(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
            const scale     = interpolate(progress, [0, 1],   [0.92, 1.0], { extrapolateRight: "clamp" });
            const cardColor = stat.color ? COLOR[stat.color as keyof typeof COLOR] ?? accent : accent;

            // Primary card: glow pulse after entrance
            const glowPulse = i === 0 && cardFrame > 20
              ? Math.sin((frame / fps) * Math.PI * 2 * 0.3) * 0.5 + 0.5
              : 0;
            const glowRadius = i === 0 ? 24 + glowPulse * 32 : 0;

            // Primary card: count-up
            const displayValue = i === 0 ? countUp(stat.value, progress) : stat.value;

            const borderAlpha = i === 0 ? "55" : "28";
            const bgAlpha     = i === 0 ? "12" : "08";

            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform:       `scale(${scale})`,
                  transformOrigin: "left center",
                  willChange:      "transform, opacity",
                  background:      `${cardColor}${bgAlpha}`,
                  border:          `1px solid ${cardColor}${borderAlpha}`,
                  borderRadius:    16,
                  padding:         "26px 28px",
                  display:         "flex",
                  alignItems:      "center",
                  gap:             24,
                  boxShadow:       i === 0
                    ? `0 0 ${glowRadius}px ${cardColor}22`
                    : stat.glow ? `0 0 48px ${cardColor}22` : "none",
                }}
              >
                {/* Left accent bar */}
                <div style={{
                  width:        4,
                  alignSelf:    "stretch",
                  background:   cardColor,
                  borderRadius: 2,
                  opacity:      i === 0 ? 1.0 : 0.55,
                  flexShrink:   0,
                }} />

                {/* Value + labels */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    ...HERO_NUMBER,
                    fontSize:  88,
                    fontWeight:800,
                    color:     cardColor,
                    lineHeight:1.0,
                    textShadow:stat.glow || i === 0 ? `0 0 60px ${cardColor}50` : "none",
                  }}>
                    {displayValue}
                  </div>
                  <div style={{
                    ...BROADCAST_TEXT,
                    fontSize:     24,
                    fontWeight:   600,
                    color:        COLOR.white,
                    opacity:      0.82,
                    marginTop:    6,
                    letterSpacing:"0.01em",
                  }}>
                    {stat.label}
                  </div>
                  {stat.sublabel && (
                    <div style={{
                      fontSize:   18,
                      fontWeight: 400,
                      color:      "rgba(255,255,255,0.38)",
                      marginTop:  4,
                      fontFamily: FONT,
                    }}>
                      {stat.sublabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom accent line */}
      <div style={{
        position:   "absolute",
        bottom:     0, left: 0, right: 0,
        height:     2,
        background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
        zIndex:     2,
      }} />

      <TelemetryFrame frame={frame} />
    </div>
  );
};
