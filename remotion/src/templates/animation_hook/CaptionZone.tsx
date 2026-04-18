/**
 * CaptionZone — shared wrapper for all Three.js template variants.
 *
 * Layout contract:
 *   - Top 0–1240px: TRANSPARENT — Three.js bg loop sits here in iMovie
 *   - y:1240–1680: content zone (text, stats, labels)
 *   - Scrim: linear gradient transparent→#000 from y:1100 to y:1280
 *
 * Usage: wrap any caption-zone content in <CaptionZone>
 */

import React from "react";
import { COLOR } from "../../layouts/_shared";

export const CaptionZone: React.FC<{
  children: React.ReactNode;
  accentColor?: keyof typeof COLOR;
}> = ({ children, accentColor = "cyan" }) => {
  const accent = COLOR[accentColor];
  return (
    <div style={{
      width: "100%", height: "100%",
      position: "relative", overflow: "hidden",
      background: "transparent",
    }}>
      {/* Scrim — fades black from y:1100 so text is always readable */}
      <div style={{
        position: "absolute", top: 1100, left: 0, right: 0, height: 220,
        background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.95) 100%)",
        zIndex: 1, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 1320, left: 0, right: 0, bottom: 0,
        background: "#000000", zIndex: 1, pointerEvents: "none",
      }} />

      {/* 1px accent border */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none",
        border: `1px solid ${accent}18`,
      }} />

      {/* Content lives here — positioned in caption zone */}
      <div style={{
        position: "absolute",
        top: 1240, left: 72, right: 72, bottom: 60,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        gap: 20,
      }}>
        {children}
      </div>
    </div>
  );
};
