/**
 * useBeatFrame.ts — Beat-local frame context (Motion Design v2 — Phase 2)
 *
 * Without <Sequence>, useCurrentFrame() returns the global frame.
 * BeatZone wraps each beat in BeatFrameContext so animated components
 * can compute a frame offset relative to the beat's start.
 *
 * Usage inside LayoutRenderer nodes:
 *   const frame = useBeatFrame();  // replaces useCurrentFrame()
 */

import { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";

interface BeatFrameContextValue {
  beatStartFrame: number;
}

export const BeatFrameContext = createContext<BeatFrameContextValue>({
  beatStartFrame: 0,
});

/**
 * Returns the frame index relative to the current beat's start.
 * Clamped to ≥ 0 so animations don't run backwards before the beat begins.
 */
export function useBeatFrame(): number {
  const { beatStartFrame } = useContext(BeatFrameContext);
  const frame = useCurrentFrame();
  return Math.max(0, frame - beatStartFrame);
}
