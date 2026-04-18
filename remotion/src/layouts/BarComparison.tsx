/**
 * BarComparison — horizontal bar chart for N items against one metric.
 *
 * Motion upgrades (design pass):
 *   • Highlighted bar: continuous shimmer glare sweeps left→right every 90 frames
 *   • Highlighted label: slow 8px rightward drift over beat duration
 *   • MEDIUM spring tier (single-frame overshoot) for bar fills
 *   • ParticleBackground + TelemetryFrame
 */

import React, { useRef, useLayoutEffect } from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { BarComparisonData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { COLOR, FONT, BROADCAST_TEXT, HERO_NUMBER, SectionLabelRow, ParticleBackground, TelemetryFrame } from "./_shared";
import { SPRING_MEDIUM } from "../utils/springIn";

const ROW_STAGGER  = 15;
const BAR_DELAY    = 8;
const BAR_H_BASE   = 28;
const VALUE_WIDTH  = 120;
const TRACK_RADIUS = 6;

const parseNum = (v: string): number => parseFloat(v.replace(/[^0-9.]/g, "")) || 1;

// ── Canvas bar row ────────────────────────────────────────────────────────────
// Draws track + filled bar + specular shimmer onto a single canvas per row.
// Anti-aliased rounded caps via arc(). GPU shadowBlur glow on highlight.

const CanvasBar: React.FC<{
  frame:         number;
  barScaleX:     number;
  widthFraction: number;
  isHighlight:   boolean;
  accent:        string;
  height:        number;
  shimmerPos:    number;        // -20 → 120 percent
  shimmerActive: boolean;
}> = ({ frame, barScaleX, widthFraction, isHighlight, accent, height, shimmerPos, shimmerActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W         = 900; // fixed canvas width — parent flex:1 fills rest

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, height);

    const r         = TRACK_RADIUS;
    const fillWidth = W * widthFraction * barScaleX;

    // Track (background)
    ctx.save();
    ctx.fillStyle   = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, height, r);
    ctx.fill();
    ctx.restore();

    if (fillWidth <= 0) return;

    // Filled bar with GPU glow on highlight
    ctx.save();
    if (isHighlight) {
      ctx.shadowBlur  = 18;
      ctx.shadowColor = accent + "80";
    }

    if (isHighlight) {
      const grad = ctx.createLinearGradient(0, 0, fillWidth, 0);
      grad.addColorStop(0, accent + "CC");
      grad.addColorStop(1, accent);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
    }

    // Clip to rounded track so bar corners are crisp
    ctx.beginPath();
    ctx.roundRect(0, 0, W, height, r);
    ctx.clip();

    ctx.beginPath();
    ctx.roundRect(0, 0, fillWidth, height, r);
    ctx.fill();
    ctx.restore();

    // Specular shimmer on highlight bar after fill settles
    if (isHighlight && shimmerActive) {
      const cx      = (shimmerPos / 100) * W;
      const sw      = W * 0.22;
      const shimGrad = ctx.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);
      shimGrad.addColorStop(0,    "transparent");
      shimGrad.addColorStop(0.2,  "rgba(255,255,255,0.02)");
      shimGrad.addColorStop(0.45, "rgba(255,255,255,0.12)");
      shimGrad.addColorStop(0.5,  "rgba(255,255,255,0.20)");
      shimGrad.addColorStop(0.55, "rgba(255,255,255,0.12)");
      shimGrad.addColorStop(0.8,  "rgba(255,255,255,0.02)");
      shimGrad.addColorStop(1,    "transparent");

      ctx.save();
      // Clip to filled bar only
      ctx.beginPath();
      ctx.roundRect(0, 0, W, height, r);
      ctx.clip();
      ctx.beginPath();
      ctx.roundRect(0, 0, fillWidth, height, r);
      ctx.clip();

      // Skew via transform
      ctx.transform(1, 0, -0.32, 1, sw * 0.16, 0); // skewX ~-18deg
      ctx.fillStyle = shimGrad;
      ctx.fillRect(cx - sw / 2 - 20, 0, sw + 40, height);
      ctx.restore();
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={height}
      style={{ display: "block", flex: 1 }}
    />
  );
};

export const BarComparison: React.FC<{ data: BarComparisonData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];

  const rawValues = data.items.map(item => parseNum(item.value));
  const maxVal    = Math.max(...rawValues, 1);

  const shimmerCycle = 90;
  const shimmerPos   = ((frame % shimmerCycle) / shimmerCycle) * 140 - 20;

  return (
    <div style={{
      width:         "100%",
      height:        "100%",
      background:    "linear-gradient(180deg, #111112 0%, #080809 100%)",
      position:      "relative",
      overflow:      "hidden",
      display:       "flex",
      flexDirection: "column",
      paddingTop:    120,
      paddingBottom: 180,
      paddingLeft:   72,
      paddingRight:  72,
      boxSizing:     "border-box",
      fontFamily:    FONT,
      gap:           32,
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "cyan"} />

        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "center",
          gap:            28,
        }}>
          {data.items.map((item, i) => {
            const rowFrame = frame - i * ROW_STAGGER;
            const barFrame = rowFrame - BAR_DELAY;

            const rowProgress = rowFrame >= 0 ? spring({ frame: rowFrame, fps, config: SPRING_MEDIUM }) : 0;
            const barProgress = barFrame  >= 0 ? spring({ frame: barFrame,  fps, config: SPRING_MEDIUM }) : 0;

            const rowOpacity    = interpolate(rowProgress, [0, 0.22], [0, 1], { extrapolateRight: "clamp" });
            const translateX    = interpolate(rowProgress, [0, 1],    [-40, 0], { extrapolateRight: "clamp" });
            const barScaleX     = interpolate(barProgress, [0, 1],    [0, 1],   { extrapolateRight: "clamp" });
            const widthFraction = rawValues[i] / maxVal;
            const isHighlight   = item.highlight;
            const valueColor    = isHighlight ? accent : "rgba(255,255,255,0.4)";
            const labelDrift    = isHighlight
              ? interpolate(frame, [0, 300], [0, 8], { extrapolateRight: "clamp" })
              : 0;
            const barHeight = isHighlight ? BAR_H_BASE + 4 : BAR_H_BASE;

            return (
              <div key={i} style={{
                opacity:    rowOpacity,
                transform:  `translateX(${translateX}px)`,
                willChange: "transform, opacity",
              }}>
                {/* Label */}
                <div style={{
                  ...BROADCAST_TEXT,
                  fontSize:      isHighlight ? 28 : 24,
                  fontWeight:    isHighlight ? 600 : 400,
                  color:         COLOR.white,
                  opacity:       isHighlight ? 1.0 : 0.55,
                  letterSpacing: "-0.01em",
                  marginBottom:  10,
                  transform:     `translateX(${labelDrift}px)`,
                  transition:    "none",
                }}>
                  {item.label}
                </div>

                {/* Canvas bar + value */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <CanvasBar
                    frame={frame}
                    barScaleX={barScaleX}
                    widthFraction={widthFraction}
                    isHighlight={!!isHighlight}
                    accent={accent}
                    height={barHeight}
                    shimmerPos={shimmerPos}
                    shimmerActive={!!isHighlight && barScaleX > 0.95}
                  />

                  <div style={{
                    ...HERO_NUMBER,
                    flexShrink: 0,
                    width:      VALUE_WIDTH,
                    fontSize:   isHighlight ? 34 : 28,
                    fontWeight: 700,
                    color:      valueColor,
                    textShadow: isHighlight ? `0 0 20px ${accent}50` : "none",
                  }}>
                    {item.value}{item.unit ? ` ${item.unit}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom accent line */}
      <div style={{
        position:   "absolute",
        bottom: 0, left: 0, right: 0,
        height:     2,
        background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
        zIndex:     2,
      }} />

      <TelemetryFrame frame={frame} />
    </div>
  );
};
