import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { TakeawaySceneData } from "../../types";
import { useBeatFrame } from "../../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../../utils/springIn";
import { COLOR, FONT } from "../../layouts/_shared";
import { CaptionZone } from "./CaptionZone";

export const TakeawaySceneThreeJS: React.FC<{
  data: TakeawaySceneData;
  durationFrames: number;
}> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];

  const headlineProgress = spring({ frame, fps, config: SPRING_MEDIUM });
  const headlineOp       = interpolate(headlineProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const headlineY        = interpolate(headlineProgress, [0, 1], [28, 0], { extrapolateRight: "clamp" });

  const ctaProgress = spring({ frame: Math.max(0, frame - 22), fps, config: SPRING_MEDIUM });
  const ctaOp       = interpolate(ctaProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale    = interpolate(ctaProgress, [0, 1], [0.88, 1], { extrapolateRight: "clamp" });

  return (
    <CaptionZone accentColor={data.accent_color ?? "cyan"}>
      <div style={{
        fontSize: 18, fontWeight: 600, color: accent,
        letterSpacing: "0.12em", fontFamily: FONT, opacity: 0.8,
        textTransform: "uppercase",
      }}>
        {data.section_label}
      </div>

      <div style={{
        opacity: headlineOp, transform: `translateY(${headlineY}px)`,
        fontSize: 52, fontWeight: 700, color: "#F9FAFB", fontFamily: FONT,
        lineHeight: 1.15, letterSpacing: "-0.02em",
      }}>
        {data.headline}
      </div>

      {data.cta && (
        <div style={{
          opacity: ctaOp, transform: `scale(${ctaScale})`,
          alignSelf: "flex-start",
          background: `${accent}14`,
          border: `1px solid ${accent}40`,
          borderRadius: 100,
          padding: "12px 28px",
          fontSize: 24, color: accent, fontWeight: 500,
          fontFamily: FONT, letterSpacing: "0.04em",
        }}>
          {data.cta}
        </div>
      )}
    </CaptionZone>
  );
};
