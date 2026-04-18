/**
 * QwenPawCPU.tsx — 180f / 6s / 30fps
 * Amber/gold palette. Three acts: emergence → reveal → lock.
 *
 * ── EDIT ─────────────────────────────────────────────────────────────────────
 */
const PROPS = {
  label:       "100% CPU",
  amber:       "#F59E0B",
  amberHex:    0xF59E0B,
  darkAmber:   "#78350F",
  dieColor:    "#0F0F0F",
  subColor:    "#080808",
};
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Text } from "@react-three/drei";

// Functional blocks on die face: [x, y, w, h, raised, isActiveCore]
const BLOCKS: Array<[number, number, number, number, number, boolean]> = [
  [ 0.9,  0.9, 1.1, 1.1, 0.16, true  ],  // active core — top right
  [-0.9,  0.9, 0.9, 1.1, 0.10, false ],  // top left
  [ 0.9, -0.5, 1.1, 0.8, 0.08, false ],  // mid right
  [-0.9, -0.3, 0.9, 1.2, 0.12, false ],  // mid left
  [ 0.0, -1.1, 1.6, 0.5, 0.07, false ],  // bottom center (IO)
  [-0.3,  0.1, 0.5, 0.5, 0.09, false ],  // small center
];

// Solder bumps: 4×4 grid on substrate underside
const BUMPS: Array<[number, number]> = [];
for (let r = -1.5; r <= 1.5; r += 1.0) {
  for (let c = -1.5; c <= 1.5; c += 1.0) {
    BUMPS.push([c, r]);
  }
}

const CPUScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const sp = (f: number, cfg = { damping: 18, mass: 1.1, stiffness: 180 }) =>
    spring({ frame: Math.max(0, f), fps, config: cfg });

  // Act 1 — emergence (f0–f40)
  const riseP  = sp(frame, { damping: 14, mass: 1.4, stiffness: 160 });
  const riseY  = interpolate(riseP, [0, 1], [-5.5, 0], { extrapolateRight: "clamp" });
  const riseOp = interpolate(riseP, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });
  const subOp  = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  // Act 2 — rotation (f40–f120), eases to near-stop at f160
  // Cumulative rotation — closed form across the 3 speed segments
  const computeRotY = (): number => {
    if (frame <= 40) return 0;
    const f = frame;
    // Segment A: f40–f120, speed ramps 0→0.005 linearly
    const endA = Math.min(f, 120);
    const dA   = endA - 40;
    const segA = dA > 0 ? (0 + interpolate(endA, [40, 120], [0, 0.005], { extrapolateRight: "clamp" })) / 2 * dA : 0;
    if (f <= 120) return segA;
    // Segment B: f120–f160, speed ramps 0.005→0.0007 linearly
    const endB = Math.min(f, 160);
    const dB   = endB - 120;
    const segB = dB > 0 ? (0.005 + interpolate(endB, [120, 160], [0.005, 0.0007], { extrapolateRight: "clamp" })) / 2 * dB : 0;
    if (f <= 160) return segA + segB;
    // Segment C: f160+, constant 0.0007
    return segA + segB + (f - 160) * 0.0007;
  };

  // Act 3 — label + scan line (f120–f180)
  const labelOp   = interpolate(frame, [130, 145], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scanY     = interpolate(frame, [150, 170], [1.9, -1.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scanOp    = interpolate(frame, [150, 153, 168, 170], [0, 0.45, 0.45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Active core pulse — 1Hz from f60
  const corePulse = frame >= 60
    ? 0.6 + Math.sin(((frame - 60) / fps) * Math.PI * 2 * 1.0) * 0.5
    : 0;

  const amber = new THREE.Color(PROPS.amberHex);

  return (
    <group position={[0, riseY, 0]} rotation={[0.26, computeRotY(), 0]}>
      {/* Substrate plate */}
      <mesh position={[0, 0, -0.22]} renderOrder={0}>
        <boxGeometry args={[4.4, 4.4, 0.15]} />
        <meshStandardMaterial
          color={new THREE.Color(0x060606)}
          metalness={0.95}
          roughness={0.05}
          opacity={subOp}
          transparent
        />
      </mesh>

      {/* Solder bumps on substrate underside */}
      {BUMPS.map(([bx, by], i) => (
        <mesh key={`bump-${i}`} position={[bx * 0.75, by * 0.75, -0.35]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial
            color={new THREE.Color(0xC0A020)}
            metalness={0.9}
            roughness={0.1}
            opacity={subOp * 0.7}
            transparent
          />
        </mesh>
      ))}

      {/* Die body */}
      <mesh position={[0, 0, 0]} renderOrder={1}>
        <boxGeometry args={[3.8, 3.8, 0.28]} />
        <meshStandardMaterial
          color={new THREE.Color(PROPS.dieColor)}
          metalness={0.8}
          roughness={0.15}
          opacity={riseOp}
          transparent
        />
      </mesh>

      {/* Functional blocks */}
      {BLOCKS.map(([bx, by, bw, bh, raised, isCore], i) => (
        <mesh key={`block-${i}`} position={[bx, by, 0.14 + raised / 2]}>
          <boxGeometry args={[bw * 0.9, bh * 0.9, raised]} />
          <meshStandardMaterial
            color={isCore ? amber : new THREE.Color(0x1a1000)}
            emissive={isCore ? amber : new THREE.Color(0x0a0800)}
            emissiveIntensity={isCore ? corePulse : 0.1}
            metalness={0.7}
            roughness={isCore ? 0.1 : 0.35}
            opacity={riseOp}
            transparent
          />
        </mesh>
      ))}

      {/* Scan line — sweeps top to bottom at f150 */}
      <mesh position={[0, scanY, 0.31]}>
        <boxGeometry args={[3.6, 0.04, 0.01]} />
        <meshStandardMaterial
          color={amber}
          emissive={amber}
          emissiveIntensity={2.5}
          opacity={scanOp}
          transparent
        />
      </mesh>

      {/* Label — face-forward at f130 */}
      <Text
        position={[0, -2.55, 0.2]}
        fontSize={0.36}
        anchorX="center"
        anchorY="middle"
        fillOpacity={labelOp}
        font={undefined}
        color={PROPS.amber}
        letterSpacing={0.1}
      >
        {PROPS.label}
      </Text>
    </group>
  );
};

const Lights: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const t = frame / fps;
  const keyI = 4.5 + Math.sin(t * Math.PI * 2 * 0.28) * 0.4;
  return (
    <>
      <ambientLight intensity={0.06} />
      {/* Strong directional key — top left, casts shadow contrast across blocks */}
      <directionalLight
        color={0xfff5e0}
        intensity={keyI}
        position={[-5, 7, 6]}
      />
      {/* Amber rim from behind */}
      <pointLight color={0xF59E0B} intensity={1.2} position={[0, 0, -4]} distance={14} decay={2} />
    </>
  );
};

export const QwenPawCPU: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
        camera={{ position: [0, 0.8, 9], fov: 52, near: 0.1, far: 60 }}
      >
        <Lights frame={frame} fps={fps} />
        <CPUScene frame={frame} fps={fps} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const QwenPawCPUConfig = {
  durationInFrames: 180,
  fps:    30,
  width:  1080,
  height: 1920,
};
