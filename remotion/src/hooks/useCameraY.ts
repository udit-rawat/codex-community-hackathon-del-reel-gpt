/**
 * useCameraY.ts — Infinite-canvas camera hook (Motion Design v2 — Phase 2)
 *
 * Algorithm (per TDD §PILLAR 2):
 *   1. targetY[i] = i * 1920   (0-indexed beat position on virtual canvas)
 *   2. For each transition i → i+1:
 *        panStartFrame = round(timing[beat_i].end * fps) - 18   (~0.6s early)
 *        spring from 0 → 1 starting at panStartFrame, contributing 1920px to cameraY
 *        config: damping 180, stiffness 320, overshootClamping true (~0.8s travel)
 *   3. Ken Burns: +8px drift over the full current beat duration (sine easing)
 *   4. cameraVelocity = cameraY[frame] - cameraY[frame-1]  (for CRTWrapper in Phase 4)
 *
 * Total cameraY = Σ spring_i_progress × 1920  +  kbDrift
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimingEntry } from "../types";

// ── Timing key mapping ────────────────────────────────────────────────────────
// Mirrors VideoComposition.beatToTimingKey — kept here to avoid circular import.

export function beatNumToTimingKey(beatNum: number, totalBeats: number): string {
  if (beatNum === 1) return "hook";
  if (beatNum === totalBeats) return "takeaway_cta";
  return `concept_${beatNum - 1}`;
}

// ── Pure camera-position computation ─────────────────────────────────────────
// Separated from the hook so we can call it for both frame and frame-1
// without violating React hooks rules.

function computeCameraY(
  frame: number,
  fps: number,
  timing: Record<string, TimingEntry>,
  totalBeats: number,
): number {
  let cameraY = 0;

  // ── Spring pans: one per transition ──────────────────────────────────────
  for (let i = 0; i < totalBeats - 1; i++) {
    const key   = beatNumToTimingKey(i + 1, totalBeats);
    const entry = timing[key];
    if (!entry) continue;

    const beatEndFrame  = Math.round(entry.end * fps);
    const panStartFrame = beatEndFrame - 18;

    const progress = spring({
      frame: Math.max(0, frame - panStartFrame),
      fps,
      config: { damping: 180, stiffness: 320, overshootClamping: true },
    });

    cameraY += progress * 1920;
  }

  // ── Ken Burns: gentle drift within the current beat ───────────────────────
  // "Current beat" = beat index whose timing window frame falls in.
  let currentBeatIndex = 0;
  for (let i = 0; i < totalBeats - 1; i++) {
    const key   = beatNumToTimingKey(i + 1, totalBeats);
    const entry = timing[key];
    if (!entry) continue;
    if (frame >= Math.round(entry.end * fps) - 18) currentBeatIndex = i + 1;
  }

  const currentKey   = beatNumToTimingKey(currentBeatIndex + 1, totalBeats);
  const currentEntry = timing[currentKey];
  if (currentEntry) {
    const beatStart = Math.round(currentEntry.start * fps);
    const beatEnd   = Math.round(currentEntry.end   * fps);
    if (beatEnd > beatStart) {
      const kbDrift = interpolate(
        frame,
        [beatStart, beatEnd],
        [0, 8],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      cameraY += kbDrift;
    }
  }

  return cameraY;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCameraY(
  timing: Record<string, TimingEntry>,
  totalBeats: number,
): { cameraY: number; cameraVelocity: number } {
  const frame       = useCurrentFrame();
  const { fps }     = useVideoConfig();

  const cameraY  = computeCameraY(frame,              fps, timing, totalBeats);
  const prevY    = computeCameraY(Math.max(0, frame - 1), fps, timing, totalBeats);

  return {
    cameraY,
    cameraVelocity: cameraY - prevY,
  };
}
