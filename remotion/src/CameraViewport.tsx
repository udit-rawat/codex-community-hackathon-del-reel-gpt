/**
 * CameraViewport.tsx — Infinite canvas + spring camera system (Phase 2 / Phase 4)
 *
 * Phase 4 refactor: useCameraY() lifted to VideoComposition so cameraVelocity
 * can be passed to CRTWrapper (which wraps CameraViewport from the outside).
 * CameraViewport now accepts a pre-computed cameraY prop — pure presentation.
 *
 * Component tree:
 *   <CRTWrapper cameraVelocity highEnergy>          ← Phase 4 — CRT effects
 *     <CameraViewport cameraY={y}>                  ← clips to 1080×1920, applies translation
 *       <VirtualCanvas totalBeats={n}>              ← 1080 × (n × 1920) absolute canvas
 *         <BeatZone index={0} beatStartFrame={0}>   ← positioned at y=0, frame ctx
 *         ...
 *       </VirtualCanvas>
 *     </CameraViewport>
 *   </CRTWrapper>
 */

import React from "react";
import { BeatFrameContext } from "./hooks/useBeatFrame";

// ── CameraViewport ────────────────────────────────────────────────────────────

interface CameraViewportProps {
  /** Pre-computed camera Y offset in pixels (from useCameraY in VideoComposition) */
  cameraY: number;
  children: React.ReactNode;
}

/**
 * Overflow-hidden viewport that translates its VirtualCanvas child by -cameraY.
 * cameraY is computed by VideoComposition via useCameraY() and passed down.
 */
export const CameraViewport: React.FC<CameraViewportProps> = ({
  cameraY,
  children,
}) => (
  <div
    style={{
      width:    "100%",
      height:   "100%",
      overflow: "hidden",
      position: "relative",
    }}
  >
    <div
      style={{
        position:  "absolute",
        top:       0,
        left:      0,
        width:     "100%",
        transform: `translateY(-${cameraY}px)`,
      }}
    >
      {children}
    </div>
  </div>
);

// ── VirtualCanvas ─────────────────────────────────────────────────────────────

interface VirtualCanvasProps {
  totalBeats: number;
  children: React.ReactNode;
}

/**
 * Full-width canvas sized to fit all beats stacked vertically.
 * Height = totalBeats × 1920px.
 */
export const VirtualCanvas: React.FC<VirtualCanvasProps> = ({
  totalBeats,
  children,
}) => (
  <div
    style={{
      position: "relative",
      width: "100%",
      height: totalBeats * 1920,
    }}
  >
    {children}
  </div>
);

// ── BeatZone ──────────────────────────────────────────────────────────────────

interface BeatZoneProps {
  /** 0-based index on the virtual canvas (y = index × 1920) */
  index: number;
  /** Global frame at which this beat's narration starts — provides local frame context */
  beatStartFrame: number;
  children: React.ReactNode;
}

/**
 * Positions one beat at its y-slot on the VirtualCanvas and provides
 * BeatFrameContext so LayoutRenderer animated nodes see beat-local frames.
 */
export const BeatZone: React.FC<BeatZoneProps> = ({
  index,
  beatStartFrame,
  children,
}) => (
  <BeatFrameContext.Provider value={{ beatStartFrame }}>
    <div
      style={{
        position: "absolute",
        top: index * 1920,
        left: 0,
        width: "100%",
        height: 1920,
        background: "#0A0A0A",
        overflow: "hidden",
        fontFamily: "'Inter', 'system-ui', sans-serif",
      }}
    >
      {children}
    </div>
  </BeatFrameContext.Provider>
);
