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
  if (state === "optimal") return "rgba(0,229,200,0.12)";
  if (state === "marginal") return "rgba(245,166,35,0.12)";
  return "rgba(224,92,92,0.12)";
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
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #050E1A;
    --surface: #0C1C30;
    --surface-raised: #112440;
    --border: #1A3050;
    --ink: #E8F4F8;
    --ink-muted: #6B8FA8;
    --ink-faint: #2E4D66;
    --accent: #00E5C8;
    --accent-glow: rgba(0,229,200,0.15);
    --warn: #F5A623;
    --danger: #E05C5C;
    --moon: #C8D8E8;
    --shadow-card: 0 0 0 1px #1A3050, 0 4px 24px rgba(0,0,0,0.4);
    --shadow-glow: 0 0 20px rgba(0,229,200,0.15);
    --r-card: 12px;
    --r-badge: 6px;
    --r-btn: 8px;
    --font-display: 'Space Grotesk', sans-serif;
    --font-body: 'IBM Plex Sans', sans-serif;
    --font-mono: 'IBM Plex Mono', monospace;
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-body);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--surface); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  /* Keyframes */
  @keyframes fadein {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes gauge-fill {
    from { stroke-dashoffset: 440; }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: var(--shadow-glow); }
    50%       { box-shadow: 0 0 32px rgba(0,229,200,0.28); }
  }

  .reveal { animation: fadein 0.6s ease both; }
  .reveal-1 { animation-delay: 0.05s; }
  .reveal-2 { animation-delay: 0.15s; }
  .reveal-3 { animation-delay: 0.28s; }
  .reveal-4 { animation-delay: 0.42s; }
  .reveal-5 { animation-delay: 0.56s; }

  /* Layout */
  .page { max-width: 1200px; margin: 0 auto; padding: 0 24px 64px; }
  @media (min-width: 768px) { .page { padding: 0 48px 64px; } }

  /* Topbar */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 0 24px; border-bottom: 1px solid var(--border);
    margin-bottom: 48px; gap: 16px; flex-wrap: wrap;
  }
  .wordmark {
    font-family: var(--font-display); font-size: 1.1rem; font-weight: 700;
    letter-spacing: 0.06em; color: var(--ink); text-transform: uppercase;
  }
  .wordmark span { color: var(--accent); }
  .topbar-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .location-pill {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 6px 14px;
    font-size: 0.8125rem; color: var(--ink-muted);
    font-family: var(--font-body);
  }
  .location-pill svg { width: 12px; height: 12px; stroke: var(--accent); fill: none; }

  /* Hero */
  .hero {
    display: grid; grid-template-columns: 1fr; gap: 24px;
    margin-bottom: 40px;
  }
  @media (min-width: 768px) {
    .hero { grid-template-columns: 1fr auto; align-items: center; gap: 40px; }
  }

  .hero-label {
    font-family: var(--font-body); font-size: 0.8125rem; font-weight: 400;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted);
    margin-bottom: 10px;
  }
  .hero-time {
    font-family: var(--font-display); font-size: clamp(2.5rem, 6vw, 4rem);
    font-weight: 700; line-height: 1.05; color: var(--ink);
    margin-bottom: 6px; letter-spacing: -0.02em;
  }
  .hero-time span { color: var(--accent); }
  .hero-sub {
    font-family: var(--font-body); font-size: 0.9375rem;
    color: var(--ink-muted); margin-bottom: 28px;
  }
  .hero-cta {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--accent); color: #050E1A;
    font-family: var(--font-display); font-weight: 600; font-size: 0.9rem;
    border: none; border-radius: var(--r-btn); padding: 12px 24px;
    cursor: pointer; transition: opacity 0.15s ease;
    animation: pulse-glow 3s ease-in-out infinite;
    box-shadow: var(--shadow-glow);
  }
  .hero-cta:hover { opacity: 0.88; }
  .hero-cta svg { width: 14px; height: 14px; stroke: currentColor; fill: none; }

  /* Confidence Gauge */
  .gauge-wrap {
    display: flex; flex-direction: column; align-items: center;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-card); padding: 28px 40px 24px;
    box-shadow: var(--shadow-card); min-width: 200px;
  }
  .gauge-label {
    font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink-muted); margin-bottom: 16px;
    font-family: var(--font-body);
  }
  .gauge-svg { overflow: visible; }
  .gauge-track { fill: none; stroke: var(--border); stroke-width: 10; stroke-linecap: round; }
  .gauge-fill {
    fill: none; stroke: var(--accent); stroke-width: 10; stroke-linecap: round;
    filter: drop-shadow(0 0 6px rgba(0,229,200,0.5));
    animation: gauge-fill 1.4s cubic-bezier(0.34,1.56,0.64,1) both;
    animation-delay: 0.3s;
  }
  .gauge-pct {
    font-family: var(--font-display); font-size: 2.2rem; font-weight: 700;
    fill: var(--ink); text-anchor: middle; dominant-baseline: central;
  }
  .gauge-confidence {
    font-family: var(--font-body); font-size: 0.75rem;
    fill: var(--accent); text-anchor: middle;
  }

  /* ── Custom DateTime Picker ──────────────────────────────── */
  .picker-section {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-card); padding: 24px 28px;
    margin-bottom: 40px; box-shadow: var(--shadow-card);
    position: relative;
    z-index: 50;
  }
  .picker-title {
    font-family: var(--font-display); font-size: 0.9rem; font-weight: 600;
    color: var(--ink); margin-bottom: 20px; letter-spacing: 0.01em;
  }
  .picker-row {
    display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap;
  }
  .picker-group {
    display: flex; flex-direction: column; gap: 6px;
  }
  .picker-label {
    font-family: var(--font-body); font-size: 0.7rem; font-weight: 400;
    color: var(--ink-faint); letter-spacing: 0.08em; text-transform: uppercase;
    padding-left: 2px;
  }
  .picker-field {
    background: var(--surface-raised); border: 1px solid var(--border);
    border-radius: var(--r-btn); padding: 10px 12px;
    color: var(--ink); font-family: var(--font-mono); font-size: 1rem;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    -moz-appearance: textfield; appearance: textfield;
    text-align: center;
  }
  .picker-field::-webkit-outer-spin-button,
  .picker-field::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .picker-field:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(0,229,200,0.12);
  }
  .picker-field::placeholder { color: var(--ink-faint); }
  .picker-sep {
    font-family: var(--font-mono); color: var(--ink-muted);
    font-size: 1.25rem; padding-bottom: 10px; user-select: none;
  }
  .picker-time-sep {
    font-family: var(--font-mono); color: var(--accent); opacity: 0.7;
    font-size: 1.25rem; padding-bottom: 10px; user-select: none;
  }
  .picker-divider {
    width: 1px; height: 44px; background: var(--border); margin: 0 6px 0 6px;
    align-self: flex-end; margin-bottom: 4px;
  }
  .picker-btn {
    background: var(--surface-raised); border: 1px solid var(--border);
    border-radius: var(--r-btn); padding: 10px 20px; height: 42px;
    color: var(--ink); font-family: var(--font-display); font-size: 0.875rem;
    font-weight: 500; cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
    white-space: nowrap; align-self: flex-end;
  }
  .picker-btn:hover { border-color: var(--accent); color: var(--accent); }
  .picker-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .picker-status {
    font-size: 0.8125rem; color: var(--ink-muted);
    font-family: var(--font-body); margin-top: 12px; min-height: 1.2em;
  }
  .picker-status.ok { color: var(--accent); }
  .picker-status.err { color: var(--danger); }

  /* ── Picker dropdown ─────────────────────────────────────── */
  .picker-group { position: relative; }
  .picker-dropdown {
    position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%);
    background: #0C1C30; border: 1px solid var(--accent);
    border-radius: 8px; z-index: 1000;
    max-height: 192px; overflow-y: auto; overflow-x: hidden;
    min-width: 100%;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,200,0.08), 0 0 24px rgba(0,229,200,0.06);
    scrollbar-width: thin; scrollbar-color: #1A3050 transparent;
  }
  .picker-dropdown::-webkit-scrollbar { width: 3px; }
  .picker-dropdown::-webkit-scrollbar-track { background: transparent; }
  .picker-dropdown::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .picker-option {
    padding: 9px 14px; font-family: var(--font-mono); font-size: 0.9rem;
    color: var(--ink-muted); cursor: pointer;
    transition: background 0.1s, color 0.1s;
    text-align: center; white-space: nowrap;
  }
  .picker-option:hover { background: rgba(0,229,200,0.07); color: var(--ink); }
  .picker-option.active {
    color: var(--accent); background: rgba(0,229,200,0.1);
    font-weight: 500;
  }

  /* Factor Strip */
  .factor-strip {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 12px; margin-bottom: 40px;
  }
  @media (min-width: 640px) { .factor-strip { grid-template-columns: repeat(4, 1fr); } }

  .factor-tile {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-card); padding: 16px;
    box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 6px;
    transition: background 0.15s;
  }
  .factor-tile:hover { background: var(--surface-raised); }
  .factor-icon {
    font-size: 1.1rem; color: var(--ink-muted); margin-bottom: 2px;
  }
  .factor-name {
    font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink-muted); font-family: var(--font-body);
  }
  .factor-value {
    font-family: var(--font-mono); font-size: 1.2rem; font-weight: 500; color: var(--ink);
    display: flex; align-items: baseline; gap: 4px;
  }
  .factor-unit { font-size: 0.75rem; color: var(--ink-muted); }
  .factor-impact { font-size: 0.75rem; font-family: var(--font-body); }
  .factor-sub { font-size: 0.75rem; color: var(--ink-muted); font-family: var(--font-body); }

  /* Section heading */
  .section-head {
    font-family: var(--font-display); font-size: 0.75rem; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted);
    margin-bottom: 16px; display: flex; align-items: center; gap: 10px;
  }
  .section-head::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  /* Tide Chart */
  .chart-wrap {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-card); padding: 24px;
    margin-bottom: 40px; box-shadow: var(--shadow-card);
  }
  .chart-title {
    font-family: var(--font-display); font-size: 0.85rem; font-weight: 600;
    color: var(--ink); margin-bottom: 4px;
  }
  .chart-sub {
    font-size: 0.75rem; color: var(--ink-muted);
    font-family: var(--font-body); margin-bottom: 20px;
  }

  /* Forecast Strip */
  .forecast-scroll {
    display: flex; gap: 12px; overflow-x: auto;
    padding-bottom: 12px; margin-bottom: 48px;
    scrollbar-width: thin; scrollbar-color: var(--border) transparent;
  }
  .window-card {
    flex: 0 0 200px; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-card); padding: 20px 18px;
    box-shadow: var(--shadow-card); cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.15s;
    display: flex; flex-direction: column; gap: 10px;
  }
  .window-card:hover { background: var(--surface-raised); transform: translateY(-2px); }
  .window-card.active { border-color: var(--accent); box-shadow: var(--shadow-card), var(--shadow-glow); }
  .wc-day {
    font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink-muted); font-family: var(--font-body);
  }
  .wc-time {
    font-family: var(--font-display); font-size: 1.1rem; font-weight: 600;
    color: var(--ink); line-height: 1.2;
  }
  .wc-dur { font-size: 0.75rem; color: var(--ink-muted); font-family: var(--font-body); }
  .wc-score {
    font-family: var(--font-mono); font-size: 1.6rem; font-weight: 500;
  }
  .wc-score-label { font-size: 0.7rem; color: var(--ink-muted); font-family: var(--font-body); }
  .badge {
    display: inline-block; font-size: 0.7rem; font-weight: 600;
    font-family: var(--font-display); letter-spacing: 0.06em;
    text-transform: uppercase; padding: 3px 10px;
    border-radius: var(--r-badge);
  }

  /* Detail Panel */
  .detail-panel {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-card); padding: 28px;
    margin-bottom: 40px; box-shadow: var(--shadow-card);
    animation: fadein 0.35s ease both;
  }
  .detail-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
  }
  .detail-title {
    font-family: var(--font-display); font-size: 1.4rem; font-weight: 700;
    color: var(--ink); line-height: 1.2; margin-bottom: 4px;
  }
  .detail-close {
    background: none; border: 1px solid var(--border);
    border-radius: var(--r-badge); padding: 6px 14px;
    color: var(--ink-muted); font-family: var(--font-body); font-size: 0.8125rem;
    cursor: pointer; transition: border-color 0.15s, color 0.15s;
  }
  .detail-close:hover { border-color: var(--danger); color: var(--danger); }
  .reasoning-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .reasoning-item {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 0.9375rem; line-height: 1.5; color: var(--ink);
    font-family: var(--font-body);
  }
  .reasoning-dot {
    flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent); margin-top: 9px; opacity: 0.8;
  }

  /* Footer */
  .footer {
    border-top: 1px solid var(--border); padding: 24px 0 0;
    display: flex; justify-content: space-between; align-items: center;
    gap: 12px; flex-wrap: wrap;
  }
  .footer-ts {
    font-size: 0.75rem; color: var(--ink-faint);
    font-family: var(--font-mono);
  }
  .footer-mission {
    font-size: 0.75rem; color: var(--ink-faint);
    font-family: var(--font-body);
  }
`;

/* ─── CONFIDENCE GAUGE ───────────────────────────────────────── */
function ConfidenceGauge({ value, color }) {
  const r = 60;
  const cx = 80, cy = 80;
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
      <svg className="gauge-svg" width={160} height={120} viewBox="0 0 160 120">
        <path className="gauge-track" d={trackD} />
        <path className="gauge-fill" d={fillD} style={{ stroke: fillColor }} />
        <text className="gauge-pct" x={cx} y={cy + 2}>{pct}%</text>
        <text className="gauge-confidence" x={cx} y={cy + 22} style={{ fontSize: "0.65rem", fill: fillColor }}>
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
    <div className={`window-card${active ? " active" : ""}`} onClick={onClick} role="button" tabIndex={0}>
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
export default function App() {
  const now = new Date();
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
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    const d = parseInt(pickerDay, 10);
    const mo = parseInt(pickerMonth, 10);
    const y = parseInt(pickerYear, 10);
    const h = parseInt(pickerHour, 10);
    const mi = parseInt(pickerMin, 10);
    if (!d || !mo || !y || isNaN(h) || isNaN(mi)) {
      setError("Please pick a date and time.");
      return;
    }
    const date = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const time = `${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}`;
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

  const selected = selectedWin
    ? MOCK_FORECAST.windows.find((w) => w.id === selectedWin)
    : null;

  return (
    <div className="page">
      {/* TOPBAR */}
      <header className="topbar reveal reveal-1">
        <div className="wordmark">
          YOU<span>(R)</span> SEA
        </div>
        <div className="topbar-right">
          <div className="location-pill">
            <svg viewBox="0 0 16 16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
        <div>
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
        <ConfidenceGauge
          value={data ? (100 - data.visibilityScore) / 100 : 0}
          color={data ? toneColor(data.statusTone) : "#3a4555"}
        />
      </section>

      {/* DATE PICKER / API FORM */}
      <div className="picker-section reveal reveal-2" style={{ animationDelay: "0.2s" }} ref={pickerRef}>
        <div className="picker-title">Check a specific time window</div>
        <div className="picker-row">

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
        )}
      </div>

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
  );
}