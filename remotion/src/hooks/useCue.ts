/**
 * useCue.ts — consume a named scene cue from SceneContext.
 *
 * Cues are semantic animation triggers: instead of hardcoding frame numbers in
 * components, each cue has a label (e.g. "gpu_split") that resolves to a global
 * frame number built from word-level audio timestamps by animator.py.
 *
 * Frame model:
 *   useCurrentFrame()  → global frame (always, even inside BeatZone)
 *   cues["gpu_split"]  → global frame at which this cue fires
 *   elapsed            → frames since cue fired (0 before trigger)
 *
 * This intentionally uses useCurrentFrame() (global), NOT useBeatFrame() (local).
 * Cues are anchored to audio timestamps which are global. Beat-local animation
 * delays (springIn delay param) are separate and handled per-component.
 *
 * Usage:
 *   const { elapsed, active } = useCue("gpu_split");
 *   const anim = slideUp(elapsed, fps, 0);           // drives spring from cue onset
 *
 *   // Guard for missing cues (T5 not yet wired):
 *   const { active } = useCue("gpu_split");
 *   if (!active) return null; // element hidden until cue fires
 */

import { useCurrentFrame } from "remotion";
import { useSceneContext } from "../context/SceneContext";

export interface CueState {
  /**
   * Frames elapsed since this cue triggered.
   * 0 before the cue fires, positive and growing after.
   * Safe to pass directly to springIn(elapsed, fps, 0).
   */
  elapsed: number;

  /** True once the cue frame has been reached. */
  active: boolean;
}

/**
 * useCue — resolve a named cue to elapsed frames + active flag.
 *
 * @param label - key matching a cue in RemotionProps.cues (e.g. "gpu_split")
 * @returns     - { elapsed, active }
 *
 * If the label is not found in the cue map (e.g. T5 not yet running),
 * active=false and elapsed=0, so all dependent animations stay hidden/idle.
 * This makes the hook safe to use before T5 is wired up.
 */
export function useCue(label: string): CueState {
  const { cues }  = useSceneContext();
  const frame     = useCurrentFrame();
  const cueFrame  = cues[label] ?? Infinity;
  const active    = frame >= cueFrame;

  return {
    elapsed: active ? frame - cueFrame : 0,
    active,
  };
}
