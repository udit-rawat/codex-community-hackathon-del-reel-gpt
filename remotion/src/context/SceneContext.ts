/**
 * SceneContext.ts — global scene state distributed to all components.
 *
 * Why this exists:
 *   Components need two things that can't cleanly come from props:
 *   1. fps — available via useVideoConfig() but wasteful to call in every leaf node
 *   2. cues — semantic frame triggers (e.g. "gpu_split" → frame 312) built by
 *      build_cue_map() in animator.py and injected via --props. No component
 *      should import or own timing data directly.
 *
 * Snap-back note:
 *   We do NOT use Remotion <Sequence> for beat layout. Our VirtualCanvas +
 *   BeatZone + BeatFrameContext approach renders all beats simultaneously on an
 *   absolute canvas. This means useCurrentFrame() inside BeatZone always returns
 *   the GLOBAL frame — there is no Sequence time-clamping, and no snap-back.
 *   SceneContext is safe to consume from any depth in the tree.
 *
 * Usage:
 *   // In VideoComposition (root):
 *   <SceneContext.Provider value={{ cues, fps }}>
 *     ...
 *   </SceneContext.Provider>
 *
 *   // In any component:
 *   const { cues, fps } = useSceneContext();
 *   const { elapsed, active } = useCue("gpu_split");
 */

import { createContext, useContext } from "react";

/** label → global frame number at which the cue fires */
export type CueMap = Record<string, number>;

export interface SceneContextValue {
  /** Semantic cues built from word_timings.json by animator.py */
  cues: CueMap;
  /** Video fps — from useVideoConfig() at root, distributed here */
  fps:  number;
}

const defaultValue: SceneContextValue = { cues: {}, fps: 30 };

export const SceneContext = createContext<SceneContextValue>(defaultValue);

/** Hook to consume SceneContext — use in any component below VideoComposition */
export const useSceneContext = (): SceneContextValue => useContext(SceneContext);
