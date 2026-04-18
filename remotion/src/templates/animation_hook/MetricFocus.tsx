import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { MetricFocusData } from "../../types";
import { useBeatFrame } from "../../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../../utils/springIn";
import { COLOR, FONT, countUp } from "../../layouts/_shared";
import { CaptionZone } from "./CaptionZone";

export const MetricFocusThreeJS: React.FC<{ data: MetricFocusData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.hero?.color ?? "cyan"];

  const heroProgress = spring({ frame, fps, config: SPRING_MEDIUM });
  const heroOp       = interpolate(heroProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const heroY        = interpolate(heroProgress, [0, 1], [30, 0], { extrapolateRight: "clamp" });
  const heroVal      = countUp(data.hero?.value ?? "", heroProgress);

  const ctxProgress  = spring({ frame: Math.max(0, frame - 20), fps, config: SPRING_MEDIUM });
  const ctxOp        = interpolate(ctxProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });

  return (
    <CaptionZone accentColor={data.hero?.color ?? "cyan"}>
      <div style={{
        fontSize: 18, fontWeight: 600, color: accent,
        letterSpacing: "0.12em", fontFamily: FONT, opacity: 0.8,
        textTransform: "uppercase",
      }}>
        {data.section_label}
      </div>

      <div style={{ opacity: heroOp, transform: `translateY(${heroY}px)` }}>
        <div style={{
          fontSize: 88, fontWeight: 900, color: accent, fontFamily: FONT,
          lineHeight: 0.95, letterSpacing: "-0.04em",
          textShadow: `0 0 80px ${accent}50`,
        }}>
          {heroVal}
        </div>
        {data.hero?.label && (
          <div style={{
            fontSize: 26, fontWeight: 500, color: "rgba(255,255,255,0.65)",
            fontFamily: FONT, marginTop: 8, letterSpacing: "0.01em",
          }}>
            {data.hero.label}
          </div>
        )}
      </div>

      {data.context && (
        <div style={{
          opacity: ctxOp, fontSize: 24, fontWeight: 400,
          color: "rgba(255,255,255,0.55)", fontFamily: FONT, lineHeight: 1.4,
        }}>
          {data.context}
        </div>
      )}
    </CaptionZone>
  );
};
