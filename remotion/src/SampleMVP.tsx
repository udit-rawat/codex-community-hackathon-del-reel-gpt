/**
 * SampleMVP.tsx — "KV Cache: Why ChatGPT Doesn't Reread Everything"
 * 300 frames · 30fps · 10s
 *
 * Color: Electric Purple #A855F7 — background shifts deep violet → near-black → purple haze
 *
 * beat_1  frames   0– 90   HookR3F: 3D metallic "KV" plate + "10x FASTER" slam
 * beat_2  frames  90–210   GlassmorphBeat: ComparisonSplit — Without vs With cache
 * beat_3  frames 210–300   GlassmorphBeat: TakeawayScene — "Store. Reuse. 10x."
 *
 * Render: npx remotion studio → select "SampleMVP" composition
 */

import React from "react";
import {
  Sequence, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from "remotion";
import {
  usePulseAt, useSlideIn,
  COLOR, FONT, HERO_NUMBER, BROADCAST_TEXT,
  SectionLabelRow, ParticleBackground, TelemetryFrame, useBreath,
} from "./layouts/_shared";
import { HookR3F, GlassmorphBeat } from "./layouts/HookR3F";
import { SPRING_HEAVY, SPRING_MEDIUM } from "./utils/springIn";
import { useCameraY } from "./hooks/useCameraY";
import { useBeatFrame } from "./hooks/useBeatFrame";
import { CameraViewport, VirtualCanvas, BeatZone } from "./CameraViewport";

// ── Colors ────────────────────────────────────────────────────────────────────

const PURPLE  = "#A855F7";
const AMBER   = "#F59E0B";

// ── Timing ────────────────────────────────────────────────────────────────────

const TIMING = {
  hook:         { start: 0,   end: 3.0, duration: 3.0 },
  concept_1:    { start: 3.0, end: 7.0, duration: 4.0 },
  takeaway_cta: { start: 7.0, end: 10.0, duration: 3.0 },
};

// ── Beat 1 — HookR3F (3D metallic plate) ─────────────────────────────────────

const Beat1: React.FC = () => (
  <HookR3F
    text="KV"
    subtext="Cache"
    color={PURPLE}
    heroValue="10x"
    heroLabel="faster inference"
    hookLine="ChatGPT doesn't reread your conversation. Here's why."
    slamFrame={45}
    plateHeight={380}
  />
);

// ── Beat 2 — Comparison: Without vs With KV Cache ────────────────────────────

const Beat2: React.FC = () => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();

  // Left panel — slides from left
  const leftSp  = spring({ frame: Math.max(0, frame - 8), fps, config: SPRING_MEDIUM });
  const leftOp  = interpolate(leftSp, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const leftX   = interpolate(leftSp, [0, 1], [-80, 0], { extrapolateRight: "clamp" });

  // Right panel — slides from right, delayed
  const rightSp = spring({ frame: Math.max(0, frame - 28), fps, config: SPRING_MEDIUM });
  const rightOp = interpolate(rightSp, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const rightX  = interpolate(rightSp, [0, 1], [80, 0],  { extrapolateRight: "clamp" });

  // Pulse on right panel (winner) at frame 60
  const pulse   = usePulseAt(frame, [60, 110], PURPLE, 48);

  // Token count animates up on right side
  const tokenSp = spring({ frame: Math.max(0, frame - 40), fps, config: SPRING_MEDIUM });
  const tokens  = Math.round(interpolate(tokenSp, [0, 1], [0, 128], { extrapolateRight: "clamp" }));

  const leftRows  = [
    { label: "Each request",  value: "Recompute all" },
    { label: "Tokens",        value: "N² ops"        },
    { label: "Latency",       value: "Grows fast"    },
  ];
  const rightRows = [
    { label: "Each request",  value: "Load stored K/V" },
    { label: `Tokens cached`, value: `${tokens}K`       },
    { label: "Latency",       value: "Flat"            },
  ];

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "radial-gradient(ellipse at 50% 40%, #130820 0%, #0A0A0A 70%)",
      display: "flex", flexDirection: "column",
      paddingTop: 120, paddingBottom: 180, paddingLeft: 72, paddingRight: 72,
      boxSizing: "border-box", fontFamily: FONT, gap: 24, position: "relative", overflow: "hidden",
    }}>
      <ParticleBackground frame={frame} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
        <SectionLabelRow text="HOW IT WORKS" color="purple" />

        {/* VS label */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,80,80,0.3)" }} />
          <div style={{ ...BROADCAST_TEXT, fontSize: 16, fontWeight: 700,
            color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em" }}>VS</div>
          <div style={{ flex: 1, height: 1, background: `${PURPLE}50` }} />
        </div>

        <div style={{ flex: 1, display: "flex", gap: 18 }}>
          {/* WITHOUT cache — red/dim */}
          <div style={{
            flex: 1, opacity: leftOp, transform: `translateX(${leftX}px)`,
            background: "rgba(220,40,40,0.06)", border: "1px solid rgba(220,40,40,0.22)",
            borderRadius: 16, padding: "24px 24px",
            display: "flex", flexDirection: "column", gap: 0,
          }}>
            <div style={{ ...BROADCAST_TEXT, fontSize: 22, fontWeight: 800, color: "#F87171",
              letterSpacing: "0.05em", marginBottom: 20 }}>WITHOUT</div>
            {leftRows.map(({ label, value }, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>{label}</div>
                <div style={{ fontSize: 19, color: "#F87171", fontFamily: FONT, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
            {/* Cost pill */}
            <div style={{ marginTop: 20, background: "rgba(220,40,40,0.12)",
              border: "1px solid rgba(220,40,40,0.25)", borderRadius: 8,
              padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#F87171", fontFamily: FONT }}>$$$</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontFamily: FONT, marginTop: 2 }}>
                compute cost
              </div>
            </div>
          </div>

          {/* WITH cache — purple/bright */}
          <div style={{
            flex: 1, opacity: rightOp, transform: `translateX(${rightX}px)`,
            background: `${PURPLE}09`, border: `1px solid ${PURPLE}40`,
            borderRadius: 16, padding: "24px 24px",
            display: "flex", flexDirection: "column", gap: 0,
            boxShadow: pulse,
          }}>
            <div style={{ ...BROADCAST_TEXT, fontSize: 22, fontWeight: 800, color: PURPLE,
              letterSpacing: "0.05em", marginBottom: 20 }}>WITH KV CACHE</div>
            {rightRows.map(({ label, value }, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>{label}</div>
                <div style={{ fontSize: 19, color: PURPLE, fontFamily: FONT, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
            {/* Savings pill */}
            <div style={{ marginTop: 20, background: `${PURPLE}14`,
              border: `1px solid ${PURPLE}35`, borderRadius: 8,
              padding: "10px 16px", textAlign: "center",
              boxShadow: `0 0 24px ${PURPLE}25` }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: PURPLE, fontFamily: FONT,
                textShadow: `0 0 30px ${PURPLE}60` }}>10x</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", fontFamily: FONT, marginTop: 2 }}>
                faster response
              </div>
            </div>
          </div>
        </div>
      </div>
      <TelemetryFrame frame={frame} />
    </div>
  );
};

// ── Beat 3 — Takeaway wrapped in R3F glass card ───────────────────────────────

const Beat3: React.FC = () => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const { scale: bs } = useBreath(frame, fps);

  const headSp    = spring({ frame: Math.max(0, frame - 1), fps, config: SPRING_HEAVY });
  const headScale = interpolate(headSp, [0, 1], [0.55, 1], { extrapolateRight: "clamp" });
  const pulse     = usePulseAt(frame, [45, 75], PURPLE, 60);

  const line1 = useSlideIn(frame, "up", 8);
  const line2 = useSlideIn(frame, "up", 28);
  const line3 = useSlideIn(frame, "up", 48);

  // Glow breathes on headline
  const glow = 40 + (Math.sin((frame / fps) * Math.PI * 2 * 0.6) * 0.5 + 0.5) * 60;

  return (
    <div style={{
      width: "100%", height: "100%",
      background: `radial-gradient(ellipse at 50% 55%, #1A0A2E 0%, #0A0A0A 65%)`,
      position: "relative", overflow: "hidden", fontFamily: FONT,
    }}>
      <ParticleBackground frame={frame} />

      {/* R3F glass card behind the text */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <GlassmorphBeat accentColor={PURPLE} delay={0} cardHeight={600}>
          <div style={{ height: 600 }} />
        </GlassmorphBeat>
      </div>

      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        paddingTop: 120, paddingBottom: 180, paddingLeft: 72, paddingRight: 72,
        boxSizing: "border-box", gap: 20, textAlign: "center",
      }}>
        {/* "Store. Reuse. 10x." — slams @1f */}
        <div style={{
          opacity: 1,
          transform: `scale(${headScale * (frame > 20 ? bs : 1)})`,
          boxShadow: pulse,
        }}>
          <div style={{ ...HERO_NUMBER, fontSize: 104, fontWeight: 900, color: PURPLE,
            lineHeight: 0.9, letterSpacing: "-0.04em",
            textShadow: `0 0 ${glow}px ${PURPLE}60, 0 0 ${glow * 2}px ${PURPLE}20` }}>
            Store.
          </div>
        </div>

        {/* Line 2 @8f */}
        <div style={{ ...line1, opacity: line1.opacity }}>
          <div style={{ ...HERO_NUMBER, fontSize: 96, fontWeight: 900, color: "rgba(255,255,255,0.9)",
            lineHeight: 0.95, letterSpacing: "-0.03em" }}>
            Reuse.
          </div>
        </div>

        {/* Line 3 @28f — amber accent for contrast */}
        <div style={{ ...line2, opacity: line2.opacity }}>
          <div style={{ ...HERO_NUMBER, fontSize: 112, fontWeight: 900, color: AMBER,
            lineHeight: 0.95, letterSpacing: "-0.04em",
            textShadow: `0 0 50px ${AMBER}50` }}>
            10x faster.
          </div>
        </div>

        {/* Sub @48f */}
        <div style={{ ...line3, opacity: line3.opacity, marginTop: 16 }}>
          <div style={{ ...BROADCAST_TEXT, fontSize: 26, fontWeight: 500,
            color: "rgba(255,255,255,0.35)", letterSpacing: "0.01em" }}>
            That's KV Cache. It's in every transformer.
          </div>
        </div>
      </div>
      <TelemetryFrame frame={frame} />
    </div>
  );
};

// ── Root ───────────────────────────────────────────────────────────────────────

export const SampleMVP: React.FC = () => {
  const { cameraY } = useCameraY(TIMING, 3);

  return (
    <div style={{ width: "100%", height: "100%", background: "#0A0A0A", position: "relative" }}>
      <CameraViewport cameraY={cameraY}>
        <VirtualCanvas totalBeats={3}>
          <BeatZone index={0} beatStartFrame={0}>
            <Beat1 />
          </BeatZone>
          <BeatZone index={1} beatStartFrame={90}>
            <Beat2 />
          </BeatZone>
          <BeatZone index={2} beatStartFrame={210}>
            <Beat3 />
          </BeatZone>
        </VirtualCanvas>
      </CameraViewport>
    </div>
  );
};

export const SampleMVPConfig = {
  durationInFrames: 300,
  fps:    30,
  width:  1080,
  height: 1920,
};
