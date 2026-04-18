/**
 * KineticBridge — conversational gap filler. Kills the "black hole" problem.
 *
 * Motion upgrades (design pass):
 *   • Ghost trail: at peak scale, a ghost copy scales to 1.5× and fades out over 10 frames
 *   • MEDIUM spring tier (single-frame overshoot, carries mass)
 *   • Keyword glow pulses with slow sin wave during hold
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { KineticBridgeData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { COLOR, FONT, SectionLabelRow, ParticleBackground, TelemetryFrame } from "./_shared";
import { SPRING_MEDIUM } from "../utils/springIn";

const HOLD_FRAMES = 44; // full spring window per keyword @30fps
const EXIT_FRAMES = 10; // fade-out duration at end of window
const EXIT_START  = HOLD_FRAMES - EXIT_FRAMES; // 34
const GHOST_DURATION = 10; // ghost trail lasts 10 frames after peak scale

const STEP = HOLD_FRAMES;

export const KineticBridge: React.FC<{ data: KineticBridgeData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];
  const kws     = data.keywords;

  // After one full pass, freeze at last keyword rest state
  const lastKeywordRestFrame = (kws.length - 1) * STEP + Math.round(EXIT_START * 0.4);
  const effectiveFrame = Math.min(frame, lastKeywordRestFrame);

  // 0.25 Hz ambient breath
  const breathScale = 1 + Math.sin((effectiveFrame / fps) * Math.PI * 2 * 0.25) * 0.015;

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
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "cyan"} />

        {/* Keyword slots */}
        <div style={{
          flex:       1,
          position:   "relative",
          display:    "flex",
          alignItems: "center",
        }}>
          {kws.map((kw, i) => {
            const firstStart = i * STEP;
            const kwFrame    = effectiveFrame - firstStart;

            const inWindow = kwFrame >= 0 && kwFrame < HOLD_FRAMES;
            if (!inWindow) return null;

            const entryProgress = spring({
              frame:  Math.max(0, kwFrame),
              fps,
              config: SPRING_MEDIUM,
            });

            const entryOpacity = interpolate(
              entryProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" },
            );
            const exitOpacity = interpolate(kwFrame, [EXIT_START, HOLD_FRAMES - 2], [1, 0], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            });

            const scale   = interpolate(entryProgress, [0, 1], [0.72, 1.0]) * breathScale;
            const opacity = entryOpacity * exitOpacity;

            // Glow pulse during hold: slow sin wave ramps up after entry settles
            const holdFrac = Math.max(0, (kwFrame - 8) / (EXIT_START - 8));
            const glowPulse = Math.sin((kwFrame / fps) * Math.PI * 2 * 0.5) * 0.5 + 0.5;
            const glowRadius = holdFrac > 0.1 ? 40 + glowPulse * 40 : 40;

            // Colour cycles per-keyword
            const kwColor = i === 0 ? accent
              : i % 3 === 1 ? COLOR.white
              : i % 3 === 2 ? COLOR[data.accent_color === "green" ? "cyan" : "green"]
              : accent;

            // Ghost trail: fire when entry progress > 0.75 (near peak scale)
            // ghost kwFrame relative to when entry peaked (~frame 6-8 for MEDIUM)
            const ghostStart = 7; // frames after window start when peak scale is reached
            const ghostFrame = kwFrame - ghostStart;
            const showGhost  = ghostFrame >= 0 && ghostFrame < GHOST_DURATION;
            const ghostScale = showGhost
              ? interpolate(ghostFrame, [0, GHOST_DURATION], [1.0, 1.5], { extrapolateRight: "clamp" })
              : 1.5;
            const ghostOpacity = showGhost
              ? interpolate(ghostFrame, [0, GHOST_DURATION], [0.35, 0], { extrapolateRight: "clamp" })
              : 0;

            const fontSize = data.keywords.length <= 2 ? 120 : 96;

            return (
              <React.Fragment key={i}>
                {/* Ghost trail layer */}
                {showGhost && (
                  <div style={{
                    position:        "absolute",
                    left:            0,
                    right:           0,
                    top:             "50%",
                    opacity:         ghostOpacity,
                    transform:       `translateY(-50%) scale(${ghostScale})`,
                    transformOrigin: "left center",
                    pointerEvents:   "none",
                  }}>
                    <div style={{
                      fontSize,
                      fontWeight:    800,
                      color:         kwColor,
                      lineHeight:    1.05,
                      letterSpacing: "-0.03em",
                      fontFamily:    FONT,
                      textShadow:    `0 0 60px ${kwColor}60`,
                    }}>
                      {kw}
                    </div>
                  </div>
                )}

                {/* Main keyword layer */}
                <div style={{
                  position:        "absolute",
                  left:            0,
                  right:           0,
                  top:             "50%",
                  opacity,
                  transform:       `translateY(-50%) scale(${scale})`,
                  transformOrigin: "left center",
                  willChange:      "transform, opacity",
                }}>
                  <div style={{
                    fontSize,
                    fontWeight:    800,
                    color:         kwColor,
                    lineHeight:    1.05,
                    letterSpacing: "-0.03em",
                    fontFamily:    FONT,
                    textShadow:    `0 0 ${glowRadius}px ${kwColor}30, 0 0 ${glowRadius * 2}px ${kwColor}10`,
                  }}>
                    {kw}
                  </div>
                </div>
              </React.Fragment>
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
