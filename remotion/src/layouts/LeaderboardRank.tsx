/**
 * LeaderboardRank — ordered ranking table with animated entrance.
 *
 * Motion upgrades (design pass):
 *   • MEDIUM spring tier for row entrances
 *   • Highlighted row: shimmer sweep + rank badge glow pulse
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { LeaderboardRankData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../utils/springIn";
import { COLOR, FONT, BROADCAST_TEXT, HERO_NUMBER, SectionLabelRow, ParticleBackground, TelemetryFrame, shimmerStyle } from "./_shared";

const ROW_STAGGER  = 14;
const SHIMMER_CYCLE = 90;

export const LeaderboardRank: React.FC<{ data: LeaderboardRankData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];
  const n       = data.items.length;

  // Shimmer for highlighted row
  const shimmerPos = ((frame % SHIMMER_CYCLE) / SHIMMER_CYCLE) * 140 - 20;

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
      gap:            32,
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "cyan"} />

        {/* Metric label */}
        <div style={{
          fontSize:      20,
          fontWeight:    500,
          color:         "rgba(255,255,255,0.35)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontFamily:    FONT,
          marginTop:     -16,
        }}>
          {data.metric_label}
        </div>

        {/* Rows */}
        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "center",
          gap:            12,
        }}>
          {data.items.map((item, i) => {
            const startFrame = (n - 1 - i) * ROW_STAGGER;
            const rowFrame   = frame - startFrame;
            const progress   = rowFrame >= 0 ? spring({
              frame:  rowFrame,
              fps,
              config: SPRING_MEDIUM,
            }) : 0;

            const opacity    = interpolate(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
            const translateX = interpolate(progress, [0, 1], [-56, 0], { extrapolateRight: "clamp" });

            const isHighlight = item.highlight;
            const rankColor   = isHighlight ? accent : "rgba(255,255,255,0.25)";
            const nameOpacity = isHighlight ? 1.0 : Math.max(0.45, 1 - i * 0.12);
            const scoreColor  = isHighlight ? accent : "rgba(255,255,255,0.4)";

            // Shimmer only shows after highlighted row's bar fills
            const highlightSettled = isHighlight && rowFrame > 20;
            const showShimmer = highlightSettled;

            // Rank badge glow pulse on highlighted row
            const rankGlow = isHighlight && rowFrame > 20
              ? 16 + (Math.sin((frame / fps) * Math.PI * 2 * 0.35) * 0.5 + 0.5) * 24
              : 16;

            return (
              <div
                key={i}
                style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         20,
                  padding:     isHighlight ? "18px 20px" : "14px 20px",
                  borderRadius: 12,
                  background:  isHighlight ? `${accent}0D` : "transparent",
                  border:      isHighlight ? `1px solid ${accent}30` : "1px solid transparent",
                  opacity,
                  transform:   `translateX(${translateX}px)`,
                  willChange:  "transform, opacity",
                  position:    "relative",
                  overflow:    "hidden",
                }}
              >
                {/* Shimmer on highlighted row — specular model */}
                {showShimmer && <div style={shimmerStyle(shimmerPos)} />}

                {/* Rank badge */}
                <div style={{
                  ...HERO_NUMBER,
                  width:         52,
                  flexShrink:    0,
                  fontSize:      isHighlight ? 42 : 34,
                  fontWeight:    800,
                  color:         rankColor,
                  textAlign:     "right",
                  textShadow:    isHighlight ? `0 0 ${rankGlow}px ${accent}50` : "none",
                }}>
                  #{item.rank}
                </div>

                {/* Divider */}
                <div style={{
                  width:        2,
                  height:       isHighlight ? 44 : 36,
                  background:   rankColor,
                  borderRadius: 1,
                  flexShrink:   0,
                  opacity:      0.6,
                }} />

                {/* Name */}
                <div style={{
                  ...BROADCAST_TEXT,
                  flex:         1,
                  fontSize:     isHighlight ? 44 : 36,
                  fontWeight:   isHighlight ? 700 : 500,
                  color:        COLOR.white,
                  opacity:      nameOpacity,
                  letterSpacing:"-0.02em",
                  minWidth:     0,
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}>
                  {item.name}
                </div>

                {/* Score */}
                <div style={{
                  ...HERO_NUMBER,
                  flexShrink: 0,
                  fontSize:   isHighlight ? 44 : 36,
                  fontWeight: 700,
                  color:      scoreColor,
                  textShadow: isHighlight ? `0 0 24px ${accent}40` : "none",
                }}>
                  {item.score}
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
