// Single source of truth. All templates import from here.
// Deep Winter Minimalist — Premium DevTool Visual System

export const THEME = {
  // Background
  bg:      "linear-gradient(180deg, #111112 0%, #080809 100%)",
  bgSolid: "#0C0C0D",

  // Colors — Deep Winter
  cyan:    "#2563EB",              // Cobalt Blue — structural accents, key data elements
  yellow:  "#D1D5DB",              // Cool Silver — secondary labels, muted context
  green:   "#10B981",              // Emerald — positive metrics
  red:     "#E11D48",              // Deep Ruby — negative metrics, critical info
  white:   "#FFFFFF",              // Stark icy white — all primary display text
  muted:   "rgba(255,255,255,0.45)",
  border:  "#2A2A2B",              // Subtle structural lines

  // Typography
  font:     "'Inter', 'Space Grotesk', sans-serif",
  mono:     "'JetBrains Mono', 'Fira Code', monospace",
  heroSize: 280,
  bodySize: 56,
  labelSize: 24,

  // Layout
  safeX:    72,
  safeYMin: 120,
  safeYMax: 180,

  // Caption zone — animation_hook template variants
  captionTop:    1240,
  captionBottom: 1680,

  // Effects
  noise:       0.015,
  gridOpacity: 0.02,
  gridSize:    "120px 120px",

  // Motion
  spring:       { damping: 14, mass: 0.7, stiffness: 200 },
  springMedium: { damping: 18, mass: 0.8, stiffness: 220 },
  springHeavy:  { damping: 22, mass: 1.0, stiffness: 180 },
  springFast:   { damping: 12, mass: 0.5, stiffness: 300 },
  springBounce: { damping: 8,  mass: 1.2, stiffness: 220 },
} as const;

export type Theme = typeof THEME;
