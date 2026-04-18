/**
 * CodeDiff — before/after code block layout.
 *
 * Motion upgrades (design pass):
 *   • MEDIUM spring for after block entrance
 *   • Cursor blink on last line of after block after it appears
 *   • After block: shimmer sweep once lines settle
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { CodeDiffData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { SPRING_MEDIUM } from "../utils/springIn";
import { COLOR, FONT, BROADCAST_TEXT, SectionLabelRow, ParticleBackground, TelemetryFrame, shimmerStyle } from "./_shared";

const CODE_FONT    = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
const AFTER_START  = 22;
const LINE_STAGGER = 10;

const RED   = "#EF4444";
const GREEN = "#10B981";

export const CodeDiff: React.FC<{ data: CodeDiffData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = data.accent_color ? COLOR[data.accent_color] : GREEN;

  // Before block: fades in quickly, stays dim
  const beforeProgress = spring({
    frame:  Math.max(0, frame),
    fps,
    config: { damping: 30, stiffness: 300 },
  });
  const beforeOpacity = interpolate(beforeProgress, [0, 0.3], [0, 0.52], { extrapolateRight: "clamp" });

  // After block container — MEDIUM spring
  const afterFrame    = frame - AFTER_START;
  const afterProgress = afterFrame >= 0 ? spring({
    frame:  afterFrame,
    fps,
    config: SPRING_MEDIUM,
  }) : 0;
  const afterOpacity   = interpolate(afterProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const afterScale     = interpolate(afterProgress, [0, 1], [0.92, 1.0], { extrapolateRight: "clamp" });
  const afterTranslate = interpolate(afterProgress, [0, 1], [40, 0], { extrapolateRight: "clamp" });

  // Cursor: blinks after last line settles
  const lastLineFrame = afterFrame - (data.after.lines.length - 1) * LINE_STAGGER;
  const cursorVisible = lastLineFrame > 20;
  const cursorBlink   = cursorVisible
    ? Math.sin((frame / fps) * Math.PI * 2 * 1.5) > 0
    : false;

  // Shimmer on after block
  const shimmerStart = AFTER_START + (data.after.lines.length * LINE_STAGGER) + 8;
  const shimmerCycle = 100;
  const shimmerPos   = frame >= shimmerStart
    ? (((frame - shimmerStart) % shimmerCycle) / shimmerCycle) * 140 - 20
    : -30;
  const showShimmer = frame >= shimmerStart;

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
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "green"} />

        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "center",
          gap:            24,
        }}>
          {/* BEFORE block */}
          <div style={{ opacity: beforeOpacity, willChange: "opacity" }}>
            <div style={{
              ...BROADCAST_TEXT,
              fontSize:      18,
              fontWeight:    600,
              color:         RED,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom:  10,
              opacity:       0.8,
            }}>
              ✕  {data.before.label}
            </div>

            <div style={{
              background:   "rgba(239, 68, 68, 0.06)",
              border:       `1px solid rgba(239, 68, 68, 0.22)`,
              borderRadius: 12,
              padding:      "22px 28px",
            }}>
              {data.before.lines.map((line, i) => (
                <div key={i} style={{
                  fontSize:           44,
                  fontWeight:         500,
                  color:              "rgba(255,255,255,0.55)",
                  lineHeight:         1.55,
                  letterSpacing:      "-0.01em",
                  fontFamily:         CODE_FONT,
                  textDecoration:     "line-through",
                  textDecorationColor:"rgba(239,68,68,0.4)",
                }}>
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* AFTER block */}
          <div style={{
            opacity:         afterOpacity,
            transform:       `translateY(${afterTranslate}px) scale(${afterScale})`,
            transformOrigin: "left center",
            willChange:      "transform, opacity",
          }}>
            <div style={{
              fontSize:      18,
              fontWeight:    600,
              color:         accent,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily:    FONT,
              marginBottom:  10,
            }}>
              ✓  {data.after.label}
            </div>

            <div style={{
              background:   `${accent}0D`,
              border:       `1px solid ${accent}35`,
              borderRadius: 12,
              padding:      "22px 28px",
              boxShadow:    `0 0 48px ${accent}15`,
              position:     "relative",
              overflow:     "hidden",
            }}>
              {/* Shimmer sweep — specular model */}
              {showShimmer && <div style={shimmerStyle(shimmerPos)} />}

              {data.after.lines.map((line, i) => {
                const lineFrame    = afterFrame - i * LINE_STAGGER;
                const lineProgress = lineFrame >= 0 ? spring({
                  frame:  lineFrame,
                  fps,
                  config: { damping: 28, stiffness: 220 },
                }) : 0;
                const lineOpacity = interpolate(lineProgress, [0, 0.25], [0, 1], { extrapolateRight: "clamp" });
                const isLastLine  = i === data.after.lines.length - 1;

                return (
                  <div key={i} style={{
                    fontSize:      44,
                    fontWeight:    600,
                    color:         COLOR.white,
                    lineHeight:    1.55,
                    letterSpacing: "-0.01em",
                    fontFamily:    CODE_FONT,
                    opacity:       lineOpacity,
                    textShadow:    `0 0 20px ${accent}30`,
                  }}>
                    {line}
                    {/* Cursor blink on last line */}
                    {isLastLine && cursorBlink && (
                      <span style={{
                        display:        "inline-block",
                        width:          3,
                        height:         "0.85em",
                        background:     accent,
                        marginLeft:     4,
                        verticalAlign:  "middle",
                        boxShadow:      `0 0 8px ${accent}80`,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
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
