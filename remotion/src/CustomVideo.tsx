/**
 * CustomVideo.tsx — Replace Paid Agents With OpenManus
 * 639f / 21.3s / 30fps
 *
 * beat_1: MetricFocus    — infographic
 * beat_2: BarComparison  — animation_hook (caption zone, Veo2 composite center)
 * beat_3: StatementSlam  — animation_hook (caption zone, Veo2 composite center)
 * beat_4: TakeawayScene  — infographic
 *
 * ── EDIT THESE PROPS ─────────────────────────────────────────────────────────
 */
const PROPS = {
  beat1: {
    section_label: "openmanus",
    hero_value:    "OpenManus",
    hero_label:    "free local agents",
    hero_color:    "cyan" as const,
    context:       "Thousands pay for cloud agents. This runs them for free.",
    chips:         ["50k stars", "local", "free forever"],
  },
  beat2: {
    // animation_hook — caption zone only, center empty for Veo2
    section_label: "python framework",
    accent_color:  "green" as const,
    bars: [
      { label: "Cloud Agents", value: "$20/mo",  sublabel: "paid orchestration", color: "red"   as const },
      { label: "OpenManus",    value: "$0",       sublabel: "local, 50k stars",   color: "green" as const, highlight: true },
    ],
    caption: "50,000 star framework. Runs complex agent workflows locally.",
  },
  beat3: {
    // animation_hook — caption zone only, center empty for Veo2
    section_label: "deploy tonight",
    accent_color:  "cyan" as const,
    lines: [
      "$20/month. Gone.",
      "Local agentic ecosystem.",
      "Ships tonight.",
    ],
  },
  beat4: {
    section_label: "takeaway",
    headline:      "Stop paying for agents. Own your stack.",
    cta:           "OpenManus. Pull it. Run it.",
    accent_color:  "cyan" as const,
  },
};
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile,
  useCurrentFrame, spring, interpolate, useVideoConfig,
} from "remotion";
import { MetricFocus }   from "./layouts/MetricFocus";
import { StatementSlam } from "./layouts/StatementSlam";
import { TakeawayScene } from "./layouts/TakeawayScene";
import { BeatFrameContext } from "./hooks/useBeatFrame";

// Beat boundaries
const BEAT1_START = 0;
const BEAT2_START = 128;
const BEAT3_START = 323;
const BEAT4_START = 549;
const TOTAL_FRAMES = 639;

const BEAT1_DUR = BEAT2_START - BEAT1_START;  // 128
const BEAT2_DUR = BEAT3_START - BEAT2_START;  // 195
const BEAT3_DUR = BEAT4_START - BEAT3_START;  // 226
const BEAT4_DUR = TOTAL_FRAMES - BEAT4_START; // 90

const FONT = "'Inter', 'Space Grotesk', sans-serif";
const BG   = "linear-gradient(180deg, #111112 0%, #080809 100%)";

const COLORS: Record<string, string> = {
  cyan:   "#2563EB",
  green:  "#10B981",
  red:    "#E11D48",
  yellow: "#D1D5DB",
  white:  "#FFFFFF",
};

export const CustomVideoConfig = {
  durationInFrames: TOTAL_FRAMES,
  fps:    30,
  width:  1080,
  height: 1920,
};

// ── beat_2 caption zone — BarComparison stats ─────────────────────────────────

const Beat2Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{
      position: "absolute", top: 1420, left: 72, right: 72, zIndex: 20,
      display: "flex", flexDirection: "column", gap: 20,
      fontFamily: FONT,
    }}>
      {PROPS.beat2.bars.map((bar, i) => {
        const delay = i === 0 ? 8 : 101;
        const prog  = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 16, mass: 0.7, stiffness: 220 } });
        const op    = interpolate(prog, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
        const tx    = interpolate(prog, [0, 1], [-32, 0], { extrapolateRight: "clamp" });

        // highlight pulse on bar_0 at f20
        const pulseAge   = Math.max(0, frame - 20);
        const pulseStr   = i === 0 ? interpolate(pulseAge, [0, 6, 12, 30], [0, 1, 0.8, 0], { extrapolateRight: "clamp" }) : 0;
        const c = COLORS[bar.color] ?? "#FFFFFF";

        return (
          <div key={i} style={{
            opacity: op,
            transform: `translateX(${tx}px)`,
            display: "flex", alignItems: "center", gap: 16,
            background: `${c}08`,
            border: `1px solid ${c}${bar.highlight ? "55" : "25"}`,
            borderRadius: 12,
            padding: "18px 24px",
            boxShadow: pulseStr > 0.01 ? `0 0 ${Math.round(28 * pulseStr)}px ${c}66` : "none",
          }}>
            <div style={{ width: 4, alignSelf: "stretch", background: c, borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 58, fontWeight: 800, color: c, lineHeight: 1, fontFamily: FONT }}>{bar.value}</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: "#FFFFFF", opacity: 0.7, marginTop: 4, fontFamily: FONT }}>{bar.label}</div>
              <div style={{ fontSize: 20, fontWeight: 400, color: "rgba(255,255,255,0.38)", marginTop: 2, fontFamily: FONT }}>{bar.sublabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── beat_3 caption zone — StatementSlam lines ─────────────────────────────────

const Beat3Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent  = COLORS["cyan"];
  const delays  = [6, 24, 42];
  const pulseFrames = [45, 90];

  return (
    <div style={{
      position: "absolute", top: 1420, left: 72, right: 72, zIndex: 20,
      display: "flex", flexDirection: "column", gap: 14,
      fontFamily: FONT,
    }}>
      {PROPS.beat3.lines.map((line, i) => {
        const prog = spring({ frame: Math.max(0, frame - delays[i]), fps, config: { damping: 16, mass: 0.8, stiffness: 200 } });
        const op   = interpolate(prog, [0, 0.18], [0, 1], { extrapolateRight: "clamp" });
        const ty   = interpolate(prog, [0, 1], [32, 0], { extrapolateRight: "clamp" });

        // pulse on line_0 at f45 + f90
        let glowStr = 0;
        if (i === 0) {
          const fired = pulseFrames.filter(f => frame >= f);
          if (fired.length > 0) {
            const age = frame - Math.max(...fired);
            glowStr = interpolate(age, [0, 6, 12, 30], [0, 1, 0.8, 0], { extrapolateRight: "clamp" });
          }
        }

        const color = i === 0 ? accent : "#FFFFFF";
        const opacity = i === 0 ? op : op * (i === 1 ? 0.88 : 0.68);

        return (
          <div key={i} style={{
            opacity,
            transform: `translateY(${ty}px)`,
            fontSize: i === 0 ? 72 : 58,
            fontWeight: 800,
            color,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            fontFamily: FONT,
            textShadow: glowStr > 0.01 ? `0 0 ${Math.round(48 * glowStr)}px ${accent}55` : "none",
          }}>
            {line}
          </div>
        );
      })}
    </div>
  );
};

// ── Main composition ──────────────────────────────────────────────────────────

export const CustomVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BG }}>

      <Audio src={staticFile("narration.wav")} />

      {/* ── beat_1 — MetricFocus — full infographic ── */}
      <Sequence from={BEAT1_START} durationInFrames={BEAT1_DUR}>
        <BeatFrameContext.Provider value={{ beatStartFrame: 0 }}>
          <AbsoluteFill>
            <MetricFocus data={{
              layout:        "MetricFocus",
              section_label: PROPS.beat1.section_label,
              hero:          { value: PROPS.beat1.hero_value, label: PROPS.beat1.hero_label, color: PROPS.beat1.hero_color },
              context:       PROPS.beat1.context,
              chips:         PROPS.beat1.chips,
            }} />
          </AbsoluteFill>
        </BeatFrameContext.Provider>
      </Sequence>

      {/* ── beat_2 — BarComparison — animation_hook ── */}
      <Sequence from={BEAT2_START} durationInFrames={BEAT2_DUR}>
        <BeatFrameContext.Provider value={{ beatStartFrame: 0 }}>
          <AbsoluteFill style={{ background: "#080809" }}>
            {/* Center y:400–1400 empty — composite Veo2 agent-nodes video here */}
            <div style={{
              position: "absolute", top: 400, left: 0, right: 0, height: 1000,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", zIndex: 0,
            }} />
            {/* Scrim */}
            <div style={{
              position: "absolute", top: 1180, left: 0, right: 0, height: 280,
              background: "linear-gradient(to bottom, transparent, rgba(8,8,9,0.95))",
              zIndex: 5, pointerEvents: "none",
            }} />
            <Beat2Caption />
          </AbsoluteFill>
        </BeatFrameContext.Provider>
      </Sequence>

      {/* ── beat_3 — StatementSlam — animation_hook ── */}
      <Sequence from={BEAT3_START} durationInFrames={BEAT3_DUR}>
        <BeatFrameContext.Provider value={{ beatStartFrame: 0 }}>
          <AbsoluteFill style={{ background: "#080809" }}>
            {/* Center y:400–1400 empty — composite Veo2 laptop-nodes video here */}
            <div style={{
              position: "absolute", top: 400, left: 0, right: 0, height: 1000,
              pointerEvents: "none", zIndex: 0,
            }} />
            {/* Scrim */}
            <div style={{
              position: "absolute", top: 1180, left: 0, right: 0, height: 280,
              background: "linear-gradient(to bottom, transparent, rgba(8,8,9,0.95))",
              zIndex: 5, pointerEvents: "none",
            }} />
            <Beat3Caption />
          </AbsoluteFill>
        </BeatFrameContext.Provider>
      </Sequence>

      {/* ── beat_4 — TakeawayScene — full infographic ── */}
      <Sequence from={BEAT4_START} durationInFrames={BEAT4_DUR}>
        <BeatFrameContext.Provider value={{ beatStartFrame: 0 }}>
          <AbsoluteFill>
            <TakeawayScene
              data={{
                layout:        "TakeawayScene",
                section_label: PROPS.beat4.section_label,
                headline:      PROPS.beat4.headline,
                cta:           PROPS.beat4.cta,
                accent_color:  PROPS.beat4.accent_color,
              }}
              durationFrames={BEAT4_DUR}
            />
          </AbsoluteFill>
        </BeatFrameContext.Provider>
      </Sequence>

    </AbsoluteFill>
  );
};
