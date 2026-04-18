/**
 * VideoComposition.tsx — Motion Design v2 (Tier 1 refactor: devtool aesthetic)
 *
 * Full component tree:
 *   <VideoComposition>
 *     ├── <Audio />
 *     └── <CameraViewport cameraY>
 *         └── <VirtualCanvas totalBeats>
 *             └── <BeatZone index beatStartFrame> × n
 *                 └── <LayoutRenderer node />
 *
 * CRTWrapper and MatrixBackground removed — replaced by clean #0A0A0A canvas.
 * Audio metrics no longer injected as CSS custom properties on visible elements.
 */

import React, { useMemo } from "react";
import { Audio, interpolate, staticFile, useVideoConfig } from "remotion";
import type { AnimateIn, BeatLayout, RemotionProps, ScenePayload, TakeawaySceneData, TimingEntry } from "./types";
import { LayoutRenderer }  from "./LayoutRenderer";
import { SceneRouter }     from "./SceneRouter";
import { TakeawayScene }   from "./layouts/TakeawayScene";
import { CameraViewport, VirtualCanvas, BeatZone } from "./CameraViewport";
import { useCameraY }      from "./hooks/useCameraY";
import { useBeatFrame }    from "./hooks/useBeatFrame";
import { SceneContext }    from "./context/SceneContext";
import { slideUp, scaleIn } from "./utils/springIn";
import { FONT, SURFACE_BG, setRuntimeTheme } from "./layouts/_shared";

const FPS = 30;

/**
 * BeatAnimateIn — applies beat-level entrance animation based on animate_in.
 *
 * Must be rendered INSIDE BeatZone so useBeatFrame() sees beat-local frames.
 * Beat-local frame 0 = camera arrives at this beat (beatStartFrame).
 *
 * animate_in mapping:
 *   spring_in / slide_up → slideUp (HERO preset — slower, more gravitas)
 *   spring_scale         → scaleIn (HERO preset)
 *   fade                 → linear opacity 0→1 over 20 frames
 *   typewriter / none    → no wrapper transform; primitives own their animation
 */
const BeatAnimateIn: React.FC<{
  animateIn: AnimateIn;
  fps: number;
  children: React.ReactNode;
}> = ({ animateIn, fps, children }) => {
  const frame = useBeatFrame();

  let wrapStyle: React.CSSProperties = { width: "100%", height: "100%" };

  if (animateIn === "spring_in" || animateIn === "slide_up") {
    const { opacity, translateY } = slideUp(frame, fps, 0, "hero");
    wrapStyle = { ...wrapStyle, opacity, transform: `translateY(${translateY}px)` };
  } else if (animateIn === "spring_scale") {
    const { opacity, scale } = scaleIn(frame, fps, 0, "hero");
    wrapStyle = { ...wrapStyle, opacity, transform: `scale(${scale})` };
  } else if (animateIn === "fade") {
    const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
    wrapStyle = { ...wrapStyle, opacity };
  }

  return <div style={wrapStyle}>{children}</div>;
};

/** Maps 1-based beat number to narration_timing.json key */
function beatToTimingKey(beatNum: number, totalBeats: number): string {
  if (beatNum === 1) return "hook";
  if (beatNum === totalBeats) return "takeaway_cta";
  return `concept_${beatNum - 1}`;
}

/**
 * ghostContent — walk backward from beatIndex to find the nearest previous beat
 * that has valid scene/layout content. Used for sequence persistence when a beat
 * renders null (e.g. "bridge" beats with no structured data).
 */
function ghostContent(
  beatIndex: number,
  beatIds: number[],
  scenes?: Record<string, ScenePayload>,
  params?: Record<string, BeatLayout>,
): { scene?: ScenePayload; layout?: BeatLayout } | null {
  for (let i = beatIndex - 1; i >= 0; i--) {
    const key = `beat_${beatIds[i]}`;
    if (scenes?.[key] || params?.[key]) {
      return { scene: scenes?.[key], layout: params?.[key] };
    }
  }
  return null;
}

export const VideoComposition: React.FC<RemotionProps> = ({
  beats,
  scenes,
  params,
  timing,
  audioSrc,
  themeName,
  cues = {},
}) => {
  const totalBeats      = beats.length;
  const { fps }         = useVideoConfig();
  const { cameraY }     = useCameraY(timing, totalBeats);
  const beatIds         = useMemo(() => beats.map(b => b.beat), [beats]);

  setRuntimeTheme(themeName);

  return (
    <SceneContext.Provider value={{ cues, fps }}>
    <div
      style={{
        width:      "100%",
        height:     "100%",
        background: SURFACE_BG,
        position:   "relative",
        overflow:   "hidden",
        fontFamily: FONT,
      }}
    >
      <Audio src={staticFile(audioSrc)} />

      <CameraViewport cameraY={cameraY}>
        <VirtualCanvas totalBeats={totalBeats}>
          {beats.map((beatInfo, index) => {
            const timingKey                      = beatToTimingKey(beatInfo.beat, totalBeats);
            const entry: TimingEntry | undefined = timing[timingKey];
            // Camera spring starts 18 frames before beat.end and takes ~24 frames
            // to arrive — so it lands at roughly beat.start + 6. Subtract
            // CAMERA_LEAD so beat-local animations start in sync with camera
            // arrival rather than 0.6s after the camera is already showing the beat.
            const CAMERA_LEAD    = 18; // frames — must match useCameraY panStartFrame offset
            const beatStartFrame = entry
              ? Math.max(0, Math.round(entry.start * FPS) - CAMERA_LEAD)
              : 0;
            const beatDurFrames  = entry ? Math.round(entry.duration * FPS) : 300;

            // v3 path: ScenePayload → SceneRouter / TakeawayScene
            const scenePayload = scenes?.[`beat_${beatInfo.beat}`];
            // v2 fallback: BeatLayout → LayoutRenderer
            const beatLayout   = params?.[`beat_${beatInfo.beat}`];

            const hasContent = !!(scenePayload || beatLayout);

            // ── Sequence persistence ─────────────────────────────────────────
            // If this beat has no content (e.g. bridge/gap beat from pipeline),
            // render the nearest previous beat's content at 25% opacity + blur
            // rather than leaving a black hole. No viewer ever sees dead air.
            if (!hasContent) {
              const ghost = ghostContent(index, beatIds, scenes, params);
              if (!ghost) return null; // first beat with no content — nothing to persist

              return (
                <BeatZone key={beatInfo.beat} index={index} beatStartFrame={beatStartFrame}>
                  <div style={{ width: "100%", height: "100%", opacity: 0.22, filter: "blur(3px)" }}>
                    {ghost.scene ? (
                      ghost.scene.data.layout === "TakeawayScene"
                        ? null  // don't ghost a TakeawayScene (it has its own motion)
                        : <SceneRouter data={ghost.scene.data} />
                    ) : ghost.layout ? (
                      <LayoutRenderer node={ghost.layout.layout} />
                    ) : null}
                  </div>
                </BeatZone>
              );
            }

            const animateIn = scenePayload?.animate_in ?? beatLayout?.animate_in ?? "none";

            return (
              <BeatZone
                key={beatInfo.beat}
                index={index}
                beatStartFrame={beatStartFrame}
              >
                <BeatAnimateIn animateIn={animateIn} fps={fps}>
                  {scenePayload ? (
                    scenePayload.data.layout === "TakeawayScene"
                      ? <TakeawayScene
                          data={scenePayload.data as TakeawaySceneData}
                          durationFrames={beatDurFrames}
                        />
                      : <SceneRouter data={scenePayload.data} />
                  ) : beatLayout ? (
                    <LayoutRenderer node={beatLayout.layout} />
                  ) : null}
                </BeatAnimateIn>
              </BeatZone>
            );
          })}
        </VirtualCanvas>
      </CameraViewport>
    </div>
    </SceneContext.Provider>
  );
};
