import React from "react";
import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { VideoComposition } from "./VideoComposition";
import type { RemotionProps } from "./types";

const FPS = 30;
const PADDING = FPS;

async function dynamicDuration({
  props,
}: {
  props: Record<string, unknown>;
}): Promise<{ durationInFrames: number }> {
  const p = props as unknown as RemotionProps;
  try {
    const duration = await getAudioDurationInSeconds(staticFile(p.audioSrc));
    return { durationInFrames: Math.ceil(duration * FPS) + PADDING };
  } catch {
    return { durationInFrames: p.totalFrames ?? 1440 };
  }
}

const defaultProps: RemotionProps = {
  beats: [
    { beat: 1 },
    { beat: 2 },
    { beat: 3 },
    { beat: 4 },
  ],
  scenes: {
    beat_1: {
      animate_in: "spring_scale",
      data: {
        layout: "MetricFocus",
        section_label: "PHASE 1",
        hero: { value: "1", label: "theme", color: "cyan" },
        context: "Active runtime is infographic only. Replace these props with output/remotion_props.json at render time.",
        chips: ["OpenAI", "Infographic", "Vertical"],
      },
    },
    beat_2: {
      animate_in: "spring_in",
      data: {
        layout: "DataGrid",
        section_label: "PIPELINE",
        metrics: [
          { label: "Input", value: "CLI", color: "white" },
          { label: "Content", value: "JSON", color: "cyan", glow: true },
          { label: "TTS", value: "WAV", color: "green" },
          { label: "Render", value: "MP4", color: "white" },
        ],
        highlight_index: 1,
        caption: "Default preview only. Real runs inject generated props.",
      },
    },
    beat_3: {
      animate_in: "fade",
      data: {
        layout: "StatementSlam",
        section_label: "REVIEW",
        lines: ["Edit script", "Pick theme", "Render video"],
        accent_color: "cyan",
      },
    },
    beat_4: {
      animate_in: "none",
      data: {
        layout: "TakeawayScene",
        section_label: "TAKEAWAY",
        headline: "Phase 1 runtime ready.",
        accent_color: "cyan",
      },
    },
  },
  timing: {
    hook: { start: 0, duration: 4, end: 4 },
    concept_1: { start: 4, duration: 4, end: 8 },
    concept_2: { start: 8, duration: 4, end: 12 },
    takeaway_cta: { start: 12, duration: 4, end: 16 },
  },
  audioSrc: "narration.wav",
  totalFrames: 16 * 30,
  themeName: "deep_winter",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VideoComposition"
      component={VideoComposition as AnyComponent}
      durationInFrames={defaultProps.totalFrames}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps as unknown as Record<string, unknown>}
      calculateMetadata={dynamicDuration}
    />
  );
};
