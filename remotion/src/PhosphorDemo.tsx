/**
 * PhosphorDemo.tsx — 60f / 2.0s / 30fps
 * Standalone amber bars demo. Uses its own palette (not main Neon Cyber theme).
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Text, RoundedBox } from "@react-three/drei";

const DEMO = {
  bg:           "radial-gradient(160deg, #0F0800 0%, #000000 100%)",
  bgSolid:      "#000000",
  accent:       "#F59E0B",
  accentHex:    0xF59E0B,
  redHex:       0xE5484D,
  text:         "#F5F5F5",
  border:       "rgba(245,158,11,0.10)",
  font:         "'Space Grotesk', 'Inter', sans-serif",
  mono:         "'JetBrains Mono', 'Fira Code', monospace",
  heroSize:     280,
  bodySize:     56,
  safeX:        80,
  safeYMin:     360,
  noise:        0.06,
  gridOpacity:  0.04,
  gridSize:     "80px 80px",
  spring:       { damping: 14, mass: 0.7, stiffness: 200 },
  springFast:   { damping: 12, mass: 0.5, stiffness: 300 },
  springBounce: { damping: 8,  mass: 1.2, stiffness: 220 },
  springInstant:{ damping: 8,  mass: 0.3, stiffness: 400 },
} as const;

const MAX_H   = 3.2;
const AFTER_H = MAX_H / 8.2;
const BAR_W   = 1.0;
const BAR_D   = 0.55;
const BASE_Y  = -2.8;
const RED_X   = -1.3;
const AMB_X   =  1.3;
const RED_GLOW_PX = 540 - 1.3 * 125.6;
const AMB_GLOW_PX = 540 + 1.3 * 125.6;

const Bars: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const sp = (delay: number, cfg = DEMO.spring) =>
    spring({ frame: Math.max(0, frame - delay), fps, config: cfg });

  const collapse  = sp(5, DEMO.springBounce);
  const ambH      = interpolate(collapse, [0, 1], [MAX_H, AFTER_H], { extrapolateRight: "clamp" });
  const bounceY   = frame >= 45
    ? interpolate(frame, [45, 52, 60], [0, -0.05, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const breathe   = 1 + Math.sin((frame / 30) * Math.PI * 2 * 0.5) * 0.012;
  const colT      = frame >= 5 ? Math.max(0, 1 - (frame - 5) / 20) : 0;
  const ambEmit   = 0.55 + colT * 2.4;
  const afterLabOp = collapse;

  return (
    <group position={[0, bounceY, 0]}>
      <group position={[RED_X, BASE_Y + MAX_H / 2, 0]} scale={[1, breathe, 1]}>
        <RoundedBox args={[BAR_W, MAX_H, BAR_D]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color={DEMO.redHex} emissive={new THREE.Color(DEMO.redHex)} emissiveIntensity={0.5} metalness={0.55} roughness={0.25} />
        </RoundedBox>
        <mesh position={[-BAR_W / 2 - 0.025, 0, 0]}>
          <boxGeometry args={[0.05, MAX_H, BAR_D * 0.95]} />
          <meshStandardMaterial color={0x8B1A1D} metalness={0.6} roughness={0.3} transparent opacity={0.65} />
        </mesh>
      </group>
      <group position={[AMB_X, BASE_Y + ambH / 2, 0]} scale={[1, breathe, 1]}>
        <RoundedBox args={[BAR_W, Math.max(ambH, 0.01), BAR_D]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color={DEMO.accentHex} emissive={new THREE.Color(DEMO.accentHex)} emissiveIntensity={ambEmit} metalness={0.65} roughness={0.15} />
        </RoundedBox>
        <mesh position={[BAR_W / 2 + 0.025, 0, 0]}>
          <boxGeometry args={[0.05, Math.max(ambH, 0.01), BAR_D * 0.95]} />
          <meshStandardMaterial color={0x92610A} metalness={0.6} roughness={0.3} transparent opacity={0.65} />
        </mesh>
      </group>
      <RoundedBox args={[5.0, 0.05, 0.8]} radius={0.02} position={[0, BASE_Y, 0]}>
        <meshStandardMaterial color={0x1a1000} metalness={0.9} roughness={0.2} />
      </RoundedBox>
      <Text position={[RED_X, BASE_Y + MAX_H - 0.38, 0.32]} fontSize={0.48} anchorX="center" anchorY="top" fillOpacity={0.95} font={undefined} color={0xffffff}>13,240</Text>
      <Text position={[AMB_X, BASE_Y + Math.max(ambH, 0.01) - 0.38, 0.32]} fontSize={0.48} anchorX="center" anchorY="top" fillOpacity={0.95} font={undefined} color={DEMO.accentHex}>1,610</Text>
      <Text position={[RED_X, BASE_Y + MAX_H + 0.14, 0]} fontSize={0.175} color={0x71717A} anchorX="center" anchorY="bottom" fillOpacity={0.85} font={undefined} letterSpacing={0.15}>BEFORE</Text>
      <Text position={[AMB_X, BASE_Y + AFTER_H + 0.14, 0]} fontSize={0.175} color={DEMO.accentHex} anchorX="center" anchorY="bottom" fillOpacity={afterLabOp * 0.85} font={undefined} letterSpacing={0.15}>AFTER</Text>
      <Text position={[AMB_X, BASE_Y + AFTER_H + 0.52, 0.32]} fontSize={0.26} anchorX="center" fillOpacity={afterLabOp * 0.9} font={undefined} color={DEMO.accentHex}>1,610</Text>
    </group>
  );
};

const Lights: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const t    = frame / fps;
  const colT = frame >= 5 ? Math.max(0, 1 - (frame - 5) / 20) : 0;
  const keyI = 2.2 + Math.sin(t * Math.PI * 2 * 0.35) * 0.2 + colT * 2.8;
  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight color={DEMO.accentHex} intensity={keyI} position={[-1, 4, 5]} distance={20} decay={2} />
      <pointLight color={0xddeeff} intensity={0.65} position={[4, 2, 4]} distance={14} decay={2} />
      <pointLight color={DEMO.accentHex} intensity={0.8} position={[1.3, -1, -1]} distance={8} decay={2} />
    </>
  );
};

export const PhosphorDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const sp = (delay: number, cfg = DEMO.spring) =>
    spring({ frame: Math.max(0, frame - delay), fps, config: cfg });

  const heroSp    = sp(0, DEMO.springInstant);
  const heroScale = interpolate(heroSp, [0, 1], [0.6, 1], { extrapolateRight: "clamp" });
  const heroOp    = interpolate(heroSp, [0, 0.3], [0, 1],  { extrapolateRight: "clamp" });
  const glow      = 80 + Math.sin((frame / fps) * Math.PI * 2 * 0.4) * 28;

  const bodySp  = sp(3, DEMO.spring);
  const bodyOp  = interpolate(bodySp, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const bodyY   = interpolate(bodySp, [0, 1],   [16, 0], { extrapolateRight: "clamp" });

  const pushIn = interpolate(frame, [0, 60], [1.02, 1.0], { extrapolateRight: "clamp" });

  const collapse3D = spring({ frame: Math.max(0, frame - 5), fps, config: DEMO.springBounce });
  const ambGlowH   = interpolate(collapse3D, [0, 1], [660, 80], { extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: DEMO.bg }}>
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        backgroundImage: [
          `linear-gradient(rgba(255,255,255,${DEMO.gridOpacity}) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(255,255,255,${DEMO.gridOpacity}) 1px, transparent 1px)`,
        ].join(", "),
        backgroundSize: DEMO.gridSize,
      }} />
      <div style={{ position: "absolute", left: RED_GLOW_PX - 55, top: 400, width: 110, height: 660, background: "radial-gradient(ellipse at top, rgba(229,72,77,0.22) 0%, transparent 70%)", filter: "blur(50px)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: AMB_GLOW_PX - 55, top: 400, width: 110, height: Math.min(ambGlowH, 660), background: "radial-gradient(ellipse at top, rgba(245,158,11,0.28) 0%, transparent 70%)", filter: "blur(50px)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1100, overflow: "hidden", zIndex: 0 }}>
        <ThreeCanvas width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }} camera={{ position: [0, 0.4, 12], fov: 65, near: 0.1, far: 60 }}>
          <group scale={[pushIn, pushIn, pushIn]} position={[0, 0.4, 0]}>
            <Lights frame={frame} fps={fps} />
            <Bars   frame={frame} fps={fps} />
          </group>
        </ThreeCanvas>
      </div>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: DEMO.noise, zIndex: 11, pointerEvents: "none", mixBlendMode: "overlay" as const }} xmlns="http://www.w3.org/2000/svg">
        <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>
      <div style={{ position: "absolute", top: 880, left: 0, right: 0, height: 320, zIndex: 12, pointerEvents: "none", background: "linear-gradient(to bottom, transparent 0%, #000000 100%)" }} />
      <div style={{ position: "absolute", top: 1200, left: 0, right: 0, bottom: 0, zIndex: 12, background: DEMO.bgSolid, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none", border: `1px solid ${DEMO.border}` }} />
      <div style={{ position: "absolute", top: DEMO.safeYMin, left: DEMO.safeX, zIndex: 20, opacity: heroOp, transform: `scale(${heroScale})`, transformOrigin: "left top" }}>
        <div style={{ position: "absolute", inset: 0, zIndex: -1, fontFamily: DEMO.font, fontSize: DEMO.heroSize, fontWeight: 900, color: DEMO.accent, lineHeight: 0.85, letterSpacing: "-0.05em", filter: "blur(160px)", opacity: 0.28, userSelect: "none", pointerEvents: "none" }}>8.2x</div>
        <div style={{ fontFamily: DEMO.font, fontSize: DEMO.heroSize, fontWeight: 900, color: DEMO.accent, lineHeight: 0.85, letterSpacing: "-0.05em", textShadow: `0 0 ${glow}px #F59E0B30, 0 0 ${glow * 2}px #F59E0B10`, WebkitTextStroke: "1px rgba(0,0,0,0.3)" }}>8.2x</div>
      </div>
      <div style={{ position: "absolute", top: 760, left: DEMO.safeX, zIndex: 20, opacity: bodyOp, transform: `translateY(${bodyY}px)` }}>
        <div style={{ fontFamily: DEMO.font, fontSize: DEMO.bodySize, fontWeight: 600, color: DEMO.text, lineHeight: 1.1, letterSpacing: "-0.01em", WebkitTextStroke: "0.5px rgba(0,0,0,0.4)" }}>fewer tokens.</div>
      </div>
      <div style={{ position: "absolute", bottom: 52, left: 72, right: 72, zIndex: 20, display: "flex", justifyContent: "space-between", fontFamily: DEMO.mono, fontSize: 10, color: "rgba(245,245,245,0.12)", letterSpacing: "0.1em" }}>
        <span>ADAMAX.AI</span><span>code-review-graph</span>
      </div>
    </div>
  );
};
