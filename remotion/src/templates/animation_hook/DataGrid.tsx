import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { DataGridData } from "../../types";
import { useBeatFrame } from "../../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../../utils/springIn";
import { COLOR, FONT } from "../../layouts/_shared";
import { CaptionZone } from "./CaptionZone";

export const DataGridThreeJS: React.FC<{ data: DataGridData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR["cyan"];

  return (
    <CaptionZone accentColor="cyan">
      <div style={{
        fontSize: 18, fontWeight: 600, color: accent,
        letterSpacing: "0.12em", fontFamily: FONT, opacity: 0.8,
        textTransform: "uppercase",
      }}>
        {data.section_label}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {data.metrics.map((m, i) => {
          const prog = spring({ frame: Math.max(0, frame - i * 12), fps, config: SPRING_MEDIUM });
          const op   = interpolate(prog, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
          const sc   = interpolate(prog, [0, 1], [0.88, 1], { extrapolateRight: "clamp" });
          const col  = m.color ? COLOR[m.color as keyof typeof COLOR] ?? accent : accent;
          const isHl = i === (data.highlight_index ?? 0);

          return (
            <div key={i} style={{
              opacity: op, transform: `scale(${sc})`,
              background: `${col}${isHl ? "18" : "0A"}`,
              border: `1px solid ${col}${isHl ? "50" : "28"}`,
              borderRadius: 12, padding: "14px 20px",
              minWidth: 140,
            }}>
              <div style={{
                fontSize: isHl ? 44 : 36, fontWeight: 800,
                color: col, fontFamily: FONT, lineHeight: 1,
                textShadow: isHl ? `0 0 32px ${col}50` : "none",
              }}>
                {m.value}
              </div>
              <div style={{
                fontSize: 16, fontWeight: 500,
                color: "rgba(255,255,255,0.55)", fontFamily: FONT, marginTop: 4,
              }}>
                {m.label}
              </div>
            </div>
          );
        })}
      </div>

      {data.caption && (
        <div style={{
          fontSize: 20, color: "rgba(255,255,255,0.45)", fontFamily: FONT, lineHeight: 1.4,
        }}>
          {data.caption}
        </div>
      )}
    </CaptionZone>
  );
};
