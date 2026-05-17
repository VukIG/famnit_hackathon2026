<<<<<<< Updated upstream
import { useState } from "react";
import "./index.css";
import { MOCK_FORECAST, TIDE_CURVE } from "./data/mock";
import Background    from "./components/Background/Background";
import Header        from "./components/Header/Header";
import Hero          from "./components/Hero/Hero";
import WindowChecker from "./components/WindowChecker/WindowChecker";
import ConditionsNow from "./components/ConditionsNow/ConditionsNow";
import TideCurve     from "./components/TideCurve/TideCurve";
import DayStrip      from "./components/DayStrip/DayStrip";
import DetailPanel   from "./components/DetailPanel/DetailPanel";
import Footer        from "./components/Footer/Footer";

export default function App() {
  const [selectedWin, setSelectedWin] = useState(null);
  const hero = MOCK_FORECAST.windows[0];
=======
import { SeaBackground } from "./components/SeaBackground";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

/* ─── MOCK DATA ──────────────────────────────────────────────── */
const MOCK_FORECAST = {
  locationName: "Sea Oasis — Site Alpha",
  generatedAt: new Date().toISOString(),
  windows: [
    {
      id: "w1",
      label: "Today",
      startsAt: "2025-06-10T14:20:00",
      endsAt: "2025-06-10T15:50:00",
      confidence: 0.87,
      visibilityScore: 8.4,
      conditionState: "optimal",
      factors: {
        tide: { value: 0.4, unit: "m", trend: "rising", impact: "good" },
        wind: { value: 12, unit: "km/h", direction: "W", impact: "good" },
        waterTemp: { value: 22, unit: "°C", impact: "good" },
        moonDistance: { value: 362000, unit: "km", phase: "Waxing Gibbous", impact: "neutral" },
      },
      reasoning: [
        "Tide rising through the window — optimal light penetration expected.",
        "Wind below 15 km/h threshold; surface chop minimal.",
        "Water temperature in ideal range for visibility.",
        "Moon 92% full; no significant lunar tidal effect today.",
      ],
    },
    {
      id: "w2",
      label: "Tue",
      startsAt: "2025-06-11T09:45:00",
      endsAt: "2025-06-11T11:10:00",
      confidence: 0.61,
      visibilityScore: 5.9,
      conditionState: "marginal",
      factors: {
        tide: { value: 0.7, unit: "m", trend: "falling", impact: "neutral" },
        wind: { value: 22, unit: "km/h", direction: "SW", impact: "neutral" },
        waterTemp: { value: 21, unit: "°C", impact: "good" },
        moonDistance: { value: 370000, unit: "km", phase: "Full Moon", impact: "neutral" },
      },
      reasoning: [
        "Tide falling — moderate silt disturbance possible.",
        "Wind at 22 km/h may create surface chop reducing visibility.",
        "Overall marginal — proceed with caution.",
      ],
    },
    {
      id: "w3",
      label: "Wed",
      startsAt: "2025-06-12T16:00:00",
      endsAt: "2025-06-12T17:20:00",
      confidence: 0.29,
      visibilityScore: 2.1,
      conditionState: "poor",
      factors: {
        tide: { value: 1.2, unit: "m", trend: "falling", impact: "bad" },
        wind: { value: 38, unit: "km/h", direction: "NW", impact: "bad" },
        waterTemp: { value: 19, unit: "°C", impact: "neutral" },
        moonDistance: { value: 380000, unit: "km", phase: "Waning Gibbous", impact: "neutral" },
      },
      reasoning: [
        "High wind (38 km/h) — significant surface disturbance.",
        "Tide at high-water mark; turbidity elevated.",
        "Not recommended. Reschedule if possible.",
      ],
    },
    {
      id: "w4",
      label: "Thu",
      startsAt: "2025-06-13T11:10:00",
      endsAt: "2025-06-13T12:40:00",
      confidence: 0.78,
      visibilityScore: 7.6,
      conditionState: "optimal",
      factors: {
        tide: { value: 0.3, unit: "m", trend: "rising", impact: "good" },
        wind: { value: 9, unit: "km/h", direction: "E", impact: "good" },
        waterTemp: { value: 23, unit: "°C", impact: "good" },
        moonDistance: { value: 395000, unit: "km", phase: "Last Quarter", impact: "good" },
      },
      reasoning: [
        "Low tide rising — excellent light penetration forecast.",
        "Calm winds; glass-like surface expected.",
        "High confidence — ideal conditions.",
      ],
    },
    {
      id: "w5",
      label: "Fri",
      startsAt: "2025-06-14T13:30:00",
      endsAt: "2025-06-14T15:00:00",
      confidence: 0.72,
      visibilityScore: 7.0,
      conditionState: "optimal",
      factors: {
        tide: { value: 0.5, unit: "m", trend: "rising", impact: "good" },
        wind: { value: 14, unit: "km/h", direction: "NE", impact: "good" },
        waterTemp: { value: 22, unit: "°C", impact: "good" },
        moonDistance: { value: 400000, unit: "km", phase: "Waning Crescent", impact: "good" },
      },
      reasoning: [
        "Moderate rising tide with good light angles.",
        "Wind within comfortable range.",
        "Reliable window — recommended.",
      ],
    },
  ],
};

const TIDE_CURVE = [
  { time: "00:00", level: 0.9 }, { time: "02:00", level: 1.4 },
  { time: "04:00", level: 1.8 }, { time: "06:00", level: 1.5 },
  { time: "08:00", level: 1.0 }, { time: "10:00", level: 0.5 },
  { time: "12:00", level: 0.3 }, { time: "14:00", level: 0.4 },
  { time: "16:00", level: 0.8 }, { time: "18:00", level: 1.3 },
  { time: "20:00", level: 1.7 }, { time: "22:00", level: 1.6 },
  { time: "23:59", level: 1.2 },
];

/* ─── HELPERS ────────────────────────────────────────────────── */
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}
function windowDuration(start, end) {
  const mins = (new Date(end) - new Date(start)) / 60000;
  return `~${Math.round(mins)} min`;
}
function confidenceLabel(c) {
  if (c >= 0.7) return "High";
  if (c >= 0.4) return "Marginal";
  return "Low";
}
function stateColor(state) {
  if (state === "optimal") return "#00E5C8";
  if (state === "marginal") return "#F5A623";
  return "#E05C5C";
}
function stateBg(state) {
  if (state === "optimal") return "linear-gradient(180deg, rgba(95,243,214,0.10), rgba(95,243,214,0.02))";
  if (state === "marginal") return "linear-gradient(180deg, rgba(230,180,84,0.12), rgba(230,180,84,0.02))";
  return "linear-gradient(180deg, rgba(224,92,92,0.12), rgba(224,92,92,0.02))";
}
function stateLabel(state) {
  if (state === "optimal") return "Optimal";
  if (state === "marginal") return "Marginal";
  return "Poor";
}
function moonPhaseEmoji(phase) {
  const map = {
    "New Moon": "🌑", "Waxing Crescent": "🌒", "First Quarter": "🌓",
    "Waxing Gibbous": "🌔", "Full Moon": "🌕", "Waning Gibbous": "🌖",
    "Last Quarter": "🌗", "Waning Crescent": "🌘",
  };
  return map[phase] || "🌕";
}
function impactIcon(impact) {
  if (impact === "good") return "↑";
  if (impact === "bad") return "↓";
  return "—";
}
function impactColor(impact) {
  if (impact === "good") return "#00E5C8";
  if (impact === "bad") return "#E05C5C";
  return "#6B8FA8";
}
function toneColor(tone) {
  if (tone === "good") return "#00E5C8";
  if (tone === "marginal") return "#F5A623";
  return "#E05C5C";
}

/* ─── STYLES (injected into <head>) ─────────────────────────── */
const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --color-bio:     #5FF3D6;
    --color-sunlit:  #4FB8C9;
    --color-warn:    #E6B454;
    --color-nogo:    #C46B6B;
    --color-abyss:   #061827;

    /* Keep backward-compat aliases so existing component vars still resolve */
    --accent:        #5FF3D6;
    --warn:          #E6B454;
    --danger:        #C46B6B;
    --ink:           #E6F0F4;
    --ink-muted:     rgba(180,210,220,0.55);
    --ink-faint:     rgba(180,210,220,0.22);
    --surface:       rgba(255,255,255,0.015);
    --surface-raised:rgba(255,255,255,0.03);
    --border:        rgba(180,210,220,0.10);
    --shadow-card:   0 0 0 1px rgba(180,210,220,0.10), 0 4px 24px rgba(0,0,0,0.4);
    --shadow-glow:   0 0 20px rgba(95,243,214,0.18);

    --font-display:  'Fraunces', serif;
    --font-mono:     'IBM Plex Mono', monospace;
    --font-body:     'IBM Plex Mono', monospace;

    --r-card:   8px;
    --r-badge:  4px;
    --r-btn:    6px;
  }

  html, body {
    background: #03101a;
    color: #E6F0F4;
    font-family: 'IBM Plex Mono', monospace;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  ::selection { background: rgba(95,243,214,0.25); color: #eafff7; }

  /* Ocean depth gradient — the page IS the sea */
  .seacolumn {
    background:
      radial-gradient(120% 60% at 50% 0%, rgba(95,243,214,0.06) 0%, rgba(95,243,214,0) 55%),
      linear-gradient(180deg,
        #4FB8C9 0%,
        #2C7E96 9%,
        #19587A 22%,
        #0F3F5E 42%,
        #0A2D44 62%,
        #07203A 80%,
        #061827 100%);
  }
  .seacolumn::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(circle at 50% -10%, rgba(120,255,240,0.25), transparent 40%),
      radial-gradient(circle at 50% 120%, rgba(0,0,0,0.9), transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  /* Typography utility classes */
  .micro {
    font-family: 'IBM Plex Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 11px;
    color: rgba(180,210,220,0.55);
  }
  .micro-bio { color: #5FF3D6; }
  .display {
    font-family: 'Fraunces', serif;
    font-optical-sizing: auto;
    font-weight: 300;
    letter-spacing: -0.02em;
  }
  .data {
    font-family: 'IBM Plex Mono', monospace;
    font-variant-numeric: tabular-nums;
  }

  /* Hairlines */
  .hairline       { border: 1px solid rgba(180,210,220,0.10); }
  .hairline-top   { border-top: 1px solid rgba(180,210,220,0.10); }
  .hairline-strong { border-color: rgba(180,210,220,0.22); }

  /* Section shell */
  .page { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
  @media (min-width: 768px) { .page { padding: 0 48px; } }

  /* Scroll fade-in */
  .fade-in { opacity: 0; transform: translateY(18px); transition: opacity 1s ease, transform 1s ease; }
  .fade-in.in { opacity: 1; transform: translateY(0); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
  ::-webkit-scrollbar-thumb { background: rgba(180,210,220,0.15); border-radius: 3px; }

  /* Keyframes */
  @keyframes fadein {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bioPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(95,243,214,0.55), 0 0 22px 0 rgba(95,243,214,0.35); }
    50%     { box-shadow: 0 0 0 6px rgba(95,243,214,0.0), 0 0 28px 4px rgba(95,243,214,0.5); }
  }
  @keyframes breathe { 0%,100% { opacity: 0.45; } 50% { opacity: 0.7; } }
  @keyframes shaftDrift {
    0%   { transform: translateX(-4%) skewX(-8deg); opacity: 0.22; }
    50%  { transform: translateX(2%)  skewX(-6deg); opacity: 0.32; }
    100% { transform: translateX(-4%) skewX(-8deg); opacity: 0.22; }
  }
  @keyframes rippleOut {
    0%   { width: 6px;  height: 6px;  opacity: 0.9; }
    100% { width: 140px; height: 140px; opacity: 0; }
  }
  @keyframes heroRise {
    from { opacity: 0; transform: translateY(28px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes gaugeArrive {
    from { opacity: 0; transform: translateY(24px) rotate(-10deg) scale(0.92); }
    to { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
  }
  @keyframes sonarSweep {
    0% { transform: rotate(0deg); opacity: 0.16; }
    50% { opacity: 0.35; }
    100% { transform: rotate(360deg); opacity: 0.16; }
  }
  @keyframes tidePulse {
    0%, 100% { opacity: 0.35; transform: scaleX(0.92); }
    50% { opacity: 0.9; transform: scaleX(1); }
  }
  @keyframes telemetryDrift {
    from { transform: translateX(-12%); }
    to { transform: translateX(112%); }
  }
  @keyframes bubbleRise {
    0% { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0; }
    12% { opacity: 0.45; }
    100% { transform: translate3d(22px, -112vh, 0) scale(1.25); opacity: 0; }
  }

  .bio-dot { animation: bioPulse 2.6s ease-in-out infinite; }
  .breathe { animation: breathe 6s ease-in-out infinite; }
  .shaft   { animation: shaftDrift 11s ease-in-out infinite; will-change: transform, opacity; }
  .shaft-b { animation: shaftDrift 17s ease-in-out infinite; animation-delay: -3s; }
  .shaft-c { animation: shaftDrift 23s ease-in-out infinite; animation-delay: -7s; }

  .reveal   { animation: fadein 0.6s ease both; }
  .reveal-1 { animation-delay: 0.05s; }
  .reveal-2 { animation-delay: 0.15s; }
  .reveal-3 { animation-delay: 0.28s; }
  .reveal-4 { animation-delay: 0.42s; }
  .reveal-5 { animation-delay: 0.56s; }

  /* ---- TOPBAR ---- */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 28px 0 28px; border-bottom: 1px solid rgba(180,210,220,0.10);
    margin-bottom: 0; gap: 16px; flex-wrap: wrap;
  }
  .topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .wordmark {
    font-family: 'Fraunces', serif;
    font-weight: 300;
    font-size: 1.35rem;
    letter-spacing: -0.02em;
    color: #E6F0F4;
  }
  .wordmark .r { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.2em; color: #5FF3D6; vertical-align: super; }
  .location-pill {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.015); border: 1px solid rgba(180,210,220,0.10);
    border-radius: 999px; padding: 6px 14px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(180,210,220,0.7);
  }

  /* ---- HERO ---- */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
    align-items: center;
    gap: clamp(32px, 6vw, 86px);
    min-height: 680px;
    padding: 76px 0 52px;
    position: relative;
    animation: heroRise 0.9s cubic-bezier(.19,1,.22,1) both;
  }
  .hero-copy { max-width: 760px; }
  .hero-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(230,248,250,0.72); margin-bottom: 18px; }
  .hero-time {
    font-family: 'Fraunces', serif;
    font-weight: 200;
    font-size: clamp(5rem, 14vw, 11rem);
    line-height: 0.9;
    letter-spacing: -0.06em;
    margin-bottom: 24px;
    background: linear-gradient(180deg, #ffffff 0%, #9be7ff 35%, #5FF3D6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow:
      0 0 40px rgba(95,243,214,0.18),
      0 0 120px rgba(95,243,214,0.08);
  }
  .hero-kicker {
    font-family: 'Fraunces', serif;
    font-size: clamp(2rem, 4.4vw, 4.6rem);
    font-weight: 260;
    line-height: 0.98;
    letter-spacing: -0.035em;
    color: #fff;
    max-width: 780px;
    margin-bottom: 22px;
  }
  .hero-sub { font-family: 'IBM Plex Mono', monospace; font-size: clamp(0.9rem, 1.25vw, 1.05rem); color: rgba(232,250,252,0.78); margin-bottom: 30px; line-height: 1.75; max-width: 680px; }
  .hero-story {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin: 30px 0 34px;
    max-width: 760px;
  }
  .story-cell {
    background: rgba(255,255,255,0.035);
    backdrop-filter: blur(18px);
    border-radius: 8px;
    padding: 16px;
    box-shadow:
      0 10px 40px rgba(0,0,0,0.28),
      inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .story-label { font-family: 'IBM Plex Mono', monospace; color: rgba(190,230,238,0.62); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px; }
  .story-value { font-family: 'Fraunces', serif; color: #fff; font-size: clamp(1.35rem, 2.2vw, 2.2rem); line-height: 1.05; letter-spacing: -0.025em; }
  .story-note { color: #5FF3D6; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.08em; margin-top: 6px; }
  .hero-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .hero-cta {
    border: 1px solid rgba(95,243,214,0.38);
    background: linear-gradient(135deg, rgba(95,243,214,0.22), rgba(255,255,255,0.045));
    color: #fff;
    border-radius: 999px;
    padding: 13px 22px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 0 28px rgba(95,243,214,0.12);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .hero-cta:hover { transform: translateY(-2px); box-shadow: 0 0 42px rgba(95,243,214,0.22); }
  .trust-line { color: rgba(232,250,252,0.62); font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.08em; }
  .hero-visual { position: relative; min-height: 520px; display: grid; place-items: center; }
  .hero-visual::before {
    content: '';
    position: absolute;
    width: min(88vw, 620px);
    aspect-ratio: 1;
    border-radius: 50%;
    background:
      radial-gradient(circle, rgba(95,243,214,0.18) 0%, rgba(95,243,214,0.05) 36%, transparent 68%),
      conic-gradient(from 220deg, transparent, rgba(95,243,214,0.16), transparent, rgba(255,255,255,0.05), transparent);
    filter: blur(6px);
    opacity: 0.86;
  }
  .ocean-orbit {
    position: absolute;
    inset: 8%;
    border-radius: 50%;
    background:
      repeating-radial-gradient(circle, rgba(255,255,255,0.045) 0 1px, transparent 1px 34px),
      conic-gradient(from 18deg, rgba(95,243,214,0.16), transparent 20%, rgba(255,255,255,0.08), transparent 42%, rgba(95,243,214,0.12), transparent 72%);
    mask-image: radial-gradient(circle, transparent 0 38%, #000 39% 68%, transparent 69%);
    animation: sonarSweep 13s linear infinite;
  }
  .telemetry-lane {
    position: absolute;
    left: 5%;
    right: 5%;
    bottom: 18%;
    height: 2px;
    background: rgba(95,243,214,0.12);
    overflow: hidden;
  }
  .telemetry-lane::before {
    content: '';
    position: absolute;
    inset: 0;
    width: 30%;
    background: linear-gradient(90deg, transparent, rgba(95,243,214,0.9), transparent);
    animation: telemetryDrift 4.5s ease-in-out infinite;
  }

  /* ---- PICKER ---- */
  .picker-section {
    background: rgba(255,255,255,0.035);
    backdrop-filter: blur(18px);
    border-radius: 8px; padding: 24px 28px; margin: 0 0 48px;
    position: relative; z-index: 50;
    box-shadow:
      0 10px 40px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .picker-title { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(180,210,220,0.55); margin-bottom: 20px; }
  .picker-row { display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; }
  .picker-group { display: flex; flex-direction: column; gap: 6px; position: relative; }
  .picker-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(180,210,220,0.35); padding-left: 2px; }
  .picker-field {
    background: rgba(2,14,24,0.35); border: 1px solid rgba(95,243,214,0.18);
    border-radius: 8px; color: #E6F0F4; font-family: 'IBM Plex Mono', monospace; font-size: 0.95rem;
    outline: none; padding: 15px 18px; min-width: min(100%, 320px); text-align: left;
    -moz-appearance: textfield; appearance: textfield;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .picker-field::-webkit-outer-spin-button,
  .picker-field::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .picker-field:focus { border-color: #5FF3D6; box-shadow: 0 0 24px rgba(95,243,214,0.14); background: rgba(2,14,24,0.55); }
  .picker-field::placeholder { color: rgba(180,210,220,0.25); }
  .picker-sep { font-family: 'IBM Plex Mono', monospace; color: rgba(180,210,220,0.35); font-size: 1.5rem; padding-bottom: 8px; user-select: none; }
  .picker-time-sep { font-family: 'IBM Plex Mono', monospace; color: #5FF3D6; opacity: 0.6; font-size: 1.5rem; padding-bottom: 8px; user-select: none; }
  .picker-divider { width: 1px; height: 44px; background: rgba(180,210,220,0.10); margin: 0 8px 8px; }
  .picker-btn {
    background: rgba(95,243,214,0.11); border: 1px solid rgba(95,243,214,0.32);
    border-radius: 999px; padding: 10px 22px; min-height: 50px;
    color: #E6F0F4; font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
    cursor: pointer; transition: border-color 0.2s, color 0.2s;
    white-space: nowrap; align-self: flex-end;
  }
  .picker-btn:hover { border-color: #5FF3D6; color: #5FF3D6; }
  .picker-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .picker-status { font-size: 11px; color: rgba(180,210,220,0.55); font-family: 'IBM Plex Mono', monospace; margin-top: 14px; min-height: 1.2em; letter-spacing: 0.08em; }
  .picker-status.ok  { color: #5FF3D6; }
  .picker-status.err { color: #C46B6B; }
  .picker-dropdown {
    position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%);
    background: #0C2035; border: 1px solid rgba(95,243,214,0.3);
    border-radius: 6px; z-index: 1000;
    max-height: 192px; overflow-y: auto; overflow-x: hidden; min-width: 100%;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    scrollbar-width: thin; scrollbar-color: rgba(180,210,220,0.15) transparent;
  }
  .picker-option { padding: 9px 14px; font-family: 'IBM Plex Mono', monospace; font-size: 0.875rem; color: rgba(180,210,220,0.55); cursor: pointer; transition: background 0.1s, color 0.1s; text-align: center; }
  .picker-option:hover { background: rgba(95,243,214,0.07); color: #E6F0F4; }
  .picker-option.active { color: #5FF3D6; background: rgba(95,243,214,0.10); }

  /* ---- CONDITIONS NOW ---- */
  .factor-strip { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 58px; }
  @media (min-width: 900px) { .factor-strip { grid-template-columns: repeat(4, 1fr); } }
  .factor-tile {
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(18px);
    border-radius: 8px; padding: 24px; display: flex; flex-direction: column; gap: 8px;
    min-height: 200px;
    box-shadow:
      0 10px 40px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .factor-name { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(180,210,220,0.55); }
  .factor-value { font-family: 'Fraunces', serif; font-weight: 300; font-size: 3rem; color: #E6F0F4; line-height: 1; letter-spacing: -0.02em; }
  .factor-unit { font-family: 'IBM Plex Mono', monospace; font-size: 1rem; color: rgba(180,210,220,0.55); }
  .factor-sub { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(180,210,220,0.45); letter-spacing: 0.1em; }
  .factor-impact { font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
  .factor-icon { display: none; }

  /* ---- SECTION HEADINGS ---- */
  .section-head {
    font-family: 'Fraunces', serif; font-size: clamp(1.65rem, 3vw, 2.7rem); font-weight: 260;
    letter-spacing: -0.025em; text-transform: none; color: rgba(255,255,255,0.92);
    margin-bottom: 20px; display: flex; align-items: center; gap: 14px;
  }
  .section-head::after { content: ''; flex: 1; height: 1px; background: rgba(180,210,220,0.10); }

  /* ---- TIDE CHART ---- */
  .chart-wrap {
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(18px);
    border-radius: 8px; padding: 28px 32px; margin-bottom: 58px;
    box-shadow:
      0 10px 40px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.04);
    position: relative;
    overflow: hidden;
  }
  .chart-wrap::after {
    content: '';
    position: absolute;
    left: 8%;
    right: 8%;
    bottom: 18px;
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(95,243,214,0.65), transparent);
    animation: tidePulse 4.5s ease-in-out infinite;
  }
  .chart-title { font-family: 'Fraunces', serif; font-weight: 300; font-size: 1.1rem; color: #E6F0F4; margin-bottom: 4px; letter-spacing: -0.01em; }
  .chart-sub { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(180,210,220,0.45); margin-bottom: 20px; letter-spacing: 0.08em; }

  /* ---- FORECAST STRIP (Coming Up) ---- */
  .forecast-scroll { display: flex; gap: 18px; overflow-x: auto; padding: 4px 4px 18px; margin-bottom: 36px; scrollbar-width: thin; scrollbar-color: rgba(180,210,220,0.15) transparent; }
  .window-card {
    flex: 0 0 240px; background: rgba(255,255,255,0.03);
    backdrop-filter: blur(18px);
    border-radius: 8px; padding: 26px 22px; cursor: pointer;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    display: flex; flex-direction: column; gap: 10px;
    min-height: 255px;
    box-shadow:
      0 10px 40px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.04);
    animation: heroRise 0.72s cubic-bezier(.19,1,.22,1) both;
  }
  .window-card:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow:
      0 20px 60px rgba(0,0,0,0.45),
      0 0 30px rgba(95,243,214,0.14);
  }
  .window-card.active { outline: 1px solid rgba(95,243,214,0.5); box-shadow: 0 20px 70px rgba(0,0,0,0.42), 0 0 34px rgba(95,243,214,0.18); }
  .wc-day { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(180,210,220,0.55); }
  .wc-time { font-family: 'Fraunces', serif; font-weight: 260; font-size: 1.75rem; color: #fff; line-height: 1.08; letter-spacing: -0.025em; }
  .wc-dur { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(180,210,220,0.45); }
  .wc-score { font-family: 'Fraunces', serif; font-weight: 260; font-size: 2.7rem; letter-spacing: -0.03em; margin-top: auto; }
  .wc-score-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(180,210,220,0.45); letter-spacing: 0.14em; text-transform: uppercase; display: block; }
  .badge { display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px; }

  /* ---- DETAIL PANEL ---- */
  .detail-panel {
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(18px);
    border-radius: 8px; padding: 32px; animation: fadein 0.35s ease both; margin-bottom: 58px;
    box-shadow:
      0 10px 40px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
  .detail-title { font-family: 'Fraunces', serif; font-weight: 300; font-size: 1.8rem; color: #E6F0F4; line-height: 1.1; margin-bottom: 4px; letter-spacing: -0.02em; }
  .detail-close { background: none; border: 1px solid rgba(180,210,220,0.10); border-radius: 4px; padding: 6px 14px; color: rgba(180,210,220,0.55); font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
  .detail-close:hover { border-color: #C46B6B; color: #C46B6B; }
  .reasoning-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .reasoning-item { display: flex; gap: 10px; align-items: flex-start; font-family: 'IBM Plex Mono', monospace; font-size: 0.8125rem; line-height: 1.6; color: rgba(180,210,220,0.8); }
  .reasoning-dot { flex-shrink: 0; width: 5px; height: 5px; border-radius: 50%; background: #5FF3D6; margin-top: 8px; }

  /* ---- GAUGE ---- */
  .gauge-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 50px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(255,255,255,0.01));
    backdrop-filter: blur(20px);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.06),
      0 0 80px rgba(95,243,214,0.12);
    animation: gaugeArrive 1.1s cubic-bezier(.19,1,.22,1) both 0.15s;
  }
  .gauge-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(230,248,250,0.72); margin-bottom: 16px; }
  .gauge-svg { overflow: visible; }
  .gauge-track { fill: none; stroke: rgba(180,210,220,0.13); stroke-width: 14; stroke-linecap: round; }
  .gauge-fill { fill: none; stroke: #5FF3D6; stroke-width: 14; stroke-linecap: round; filter: drop-shadow(0 0 14px rgba(95,243,214,0.72)); }
  .gauge-pct { font-family: 'Fraunces', serif; font-weight: 260; font-size: 2.8rem; fill: #fff; text-anchor: middle; dominant-baseline: central; }
  .gauge-confidence { font-family: 'IBM Plex Mono', monospace; font-size: 10px; fill: #5FF3D6; text-anchor: middle; letter-spacing: 0.14em; }

  @media (max-width: 980px) {
    .hero { grid-template-columns: 1fr; min-height: auto; padding-top: 56px; }
    .hero-visual { min-height: 420px; }
    .hero-story { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .page { padding: 0 18px; }
    .hero { padding-top: 42px; }
    .hero-time { font-size: clamp(4.2rem, 25vw, 6.5rem); }
    .factor-strip { grid-template-columns: 1fr; }
    .picker-row { align-items: stretch; }
    .picker-field, .picker-btn { width: 100%; }
  }

  /* ---- FOOTER ---- */
  .footer { border-top: 1px solid rgba(180,210,220,0.10); padding: 24px 0 40px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .footer-ts { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(180,210,220,0.35); letter-spacing: 0.1em; }
  .footer-mission { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(180,210,220,0.35); letter-spacing: 0.08em; }
`;

/* ─── CONFIDENCE GAUGE ───────────────────────────────────────── */
function ConfidenceGauge({ value, color }) {
  const r = 92;
  const cx = 120, cy = 120;
  const startAngle = -220;
  const sweep = 260;
  const pct = Math.round(value * 100);
  const filled = (pct / 100) * sweep;
  const fillColor = color || "var(--accent)";

  function polarToXY(angleDeg, radius) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function arcPath(startDeg, endDeg, radius) {
    const s = polarToXY(startDeg, radius);
    const e = polarToXY(endDeg, radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackD = arcPath(startAngle, startAngle + sweep, r);
  const fillD = arcPath(startAngle, startAngle + filled, r);

  return (
    <div className="gauge-wrap">
      <div className="gauge-label">Visibility</div>
      <svg className="gauge-svg" width={260} height={220} viewBox="0 0 240 220">
        <defs>
          <radialGradient id="dialBloom" cx="50%" cy="45%" r="58%">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.24" />
            <stop offset="65%" stopColor={fillColor} stopOpacity="0.04" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r="78" fill="url(#dialBloom)" />
        <path className="gauge-track" d={trackD} />
        <path className="gauge-fill" d={fillD} style={{ stroke: fillColor }} />
        <text className="gauge-pct" x={cx} y={cy + 2}>{pct}%</text>
        <text className="gauge-confidence" x={cx} y={cy + 34} style={{ fontSize: "0.65rem", fill: fillColor }}>
          {confidenceLabel(value)}
        </text>
      </svg>
    </div>
  );
}

/* ─── FACTOR TILE ────────────────────────────────────────────── */
function FactorTile({ icon, name, value, unit, impact, sub }) {
  return (
    <div className="factor-tile">
      <div className="factor-icon">{icon}</div>
      <div className="factor-name">{name}</div>
      <div className="factor-value">
        {value}<span className="factor-unit">{unit}</span>
      </div>
      {sub && <div className="factor-sub">{sub}</div>}
      <div className="factor-impact" style={{ color: impactColor(impact) }}>
        {impactIcon(impact)} {impact.charAt(0).toUpperCase() + impact.slice(1)}
      </div>
    </div>
  );
}

/* ─── WINDOW CARD ────────────────────────────────────────────── */
function WindowCard({ win, active, onClick }) {
  const color = stateColor(win.conditionState);
  const bg = stateBg(win.conditionState);
  return (
    <div className={`window-card${active ? " active" : ""}`} onClick={onClick} role="button" tabIndex={0} style={{ background: bg }}>
      <div className="wc-day">{win.label}</div>
      <div className="wc-time">
        {formatTime(win.startsAt)}<br />
        <span style={{ color: "var(--ink-muted)", fontWeight: 400, fontSize: "0.85rem" }}>
          → {formatTime(win.endsAt)}
        </span>
      </div>
      <div className="wc-dur">{windowDuration(win.startsAt, win.endsAt)}</div>
      <div className="wc-score" style={{ color }}>
        {Math.round(win.confidence * 100)}%
        <span className="wc-score-label" style={{ display: "block" }}>confidence</span>
      </div>
      <span className="badge" style={{ background: bg, color }}>{stateLabel(win.conditionState)}</span>
    </div>
  );
}

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────── */
function TideTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface-raised)", border: "1px solid var(--border)",
      borderRadius: "var(--r-badge)", padding: "8px 14px",
      fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--ink)",
    }}>
      <div style={{ color: "var(--ink-muted)", fontSize: "0.7rem" }}>{payload[0]?.payload?.time}</div>
      <div>{payload[0]?.value?.toFixed(1)} m</div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────── */
function toDatetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function App() {
  const now = new Date();
  const [pickerDateTime, setPickerDateTime] = useState(toDatetimeLocalValue(now));
  const [pickerDay,   setPickerDay]   = useState(String(now.getDate()).padStart(2, "0"));
  const [pickerMonth, setPickerMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [pickerYear,  setPickerYear]  = useState(String(now.getFullYear()));
  const [pickerHour,  setPickerHour]  = useState(String(now.getHours()).padStart(2, "0"));
  const [pickerMin,   setPickerMin]   = useState(String(now.getMinutes()).padStart(2, "0"));
  const [pickerOpen,  setPickerOpen]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedWin, setSelectedWin] = useState(null);
  const [data, setData] = useState(null);
  const [queryInfo, setQueryInfo] = useState(null);
  const [error, setError] = useState(null);
  const styleRef  = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById("yoursea-styles")) {
      const el = document.createElement("style");
      el.id = "yoursea-styles";
      el.textContent = css;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    document.title = "YOU(R) SEA — Forecast";
    return () => {
      if (styleRef.current) styleRef.current.remove();
    };
  }, []);

  const hero = MOCK_FORECAST.windows[0];

  const handleCheck = async () => {
    if (!pickerDateTime) {
      setError("Please pick a date and time.");
      return;
    }
    const [date, time] = pickerDateTime.split("T");
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
      const json = await response.json();
      setData(json);
      setQueryInfo({ date, time });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

>>>>>>> Stashed changes
  const selected = selectedWin
    ? MOCK_FORECAST.windows.find((w) => w.id === selectedWin)
    : null;

  return (
<<<<<<< Updated upstream
    <>
      <Background />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Header locationName={MOCK_FORECAST.locationName} />
        <Hero window={hero} />
        <WindowChecker />
        <ConditionsNow factors={hero.factors} />
        <TideCurve
          data={TIDE_CURVE}
          optimalStart={hero.startsAt}
          optimalEnd={hero.endsAt}
          conditions={hero.factors}
        />
        <DayStrip
          windows={MOCK_FORECAST.windows}
          selectedId={selectedWin}
          onSelect={(id) => setSelectedWin(selectedWin === id ? null : id)}
        />
        {selected && (
          <DetailPanel window={selected} onClose={() => setSelectedWin(null)} />
=======
     <div style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}>
    <SeaBackground />
    <div className="page" style={{ position: "relative", zIndex: 10 }}>
      {/* TOPBAR */}
      <header className="topbar reveal reveal-1">
      <div style={{
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 300,
                    fontSize: "1.5rem",
                    letterSpacing: "-0.02em",
                    color: "#E6F0F4",
                    lineHeight: 1,
                  }}>
                  YOU
                  <span style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: "10px",
                                letterSpacing: "0.2em",
                                color: "#5FF3D6",
                                verticalAlign: "super",
                                margin: "0 1px",
                                }}>
                                (R)
                                </span>
                                {" "}SEA
</div>
        <div className="topbar-right">
          <div className="location-pill">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#5FF3D6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z" />
              <circle cx="8" cy="6" r="1.5" />
            </svg>
            {MOCK_FORECAST.locationName}
            </div>
          <div className="location-pill" style={{ color: "var(--ink-muted)" }}>
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero reveal reveal-2">
        <div className="hero-copy">
          <div className="hero-label">Current visibility</div>
          <div className="hero-time">
            {data ? Math.round(100 - data.visibilityScore) : Math.round(hero.confidence * 100)}%
          </div>
          <h1 className="hero-kicker">Know when the ocean opens.</h1>
          <div className="hero-sub">
            AI-assisted marine forecasting using tide movement, wind turbulence, water temperature, and lunar conditions.
          </div>
          <div className="hero-story">
            <div className="story-cell">
              <div className="story-label">Current visibility</div>
              <div className="story-value">
                {data ? Math.round(100 - data.visibilityScore) : Math.round(hero.confidence * 100)}% {data?.statusLabel ?? "Optimal"}
              </div>
              <div className="story-note">Confidence {Math.round(hero.confidence * 100)}%</div>
            </div>
            <div className="story-cell">
              <div className="story-label">Next best window</div>
              <div className="story-value">{formatTime(hero.startsAt)} - {formatTime(hero.endsAt)}</div>
              <div className="story-note">{windowDuration(hero.startsAt, hero.endsAt)}</div>
            </div>
            <div className="story-cell">
              <div className="story-label">Why it matters</div>
              <div className="story-value">Low tide + calm wind</div>
              <div className="story-note">Warm water, stable moon cycle</div>
            </div>
          </div>
          <div className="hero-actions">
            <button className="hero-cta" onClick={handleCheck} disabled={loading}>
              {loading ? "Calculating..." : "Run visibility scan"}
            </button>
            <div className="trust-line">
              NOAA tide feed / Buoy station SO-17 / {formatDate(hero.startsAt)} / {moonPhaseEmoji(hero.factors.moonDistance.phase)} {hero.factors.moonDistance.phase} / 45.536 N, 13.730 E
            </div>
          </div>
        </div>
        <div style={{ display: "none" }}>
          <div className="hero-label">Visibility prediction</div>
          {!data && !loading && (
            <div className="hero-sub" style={{ marginTop: "12px" }}>
              Pick a date and time below to see the predicted visibility.
            </div>
          )}
          {loading && (
            <div className="hero-time" style={{ color: "var(--ink-muted)", fontSize: "2rem" }}>
              Calculating…
            </div>
          )}
          {data && (
            <>
              <div className="hero-time">
                <span style={{ color: toneColor(data.statusTone) }}>
                  {Math.round(100 - data.visibilityScore)}%
                </span>
                {" "}
                <span className="badge" style={{
                  background: toneColor(data.statusTone) + "22",
                  color: toneColor(data.statusTone),
                  fontSize: "1rem",
                  verticalAlign: "middle",
                  padding: "4px 14px",
                }}>
                  {data.statusLabel}
                </span>
              </div>
              <div className="hero-sub">
                {queryInfo && `For ${queryInfo.date} at ${queryInfo.time}. `}
                {data.statusTone === "good" && "Conditions look great — solid visibility expected."}
                {data.statusTone === "marginal" && "Conditions are borderline — check wind and waves before going."}
                {data.statusTone === "poor" && "Visibility likely low — consider rescheduling."}
              </div>
            </>
          )}
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="ocean-orbit" />
          <div className="telemetry-lane" />
          <ConfidenceGauge
            value={data ? (100 - data.visibilityScore) / 100 : hero.confidence}
            color={data ? toneColor(data.statusTone) : stateColor(hero.conditionState)}
          />
        </div>
      </section>

      {/* DATE PICKER / API FORM */}
      <div className="picker-section reveal reveal-2" style={{ animationDelay: "0.2s" }} ref={pickerRef}>
        <div className="picker-title">Forecast a launch window</div>
        <div className="picker-row">
          <div className="picker-group">
            <span className="picker-label">Date and time</span>
            <input
              className="picker-field"
              type="datetime-local"
              value={pickerDateTime}
              onChange={(e) => setPickerDateTime(e.target.value)}
            />
          </div>
          <button className="picker-btn" onClick={handleCheck} disabled={loading}>
            {loading ? "Checking..." : "Check conditions"}
          </button>
          <button className="picker-btn" type="button" onClick={() => setPickerDateTime(toDatetimeLocalValue(new Date()))}>
            Use live time
          </button>
          <div style={{ display: "none" }}>

          {/* DAY */}
          <div className="picker-group">
            <span className="picker-label">Day</span>
            <input className="picker-field" type="number" min="1" max="31"
              style={{ width: "56px" }} placeholder="DD"
              value={pickerDay}
              onChange={e => setPickerDay(e.target.value)}
              onFocus={() => setPickerOpen("day")} />
            {pickerOpen === "day" && (
              <div className="picker-dropdown">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(v => {
                  const val = String(v).padStart(2, "0");
                  return (
                    <div key={v} className={`picker-option${pickerDay === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerDay(val); setPickerOpen(null); }}>
                      {val}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <span className="picker-sep">/</span>

          {/* MONTH */}
          <div className="picker-group">
            <span className="picker-label">Month</span>
            <input className="picker-field" type="number" min="1" max="12"
              style={{ width: "56px" }} placeholder="MM"
              value={pickerMonth}
              onChange={e => setPickerMonth(e.target.value)}
              onFocus={() => setPickerOpen("month")} />
            {pickerOpen === "month" && (
              <div className="picker-dropdown">
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((name, i) => {
                  const val = String(i + 1).padStart(2, "0");
                  return (
                    <div key={i} className={`picker-option${pickerMonth === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerMonth(val); setPickerOpen(null); }}>
                      {val} · {name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <span className="picker-sep">/</span>

          {/* YEAR */}
          <div className="picker-group">
            <span className="picker-label">Year</span>
            <input className="picker-field" type="number" min="2024" max="2099"
              style={{ width: "80px" }} placeholder="YYYY"
              value={pickerYear}
              onChange={e => setPickerYear(e.target.value)}
              onFocus={() => setPickerOpen("year")} />
            {pickerOpen === "year" && (
              <div className="picker-dropdown">
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(y => (
                  <div key={y} className={`picker-option${pickerYear === String(y) ? " active" : ""}`}
                    onMouseDown={e => { e.preventDefault(); setPickerYear(String(y)); setPickerOpen(null); }}>
                    {y}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="picker-divider" />

          {/* HOUR */}
          <div className="picker-group">
            <span className="picker-label">Hour</span>
            <input className="picker-field" type="number" min="0" max="23"
              style={{ width: "56px" }} placeholder="HH"
              value={pickerHour}
              onChange={e => setPickerHour(e.target.value)}
              onFocus={() => setPickerOpen("hour")} />
            {pickerOpen === "hour" && (
              <div className="picker-dropdown">
                {Array.from({ length: 24 }, (_, i) => i).map(h => {
                  const val = String(h).padStart(2, "0");
                  return (
                    <div key={h} className={`picker-option${pickerHour === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerHour(val); setPickerOpen(null); }}>
                      {val}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <span className="picker-time-sep">:</span>

          {/* MINUTE */}
          <div className="picker-group">
            <span className="picker-label">Min</span>
            <input className="picker-field" type="number" min="0" max="59"
              style={{ width: "56px" }} placeholder="MM"
              value={pickerMin}
              onChange={e => setPickerMin(e.target.value)}
              onFocus={() => setPickerOpen("min")} />
            {pickerOpen === "min" && (
              <div className="picker-dropdown">
                {Array.from({ length: 12 }, (_, i) => i * 5).map(m => {
                  const val = String(m).padStart(2, "0");
                  return (
                    <div key={m} className={`picker-option${pickerMin === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerMin(val); setPickerOpen(null); }}>
                      {val}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button className="picker-btn" onClick={handleCheck} disabled={loading}>
            {loading ? "Checking…" : "Check conditions"}
          </button>
          </div>
        </div>
        {error && (
          <div className="picker-status err">{error}</div>
        )}
        {loading && (
          <div className="picker-status">Querying forecast engine…</div>
        )}
        {data && queryInfo && (
          <div style={{
            marginTop: "16px",
            padding: "16px 20px",
            borderRadius: "8px",
            borderLeft: `4px solid ${toneColor(data.statusTone)}`,
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            animation: "fadein 0.4s ease both",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "64px" }}>
              <span style={{
                fontSize: "2rem", fontWeight: 700, fontFamily: "var(--font-display)",
                color: toneColor(data.statusTone), lineHeight: 1,
              }}>
                {Math.round(100 - data.visibilityScore)}%
              </span>
              <span style={{
                fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em",
                color: toneColor(data.statusTone), marginTop: "4px",
              }}>
                {data.statusLabel}
              </span>
            </div>
            <div style={{ flex: 1, fontSize: "0.875rem", opacity: 0.85, lineHeight: 1.5, color: "var(--ink)" }}>
              {data.statusTone === "good" && `Predicted visibility is good for ${queryInfo.date} at ${queryInfo.time}.`}
              {data.statusTone === "marginal" && `Conditions are borderline for ${queryInfo.date} at ${queryInfo.time}. Worth a closer look.`}
              {data.statusTone === "poor" && `Low visibility expected for ${queryInfo.date} at ${queryInfo.time}. Not recommended.`}
            </div>
          </div>
>>>>>>> Stashed changes
        )}
        <Footer
          generatedAt={MOCK_FORECAST.generatedAt}
          locationName={MOCK_FORECAST.locationName}
        />
      </div>
<<<<<<< Updated upstream
    </>
=======

      {/* FACTOR STRIP */}
      <div className="reveal reveal-3">
        <div className="section-head">
          {data ? "Conditions for the selected time" : "Conditions now"}
        </div>
        <div className="factor-strip">
          <FactorTile
            icon="🌊"
            name="Tide"
            value={data?.features?.nextTideHeightM != null ? data.features.nextTideHeightM.toFixed(1) : "—"}
            unit={data?.features?.nextTideHeightM != null ? " m" : ""}
            impact="neutral"
            sub={data?.features?.nextTideType ?? "—"}
          />
          <FactorTile
            icon="💨"
            name="Wind"
            value={data?.features?.windSpeedKmh != null ? Math.round(data.features.windSpeedKmh) : "—"}
            unit={data?.features?.windSpeedKmh != null ? " km/h" : ""}
            impact="neutral"
          />
          <FactorTile
            icon="🌡"
            name="Water temp"
            value={data?.features?.waterTemperatureC != null ? Math.round(data.features.waterTemperatureC) : "—"}
            unit={data?.features?.waterTemperatureC != null ? " °C" : ""}
            impact="neutral"
          />
          <FactorTile
            icon="🌕"
            name="Moon phase"
            value={data?.features?.moonPhase != null ? (data.features.moonPhase * 100).toFixed(0) : "—"}
            unit={data?.features?.moonPhase != null ? "%" : ""}
            impact="neutral"
          />
        </div>
      </div>

      {/* TIDE CHART */}
      <div className="reveal reveal-4">
        <div className="section-head">Tide curve — today</div>
        <div className="chart-wrap">
          <div className="chart-title">Tidal level · 24-hour forecast</div>
          <div className="chart-sub">
            Optimal window {formatTime(hero.startsAt)} – {formatTime(hero.endsAt)} highlighted
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={TIDE_CURVE} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00E5C8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00E5C8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fill: "#6B8FA8", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                tickLine={false}
                axisLine={{ stroke: "#1A3050" }}
                interval={2}
              />
              <YAxis
                tick={{ fill: "#6B8FA8", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <Tooltip content={<TideTooltip />} />
              {/* Optimal window band */}
              <ReferenceLine x="14:00" stroke="rgba(0,229,200,0.3)" strokeWidth={40} />
              <ReferenceLine x="16:00" stroke="rgba(0,229,200,0.12)" strokeWidth={40} />
              <Area
                type="monotone"
                dataKey="level"
                stroke="#00E5C8"
                strokeWidth={2}
                fill="url(#tideGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#00E5C8", stroke: "none" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FORECAST STRIP */}
      <div className="reveal reveal-5">
        <div className="section-head">Coming up</div>
        <div className="forecast-scroll">
          {MOCK_FORECAST.windows.map((w) => (
            <WindowCard
              key={w.id}
              win={w}
              active={selectedWin === w.id}
              onClick={() => setSelectedWin(selectedWin === w.id ? null : w.id)}
            />
          ))}
        </div>
      </div>

      {/* DETAIL PANEL */}
      {selected && (
        <div className="detail-panel">
          <div className="detail-header">
            <div>
              <div style={{ fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-muted)", marginBottom: "6px" }}>
                {selected.label} · Window detail
              </div>
              <div className="detail-title">
                {formatTime(selected.startsAt)} → {formatTime(selected.endsAt)}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--ink-muted)", marginTop: "4px" }}>
                {windowDuration(selected.startsAt, selected.endsAt)} ·{" "}
                Visibility {selected.visibilityScore.toFixed(1)} / 10 ·{" "}
                <span style={{ color: stateColor(selected.conditionState) }}>
                  {stateLabel(selected.conditionState)}
                </span>
              </div>
            </div>
            <button className="detail-close" onClick={() => setSelectedWin(null)}>
              Close ×
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-muted)", marginBottom: "12px" }}>
                Why we think this
              </div>
              <ul className="reasoning-list">
                {selected.reasoning.map((r, i) => (
                  <li key={i} className="reasoning-item">
                    <div className="reasoning-dot" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { icon: "🌊", name: "Tide", f: selected.factors.tide, val: `${selected.factors.tide.value.toFixed(1)} m`, sub: selected.factors.tide.trend },
                { icon: "💨", name: "Wind", f: selected.factors.wind, val: `${Math.round(selected.factors.wind.value)} km/h ${selected.factors.wind.direction}` },
                { icon: "🌡", name: "Water temp", f: selected.factors.waterTemp, val: `${Math.round(selected.factors.waterTemp.value)}°C` },
                { icon: "🌕", name: "Moon", f: selected.factors.moonDistance, val: `${Math.round(selected.factors.moonDistance.value / 1000)}k km`, sub: selected.factors.moonDistance.phase },
              ].map(({ icon, name, f, val, sub }) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--surface-raised)", borderRadius: "var(--r-badge)",
                  padding: "10px 14px",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", color: "var(--ink-muted)" }}>
                    {icon} {name}
                    {sub && <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)" }}>· {sub}</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>{val}</span>
                    <span style={{ fontSize: "0.75rem", color: impactColor(f.impact) }}>
                      {impactIcon(f.impact)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-ts">
          Last updated {new Date(MOCK_FORECAST.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="footer-mission">
          Removing the guesswork from underwater viewing · Sea Oasis
        </div>
      </footer>
     </div>
  </div>
>>>>>>> Stashed changes
  );
}
