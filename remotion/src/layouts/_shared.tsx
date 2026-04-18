/**
 * _shared.tsx — design tokens, shared primitives, motion system.
 *
 * Palette: "Deep Winter Minimalist" — premium, high-contrast, no neon
 *   cyan   → #2563EB  Cobalt Blue  (structural accents, key data)
 *   yellow → #D1D5DB  Cool Silver  (secondary labels, muted context)
 *   green  → #10B981  Emerald      (positive metrics)
 *   red    → #E11D48  Deep Ruby    (negative metrics, critical info)
 *   white  → #FFFFFF  Icy White    (all primary display text)
 *
 * Motion tiers (see springIn.ts for spring configs):
 *   HEAVY  — hook + takeaway hero elements. Visible overshoot.
 *   MEDIUM — concept beat cards and data. Single-frame overshoot.
 *   SOFT   — secondary text, labels. Clean landing, no bounce.
 *
 * Shared components:
 *   <ParticleBackground frame />   — 40-particle digital dust field (all templates)
 *   <TelemetryFrame frame />       — 1px perimeter border (brand signature, all templates)
 *   <SectionLabelRow />            — micro-label with left accent bar
 *   <HRule />                      — subtle horizontal rule
 *
 * Hooks:
 *   useBreath(frame, fps)          — 0.25 Hz ambient scale/opacity pulse
 */

import React, { useRef, useLayoutEffect } from "react";
import { interpolate } from "remotion";
import type { CustomTheme, NodeColor } from "../types";

// ── Design tokens ─────────────────────────────────────────────────────────────

type ThemeName = "deep_winter" | "oxide_sunset" | "graphite_lime";

const THEME_PRESETS: Record<ThemeName, {
  bg: string;
  bgSolid: string;
  cyan: string;
  yellow: string;
  green: string;
  red: string;
  white: string;
  violet: string;
  font: string;
}> = {
  deep_winter: {
    bg: "linear-gradient(180deg, #111112 0%, #080809 100%)",
    bgSolid: "#0C0C0D",
    cyan: "#2563EB",
    yellow: "#D1D5DB",
    green: "#10B981",
    red: "#E11D48",
    white: "#FFFFFF",
    violet: "#1E3A5F",
    font: "'Inter', 'Space Grotesk', sans-serif",
  },
  oxide_sunset: {
    bg: "linear-gradient(180deg, #201310 0%, #120B09 100%)",
    bgSolid: "#140F0D",
    cyan: "#F97316",
    yellow: "#FED7AA",
    green: "#FB7185",
    red: "#DC2626",
    white: "#FFF7ED",
    violet: "#7C2D12",
    font: "'IBM Plex Sans', 'Avenir Next', sans-serif",
  },
  graphite_lime: {
    bg: "linear-gradient(180deg, #0F1410 0%, #090C09 100%)",
    bgSolid: "#0A0D0A",
    cyan: "#84CC16",
    yellow: "#D9F99D",
    green: "#22C55E",
    red: "#F97316",
    white: "#F7FEE7",
    violet: "#365314",
    font: "'Sora', 'Space Grotesk', sans-serif",
  },
};

let activeTheme = THEME_PRESETS.deep_winter;

export let COLOR: Record<NodeColor, string> = {
  cyan: activeTheme.cyan,
  yellow: activeTheme.yellow,
  green: activeTheme.green,
  red: activeTheme.red,
  white: activeTheme.white,
};

export let VIOLET = activeTheme.violet;

export let FONT = activeTheme.font;

export let SURFACE_BG = activeTheme.bg;

function isRenderableCssColor(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function setRuntimeTheme(name?: string, customTheme?: CustomTheme) {
  const key = (name ?? "deep_winter") as ThemeName;
  activeTheme = THEME_PRESETS[key] ?? THEME_PRESETS.deep_winter;

  const useCustom = Boolean(
    isRenderableCssColor(customTheme?.bg)
    && isRenderableCssColor(customTheme?.accent)
    && isRenderableCssColor(customTheme?.text),
  );
  const cyan = useCustom ? String(customTheme?.accent).trim() : activeTheme.cyan;
  const yellow = activeTheme.yellow;
  const green = activeTheme.green;
  const red = activeTheme.red;
  const white = useCustom ? String(customTheme?.text).trim() : activeTheme.white;
  const bgBase = useCustom ? String(customTheme?.bg).trim() : activeTheme.bgSolid;
  const bg = useCustom
    ? `linear-gradient(180deg, ${bgBase} 0%, ${bgBase} 100%)`
    : activeTheme.bg;

  COLOR = {
    cyan,
    yellow,
    green,
    red,
    white,
  };
  VIOLET = useCustom ? cyan : activeTheme.violet;
  FONT = activeTheme.font;
  SURFACE_BG = bg;
}

// ── Broadcast-grade typography styles ─────────────────────────────────────────
// Apply to all text elements for optical precision matching broadcast graphics.

export const BROADCAST_TEXT: React.CSSProperties = {
  fontFamily:             FONT,
  fontFeatureSettings:    '"kern" 1, "liga" 1, "calt" 1, "ss01" 1',
  fontOpticalSizing:      "auto" as const,
  textRendering:          "geometricPrecision" as const,
  WebkitFontSmoothing:    "antialiased",
  MozOsxFontSmoothing:    "grayscale",
};

/** Use on large numerals and hero values (tabular-nums prevents width jitter on count-ups). */
export const HERO_NUMBER: React.CSSProperties = {
  ...BROADCAST_TEXT,
  fontVariantNumeric: "tabular-nums",
  letterSpacing:      "-0.04em",
};

// ── Deterministic particle data (computed once, no Math.random) ───────────────

const frac = (v: number) => { const f = v - Math.floor(v); return f; };
const det  = (seed: number) => frac(Math.sin(seed) * 43758.5453);

export const PARTICLE_FIELD = Array.from({ length: 40 }, (_, i) => ({
  x:        det(i * 127.1) * 1080,
  y:        det(i * 311.7 + 99) * 1920,
  size:     1 + Math.round(det(i * 74.3 + 33) * 1.5),
  xFreq:    0.007 + det(i * 53.1) * 0.005,
  xAmp:     18 + det(i * 91.3) * 28,
  blurred:  i % 2 === 0,
  isCyan:   i % 3 !== 2,                               // 2/3 cobalt, 1/3 navy
}));

// ── ParticleBackground ────────────────────────────────────────────────────────

/**
 * Shared particle field — canvas implementation.
 * 40 DOM nodes → 1 canvas element. Canvas shadowBlur = GPU-composited gaussian,
 * not software CSS blur. Circular particles instead of 1px square divs.
 * useLayoutEffect fires synchronously pre-paint — Remotion Puppeteer screenshots after.
 */
export const ParticleBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 1080, 1920);

    for (const p of PARTICLE_FIELD) {
      const top  = ((p.y - frame * 0.3) % 1920 + 1920) % 1920;
      const left = p.x + Math.sin(frame * p.xFreq) * p.xAmp;
      const color = p.isCyan ? COLOR.cyan : VIOLET;

      ctx.save();

      if (p.blurred) {
        // Depth-of-field tier: soft glow, lower opacity
        ctx.globalAlpha = 0.08;
        ctx.shadowBlur  = 6;
        ctx.shadowColor = color;
      } else {
        // Sharp tier: crisp dot with tight GPU glow
        ctx.globalAlpha = 0.18;
        ctx.shadowBlur  = 3;
        ctx.shadowColor = color;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(left, top, p.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1920}
      style={{
        position:      "absolute",
        inset:         0,
        pointerEvents: "none",
        zIndex:        0,
      }}
    />
  );
};

// ── TelemetryFrame — canvas border (Phase 2) ─────────────────────────────────

/**
 * Canvas-based 1px Cyber Cyan border — replaces CSS border.
 * Benefits over CSS border:
 *   • strokeRect sub-pixel precise — no box-model bleed on odd pixel widths
 *   • Animated dash offset on transition: marching ants effect at beat start
 *   • Acid Volt streak drawn directly on canvas via gradient fill — no extra DOM node
 *
 * Normal: 20% opacity solid stroke.
 * Frames 0–15: opacity spikes to 100%, dash offset marches, streak sweeps top.
 */
export const TelemetryFrame: React.FC<{ frame: number }> = ({ frame }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 1080, 1920);

    const isTransition = frame < 16;

    const borderOpacity = isTransition
      ? interpolate(frame, [0, 3, 10, 16], [1, 1, 0.55, 0.2], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        })
      : 0.2;

    // Border stroke
    ctx.save();
    ctx.strokeStyle = `rgba(37,99,235,${borderOpacity})`; // Cobalt Blue #2563EB
    ctx.lineWidth   = 1;

    if (isTransition) {
      // Marching-ants dash: offset advances by 2px/frame
      const dashLen    = 12;
      const gapLen     = 8;
      const dashOffset = -(frame * 2) % (dashLen + gapLen);
      ctx.setLineDash([dashLen, gapLen]);
      ctx.lineDashOffset = dashOffset;
    } else {
      ctx.setLineDash([]);
    }

    ctx.strokeRect(0.5, 0.5, 1079, 1919);
    ctx.restore();

    // Acid Volt streak along top edge (frames 0–15)
    if (isTransition) {
      const streakPct = interpolate(frame, [0, 15], [-8, 108], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });
      const streakOpacity = interpolate(frame, [0, 5, 13, 16], [0, 1, 1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });

      const streakCx = (streakPct / 100) * 1080;
      const grad = ctx.createLinearGradient(streakCx - 60, 0, streakCx + 60, 0);
      grad.addColorStop(0,   "transparent");
      grad.addColorStop(0.5, `rgba(37,99,235,${streakOpacity})`);    // #2563EB Cobalt Blue
      grad.addColorStop(1,   "transparent");

      ctx.save();
      ctx.filter    = "blur(1px)";
      ctx.fillStyle = grad;
      ctx.fillRect(streakCx - 60, 0, 120, 2);
      ctx.restore();
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1920}
      style={{
        position:      "absolute",
        inset:         0,
        pointerEvents: "none",
        zIndex:        1000,
      }}
    />
  );
};

// ── Shared sub-components ─────────────────────────────────────────────────────

export const SectionLabelRow: React.FC<{
  text:   string;
  color?: NodeColor;
}> = ({ text, color = "cyan" }) => {
  const c = COLOR[color];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
      <div style={{ width: 3, height: 22, background: c, borderRadius: 2, opacity: 0.9 }} />
      <div style={{
        ...BROADCAST_TEXT,
        fontSize: 22, fontWeight: 600, color: c,
        letterSpacing: "0.12em",
        textTransform: "uppercase", opacity: 0.85,
      }}>
        {text}
      </div>
    </div>
  );
};

export const HRule: React.FC = () => (
  <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
);

// ── Specular shimmer utility ──────────────────────────────────────────────────

/**
 * shimmerStyle — angle-aware specular highlight replacing the flat white smear.
 * Narrow bright core (peak 20% opacity) with soft falloff either side.
 * Matches real glass/metal specularity: bright centre, fast falloff.
 *
 * shimmerPos: -20 → 120 (percentage left offset)
 */
export function shimmerStyle(shimmerPos: number): React.CSSProperties {
  return {
    position:      "absolute",
    inset:         0,
    left:          `${shimmerPos}%`,
    width:         "22%",
    background:    [
      "linear-gradient(90deg,",
      "  transparent 0%,",
      "  rgba(255,255,255,0.02) 20%,",
      "  rgba(255,255,255,0.12) 45%,",
      "  rgba(255,255,255,0.20) 50%,",
      "  rgba(255,255,255,0.12) 55%,",
      "  rgba(255,255,255,0.02) 80%,",
      "  transparent 100%",
      ")",
    ].join(""),
    transform:     "skewX(-18deg)",
    pointerEvents: "none",
  };
}

// ── Ambient breathing hook ────────────────────────────────────────────────────

/**
 * useBreath — continuous 0.25 Hz sinusoidal pulse.
 * Returns scale (1 ± 0.012) and opacityShift (± 0.04).
 * Apply to hero elements after their entrance spring settles (~frame 20+).
 */
export function useBreath(frame: number, fps: number) {
  const phase = (frame / fps) * Math.PI * 2 * 0.25;
  const sin   = Math.sin(phase);
  return {
    scale:        1 + sin * 0.012,
    opacityShift: sin * 0.04,
  };
}

// ── Phase 2 animation primitives ─────────────────────────────────────────────
//
// Consumed by brief_generator's animation_brief.json spec.
// Templates accept optional frame arrays; these hooks do the math.

/**
 * usePulseAt — glow pulse at specific frames.
 * Returns a CSS boxShadow string. Ramps in 6f, holds, fades over 18f.
 */
export function usePulseAt(
  frame: number,
  pulseFrames: number[],
  color: string,
  radius = 32,
): string {
  const fired = pulseFrames.filter(f => frame >= f);
  if (fired.length === 0) return "none";
  const age = frame - Math.max(...fired);
  const strength = interpolate(age, [0, 6, 12, 30], [0, 1, 0.9, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  if (strength <= 0.01) return "none";
  const r  = Math.round(radius * strength);
  const r2 = Math.round(radius * 2 * strength);
  return `0 0 ${r}px ${color}99, 0 0 ${r2}px ${color}44`;
}

/**
 * useSlideIn — per-element directional entrance.
 * Returns { opacity, transform } style fragment.
 */
export function useSlideIn(
  frame: number,
  direction: "left" | "right" | "up" | "down",
  startFrame: number,
  distance = 40,
): { opacity: number; transform: string } {
  const f    = Math.max(0, frame - startFrame);
  const prog = interpolate(f, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const ease = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
  const d    = (1 - ease) * distance;
  const tx   = direction === "left" ? -d : direction === "right" ? d : 0;
  const ty   = direction === "up"   ?  d : direction === "down"  ? -d : 0;
  return {
    opacity:   interpolate(prog, [0, 0.25], [0, 1], { extrapolateRight: "clamp" }),
    transform: `translate(${tx}px, ${ty}px)`,
  };
}

/**
 * useHighlightAt — checkmark pop + scale burst at a specific frame.
 * Returns { scale, active, opacity }.
 */
export function useHighlightAt(
  frame: number,
  highlightFrame: number,
): { scale: number; active: boolean; opacity: number } {
  if (frame < highlightFrame) return { scale: 1, active: false, opacity: 0 };
  const age = frame - highlightFrame;
  const scale   = interpolate(age, [0, 6, 12, 20, 60], [0.6, 1.12, 1.06, 1.04, 1.04], { extrapolateRight: "clamp" });
  const opacity = interpolate(age, [0, 5], [0, 1], { extrapolateRight: "clamp" });
  return { scale, active: true, opacity };
}

// ── Count-up helper ───────────────────────────────────────────────────────────

/**
 * parseHeroValue — splits a formatted value string into numeric and decorative parts.
 * Examples: "400M" → {prefix:"", num:400, suffix:"M", decimals:0}
 *           "3.8×" → {prefix:"", num:3.8, suffix:"×", decimals:1}
 *           ">3B"  → {prefix:">", num:3,  suffix:"B", decimals:0}
 *           "90ms" → {prefix:"", num:90,  suffix:"ms", decimals:0}
 */
export function parseHeroValue(value: string) {
  const m = value.match(/^([^0-9.]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!m) return { prefix: "", num: 0, suffix: value, decimals: 0 };
  const decimals = m[2].includes(".") ? m[2].split(".")[1].length : 0;
  return { prefix: m[1], num: parseFloat(m[2]), suffix: m[3], decimals };
}

/**
 * countUp — returns a formatted display string that counts from 0 to target.
 * progress: 0→1 (use spring progress). Finishes counting at progress=0.88
 * so the number lands before the spring fully settles.
 */
export function countUp(value: string, progress: number): string {
  const { prefix, num, suffix, decimals } = parseHeroValue(value);
  if (num === 0) return value;
  const current = interpolate(progress, [0, 0.88], [0, num], { extrapolateRight: "clamp" });
  return `${prefix}${current.toFixed(decimals)}${suffix}`;
}
