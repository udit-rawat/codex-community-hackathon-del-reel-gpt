/**
 * useAudioMetrics.ts — Audio frequency analysis hook (Motion Design v2 — Phase 3)
 *
 * Called ONCE at <VideoComposition> root. Injects four normalised metrics
 * that drive CSS custom properties (--audio-rms, --audio-bass, --audio-mid,
 * --audio-high) consumed by TerminalText, LabelValueCard, and MatrixBackground.
 *
 * Algorithm (per TDD §PILLAR 3):
 *   1. useAudioData() — returns null until loaded; hook returns ZERO_METRICS then.
 *   2. 5-frame smoothing window: call visualizeAudio for frame-2 … frame+2, average.
 *   3. Frequency bin mapping at 256 samples:
 *        bins 0–32:   sub-bass + bass  → bassEnergy  (border glow pulse, matrix speed)
 *        bins 33–128: mid / voice      → midEnergy   (card inner glow, matrix opacity)
 *        bins 129–255: presence / air  → highEnergy  (screen grain — Phase 4)
 *        all 256:     RMS              → rms         (text-shadow spread)
 *   4. All outputs clamped to [0, 1].
 */

import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AudioMetrics {
  rms:         number;   // overall loudness           → text-shadow spread
  bassEnergy:  number;   // sub-bass + bass (0–32)     → border glow + matrix speed
  midEnergy:   number;   // mid / voice (33–128)       → card glow + matrix opacity
  highEnergy:  number;   // presence / air (129–255)   → screen grain (Phase 4)
}

const ZERO_METRICS: AudioMetrics = {
  rms: 0, bassEnergy: 0, midEnergy: 0, highEnergy: 0,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const NUM_SAMPLES    = 256;
const SMOOTH_OFFSETS = [-2, -1, 0, 1, 2] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function binMean(bins: number[], start: number, end: number): number {
  let sum = 0;
  for (let i = start; i <= end; i++) sum += bins[i];
  return sum / (end - start + 1);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Computes per-frame audio metrics from the narration audio.
 * Safe to call even when no audio file exists — returns ZERO_METRICS.
 *
 * @param audioSrc  Filename in remotion/public/ (e.g. "narration.wav")
 */
export function useAudioMetrics(audioSrc: string = "narration.wav"): AudioMetrics {
  const frame      = useCurrentFrame();
  const { fps }    = useVideoConfig();
  const audioData  = useAudioData(staticFile(audioSrc));

  // audioData is null while loading or when file doesn't exist — safe fallback
  if (!audioData) return ZERO_METRICS;

  // ── 5-frame smoothing window ─────────────────────────────────────────────
  const smoothBins = new Array<number>(NUM_SAMPLES).fill(0);

  for (const offset of SMOOTH_OFFSETS) {
    const f    = Math.max(0, frame + offset);
    const bins = visualizeAudio({ audioData, frame: f, fps, numberOfSamples: NUM_SAMPLES });
    const len  = Math.min(bins.length, NUM_SAMPLES);
    for (let i = 0; i < len; i++) {
      smoothBins[i] += bins[i] / SMOOTH_OFFSETS.length;
    }
  }

  // ── Frequency band derivation ────────────────────────────────────────────
  const bassEnergy = clamp01(binMean(smoothBins, 0,   32));
  const midEnergy  = clamp01(binMean(smoothBins, 33,  128));
  const highEnergy = clamp01(binMean(smoothBins, 129, 255));

  // RMS across all 256 bins
  let sumSq = 0;
  for (let i = 0; i < NUM_SAMPLES; i++) sumSq += smoothBins[i] * smoothBins[i];
  const rms = clamp01(Math.sqrt(sumSq / NUM_SAMPLES));

  return { rms, bassEnergy, midEnergy, highEnergy };
}
