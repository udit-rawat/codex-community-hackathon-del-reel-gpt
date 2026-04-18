/**
 * ThemeTest.tsx — Phosphor · 105f / 3.5s · Director cut v2
 *
 * Timeline (compressed — no dead frames)
 * 0–24f   Both bars grow from 5% + count-up (frame 0 is NEVER black)
 * 24–48f  Amber collapses 8.2× with bounce spring
 * 54–105f 8.2x (260px) slams at 1.8s + "fewer tokens" at 2.2s
 * 95–105f Bars micro-bounce Y 0→-6px→0
 *
 * Fixes: bg gradient + grid · 60px count-up · BEFORE above bar ·
 *        260px 8.2x · camera rotateZ · 50px bar glows · dead frames gone
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Text, RoundedBox } from "@react-three/drei";

// ── Tokens ────────────────────────────────────────────────────────────────────

const AMBER     = "#F59E0B";
const AMBER_HEX = 0xF59E0B;
const RED_HEX   = 0xE5484D;
const SANS      = "'Space Grotesk', 'Inter', sans-serif";
const MONO      = "'JetBrains Mono', 'Fira Code', monospace";

// Director spring v2: damping 16, mass 0.7
const SP        = { damping: 16, mass: 0.7, stiffness: 200 };
const SP_BOUNCE = { damping: 8,  mass: 1.2, stiffness: 220 };
const SP_FAST   = { damping: 12, mass: 0.5, stiffness: 280 };

function s(frame: number, fps: number, delay: number, cfg = SP) {
  return spring({ frame: Math.max(0, frame - delay), fps, config: cfg });
}

// ── Bar geometry ──────────────────────────────────────────────────────────────

const MAX_H     = 3.2;
const AFTER_H   = MAX_H / 8.2;   // ≈ 0.39
const INITIAL_H = MAX_H * 0.05;  // 5% — frame 0 is never black
const BAR_W     = 1.0;
const BAR_D     = 0.55;
const BASE_Y    = -2.8;

// Rule of thirds — 8.6 units visible width at fov65 z12
const RED_X = -1.3;
const AMB_X =  1.3;

// DOM glow pixel positions (3D→screen: 1 unit ≈ 125.6px, center at 540px)
const RED_GLOW_PX = 540 - 1.3 * 125.6;  // ≈ 377
const AMB_GLOW_PX = 540 + 1.3 * 125.6;  // ≈ 703

// ── Bars ──────────────────────────────────────────────────────────────────────

const Bars: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  // Both bars grow 0–24f from INITIAL_H
  const redGrow  = s(frame, fps, 0, SP_FAST);
  const redH     = interpolate(redGrow, [0, 1], [INITIAL_H, MAX_H], { extrapolateRight: "clamp" });
  const redOp    = interpolate(redGrow, [0, 0.10], [0.4, 1], { extrapolateRight: "clamp" });

  const ambGrow  = s(frame, fps, 4, SP_FAST);
  const ambH_up  = interpolate(ambGrow, [0, 1], [INITIAL_H, MAX_H], { extrapolateRight: "clamp" });
  const ambOp    = interpolate(ambGrow, [0, 0.10], [0.4, 1], { extrapolateRight: "clamp" });

  // Amber collapse at f24 with bounce spring
  const collapse = s(frame, fps, 24, SP_BOUNCE);
  const ambH     = interpolate(collapse, [0, 1], [ambH_up, AFTER_H], { extrapolateRight: "clamp" });

  // Micro-bounce last 10f
  const bounceY  = frame >= 95
    ? interpolate(frame, [95, 100, 105], [0, -0.048, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  // Idle breathe (proves it's 3D)
  const breathe  = 1 + Math.sin((frame / 30) * Math.PI * 2 * 0.5) * 0.012;

  // Amber emissive spikes on collapse
  const colT     = frame >= 24 ? Math.max(0, 1 - (frame - 24) / 22) : 0;
  const ambEmit  = 0.55 + colT * 2.4;

  // Count-up 0→13,240 inside red bar (synced to bar growth)
  const cntProg  = s(frame, fps, 0, { damping: 18, mass: 0.8, stiffness: 160 });
  const cntVal   = Math.round(interpolate(cntProg, [0, 1], [0, 13240], { extrapolateRight: "clamp" }));

  // Count-up 0→1,610 inside amber bar
  const ambCntProg = s(frame, fps, 4, { damping: 18, mass: 0.8, stiffness: 160 });
  const ambCntVal  = Math.round(interpolate(ambCntProg, [0, 1], [0, 1610], { extrapolateRight: "clamp" }));

  // Labels fade in with bars
  const labOp     = interpolate(frame, [0, 10], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const afterLabOp = collapse * labOp;

  // fontSize in 3D units: 0.48 ≈ 60px (1 unit ≈ 125px at this fov/z)
  const CNT_SIZE  = 0.48;
  const LBL_SIZE  = 0.175;

  return (
    <group position={[0, bounceY, 0]}>
      {/* ── Red bar (BEFORE) ── */}
      <group position={[RED_X, BASE_Y + redH / 2, 0]} scale={[1, breathe, 1]}>
        <RoundedBox args={[BAR_W, Math.max(redH, 0.01), BAR_D]} radius={0.05} smoothness={4}>
          <meshStandardMaterial
            color={RED_HEX} emissive={new THREE.Color(RED_HEX)}
            emissiveIntensity={0.5} metalness={0.55} roughness={0.25}
            transparent opacity={redOp * 0.9}
          />
        </RoundedBox>
        {/* Side face — darker shade for 3D depth */}
        <mesh position={[-BAR_W / 2 - 0.025, 0, 0]}>
          <boxGeometry args={[0.05, Math.max(redH, 0.01), BAR_D * 0.95]} />
          <meshStandardMaterial
            color={0x8B1A1D} metalness={0.6} roughness={0.3}
            transparent opacity={redOp * 0.65}
          />
        </mesh>
      </group>

      {/* ── Amber bar (AFTER) ── */}
      <group position={[AMB_X, BASE_Y + ambH / 2, 0]} scale={[1, breathe, 1]}>
        <RoundedBox args={[BAR_W, Math.max(ambH, 0.01), BAR_D]} radius={0.05} smoothness={4}>
          <meshStandardMaterial
            color={AMBER_HEX} emissive={new THREE.Color(AMBER_HEX)}
            emissiveIntensity={ambEmit} metalness={0.65} roughness={0.15}
            transparent opacity={ambOp * 0.92}
          />
        </RoundedBox>
        {/* Side face */}
        <mesh position={[BAR_W / 2 + 0.025, 0, 0]}>
          <boxGeometry args={[0.05, Math.max(ambH, 0.01), BAR_D * 0.95]} />
          <meshStandardMaterial
            color={0x92610A} metalness={0.6} roughness={0.3}
            transparent opacity={ambOp * 0.65}
          />
        </mesh>
      </group>

      {/* ── Floor ── */}
      <RoundedBox args={[5.0, 0.05, 0.8]} radius={0.02} position={[0, BASE_Y, 0]}>
        <meshStandardMaterial color={0x1a1000} metalness={0.9} roughness={0.2} />
      </RoundedBox>

      {/* ── Count-up: 60px inside red bar (top) ── */}
      <Text
        position={[RED_X, BASE_Y + Math.max(redH, 0.01) - 0.38, 0.32]}
        fontSize={CNT_SIZE} anchorX="center" anchorY="top"
        fillOpacity={labOp * 0.95} font={undefined} color={0xffffff}
      >
        {cntVal.toLocaleString()}
      </Text>

      {/* ── Count-up inside amber bar ── */}
      <Text
        position={[AMB_X, BASE_Y + Math.max(ambH, 0.01) - 0.38, 0.32]}
        fontSize={CNT_SIZE} anchorX="center" anchorY="top"
        fillOpacity={labOp * 0.95} font={undefined} color={AMBER_HEX}
      >
        {ambCntVal.toLocaleString()}
      </Text>

      {/* ── BEFORE — above red bar, 12px gap ── */}
      <Text
        position={[RED_X, BASE_Y + Math.max(redH, 0.01) + 0.14, 0]}
        fontSize={LBL_SIZE} color={0x71717A} anchorX="center" anchorY="bottom"
        fillOpacity={labOp * 0.85} font={undefined} letterSpacing={0.15}
      >
        BEFORE
      </Text>

      {/* ── AFTER — above amber bar (post-collapse) ── */}
      <Text
        position={[AMB_X, BASE_Y + AFTER_H + 0.14, 0]}
        fontSize={LBL_SIZE} color={AMBER_HEX} anchorX="center" anchorY="bottom"
        fillOpacity={afterLabOp * 0.85} font={undefined} letterSpacing={0.15}
      >
        AFTER
      </Text>

      {/* ── 1,610 label above amber bar after collapse ── */}
      <Text
        position={[AMB_X, BASE_Y + AFTER_H + 0.52, 0.32]}
        fontSize={0.26} anchorX="center"
        fillOpacity={afterLabOp * 0.9} font={undefined} color={AMBER_HEX}
      >
        1,610
      </Text>
    </group>
  );
};

// ── Lights ────────────────────────────────────────────────────────────────────

const Lights: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const t    = frame / fps;
  const colT = frame >= 24 ? Math.max(0, 1 - (frame - 24) / 22) : 0;
  const keyI = 2.2 + Math.sin(t * Math.PI * 2 * 0.35) * 0.2 + colT * 2.8;

  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight color={AMBER_HEX} intensity={keyI}  position={[-1, 4, 5]}    distance={20} decay={2} />
      <pointLight color={0xddeeff}   intensity={0.65}  position={[4, 2, 4]}     distance={14} decay={2} />
      <pointLight color={AMBER_HEX} intensity={0.8}   position={[1.3, -1, -1]} distance={8}  decay={2} />
    </>
  );
};

// ── Scene (camera) ────────────────────────────────────────────────────────────

const Scene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  // Push-in: scale 1.03→1.0 over full duration (DOM level handles rotateZ)
  const pushIn = interpolate(frame, [0, 105], [1.03, 1.0], { extrapolateRight: "clamp" });
  // Nudge toward amber during collapse f24-58
  const nudgeX = interpolate(
    frame, [24, 34, 44, 58],
    [0, AMB_X * 0.07, AMB_X * 0.07, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <group scale={[pushIn, pushIn, pushIn]} position={[nudgeX, 0.4, 0]}>
      <Lights frame={frame} fps={fps} />
      <Bars   frame={frame} fps={fps} />
    </group>
  );
};

// ── Grid overlay ──────────────────────────────────────────────────────────────

const Grid: React.FC = () => (
  <div style={{
    position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
    backgroundImage: [
      "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
    ].join(", "),
    backgroundSize: "80px 80px",
  }} />
);

// ── Noise overlay (6%) ────────────────────────────────────────────────────────

const Noise: React.FC = () => (
  <svg style={{
    position: "absolute", inset: 0, width: "100%", height: "100%",
    opacity: 0.06, zIndex: 11, pointerEvents: "none",
    mixBlendMode: "overlay" as const,
  }} xmlns="http://www.w3.org/2000/svg">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#n)" />
  </svg>
);

// ── Main ──────────────────────────────────────────────────────────────────────

export const ThemeTestHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // White flash when red bar hits full (≈f12)
  const flashOp = interpolate(
    frame, [11, 12, 14], [0, 0.15, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 8.2x: appears at f54 (1.8s), 260px
  const heroSp    = s(frame, fps, 54, { damping: 12, mass: 0.6, stiffness: 220 });
  const heroScale = interpolate(heroSp, [0, 1], [0.35, 1], { extrapolateRight: "clamp" });
  const heroOp    = interpolate(heroSp, [0, 0.15], [0, 1],  { extrapolateRight: "clamp" });

  // "fewer tokens." at f66 (2.2s), 54px
  const bodySp  = s(frame, fps, 66, SP);
  const bodyOp  = interpolate(bodySp, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const bodyY   = interpolate(bodySp, [0, 1], [20, 0],  { extrapolateRight: "clamp" });

  // Breathing glow on 8.2x
  const glow = 80 + Math.sin((frame / fps) * Math.PI * 2 * 0.4) * 28;

  // DOM-level camera: rotateZ 0.4→0deg over full clip
  const rotZ = interpolate(frame, [0, 105], [0.4, 0], { extrapolateRight: "clamp" });

  // Bar glow heights (rough DOM approximation)
  const redGrow  = spring({ frame, fps, config: SP_FAST });
  const redGlowH = interpolate(redGrow, [0, 1], [40, 700], { extrapolateRight: "clamp" });
  const collapse = spring({ frame: Math.max(0, frame - 24), fps, config: SP_BOUNCE });
  const ambGlowH = interpolate(collapse, [0, 1], [700, 80], { extrapolateRight: "clamp" });

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: "radial-gradient(ellipse 130% 85% at 50% 105%, #0F0800 0%, #000000 65%)",
      transform: `rotateZ(${rotZ}deg)`,
    }}>

      <Grid />

      {/* Bar glow divs — 50px blur, pinned to 3D bar x-positions */}
      <div style={{
        position: "absolute",
        left: RED_GLOW_PX - 55,
        top: 400,
        width: 110,
        height: Math.min(redGlowH, 680),
        background: "radial-gradient(ellipse at top, rgba(229,72,77,0.25) 0%, transparent 70%)",
        filter: "blur(50px)",
        zIndex: 1, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        left: AMB_GLOW_PX - 55,
        top: 400,
        width: 110,
        height: Math.min(ambGlowH, 680),
        background: "radial-gradient(ellipse at top, rgba(245,158,11,0.30) 0%, transparent 70%)",
        filter: "blur(50px)",
        zIndex: 1, pointerEvents: "none",
      }} />

      {/* 3D scene — clipped to top 1100px */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 1100, overflow: "hidden", zIndex: 0,
      }}>
        <ThreeCanvas
          width={width} height={height}
          style={{ position: "absolute", top: 0, left: 0 }}
          camera={{ position: [0, 0.4, 12], fov: 65, near: 0.1, far: 60 }}
        >
          <Scene frame={frame} fps={fps} />
        </ThreeCanvas>
      </div>

      {/* White flash on red bar hit */}
      {flashOp > 0 && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 9,
          background: `rgba(255,255,255,${flashOp})`, pointerEvents: "none",
        }} />
      )}

      <Noise />

      {/* Scrim — 3D fades into text zone */}
      <div style={{
        position: "absolute", top: 880, left: 0, right: 0, height: 320,
        zIndex: 12, pointerEvents: "none",
        background: "linear-gradient(to bottom, transparent 0%, #000000 100%)",
      }} />
      <div style={{
        position: "absolute", top: 1200, left: 0, right: 0, bottom: 0,
        zIndex: 12, background: "#000000", pointerEvents: "none",
      }} />

      {/* 1px amber border */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none",
        border: "1px solid rgba(245,158,11,0.10)",
      }} />

      {/* ── 8.2x — 260px, x:80 y:360, appears at 1.8s ── */}
      <div style={{
        position: "absolute", top: 360, left: 80, zIndex: 20,
        opacity: heroOp,
        transform: `scale(${heroScale})`,
        transformOrigin: "left top",
      }}>
        {/* Glow behind */}
        <div style={{
          position: "absolute", inset: 0, zIndex: -1,
          fontFamily: SANS, fontSize: 260, fontWeight: 900,
          color: AMBER, lineHeight: 0.85, letterSpacing: "-0.05em",
          filter: "blur(160px)", opacity: 0.30,
          userSelect: "none", pointerEvents: "none",
        }}>
          8.2x
        </div>
        <div style={{
          fontFamily: SANS, fontSize: 260, fontWeight: 900,
          color: AMBER, lineHeight: 0.85, letterSpacing: "-0.05em",
          textShadow: `0 0 ${glow}px #F59E0B30, 0 0 ${glow * 2}px #F59E0B10`,
          WebkitTextStroke: "1px rgba(0,0,0,0.3)",
        }}>
          8.2x
        </div>
      </div>

      {/* ── "fewer tokens." — 54px, y:760 ── */}
      <div style={{
        position: "absolute", top: 760, left: 80, zIndex: 20,
        opacity: bodyOp,
        transform: `translateY(${bodyY}px)`,
      }}>
        <div style={{
          fontFamily: SANS, fontSize: 54, fontWeight: 600,
          color: "#F5F5F5", lineHeight: 1.1, letterSpacing: "-0.01em",
          WebkitTextStroke: "0.5px rgba(0,0,0,0.4)",
        }}>
          fewer tokens.
        </div>
      </div>

      {/* Telemetry + watermark */}
      <div style={{
        position: "absolute", bottom: 52, left: 72, right: 72, zIndex: 20,
        display: "flex", justifyContent: "space-between",
        fontFamily: MONO, fontSize: 10,
        color: "rgba(245,245,245,0.12)", letterSpacing: "0.1em",
      }}>
        <span>ADAMAX.AI</span>
        <span>code-review-graph</span>
      </div>
    </div>
  );
};
