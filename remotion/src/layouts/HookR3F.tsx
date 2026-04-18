/**
 * HookR3F — Phase 3 hook beat using React Three Fiber for hero logo.
 *
 * Architecture:
 *   DOM layer:   ParticleBackground, headline text, hook subtext (z-index above canvas)
 *   R3F layer:   MetallicLogoPlate (ThreeCanvas) — physically-based metallic logo slab
 *
 * Use in CustomVideo.tsx hook beats by swapping the DOM logo div for:
 *   <HookR3F frame={frame} fps={fps} text="AMD" color="#00B050" subtext="MI355X" />
 *
 * Props mirror compositor hook design — all data hardcoded at call site per
 * compositor pattern (no pipeline injection needed for Phase 3).
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AbsoluteFill } from "remotion";
import { COLOR, FONT, BROADCAST_TEXT, HERO_NUMBER, ParticleBackground, TelemetryFrame } from "./_shared";
import { MetallicLogoPlate, GlassmorphCard } from "../r3f/MetallicHook";
import { SPRING_HEAVY, SPRING_MEDIUM } from "../utils/springIn";

export interface HookR3FProps {
  /** Logo text — e.g. "AMD", "DeepSeek", "$0" */
  text:          string;
  /** Optional second line below logo text */
  subtext?:      string;
  /** Hex color for R3F accent lights + DOM accents */
  color:         string;
  /** Large hero number/word slammed in below the plate */
  heroValue:     string;
  /** Small label under hero value */
  heroLabel:     string;
  /** Hook line shown at bottom (small, forces focus) */
  hookLine:      string;
  /** Frame at which heroValue slams in (local beat frame) */
  slamFrame?:    number;
  /** Total height of the ThreeCanvas logo plate in px */
  plateHeight?:  number;
}

export const HookR3F: React.FC<HookR3FProps> = ({
  text,
  subtext,
  color,
  heroValue,
  heroLabel,
  hookLine,
  slamFrame    = 80,
  plateHeight  = 400,
}) => {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Plate entrance — slides up from below
  const plateProg  = spring({ frame: Math.max(0, frame), fps, config: SPRING_MEDIUM });
  const plateY     = interpolate(plateProg, [0, 1], [60, 0]);
  const plateOp    = interpolate(plateProg, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });

  // Hero value slam — SPRING_HEAVY scale from 0.4
  const slamProg   = spring({ frame: Math.max(0, frame - slamFrame), fps, config: SPRING_HEAVY });
  const slamScale  = interpolate(slamProg, [0, 1], [0.4, 1]);
  const slamOp     = interpolate(slamProg, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });

  // Breathing neon glow on hero value
  const glow       = 20 + (Math.sin((frame / fps) * Math.PI * 2 * 0.55) * 0.5 + 0.5) * 45;

  // Hero label fades in 12 frames after slam
  const labelProg  = spring({ frame: Math.max(0, frame - slamFrame - 12), fps, config: SPRING_MEDIUM });
  const labelOp    = interpolate(labelProg, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

  // Hook line fades in last
  const hookProg   = spring({ frame: Math.max(0, frame - slamFrame - 28), fps, config: SPRING_MEDIUM });
  const hookOp     = interpolate(hookProg, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const hookY      = interpolate(hookProg, [0, 1], [12, 0]);

  return (
    <AbsoluteFill style={{
      background:    "linear-gradient(180deg, #111112 0%, #080809 100%)",
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      justifyContent:"center",
      fontFamily:    FONT,
      overflow:      "hidden",
      paddingTop:    120,
      paddingBottom: 180,
      paddingLeft:   72,
      paddingRight:  72,
      boxSizing:     "border-box",
      gap:           24,
    }}>

      <ParticleBackground frame={frame} />

      {/* R3F Metallic Logo Plate */}
      <div style={{
        opacity:   plateOp,
        transform: `translateY(${plateY}px)`,
        width:     "100%",
        position:  "relative",
        zIndex:    2,
      }}>
        <MetallicLogoPlate
          frame={frame}
          fps={fps}
          text={text}
          subtext={subtext}
          color={color}
          width={936}       // 1080 - 2×72px padding
          height={plateHeight}
        />
      </div>

      {/* Hero value slam */}
      <div style={{
        opacity:         slamOp,
        transform:       `scale(${slamScale})`,
        transformOrigin: "center center",
        position:        "relative",
        zIndex:          3,
        textAlign:       "center",
      }}>
        <div style={{
          ...HERO_NUMBER,
          fontSize:  120,
          fontWeight:900,
          color,
          lineHeight:1,
          textShadow:`0 0 ${glow}px ${color}70, 0 0 ${glow * 2}px ${color}25`,
        }}>
          {heroValue}
        </div>
      </div>

      {/* Hero label */}
      <div style={{
        opacity:  labelOp,
        position: "relative",
        zIndex:   3,
      }}>
        <div style={{
          ...BROADCAST_TEXT,
          fontSize:     32,
          fontWeight:   600,
          color,
          letterSpacing:"0.14em",
          textTransform:"uppercase",
          textShadow:   `0 0 16px ${color}60`,
        }}>
          {heroLabel}
        </div>
      </div>

      {/* Hook line — small, forces focus, re-watch trigger */}
      <div style={{
        opacity:   hookOp,
        transform: `translateY(${hookY}px)`,
        position:  "relative",
        zIndex:    3,
        marginTop: 8,
      }}>
        <div style={{
          ...BROADCAST_TEXT,
          fontSize:  26,
          color:     "rgba(255,255,255,0.28)",
          textAlign: "center",
          maxWidth:  680,
          lineHeight:1.55,
        }}>
          {hookLine}
        </div>
      </div>

      <TelemetryFrame frame={frame} />
    </AbsoluteFill>
  );
};

// ── GlassmorphBeat — concept beat wrapper using R3F glass card ────────────────

export interface GlassmorphBeatProps {
  accentColor?: string;
  delay?:       number;
  children:     React.ReactNode;   // DOM content layered over the glass card
  cardHeight?:  number;
}

/**
 * Wraps concept beat content in a physically-based glass card.
 * The R3F card sits behind DOM content — DOM text overlays via absolute positioning.
 */
export const GlassmorphBeat: React.FC<GlassmorphBeatProps> = ({
  accentColor = COLOR.cyan,
  delay       = 0,
  children,
  cardHeight  = 500,
}) => {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* R3F glass card — renders behind DOM content */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <GlassmorphCard
          frame={frame}
          fps={fps}
          accentColor={accentColor}
          delay={delay}
          width={984}
          height={cardHeight}
        />
      </div>
      {/* DOM content on top */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};
