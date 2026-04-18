/**
 * springIn.ts — motion tier system + shared animation utilities.
 *
 * THREE TIERS (Gemini design pass — overshootClamping removed on Heavy + Medium):
 *
 *   HEAVY   stiffness 150, damping 12, mass 1.2, overshoot ON
 *           → Hook hero text, TakeawayScene card. Visible bounce, carries weight.
 *           → Entrance distance: 80px from below.
 *
 *   MEDIUM  stiffness 220, damping 18, mass 1,   overshoot ON
 *           → Concept beat cards, data bars, ComparisonSplit panels.
 *           → Single-frame overshoot. Fast but organic.
 *           → Entrance distance: 40px.
 *
 *   SOFT    stiffness 250, damping 25, mass 1,   overshoot OFF
 *           → Secondary text, labels, chips. Clean, sharp landing.
 *           → Entrance distance: 15px.
 *
 * Legacy presets (CRISP, HERO, SNAP) kept for backward compatibility.
 */

import { spring, interpolate } from "remotion";

// ── Spring configs ─────────────────────────────────────────────────────────────

interface SpringConfig {
  damping:           number;
  stiffness:         number;
  mass?:             number;
  overshootClamping: boolean;
}

// ── New motion tiers ──────────────────────────────────────────────────────────

/** HEAVY — hook hero + takeaway. Visible overshoot, carries mass. */
export const SPRING_HEAVY: SpringConfig = {
  damping: 12, stiffness: 150, mass: 1.2, overshootClamping: false,
};

/** MEDIUM — concept beat cards, data bars. One-frame overshoot, organic. */
export const SPRING_MEDIUM: SpringConfig = {
  damping: 18, stiffness: 220, mass: 1, overshootClamping: false,
};

/** SOFT — secondary text, labels, chips. Clean landing. */
export const SPRING_SOFT: SpringConfig = {
  damping: 25, stiffness: 250, mass: 1, overshootClamping: true,
};

// ── Legacy presets (backward compat) ─────────────────────────────────────────

const SPRING_CRISP: SpringConfig = { damping: 28, stiffness: 220, overshootClamping: true };
const SPRING_HERO:  SpringConfig = { damping: 28, stiffness: 180, overshootClamping: true };
const SPRING_SNAP:  SpringConfig = { damping: 40, stiffness: 300, overshootClamping: true };

export type SpringPreset = "crisp" | "hero" | "snap" | "heavy" | "medium" | "soft";

const PRESET_MAP: Record<SpringPreset, SpringConfig> = {
  crisp:  SPRING_CRISP,
  hero:   SPRING_HERO,
  snap:   SPRING_SNAP,
  heavy:  SPRING_HEAVY,
  medium: SPRING_MEDIUM,
  soft:   SPRING_SOFT,
};

// ── Entrance distances per tier ───────────────────────────────────────────────

const ENTER_DIST: Record<SpringPreset, number> = {
  heavy:  80,
  medium: 40,
  soft:   15,
  crisp:  16,
  hero:   16,
  snap:   8,
};

// ── Core utility ──────────────────────────────────────────────────────────────

export function springIn(
  frame: number,
  fps: number,
  delay: number = 0,
  preset: SpringPreset = "medium",
): number {
  return spring({
    frame:  Math.max(0, frame - delay),
    fps,
    config: PRESET_MAP[preset],
  });
}

// ── Derived animation values ──────────────────────────────────────────────────

export interface SlideUpValues {
  opacity:    number;
  translateY: number;
}

export function slideUp(
  frame: number,
  fps: number,
  delay: number = 0,
  preset: SpringPreset = "medium",
): SlideUpValues {
  const progress = springIn(frame, fps, delay, preset);
  const dist     = ENTER_DIST[preset];
  return {
    opacity:    interpolate(progress, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }),
    translateY: interpolate(progress, [0, 1],    [dist, 0]),
  };
}

export interface ScaleInValues {
  opacity:  number;
  scale:    number;
  progress: number;
}

export function scaleIn(
  frame: number,
  fps: number,
  delay: number = 0,
  preset: SpringPreset = "heavy",
): ScaleInValues {
  const progress = springIn(frame, fps, delay, preset);
  return {
    opacity:  interpolate(progress, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }),
    scale:    interpolate(progress, [0, 1],    [0.72, 1.0]),
    progress,
  };
}

export interface PopInValues {
  opacity: number;
  scale:   number;
}

export function popIn(
  frame: number,
  fps: number,
  delay: number = 0,
): PopInValues {
  const progress = springIn(frame, fps, delay, "medium");
  return {
    opacity: interpolate(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
    scale:   interpolate(progress, [0, 1],   [0.85, 1.0]),
  };
}

// ── HEAVY slam with anticipation sneak ───────────────────────────────────────

/**
 * slideUpHeavy — HEAVY spring entrance with 3-frame anticipation.
 * Before the main slam, the element sneaks 4px in the WRONG direction
 * (downward), then launches. Adds perceived mass and snappiness.
 *
 * Returns { opacity, translateY, progress }.
 * Drop-in replacement for slideUp(frame, fps, delay, "heavy").
 */
export function slideUpHeavy(
  frame: number,
  fps: number,
  delay: number = 0,
): { opacity: number; translateY: number; progress: number } {
  const ANTICIPATION_FRAMES = 3;
  const localFrame = frame - delay;

  // Anticipation: 0→3 frames, sneak 4px wrong-way (downward = positive Y)
  const antProgress = interpolate(
    localFrame,
    [0, ANTICIPATION_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const anticipationY = Math.sin(antProgress * Math.PI) * 4; // 0 → 4 → 0px

  // Main spring starts after anticipation window
  const mainProgress = spring({
    frame:  Math.max(0, localFrame - ANTICIPATION_FRAMES),
    fps,
    config: SPRING_HEAVY,
  });

  return {
    opacity:    interpolate(mainProgress, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }),
    translateY: interpolate(mainProgress, [0, 1], [80, 0]) + anticipationY,
    progress:   mainProgress,
  };
}

// ── Stagger utility ───────────────────────────────────────────────────────────

export function staggerDelay(
  index: number,
  total: number,
  budgetFrames: number = 24,
  baseDelay: number = 0,
): number {
  if (total <= 1) return baseDelay;
  return baseDelay + Math.round((index / total) * budgetFrames);
}
