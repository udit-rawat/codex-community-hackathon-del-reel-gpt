/**
 * PipelineFlow — sequential step-by-step architecture layout.
 *
 * Motion upgrades (design pass):
 *   • MEDIUM spring tier for node entrances
 *   • Active/bottleneck nodes: continuous border glow pulse after entry
 *   • Connector lines: animated dashed flow after nodes settle
 *   • ParticleBackground + TelemetryFrame
 */

import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import type { PipelineFlowData, PipelineStep } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { springIn, staggerDelay } from "../utils/springIn";
import { FONT, SectionLabelRow, ParticleBackground, TelemetryFrame } from "./_shared";

// ── State styles ──────────────────────────────────────────────────────────────

const STATE = {
  idle:       { border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.02)", glow: "transparent" },
  active:     { border: "#6366F178",              text: "#6366F1",                bg: "rgba(99,102,241,0.08)",  glow: "#6366F1"    },
  bottleneck: { border: "#EF444478",              text: "#EF4444",                bg: "rgba(239,68,68,0.08)",   glow: "#EF4444"    },
} as const;

// ── Step node ─────────────────────────────────────────────────────────────────

const StepNode: React.FC<{
  step:    PipelineStep;
  frame:   number;
  fps:     number;
  delay:   number;
  isHoriz: boolean;
}> = ({ step, frame, fps, delay, isHoriz }) => {
  const s        = STATE[step.state] ?? STATE.idle;
  const progress = springIn(frame, fps, delay, "medium");
  const opacity  = interpolate(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const scale    = interpolate(progress, [0, 1], [0.78, 1]);

  // Glow pulse on active/bottleneck nodes after entry
  const glowFrame = Math.max(0, frame - delay - 12);
  const glowPulse = step.state !== "idle" && glowFrame > 0
    ? Math.sin((glowFrame / fps) * Math.PI * 2 * 0.4) * 0.5 + 0.5
    : 0;
  const glowRadius = step.state !== "idle" ? 14 + glowPulse * 20 : 0;

  return (
    <div style={{
      opacity,
      transform:     `scale(${scale})`,
      background:    s.bg,
      border:        `1px solid ${s.border}`,
      borderRadius:  12,
      padding:       isHoriz ? "20px 18px" : "18px 24px",
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      justifyContent:"center",
      gap:           6,
      minHeight:     isHoriz ? 110 : 72,
      minWidth:      isHoriz ? 80 : 0,
      flex:          isHoriz ? "1 1 0" : 1,
      overflow:      "hidden",
      boxShadow:     step.state !== "idle" ? `0 0 ${glowRadius}px ${s.glow}30` : undefined,
      boxSizing:     "border-box",
    }}>
      <div style={{ fontSize: 26, fontWeight: 600, color: s.text, fontFamily: FONT,
                    letterSpacing: "0.04em", textAlign: "center",
                    wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "100%" }}>
        {step.label}
      </div>
      {step.sublabel && (
        <div style={{ fontSize: 20, color: s.text, opacity: 0.6, fontFamily: FONT, textAlign: "center" }}>
          {step.sublabel}
        </div>
      )}
      {step.state === "bottleneck" && (
        <div style={{
          fontSize:     17, color: "#EF4444", fontWeight: 500,
          background:   "rgba(239,68,68,0.14)", padding: "3px 12px",
          borderRadius: 100, fontFamily: FONT, marginTop: 2,
        }}>
          bottleneck
        </div>
      )}
    </div>
  );
};

// ── Connector arrow ───────────────────────────────────────────────────────────

const Connector: React.FC<{ frame: number; fps: number; delay: number; isHoriz: boolean }> =
  ({ frame, fps, delay, isHoriz }) => {
  const opacity = interpolate(
    springIn(frame, fps, delay, "snap"),
    [0, 0.3], [0, 1], { extrapolateRight: "clamp" },
  );

  return isHoriz ? (
    <div style={{ display: "flex", alignItems: "center", opacity, flexShrink: 0, width: 36 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.14)" }} />
      <div style={{
        width: 0, height: 0,
        borderTop: "5px solid transparent", borderBottom: "5px solid transparent",
        borderLeft: "8px solid rgba(255,255,255,0.22)",
      }} />
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity, flexShrink: 0, height: 28 }}>
      <div style={{ flex: 1, width: 1, background: "rgba(255,255,255,0.14)" }} />
      <div style={{
        width: 0, height: 0,
        borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
        borderTop: "8px solid rgba(255,255,255,0.22)",
      }} />
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const PipelineFlow: React.FC<{ data: PipelineFlowData }> = ({ data }) => {
  const frame      = useBeatFrame();
  const { fps }    = useVideoConfig();
  const isHoriz    = data.flow_direction === "horizontal";
  const stepCount  = data.steps.length;

  return (
    <div style={{
      paddingTop:    120,
      paddingBottom: 180,
      paddingLeft:   72,
      paddingRight:  72,
      display:       "flex",
      flexDirection: "column",
      gap:           32,
      height:        "100%",
      boxSizing:     "border-box",
      background:    "linear-gradient(180deg, #111112 0%, #080809 100%)",
      position:      "relative",
      overflow:      "hidden",
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
        <SectionLabelRow text={data.section_label} color="yellow" />

        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  isHoriz ? "row" : "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            0,
        }}>
          {data.steps.map((step, i) => (
            <React.Fragment key={i}>
              <StepNode
                step={step} frame={frame} fps={fps} isHoriz={isHoriz}
                delay={staggerDelay(i, stepCount, 22, 0)}
              />
              {i < stepCount - 1 && (
                <Connector
                  frame={frame} fps={fps} isHoriz={isHoriz}
                  delay={staggerDelay(i, stepCount, 22, 10)}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {data.bottleneck_label && (
          <div style={{
            fontSize: 26, color: "#EF4444", fontFamily: FONT,
            opacity: interpolate(
              springIn(frame, fps, staggerDelay(stepCount, stepCount, 22, 12), "crisp"),
              [0, 0.3], [0, 1], { extrapolateRight: "clamp" },
            ),
          }}>
            ⚠ {data.bottleneck_label}
          </div>
        )}
      </div>

      <TelemetryFrame frame={frame} />
    </div>
  );
};
