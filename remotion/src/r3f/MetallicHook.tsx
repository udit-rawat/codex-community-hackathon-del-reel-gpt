/**
 * MetallicHook.tsx — Phase 3 R3F pilot component.
 *
 * Renders a physically-based metallic logo plate for hook beats.
 * Uses @remotion/three ThreeCanvas so Puppeteer screenshots the WebGL frame.
 *
 * Architecture:
 *   <ThreeCanvas> wraps the R3F scene.
 *   All animation driven by Remotion frame — deterministic, no RAF.
 *   PBR material: metalness 0.95, roughness 0.05 → Apple product launch look.
 *
 * Exports:
 *   <MetallicLogoPlate frame fps text color />  — floating logo slab with neon lights
 *   <GlassmorphCard frame fps children />       — frosted glass card (concept beats)
 */

import React, { useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import * as THREE from "three";
import { useFrame, type RootState } from "@react-three/fiber";
import { RoundedBox, MeshTransmissionMaterial, Environment, Float, Text } from "@react-three/drei";

// ── Deterministic easing (no RAF, driven by Remotion frame) ──────────────────

function useDrivenSpring(
  frame: number,
  fps: number,
  delay: number = 0,
  stiffness = 150,
  damping = 12,
): number {
  return spring({ frame: Math.max(0, frame - delay), fps, config: { stiffness, damping, mass: 1.2, overshootClamping: false } });
}

// ── Metallic Logo Plate ───────────────────────────────────────────────────────

interface MetallicLogoPlateProps {
  frame:   number;
  fps:     number;
  text:    string;          // e.g. "AMD", "DeepSeek", "AdaMax"
  color:   string;          // hex — used for point light tint
  subtext?: string;         // optional second line
}

const LogoScene: React.FC<MetallicLogoPlateProps> = ({ frame, fps, text, color, subtext }) => {
  const plateRef  = useRef<THREE.Mesh>(null);
  const lightRef1 = useRef<THREE.PointLight>(null);
  const lightRef2 = useRef<THREE.PointLight>(null);

  // Entrance spring
  const entryProg = useDrivenSpring(frame, fps, 0, 150, 12);
  const entryY    = interpolate(entryProg, [0, 1], [-3.5, 0]);
  const entryS    = interpolate(entryProg, [0, 1], [0.5, 1]);

  // Continuous slow Y-rotation + gentle tilt — all frame-driven
  const rotY    = (frame / fps) * 0.4;                          // 0.4 rad/s
  const tiltX   = Math.sin((frame / fps) * 0.3) * 0.06;         // gentle nod
  const tiltZ   = Math.sin((frame / fps) * 0.18 + 1) * 0.03;   // subtle roll

  // Orbiting accent light
  const orbitAngle = (frame / fps) * 1.1;
  const lightX     = Math.cos(orbitAngle) * 4.5;
  const lightZ     = Math.sin(orbitAngle) * 4.5;

  // Pulse secondary light intensity
  const lightPulse = 0.8 + Math.sin((frame / fps) * Math.PI * 2 * 0.4) * 0.4;

  // Apply transforms every frame (useFrame runs once per Remotion frame render)
  useFrame(() => {
    if (plateRef.current) {
      plateRef.current.position.y  = entryY;
      plateRef.current.scale.setScalar(entryS);
      plateRef.current.rotation.y  = rotY;
      plateRef.current.rotation.x  = tiltX;
      plateRef.current.rotation.z  = tiltZ;
    }
    if (lightRef1.current) {
      lightRef1.current.position.set(lightX, 2, lightZ);
    }
    if (lightRef2.current) {
      lightRef2.current.intensity = lightPulse;
    }
  });

  // Parse hex color → THREE.Color
  const threeColor = new THREE.Color(color);

  return (
    <>
      {/* Environment map — simulates studio lighting for PBR */}
      <Environment preset="studio" />

      {/* Key light — cool white from top */}
      <directionalLight position={[0, 8, 4]} intensity={1.4} color="#E8F0FF" />

      {/* Orbiting accent light — brand color tint */}
      <pointLight ref={lightRef1} color={threeColor} intensity={2.5} distance={12} />

      {/* Pulsing fill light — opposite side */}
      <pointLight
        ref={lightRef2}
        position={[-4, -2, 3]}
        color="#001a2e"
        intensity={lightPulse}
        distance={10}
      />

      {/* Rim light — thin neon edge */}
      <pointLight position={[0, -4, -3]} color={threeColor} intensity={1.2} distance={8} />

      {/* Logo plate */}
      <mesh ref={plateRef}>
        <RoundedBox args={[5.2, 1.8, 0.18]} radius={0.12} smoothness={6}>
          <meshStandardMaterial
            color="#0A0A0F"
            metalness={0.95}
            roughness={0.04}
            envMapIntensity={2.2}
          />
        </RoundedBox>

        {/* Inset accent face — colored stripe */}
        <mesh position={[0, 0, 0.092]}>
          <RoundedBox args={[4.8, 0.06, 0.01]} radius={0.03} smoothness={4}>
            <meshStandardMaterial
              color={threeColor}
              metalness={0.3}
              roughness={0.1}
              emissive={threeColor}
              emissiveIntensity={0.6}
            />
          </RoundedBox>
        </mesh>

        {/* Logo text — rendered via drei Text (SDF font) */}
        <Text
          position={[0, subtext ? 0.28 : 0, 0.1]}
          fontSize={subtext ? 0.58 : 0.72}
          fontWeight={800}
          color="#F9FAFB"
          anchorX="center"
          anchorY="middle"
          letterSpacing={-0.03}
        >
          {text}
        </Text>

        {subtext && (
          <Text
            position={[0, -0.28, 0.1]}
            fontSize={0.22}
            fontWeight={500}
            color={color}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.06}
          >
            {subtext.toUpperCase()}
          </Text>
        )}
      </mesh>
    </>
  );
};

export const MetallicLogoPlate: React.FC<MetallicLogoPlateProps & {
  width?: number;
  height?: number;
}> = ({ width = 1080, height = 420, ...props }) => {
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ position: "relative" }}
    >
      <LogoScene {...props} />
    </ThreeCanvas>
  );
};

// ── Glassmorphism Card ────────────────────────────────────────────────────────

interface GlassmorphCardProps {
  frame:    number;
  fps:      number;
  width?:   number;
  height?:  number;
  accentColor?: string;
  delay?:   number;
}

const GlassScene: React.FC<GlassmorphCardProps> = ({
  frame, fps, accentColor = "#00E5FF", delay = 0,
}) => {
  const cardRef = useRef<THREE.Mesh>(null);

  const entryProg = useDrivenSpring(frame, fps, delay, 150, 12);
  const entryY    = interpolate(entryProg, [0, 1], [-2.5, 0]);
  const entryS    = interpolate(entryProg, [0, 1], [0.6, 1]);

  // Gentle float after entrance
  const floatY  = entryProg > 0.9 ? Math.sin((frame / fps) * Math.PI * 2 * 0.25) * 0.06 : 0;
  const floatRX = entryProg > 0.9 ? Math.sin((frame / fps) * Math.PI * 2 * 0.18) * 0.015 : 0;

  const threeColor = new THREE.Color(accentColor);
  const pulseI     = 1.2 + Math.sin((frame / fps) * Math.PI * 2 * 0.4) * 0.5;

  useFrame(() => {
    if (cardRef.current) {
      cardRef.current.position.y  = entryY + floatY;
      cardRef.current.rotation.x  = floatRX;
      cardRef.current.scale.setScalar(entryS);
    }
  });

  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} color="#D0E8FF" />
      <pointLight position={[-3, 2, 3]} color={threeColor} intensity={pulseI} distance={8} />
      <pointLight position={[3, -2, -2]} color={threeColor} intensity={0.6} distance={6} />

      <mesh ref={cardRef}>
        <RoundedBox args={[4.6, 2.6, 0.08]} radius={0.18} smoothness={6}>
          {/* MeshTransmissionMaterial = physically-correct glass/frosted */}
          <MeshTransmissionMaterial
            backside
            samples={8}
            thickness={0.2}
            roughness={0.08}
            transmission={0.92}
            ior={1.5}
            chromaticAberration={0.02}
            anisotropicBlur={0.1}
            distortion={0.05}
            distortionScale={0.1}
            temporalDistortion={0}
            color="#ffffff"
          />
        </RoundedBox>

        {/* Neon edge glow via emissive border mesh */}
        <mesh position={[0, 0, 0]}>
          <RoundedBox args={[4.65, 2.65, 0.075]} radius={0.19} smoothness={6}>
            <meshStandardMaterial
              color={threeColor}
              emissive={threeColor}
              emissiveIntensity={0.25}
              transparent
              opacity={0.15}
              metalness={0}
              roughness={1}
            />
          </RoundedBox>
        </mesh>
      </mesh>
    </>
  );
};

export const GlassmorphCard: React.FC<GlassmorphCardProps> = ({
  width = 1080, height = 480, ...props
}) => {
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ position: "relative" }}
    >
      <GlassScene {...props} />
    </ThreeCanvas>
  );
};
