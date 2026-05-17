import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Dashboard } from "./Dashboard.jsx";

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
  if (state === "optimal") return "#7FF5DC";
  if (state === "marginal") return "#E6B454";
  return "#C46B6B";
}
function stateBg(state) {
  if (state === "optimal") return "rgba(127, 245, 220, 0.15)";
  if (state === "marginal") return "rgba(230, 180, 84, 0.18)";
  return "rgba(196, 107, 107, 0.18)";
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
  if (impact === "good") return "#7FF5DC";
  if (impact === "bad") return "#C46B6B";
  return "rgba(244, 248, 248, 0.4)";
}
function toneColor(tone) {
  if (tone === "good") return "#7FF5DC";
  if (tone === "marginal") return "#E6B454";
  return "#C46B6B";
}

/* ─── STYLES ─────────────────────────────────────────────────── */
const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-top: #5BA8B0;
    --bg-mid: #2E6670;
    --bg-bottom: #133341;
    --bg-gradient: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 45%, var(--bg-bottom) 100%);

    --surface: rgba(255, 255, 255, 0.04);
    --surface-strong: rgba(255, 255, 255, 0.07);
    --surface-border: rgba(255, 255, 255, 0.12);
    --surface-border-strong: rgba(255, 255, 255, 0.22);

    --ink: #F4F8F8;
    --ink-muted: rgba(244, 248, 248, 0.65);
    --ink-faint: rgba(244, 248, 248, 0.4);

    --accent: #7FF5DC;
    --accent-dim: rgba(127, 245, 220, 0.18);
    --accent-line: rgba(127, 245, 220, 0.45);

    --state-good: #7FF5DC;
    --state-wait: #E6B454;
    --state-poor: #C46B6B;
    --state-good-bg: rgba(127, 245, 220, 0.15);
    --state-wait-bg: rgba(230, 180, 84, 0.18);
    --state-poor-bg: rgba(196, 107, 107, 0.18);

    --font-serif: "Fraunces", Georgia, serif;
    --font-mono: "IBM Plex Mono", "Courier New", monospace;
    --font-sans: "Inter", system-ui, -apple-system, sans-serif;

    /* legacy compat for inline refs */
    --surface-raised: rgba(255, 255, 255, 0.07);
    --border: rgba(255, 255, 255, 0.12);
    --r-card: 6px;
    --r-badge: 6px;
    --r-btn: 6px;
    --font-display: var(--font-serif);
    --font-body: var(--font-sans);
  }

  html, body {
    margin: 0;
    background: var(--bg-gradient);
    background-attachment: fixed;
    min-height: 100vh;
    color: var(--ink);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
  ::-webkit-scrollbar-thumb { background: var(--surface-border); border-radius: 3px; }

  .micro {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  @keyframes fadein {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes gauge-fill {
    from { stroke-dashoffset: 440; }
  }

  .reveal { animation: fadein 0.6s ease both; }
  .reveal-1 { animation-delay: 0.05s; }
  .reveal-2 { animation-delay: 0.15s; }
  .reveal-3 { animation-delay: 0.28s; }
  .reveal-4 { animation-delay: 0.42s; }
  .reveal-5 { animation-delay: 0.56s; }

  /* Layout */
  .app-shell { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .page { max-width: 1200px; margin: 0 auto; padding: 0 24px 64px; }
  @media (min-width: 768px) {
    .app-shell { padding: 0 48px; }
    .page { padding: 0 48px 64px; }
  }

  /* Header */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 0 24px; border-bottom: 1px solid var(--surface-border);
    margin-bottom: 0; gap: 16px; flex-wrap: wrap;
  }
  .wordmark {
    font-family: var(--font-serif);
    font-size: 1.6rem;
    font-weight: 500;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .wordmark-r {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--accent);
    vertical-align: super;
    font-weight: 400;
  }
  .topbar-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .route-nav {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    backdrop-filter: blur(8px);
  }
  .route-link {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 34px; padding: 0 14px;
    border-radius: 6px;
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-decoration: none;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .route-link:hover { color: var(--ink); background: var(--surface-strong); }
  .route-link.active { color: var(--accent); background: var(--accent-dim); }
  .location-pill, .date-pill {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: 999px; padding: 6px 14px;
    font-family: var(--font-mono); font-size: 0.7rem;
    letter-spacing: 0.15em; text-transform: uppercase;
    color: var(--ink-muted);
  }
  .location-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent); flex-shrink: 0;
  }

  /* Hero */
  .hero { padding: 80px 0 60px; position: relative; }

  .hero__top-label {
    display: flex; align-items: center; gap: 10px; margin-bottom: 32px;
  }
  .hero__dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 12px var(--accent);
    flex-shrink: 0;
  }

  .hero__main {
    display: grid; grid-template-columns: 1fr auto;
    gap: 48px; align-items: center; margin-bottom: 56px;
  }
  @media (max-width: 640px) {
    .hero__main { grid-template-columns: 1fr; gap: 24px; }
  }

  .hero__right { display: flex; flex-direction: column; align-items: center; }

  .hero__headline {
    font-family: var(--font-serif);
    font-size: clamp(3.5rem, 9vw, 9rem);
    font-weight: 300;
    line-height: 0.95;
    letter-spacing: -0.02em;
    margin: 0 0 16px;
    color: var(--ink);
  }
  .hero__headline--placeholder {
    font-style: italic;
    color: rgba(244, 248, 248, 0.85);
  }

  .hero__state-line {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
    text-transform: uppercase;
  }

  /* Hero form card */
  .hero__form-card {
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 28px 32px;
    backdrop-filter: blur(8px);
    position: relative;
  }

  .hero__form-row {
    display: flex; align-items: flex-end;
    gap: 12px; flex-wrap: wrap; margin-top: 16px;
  }

  .hero__input-group {
    display: flex; flex-direction: column; gap: 6px;
    position: relative;
  }

  .hero__input {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    width: 56px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--surface-border);
    color: var(--ink);
    text-align: center;
    padding: 4px 0;
    outline: none;
    -moz-appearance: textfield; appearance: textfield;
  }
  .hero__input::-webkit-outer-spin-button,
  .hero__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .hero__input--wide { width: 84px; }
  .hero__input:focus { border-bottom-color: var(--accent); }
  .hero__input::placeholder { color: var(--ink-faint); }

  .hero__sep {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    color: var(--ink-faint);
    padding-bottom: 4px;
  }
  .hero__sep--gap { margin: 0 12px; }

  .hero__check-btn {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: transparent;
    border: 1px solid var(--surface-border-strong);
    border-radius: 6px;
    color: var(--ink);
    padding: 10px 20px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .hero__check-btn:hover { border-color: var(--accent); color: var(--accent); }
  .hero__check-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .picker-error {
    margin-top: 12px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    color: var(--state-poor);
  }

  /* Picker dropdowns */
  .picker-dropdown {
    position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%);
    background: rgba(19, 51, 65, 0.97);
    border: 1px solid var(--accent);
    border-radius: 8px; z-index: 1000;
    max-height: 192px; overflow-y: auto; overflow-x: hidden;
    min-width: 100%;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    backdrop-filter: blur(12px);
    scrollbar-width: thin; scrollbar-color: var(--surface-border) transparent;
  }
  .picker-dropdown::-webkit-scrollbar { width: 3px; }
  .picker-dropdown::-webkit-scrollbar-track { background: transparent; }
  .picker-dropdown::-webkit-scrollbar-thumb { background: var(--surface-border); border-radius: 2px; }
  .picker-option {
    padding: 9px 14px; font-family: var(--font-mono); font-size: 0.9rem;
    color: var(--ink-muted); cursor: pointer;
    transition: background 0.1s, color 0.1s;
    text-align: center; white-space: nowrap;
  }
  .picker-option:hover { background: var(--accent-dim); color: var(--ink); }
  .picker-option.active { color: var(--accent); background: var(--accent-dim); font-weight: 500; }

  /* Confidence Gauge */
  .gauge-wrap {
    display: flex; flex-direction: column; align-items: center;
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: 6px; padding: 28px 40px 24px;
    backdrop-filter: blur(8px); min-width: 200px;
  }
  .gauge-label { display: none; }
  .gauge-svg { overflow: visible; }
  .gauge-track { fill: none; stroke: var(--surface-border); stroke-width: 10; stroke-linecap: round; }
  .gauge-fill {
    fill: none; stroke: var(--accent); stroke-width: 10; stroke-linecap: round;
    filter: drop-shadow(0 0 6px rgba(127,245,220,0.5));
    animation: gauge-fill 1.4s cubic-bezier(0.34,1.56,0.64,1) both;
    animation-delay: 0.3s;
  }
  .gauge-pct {
    font-family: var(--font-serif); font-size: 2.2rem; font-weight: 300;
    fill: var(--ink); text-anchor: middle; dominant-baseline: central;
  }
  .gauge-confidence {
    font-family: var(--font-mono); font-size: 0.65rem;
    fill: var(--accent); text-anchor: middle;
  }

  /* Section heading */
  .section-head {
    font-family: var(--font-mono); font-size: 0.7rem;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--ink-muted); margin-bottom: 16px;
    display: flex; align-items: center; gap: 10px;
  }
  .section-head::after {
    content: ''; flex: 1; height: 1px; background: var(--surface-border);
  }

  /* Conditions grid */
  .conditions-section { margin-bottom: 40px; }
  .conditions__grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
  }
  @media (max-width: 900px) { .conditions__grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px) { .conditions__grid { grid-template-columns: 1fr; } }

  .conditions__tile {
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: 6px; padding: 24px; backdrop-filter: blur(8px);
    display: flex; flex-direction: column;
  }
  .conditions__tile-top {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }
  .conditions__tile-icon { font-size: 1.1rem; }
  .conditions__tile-value {
    font-family: var(--font-serif); font-size: 3.5rem; font-weight: 300;
    line-height: 1.05; color: var(--ink);
    display: flex; align-items: baseline;
    margin-bottom: 0;
  }
  .conditions__tile-unit {
    font-family: var(--font-mono); font-size: 0.85rem;
    color: var(--ink-muted); margin-left: 4px;
  }
  .conditions__tile-sub {
    margin-top: 8px;
    font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink-muted);
  }
  .conditions__tile-impact {
    font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.1em;
    text-transform: uppercase; margin-top: 6px;
  }

  /* Tide Chart */
  .chart-section { margin-bottom: 40px; }
  .chart-wrap {
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: 6px; padding: 24px; backdrop-filter: blur(8px);
  }

  /* Forecast strip */
  .forecast-section { margin-bottom: 48px; }
  .forecast-scroll {
    display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px;
    scrollbar-width: thin; scrollbar-color: var(--surface-border) transparent;
  }
  .window-card {
    flex: 0 0 160px; background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: 6px; padding: 16px; cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.15s;
    display: flex; flex-direction: column; gap: 8px;
  }
  .window-card:hover { transform: translateY(-2px); border-color: var(--surface-border-strong); }
  .window-card.active { border-color: var(--accent-line); }

  .wc-day {
    font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink-muted);
  }
  .wc-day--today { color: var(--accent); }

  .wc-confidence-bar {
    height: 2px; background: var(--surface-border); border-radius: 1px; overflow: hidden;
  }
  .wc-confidence-fill { height: 100%; border-radius: 1px; }

  .wc-score {
    font-family: var(--font-serif); font-size: 2rem; font-weight: 300; line-height: 1;
  }
  .wc-time {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--ink-muted); line-height: 1.6;
  }
  .badge {
    display: inline-block; font-size: 0.65rem; font-weight: 500;
    font-family: var(--font-mono); letter-spacing: 0.1em;
    text-transform: uppercase; padding: 3px 10px; border-radius: 999px;
  }

  /* Detail Panel */
  .detail-panel {
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: 6px; padding: 28px; margin-bottom: 40px;
    backdrop-filter: blur(8px); animation: fadein 0.35s ease both;
  }
  .detail-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
  }
  .detail-meta {
    font-family: var(--font-mono); font-size: 0.7rem;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--ink-muted); margin-bottom: 6px;
  }
  .detail-title {
    font-family: var(--font-serif); font-size: 2rem; font-weight: 300;
    color: var(--ink); line-height: 1.2; margin-bottom: 4px;
  }
  .detail-sub {
    font-family: var(--font-mono); font-size: 0.75rem;
    color: var(--ink-muted); margin-top: 4px;
  }
  .detail-close {
    background: none; border: 1px solid var(--surface-border);
    border-radius: 6px; padding: 6px 14px;
    color: var(--ink-muted); font-family: var(--font-mono);
    font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; transition: border-color 0.15s, color 0.15s; white-space: nowrap;
  }
  .detail-close:hover { border-color: var(--state-poor); color: var(--state-poor); }

  .detail-body { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 640px) { .detail-body { grid-template-columns: 1fr; } }

  .reasoning-section-label {
    font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink-muted); margin-bottom: 12px;
  }
  .reasoning-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .reasoning-item {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 0.9375rem; line-height: 1.5; color: var(--ink);
    font-family: var(--font-sans);
  }
  .reasoning-dot {
    flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent); margin-top: 9px; opacity: 0.8;
  }

  .factor-row {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--surface-strong); border-radius: 6px; padding: 10px 14px;
  }
  .factor-row-name {
    font-family: var(--font-serif); font-size: 1.1rem; font-weight: 400; color: var(--ink);
    display: flex; align-items: center; gap: 8px;
  }
  .factor-row-sub {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--ink-faint); margin-left: 4px;
  }
  .factor-row-right { display: flex; align-items: center; gap: 8px; }
  .factor-row-val {
    font-family: var(--font-mono); font-size: 0.875rem; color: var(--ink);
  }

  /* Footer */
  .footer {
    border-top: 1px solid var(--surface-border); padding: 20px 0;
    display: flex; justify-content: space-between; align-items: center;
    gap: 12px; flex-wrap: wrap;
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
    <div className="conditions__tile">
      <div className="conditions__tile-top">
        <span className="micro">{name}</span>
        <span className="conditions__tile-icon">{icon}</span>
      </div>
      <div className="conditions__tile-value">
        {value}
        {unit && <span className="conditions__tile-unit">{unit}</span>}
      </div>
      {sub && <div className="conditions__tile-sub">{sub}</div>}
      <div className="conditions__tile-impact" style={{ color: impactColor(impact) }}>
        {impactIcon(impact)} — {impact.charAt(0).toUpperCase() + impact.slice(1)}
      </div>
    </div>
  );
}

/* ─── WINDOW CARD ────────────────────────────────────────────── */
function WindowCard({ win, active, onClick, isToday }) {
  const color = stateColor(win.conditionState);
  const bg = stateBg(win.conditionState);
  return (
    <div className={`window-card${active ? " active" : ""}`} onClick={onClick} role="button" tabIndex={0}>
      <div className={`wc-day${isToday ? " wc-day--today" : ""}`}>{win.label}</div>
      <div className="wc-confidence-bar">
        <div className="wc-confidence-fill" style={{ width: `${Math.round(win.confidence * 100)}%`, background: color }} />
      </div>
      <div className="wc-score" style={{ color }}>
        {Math.round(win.confidence * 100)}%
      </div>
      <div className="wc-time">
        {formatTime(win.startsAt)}<br />
        → {formatTime(win.endsAt)}
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
      background: "rgba(19, 51, 65, 0.97)", border: "1px solid var(--surface-border)",
      borderRadius: "var(--r-badge)", padding: "8px 14px",
      fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--ink)",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ color: "var(--ink-muted)", fontSize: "0.7rem" }}>{payload[0]?.payload?.time}</div>
      <div>{payload[0]?.value?.toFixed(1)} m</div>
    </div>
  );
}

/* ─── MAIN ROUTE ─────────────────────────────────────────────── */
function MainPage() {
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
    document.title = "YOU(R) SEA — Forecast";
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
      {/* HERO */}
      <section className="hero reveal reveal-2">
        <div className="hero__top-label">
          <span className="hero__dot" />
          <span className="micro">VISIBILITY CHECK</span>
        </div>

        <div className="hero__main">
          <div className="hero__left">
            {loading ? (
              <>
                <h1 className="hero__headline hero__headline--placeholder">Calculating…</h1>
                <div className="hero__state-line">Querying forecast engine…</div>
              </>
            ) : data ? (
              <>
                <h1 className="hero__headline" style={{ color: toneColor(data.statusTone) }}>
                  {Math.round(data.visibilityScore)}%
                </h1>
                <div className="hero__state-line">
                  {data.statusLabel.toUpperCase()}
                  {queryInfo && ` · ${queryInfo.date} at ${queryInfo.time}`}
                </div>
              </>
            ) : (
              <>
                <h1 className="hero__headline hero__headline--placeholder">Select a date and time</h1>
                <div className="hero__state-line">Choose when you want to dive — we'll predict visibility</div>
              </>
            )}
          </div>

          <div className="hero__right">
            <div className="micro" style={{ textAlign: "center", marginBottom: 8 }}>CONFIDENCE</div>
            <ConfidenceGauge
              value={data ? Math.min(data.visibilityScore / 100, 1) : 0}
              color={data ? toneColor(data.statusTone) : "rgba(244,248,248,0.2)"}
            />
          </div>
        </div>

        <div className="hero__form-card" ref={pickerRef}>
          <div className="micro">WHEN ARE YOU THINKING?</div>
          <div className="hero__form-row">

            {/* DAY */}
            <div className="hero__input-group">
              <span className="micro">DAY</span>
              <input className="hero__input" type="number" min="1" max="31"
                placeholder="DD" value={pickerDay}
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
            <span className="hero__sep">/</span>

            {/* MONTH */}
            <div className="hero__input-group">
              <span className="micro">MONTH</span>
              <input className="hero__input" type="number" min="1" max="12"
                placeholder="MM" value={pickerMonth}
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
            <span className="hero__sep">/</span>

            {/* YEAR */}
            <div className="hero__input-group">
              <span className="micro">YEAR</span>
              <input className="hero__input hero__input--wide" type="number" min="2024" max="2099"
                placeholder="YYYY" value={pickerYear}
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

            <span className="hero__sep hero__sep--gap">|</span>

            {/* HOUR */}
            <div className="hero__input-group">
              <span className="micro">HOUR</span>
              <input className="hero__input" type="number" min="0" max="23"
                placeholder="HH" value={pickerHour}
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
            <span className="hero__sep">:</span>

            {/* MINUTE */}
            <div className="hero__input-group">
              <span className="micro">MIN</span>
              <input className="hero__input" type="number" min="0" max="59"
                placeholder="MM" value={pickerMin}
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

            <button className="hero__check-btn" onClick={handleCheck} disabled={loading}>
              {loading ? "Checking…" : "Check conditions"}
            </button>
          </div>
          {error && <div className="picker-error">{error}</div>}
        </div>
      </section>

      {/* CONDITIONS NOW */}
      <div className="conditions-section reveal reveal-3">
        <div className="section-head">
          {data ? "Conditions for the selected time" : "Conditions now"}
        </div>
        <div className="conditions__grid">
          <FactorTile
            icon="🌊"
            name="Tide"
            value={data?.features?.nextTideHeightM != null ? data.features.nextTideHeightM.toFixed(1) : "—"}
            unit={data?.features?.nextTideHeightM != null ? "m" : ""}
            impact="neutral"
            sub={data?.features?.nextTideType ?? "—"}
          />
          <FactorTile
            icon="💨"
            name="Wind"
            value={data?.features?.windSpeedKmh != null ? Math.round(data.features.windSpeedKmh) : "—"}
            unit={data?.features?.windSpeedKmh != null ? "km/h" : ""}
            impact="neutral"
          />
          <FactorTile
            icon="🌡"
            name="Water temp"
            value={data?.features?.waterTemperatureC != null ? Math.round(data.features.waterTemperatureC) : "—"}
            unit={data?.features?.waterTemperatureC != null ? "°C" : ""}
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
      <div className="chart-section reveal reveal-4">
        <div className="section-head">Tide curve / today</div>
        <div className="chart-wrap">
          <div className="micro" style={{ marginBottom: 20 }}>
            Optimal window {formatTime(hero.startsAt)} – {formatTime(hero.endsAt)} highlighted
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={TIDE_CURVE} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7FF5DC" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7FF5DC" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fill: "rgba(244,248,248,0.4)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                interval={2}
              />
              <YAxis
                tick={{ fill: "rgba(244,248,248,0.4)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <Tooltip content={<TideTooltip />} />
              <ReferenceLine x="14:00" stroke="rgba(127,245,220,0.3)" strokeWidth={40} />
              <ReferenceLine x="16:00" stroke="rgba(127,245,220,0.12)" strokeWidth={40} />
              <Area
                type="monotone"
                dataKey="level"
                stroke="#7FF5DC"
                strokeWidth={2}
                fill="url(#tideGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#7FF5DC", stroke: "none" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FORECAST STRIP */}
      <div className="forecast-section reveal reveal-5">
        <div className="section-head">Coming up</div>
        <div className="forecast-scroll">
          {MOCK_FORECAST.windows.map((w, i) => (
            <WindowCard
              key={w.id}
              win={w}
              active={selectedWin === w.id}
              isToday={i === 0}
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
              <div className="detail-meta">{selected.label} · Window detail</div>
              <div className="detail-title">
                {formatTime(selected.startsAt)} → {formatTime(selected.endsAt)}
              </div>
              <div className="detail-sub">
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

          <div className="detail-body">
            <div>
              <div className="reasoning-section-label">Why we think this</div>
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
                <div key={name} className="factor-row">
                  <span className="factor-row-name">
                    {icon} {name}
                    {sub && <span className="factor-row-sub">· {sub}</span>}
                  </span>
                  <span className="factor-row-right">
                    <span className="factor-row-val">{val}</span>
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
        <span className="micro">
          Last updated {new Date(MOCK_FORECAST.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="micro">
          Removing the guesswork from underwater viewing · {MOCK_FORECAST.locationName}
        </span>
      </footer>

    </div>
  );
}

function DashboardRoute() {
  useEffect(() => {
    document.title = "YOU(R) SEA — Dashboard";
  }, []);

  return <Dashboard />;
}

function Shell() {
  useEffect(() => {
    if (!document.getElementById("yoursea-styles")) {
      const el = document.createElement("style");
      el.id = "yoursea-styles";
      el.textContent = css;
      document.head.appendChild(el);
    }
  }, []);

  return (
    <>
      <div className="app-shell">
        <header className="topbar reveal reveal-1">
          <div className="wordmark">
            You<sup className="wordmark-r">(R)</sup> Sea
          </div>
          <div className="topbar-right">
            <nav className="route-nav" aria-label="Primary navigation">
              <NavLink className="route-link" to="/main">
                Predict
              </NavLink>
              <NavLink className="route-link" to="/dashboard">
                Dashboard
              </NavLink>
            </nav>
            <div className="location-pill">
              <span className="location-dot" />
              · {MOCK_FORECAST.locationName}
            </div>
            <div className="date-pill">
              {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
        </header>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="/main" replace />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
