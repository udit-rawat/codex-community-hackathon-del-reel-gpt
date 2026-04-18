/**
 * TemplateMVP.tsx — alignment validation render
 *
 * 0–60f  (0–2s): infographic — 1 line, 280px, y:600, no header
 * 60–120f (2–4s): threejs    — 1 line, 220px, y:1480, no header
 *
 * IG safe zones enforced:
 *   infographic: y:400–1100 only
 *   threejs:     y:1400–1680 only
 */

import React from "react";
import { useCurrentFrame, AbsoluteFill, interpolate, spring, useVideoConfig } from "remotion";

const SANS = "'Space Grotesk', 'Inter', sans-serif";
const CYAN = "#00E5FF";

const BEAT = 60; // 2s per section

// ── Safe zone markers (visual debug, remove after validation) ─────────────────

const SafeZoneGuides: React.FC = () => (
  <>
    {/* Top death zone boundary */}
    <div style={{
      position: "absolute", top: 400, left: 0, right: 0, height: 1,
      background: "rgba(255,0,0,0.3)", zIndex: 50, pointerEvents: "none",
    }} />
    {/* Bottom safe zone boundary */}
    <div style={{
      position: "absolute", top: 1400, left: 0, right: 0, height: 1,
      background: "rgba(255,165,0,0.4)", zIndex: 50, pointerEvents: "none",
    }} />
    {/* Caption end boundary */}
    <div style={{
      position: "absolute", top: 1680, left: 0, right: 0, height: 1,
      background: "rgba(255,0,0,0.3)", zIndex: 50, pointerEvents: "none",
    }} />
  </>
);

// ── Infographic section — text owns center, y:400–1100 ───────────────────────

const InfoSection: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const prog  = spring({ frame, fps, config: { damping: 14, mass: 0.7, stiffness: 200 } });
  const op    = interpolate(prog, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(prog, [0, 1], [0.85, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, #111 0%, #0A0A0A 70%)" }}>
      <SafeZoneGuides />

      {/* Label */}
      <div style={{
        position: "absolute", top: 32, left: 0, right: 0,
        zIndex: 100, textAlign: "center",
      }}>
        <span style={{
          background: "rgba(0,0,0,0.75)", color: CYAN,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 20, fontWeight: 700, letterSpacing: "0.08em",
          padding: "6px 20px", borderRadius: 6,
          border: "1px solid rgba(0,229,255,0.3)",
        }}>
          DIR: infographic — y:600 / 280px
        </span>
      </div>

      {/* Hero line — y:600, 280px */}
      <div style={{
        position: "absolute",
        top: 600,
        left: 80,
        right: 80,
        zIndex: 20,
        opacity: op,
        transform: `scale(${scale})`,
        transformOrigin: "left top",
      }}>
        <div style={{
          fontFamily: SANS,
          fontSize: 280,
          fontWeight: 900,
          color: CYAN,
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
          textShadow: `0 0 120px ${CYAN}40`,
        }}>
          8.2×
        </div>
        <div style={{
          fontFamily: SANS,
          fontSize: 72,
          fontWeight: 600,
          color: "#F9FAFB",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          marginTop: 16,
        }}>
          fewer tokens.
        </div>
      </div>

      {/* 1px border */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none",
        border: "1px solid rgba(0,229,255,0.08)",
      }} />
    </AbsoluteFill>
  );
};

// ── ThreeJS section — text in caption zone only, y:1400–1680 ─────────────────

const ThreeJSSection: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const prog = spring({ frame, fps, config: { damping: 14, mass: 0.7, stiffness: 200 } });
  const op   = interpolate(prog, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const tx   = interpolate(prog, [0, 1], [-24, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <SafeZoneGuides />

      {/* Label */}
      <div style={{
        position: "absolute", top: 32, left: 0, right: 0,
        zIndex: 100, textAlign: "center",
      }}>
        <span style={{
          background: "rgba(0,0,0,0.75)", color: CYAN,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 20, fontWeight: 700, letterSpacing: "0.08em",
          padding: "6px 20px", borderRadius: 6,
          border: "1px solid rgba(0,229,255,0.3)",
        }}>
          DIR: threejs — y:1480 / 220px
        </span>
      </div>

      {/* Placeholder for Three.js bg loop */}
      <div style={{
        position: "absolute", top: 400, left: 80, right: 80,
        height: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px dashed rgba(255,255,255,0.08)",
        borderRadius: 12,
        zIndex: 1,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 22, color: "rgba(255,255,255,0.15)",
          letterSpacing: "0.06em",
        }}>
          ← bg_loop.mp4 composited here in iMovie
        </span>
      </div>

      {/* Scrim above caption zone */}
      <div style={{
        position: "absolute", top: 1200, left: 0, right: 0, height: 280,
        background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.92))",
        zIndex: 5, pointerEvents: "none",
      }} />

      {/* Hero line — y:1480, 220px */}
      <div style={{
        position: "absolute",
        top: 1480,
        left: 80,
        right: 80,
        zIndex: 20,
        opacity: op,
        transform: `translateX(${tx}px)`,
      }}>
        <div style={{
          fontFamily: SANS,
          fontSize: 220,
          fontWeight: 900,
          color: CYAN,
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
          textShadow: `0 0 80px ${CYAN}40`,
        }}>
          8.2×
        </div>
        <div style={{
          fontFamily: SANS,
          fontSize: 52,
          fontWeight: 600,
          color: "#F9FAFB",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          marginTop: 10,
        }}>
          fewer tokens.
        </div>
      </div>

      {/* 1px border */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none",
        border: "1px solid rgba(0,229,255,0.08)",
      }} />
    </AbsoluteFill>
  );
};

// ── Combined — 120f / 4s ──────────────────────────────────────────────────────

export const TemplateMVP_Combined: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const beatFrame = frame % BEAT;
  const isInfo    = frame < BEAT;

  return isInfo
    ? <InfoSection frame={beatFrame} fps={fps} />
    : <ThreeJSSection frame={beatFrame} fps={fps} />;
};

// Individual exports kept for separate renders
export const TemplateMVP_Infographic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <InfoSection frame={frame} fps={fps} />;
};

export const TemplateMVP_ThreeJS: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <ThreeJSSection frame={frame} fps={fps} />;
};
