/**
 * TerminalScene — macOS-style terminal window beat.
 *
 * Use for: install commands, git clone steps, code execution, repo drops.
 * The brief_generator assigns this template when concept beats contain
 * shell commands or step-by-step CLI instructions.
 *
 * Animation model:
 *   - Window slides up from below (MEDIUM spring)
 *   - Traffic light buttons pop in at frame 8
 *   - Each command line types in character-by-character
 *   - Output lines fade in after the command finishes typing
 *   - Cursor blinks on the active line
 *   - Optional pulse highlight on the key command line
 *
 * Props (via TerminalSceneData):
 *   section_label  — micro-label e.g. "INSTALL"
 *   title          — terminal window title bar text e.g. "bash"
 *   lines          — array of TerminalLine objects
 *   accent_color   — cyan | green | yellow (default cyan)
 *   pulse_line     — index of line to pulse-highlight (optional)
 *   pulse_frames   — frames at which to fire pulse on pulse_line (optional)
 */

import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import type { TerminalSceneData, TerminalLine } from "../types";
import { useBeatFrame } from "../hooks/useBeatFrame";
import { SPRING_MEDIUM, SPRING_HEAVY } from "../utils/springIn";
import {
  COLOR, FONT, BROADCAST_TEXT, SectionLabelRow,
  ParticleBackground, TelemetryFrame,
  usePulseAt,
} from "./_shared";

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARS_PER_FRAME = 2.2;   // typing speed — characters revealed per frame
const LINE_GAP        = 8;     // frames between lines starting to type

// ── Traffic light dots ────────────────────────────────────────────────────────

const TrafficLights: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const prog = spring({ frame: Math.max(0, frame - 8), fps, config: SPRING_MEDIUM });
  const colors = ["#FF5F57", "#FFBD2E", "#28C840"];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {colors.map((c, i) => {
        const p = spring({ frame: Math.max(0, frame - 8 - i * 4), fps, config: SPRING_MEDIUM });
        const scale   = interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" });
        const opacity = interpolate(p, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            width: 14, height: 14,
            borderRadius: "50%",
            background: c,
            opacity,
            transform: `scale(${scale})`,
            boxShadow: `0 0 6px ${c}80`,
          }} />
        );
      })}
    </div>
  );
};

// ── Cursor blink ──────────────────────────────────────────────────────────────

const Cursor: React.FC<{ frame: number; color: string }> = ({ frame, color }) => {
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <span style={{
      display:         "inline-block",
      width:           12,
      height:          28,
      background:      blink ? color : "transparent",
      verticalAlign:   "text-bottom",
      marginLeft:      2,
      borderRadius:    1,
      boxShadow:       blink ? `0 0 8px ${color}80` : "none",
      transition:      "background 0.05s",
    }} />
  );
};

// ── Single terminal line ──────────────────────────────────────────────────────

const TerminalLineRow: React.FC<{
  line:       TerminalLine;
  frame:      number;
  fps:        number;
  startFrame: number;
  isActive:   boolean;
  accent:     string;
  pulseBox:   string;   // CSS boxShadow from usePulseAt
}> = ({ line, frame, fps, startFrame, isActive, accent, pulseBox }) => {
  const localFrame = Math.max(0, frame - startFrame);

  // Fade in for output lines
  const fadeOpacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  if (line.type === "output") {
    return (
      <div style={{
        opacity:    fadeOpacity,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize:   28,
        color:      line.color === "green"  ? COLOR.green
                  : line.color === "yellow" ? COLOR.yellow
                  : line.color === "red"    ? COLOR.red
                  : "rgba(255,255,255,0.55)",
        lineHeight: 1.6,
        paddingLeft: 8,
      }}>
        {line.text}
      </div>
    );
  }

  // Command line — type-in effect
  const charsVisible  = Math.floor(localFrame * CHARS_PER_FRAME);
  const visibleText   = line.text.slice(0, charsVisible);
  const isTypingDone  = charsVisible >= line.text.length;

  const promptColor = line.type === "comment" ? "rgba(255,255,255,0.30)" : accent;
  const prompt      = line.type === "comment" ? "# " : "$ ";

  return (
    <div style={{
      display:    "flex",
      alignItems: "flex-start",
      gap:        10,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      fontSize:   32,
      lineHeight: 1.55,
      background: pulseBox !== "none" ? `${accent}08` : "transparent",
      borderRadius: 8,
      padding:    "4px 8px",
      boxShadow:  pulseBox,
      transition: "box-shadow 0.1s",
      borderLeft: pulseBox !== "none" ? `3px solid ${accent}` : "3px solid transparent",
    }}>
      <span style={{ color: promptColor, flexShrink: 0, userSelect: "none" }}>
        {prompt}
      </span>
      <span style={{ color: line.type === "comment" ? "rgba(255,255,255,0.30)" : "#F9FAFB", flex: 1, wordBreak: "break-all" }}>
        {visibleText}
        {isActive && !isTypingDone && <Cursor frame={frame} color={accent} />}
        {isActive &&  isTypingDone && <Cursor frame={frame} color={accent} />}
      </span>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const TerminalScene: React.FC<{ data: TerminalSceneData }> = ({ data }) => {
  const frame   = useBeatFrame();
  const { fps } = useVideoConfig();
  const accent  = COLOR[data.accent_color ?? "cyan"];

  // Window entrance — slides up from below
  const windowProg = spring({ frame: Math.max(0, frame), fps, config: SPRING_MEDIUM });
  const windowY    = interpolate(windowProg, [0, 1], [80, 0]);
  const windowOp   = interpolate(windowProg, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });

  // Compute per-line start frames
  // Command lines: staggered by LINE_GAP + time to type previous command
  const lineStartFrames: number[] = [];
  let cursor = 12; // initial delay after window entrance
  for (const line of data.lines) {
    lineStartFrames.push(cursor);
    if (line.type === "command") {
      // Time to finish typing + small pause before next line
      cursor += Math.ceil(line.text.length / CHARS_PER_FRAME) + LINE_GAP;
    } else {
      cursor += LINE_GAP;
    }
  }

  // Active line = last command that has started
  const activeIdx = data.lines.reduce((acc, _, i) =>
    frame >= lineStartFrames[i] ? i : acc, -1);

  // Pulse on designated line
  const pulseFrames = data.pulse_frames ?? [];
  const pulseLine   = data.pulse_line  ?? -1;

  return (
    <div style={{
      width:          "100%",
      height:         "100%",
      background:     "linear-gradient(180deg, #111112 0%, #080809 100%)",
      position:       "relative",
      overflow:       "hidden",
      display:        "flex",
      flexDirection:  "column",
      paddingTop:     120,
      paddingBottom:  180,
      paddingLeft:    72,
      paddingRight:   72,
      boxSizing:      "border-box",
      fontFamily:     FONT,
      gap:            32,
      justifyContent: "center",
    }}>

      <ParticleBackground frame={frame} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 32 }}>
        <SectionLabelRow text={data.section_label} color={data.accent_color ?? "cyan"} />

        {/* Terminal window */}
        <div style={{
          opacity:      windowOp,
          transform:    `translateY(${windowY}px)`,
          background:   "#1C1C1E",
          border:       `1px solid rgba(255,255,255,0.10)`,
          borderRadius: 16,
          overflow:     "hidden",
          boxShadow:    `0 24px 80px rgba(0,0,0,0.60), 0 0 0 0.5px rgba(255,255,255,0.05)`,
        }}>

          {/* Title bar */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            gap:            12,
            padding:        "16px 20px",
            background:     "#2C2C2E",
            borderBottom:   "1px solid rgba(255,255,255,0.06)",
          }}>
            <TrafficLights frame={frame} fps={fps} />
            <div style={{
              flex:          1,
              textAlign:     "center",
              fontFamily:    "'JetBrains Mono', 'Fira Code', monospace",
              fontSize:      22,
              color:         "rgba(255,255,255,0.35)",
              letterSpacing: "0.04em",
              marginRight:   54, // offset for traffic lights width
            }}>
              {data.title ?? "bash"}
            </div>
          </div>

          {/* Terminal body */}
          <div style={{
            padding:        "24px 28px",
            minHeight:      240,
            display:        "flex",
            flexDirection:  "column",
            gap:            6,
          }}>
            {data.lines.map((line, i) => {
              if (frame < lineStartFrames[i]) return null;

              const isActiveLine = i === activeIdx;
              const pulseBox = (i === pulseLine)
                ? usePulseAt(frame, pulseFrames, accent, 24)
                : "none";

              return (
                <TerminalLineRow
                  key={i}
                  line={line}
                  frame={frame}
                  fps={fps}
                  startFrame={lineStartFrames[i]}
                  isActive={isActiveLine}
                  accent={accent}
                  pulseBox={pulseBox}
                />
              );
            })}
          </div>
        </div>
      </div>

      <TelemetryFrame frame={frame} />
    </div>
  );
};
