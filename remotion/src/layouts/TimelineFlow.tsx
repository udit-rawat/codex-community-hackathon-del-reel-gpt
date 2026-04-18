/**
 * TimelineFlow — chronological sequence layout.
 *
 * Motion upgrades (design pass):
 *   • MEDIUM spring tier for item entrances
 *   • Highlighted dot: continuous glow pulse
 *   • Spine: animated fill from top to bottom as items appear
 *   • ParticleBackground + TelemetryFrame
 */

import React, { useRef, useLayoutEffect } from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { TimelineFlowData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../utils/springIn";
import { COLOR, FONT, BROADCAST_TEXT, SectionLabelRow, ParticleBackground, TelemetryFrame } from "./_shared";

const ITEM_STAGGER = 15;
const SPINE_X      = 20;   // absolute left px of spine centre

// ── Canvas spine ─────────────────────────────────────────────────────────────
// Draws base track + animated fill line. Sub-pixel lineTo is crisper than a 2px div.
// GPU shadowBlur on the fill line gives a neon glow at zero CSS cost.

const CanvasSpine: React.FC<{
  spineProgress: number;
  accent: string;
  totalHeight: number;
}> = ({ spineProgress, accent, totalHeight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const H = totalHeight;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 40, H);

    const top    = 16;
    const bottom = H - 16;
    const height = bottom - top;
    const cx     = SPINE_X;

    // Base track
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, bottom);
    ctx.stroke();
    ctx.restore();

    // Animated fill — GPU glow via shadowBlur
    if (spineProgress > 0) {
      const fillBottom = top + height * spineProgress;
      const grad = ctx.createLinearGradient(0, top, 0, fillBottom);
      grad.addColorStop(0, accent + "99");
      grad.addColorStop(1, accent + "33");

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = accent + "80";
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx, fillBottom);
      ctx.stroke();
      ctx.restore();
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={H}
      style={{
        position:      "absolute",
        left:          0,
        top:           0,
        pointerEvents: "none",
      }}
    />
  );
};

export const TimelineFlow: React.FC<{ data: TimelineFlowData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];

  const lastItemFrame = (data.items.length - 1) * ITEM_STAGGER;
  const spineProgress = lastItemFrame > 0
    ? Math.min(1, Math.max(0, frame / (lastItemFrame + 20)))
    : Math.min(1, frame / 20);

  // Measure spine container height via ref for canvas sizing
  const spineContainerRef = useRef<HTMLDivElement>(null);
  const [spineHeight, setSpineHeight] = React.useState(800);
  useLayoutEffect(() => {
    if (spineContainerRef.current) {
      setSpineHeight(spineContainerRef.current.offsetHeight);
    }
  }, []);

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
      gap:            36,
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 36, flex: 1 }}>
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "cyan"} />

        {/* Timeline body */}
        <div
          ref={spineContainerRef}
          style={{
            flex:           1,
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "center",
            position:       "relative",
            paddingLeft:    52,
          }}
        >
          {/* Canvas spine — replaces 2 DOM divs */}
          <CanvasSpine spineProgress={spineProgress} accent={accent} totalHeight={spineHeight} />

          {data.items.map((item, i) => {
            const itemFrame = frame - i * ITEM_STAGGER;
            const progress  = itemFrame >= 0 ? spring({
              frame:  itemFrame,
              fps,
              config: SPRING_MEDIUM,
            }) : 0;

            const opacity    = interpolate(progress, [0, 0.22], [0, 1], { extrapolateRight: "clamp" });
            const translateX = interpolate(progress, [0, 1],    [-48, 0], { extrapolateRight: "clamp" });
            const dotSize    = item.highlight ? 18 : 11;
            const dotColor   = item.highlight ? accent : "rgba(255,255,255,0.22)";

            // Highlighted dot glow pulse
            const dotGlow = item.highlight && itemFrame > 20
              ? 10 + (Math.sin((frame / fps) * Math.PI * 2 * 0.4) * 0.5 + 0.5) * 20
              : 0;

            return (
              <div
                key={i}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          24,
                  marginBottom: i < data.items.length - 1 ? 40 : 0,
                  opacity,
                  transform:    `translateX(${translateX}px)`,
                  willChange:   "transform, opacity",
                  position:     "relative",
                }}
              >
                {/* Dot */}
                <div style={{
                  position:     "absolute",
                  left:         -(52 - 20) + (8 - dotSize / 2),
                  width:        dotSize,
                  height:       dotSize,
                  borderRadius: "50%",
                  background:   dotColor,
                  boxShadow:    item.highlight ? `0 0 ${dotGlow + 10}px ${accent}70` : "none",
                  flexShrink:   0,
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    ...BROADCAST_TEXT,
                    fontSize:      17,
                    fontWeight:    500,
                    color:         "rgba(255,255,255,0.35)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom:  5,
                  }}>
                    {item.date}
                  </div>

                  <div style={{
                    display:    "flex",
                    alignItems: "baseline",
                    gap:        18,
                    flexWrap:   "wrap",
                  }}>
                    <div style={{
                      ...BROADCAST_TEXT,
                      fontSize:      item.highlight ? 54 : 46,
                      fontWeight:    700,
                      color:         item.highlight ? accent : COLOR.white,
                      lineHeight:    1.1,
                      letterSpacing: "-0.025em",
                      textShadow:    item.highlight ? `0 0 40px ${accent}35` : "none",
                    }}>
                      {item.label}
                    </div>

                    {item.value && (
                      <div style={{
                        fontSize:      30,
                        fontWeight:    600,
                        color:         item.highlight ? accent : "rgba(255,255,255,0.45)",
                        fontFamily:    FONT,
                        letterSpacing: "-0.01em",
                      }}>
                        {item.value}
                      </div>
                    )}
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
        bottom:     0, left: 0, right: 0,
        height:     2,
        background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
        zIndex:     2,
      }} />

      <TelemetryFrame frame={frame} />
    </div>
  );
};
