import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { StatementSlamData } from "../../types";
import { useBeatFrame } from "../../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../../utils/springIn";
import { COLOR, FONT, BROADCAST_TEXT } from "../../layouts/_shared";
import { CaptionZone } from "./CaptionZone";

const LINE_STAGGER = 20;

export const StatementSlamThreeJS: React.FC<{ data: StatementSlamData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];

  return (
    <CaptionZone accentColor={data.accent_color ?? "cyan"}>
      {/* Section label */}
      <div style={{
        fontSize: 18, fontWeight: 600, color: accent,
        letterSpacing: "0.12em", fontFamily: FONT, opacity: 0.8,
        textTransform: "uppercase",
      }}>
        {data.section_label}
      </div>

      {/* Lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.lines.map((line, i) => {
          const lineFrame = frame - i * LINE_STAGGER;
          const progress  = lineFrame >= 0
            ? spring({ frame: lineFrame, fps, config: SPRING_MEDIUM }) : 0;
          const opacity    = interpolate(progress, [0, 0.18], [0, 1], { extrapolateRight: "clamp" });
          const translateY = interpolate(progress, [0, 1], [24, 0], { extrapolateRight: "clamp" });
          const lineColor  = i === 0 ? accent : COLOR.white;

          return (
            <div key={i} style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              ...BROADCAST_TEXT,
              fontSize:     i === 0 ? 72 : 52,
              fontWeight:   i === 0 ? 800 : 600,
              color:        lineColor,
              lineHeight:   1.08,
              letterSpacing:"-0.02em",
              textShadow:   i === 0 ? `0 0 48px ${accent}40` : "none",
            }}>
              {line}
            </div>
          );
        })}
      </div>
    </CaptionZone>
  );
};
