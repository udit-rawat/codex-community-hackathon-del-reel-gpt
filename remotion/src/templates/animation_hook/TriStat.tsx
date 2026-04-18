import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { TriStatData } from "../../types";
import { useBeatFrame } from "../../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../../utils/springIn";
import { COLOR, FONT, countUp } from "../../layouts/_shared";
import { CaptionZone } from "./CaptionZone";

const CARD_STAGGER = 16;

export const TriStatThreeJS: React.FC<{ data: TriStatData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];

  return (
    <CaptionZone accentColor={data.accent_color ?? "cyan"}>
      <div style={{
        fontSize: 18, fontWeight: 600, color: accent,
        letterSpacing: "0.12em", fontFamily: FONT, opacity: 0.8,
        textTransform: "uppercase",
      }}>
        {data.section_label}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.stats.map((stat, i) => {
          const cardFrame = frame - i * CARD_STAGGER;
          const progress  = cardFrame >= 0
            ? spring({ frame: cardFrame, fps, config: SPRING_MEDIUM }) : 0;
          const opacity    = interpolate(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
          const translateX = interpolate(progress, [0, 1], [-20, 0], { extrapolateRight: "clamp" });
          const cardColor  = stat.color ? COLOR[stat.color as keyof typeof COLOR] ?? accent : accent;
          const displayVal = i === 0 ? countUp(stat.value, progress) : stat.value;

          return (
            <div key={i} style={{
              opacity,
              transform: `translateX(${translateX}px)`,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 3, height: 44, background: cardColor,
                borderRadius: 2, opacity: i === 0 ? 1 : 0.5, flexShrink: 0,
              }} />
              <div>
                <span style={{
                  fontSize: i === 0 ? 56 : 44, fontWeight: 800,
                  color: cardColor, fontFamily: FONT,
                  textShadow: i === 0 ? `0 0 40px ${cardColor}50` : "none",
                }}>
                  {displayVal}
                </span>
                <span style={{
                  fontSize: 20, fontWeight: 500, color: "rgba(255,255,255,0.65)",
                  fontFamily: FONT, marginLeft: 10,
                }}>
                  {stat.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </CaptionZone>
  );
};
