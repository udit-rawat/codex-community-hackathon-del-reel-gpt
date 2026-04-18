/**
 * MetricFocus — hero metric display layout.
 *
 * Motion upgrades (design pass):
 *   • Hero number counts up from 0 → final value during scaleIn (HEAVY tier)
 *   • useBreath ambient oscillation after entrance settles
 *   • useAudioMetrics bassEnergy drives glow radius (audio-reactive)
 *   • ParticleBackground + TelemetryFrame signature
 */

import React from "react";
import { useVideoConfig } from "remotion";
import type { MetricFocusData } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { useAudioMetrics } from "../hooks/useAudioMetrics";
import { scaleIn, slideUp, staggerDelay } from "../utils/springIn";
import {
  COLOR, FONT, HERO_NUMBER, BROADCAST_TEXT, SectionLabelRow,
  ParticleBackground, TelemetryFrame,
  useBreath, countUp,
} from "./_shared";

export const MetricFocus: React.FC<{ data: MetricFocusData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.hero.color ?? "cyan"];
  const audio   = useAudioMetrics();

  const { opacity: heroOpacity, scale: heroScale, progress: heroProgress } =
    scaleIn(frame, fps, 8, "heavy");

  const breath  = useBreath(frame, fps);
  const ctx     = slideUp(frame, fps, 28, "soft");

  // Audio-reactive glow: base 40px + bassEnergy contribution up to +60px
  const glowRadius = 40 + (audio?.bassEnergy ?? 0) * 60;

  // Hero font size — responsive to value length
  const heroFontSize = Math.min(220, Math.floor(880 / Math.max(data.hero.value.length, 1)));

  // Count-up display: counting during spring, settled value after
  const displayValue = countUp(data.hero.value, heroProgress);

  // Breath kicks in after entrance settles (~frame 22)
  const breathScale   = frame > 22 ? breath.scale : 1;
  const breathOpacity = frame > 22 ? breath.opacityShift : 0;

  return (
    <div style={{
      paddingTop:    120,
      paddingBottom: 180,
      paddingLeft:   72,
      paddingRight:  72,
      display:        "flex",
      flexDirection:  "column",
      gap:            32,
      height:         "100%",
      boxSizing:      "border-box",
      justifyContent: "center",
      fontFamily:     FONT,
      background:     "linear-gradient(180deg, #111112 0%, #080809 100%)",
      position:       "relative",
      overflow:       "hidden",
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 32 }}>
        <SectionLabelRow text={data.section_label} color="cyan" />

        {/* Hero number — counts up + breathes */}
        <div style={{
          opacity:         heroOpacity + breathOpacity,
          transform:       `scale(${heroScale * breathScale})`,
          transformOrigin: "left center",
        }}>
          <div style={{
            ...HERO_NUMBER,
            fontSize:  heroFontSize,
            fontWeight:800,
            color:     accent,
            lineHeight:0.9,
            textShadow:`0 0 ${glowRadius}px ${accent}55, 0 0 ${glowRadius * 2}px ${accent}20`,
            maxWidth:  "100%",
            overflow:  "hidden",
            whiteSpace:"nowrap",
          }}>
            {displayValue}
          </div>
          <div style={{
            ...BROADCAST_TEXT,
            fontSize:     36,
            fontWeight:   500,
            color:        "#F9FAFB",
            opacity:      0.45,
            letterSpacing:"0.12em",
            textTransform:"uppercase",
            marginTop:    12,
          }}>
            {data.hero.label}
          </div>
        </div>

        {/* Context */}
        <div style={{
          opacity:    ctx.opacity * 0.65,
          transform:  `translateY(${ctx.translateY}px)`,
          fontSize:   44,
          color:      "#F9FAFB",
          lineHeight: 1.4,
          fontFamily: FONT,
          fontWeight: 400,
          maxWidth:   900,
        }}>
          {data.context}
        </div>

        {/* Chips */}
        {data.chips && data.chips.length > 0 && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {data.chips.map((chip, i) => {
              const sl = slideUp(
                frame, fps,
                staggerDelay(i, data.chips!.length, 16, 44),
                "soft",
              );
              // Chip breath: slow shadow pulse
              const chipPulse = Math.sin((frame / fps) * Math.PI * 2 * 0.25 + i) * 0.5 + 0.5;
              return (
                <span key={i} style={{
                  opacity:       sl.opacity,
                  transform:     `translateY(${sl.translateY}px)`,
                  display:       "inline-block",
                  background:    `${accent}12`,
                  border:        `1px solid ${accent}35`,
                  color:         accent,
                  padding:       "10px 24px",
                  borderRadius:  100,
                  fontSize:      26,
                  fontWeight:    500,
                  fontFamily:    FONT,
                  letterSpacing: "0.04em",
                  boxShadow:     `0 0 ${8 + chipPulse * 10}px ${accent}${frame > 22 ? "30" : "00"}`,
                }}>
                  {chip}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <TelemetryFrame frame={frame} />
    </div>
  );
};
