import { useState, useEffect, useRef } from "react";

import { useForecast } from "./hooks/useForecast";
import { ConditionsNow } from "./components/ConditionsNow";

/* ─── HELPERS ────────────────────────────────────────────────── */
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

  /* Date picker section */
  .picker-section {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-card); padding: 24px 28px;
    margin-bottom: 40px; box-shadow: var(--shadow-card);
  }
  .picker-title {
    font-family: var(--font-display); font-size: 0.9rem; font-weight: 600;
    color: var(--ink); margin-bottom: 16px; letter-spacing: 0.01em;
  }
  .picker-row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .picker-input {
    flex: 1; min-width: 200px;
    background: var(--surface-raised); border: 1px solid var(--border);
    border-radius: var(--r-btn); padding: 10px 14px;
    color: var(--ink); font-family: var(--font-mono); font-size: 0.875rem;
    outline: none; transition: border-color 0.15s;
    color-scheme: dark;
  }
  .picker-input:focus { border-color: var(--accent); }
  .picker-btn {
    background: var(--surface-raised); border: 1px solid var(--border);
    border-radius: var(--r-btn); padding: 10px 20px;
    color: var(--ink); font-family: var(--font-display); font-size: 0.875rem;
    font-weight: 500; cursor: pointer; transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .picker-btn:hover { border-color: var(--accent); background: var(--surface); }
  .picker-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .picker-status {
    font-size: 0.8125rem; color: var(--ink-muted);
    font-family: var(--font-body); margin-top: 10px; min-height: 1.2em;
  }
  .picker-status.ok { color: var(--accent); }
  .picker-status.err { color: var(--danger); }

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

/* ─── MAIN APP ───────────────────────────────────────────────── */
export default function App() {
  const [time, setTime] = useState("");
  const styleRef = useRef(null);
  const { data, loading, error, load } = useForecast();

  useEffect(() => {
    if (!document.getElementById("yoursea-styles")) {
      const el = document.createElement("style");
      el.id = "yoursea-styles";
      el.textContent = css;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    document.title = "YOU(R) SEA — Forecast";

    // Auto-fetch for the next round hour on mount.
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const hh = String(now.getHours() + 1).padStart(2, "0");
    load(date, `${hh}:00`);

    return () => {
      if (styleRef.current) styleRef.current.remove();
    };
  }, [load]);

  const handleCheck = () => {
    if (!time) return;
    const [date, timeOfDay] = time.split("T");
    load(date, timeOfDay);
  };

  const statusMsg = loading
    ? "Querying forecast engine…"
    : error
    ? "Network error — check your connection and try again."
    : data
    ? "Forecast received."
    : "";
  const statusType = loading ? "" : error ? "err" : data ? "ok" : "";

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
            Sea Oasis — Site Alpha
          </div>
          <div className="location-pill" style={{ color: "var(--ink-muted)" }}>
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </header>

      {/* HERO — blocked on ML model, neutral placeholders */}
      <section className="hero reveal reveal-2">
        <div>
          <div className="hero-label">Next optimal window</div>
          <div className="hero-time" style={{ color: "var(--ink-muted)" }}>—</div>
          <div className="hero-sub">Awaiting prediction model</div>
        </div>
        <div className="gauge-wrap" style={{ opacity: 0.4 }}>
          <div className="gauge-label">Confidence</div>
          <svg className="gauge-svg" width={160} height={120} viewBox="0 0 160 120">
            {(() => {
              const r = 60, cx = 80, cy = 80, startAngle = -220, sweep = 260;
              const polar = (a, rad) => ({
                x: cx + rad * Math.cos((a * Math.PI) / 180),
                y: cy + rad * Math.sin((a * Math.PI) / 180),
              });
              const arc = (s, e, rad) => {
                const sp = polar(s, rad), ep = polar(e, rad);
                return `M ${sp.x} ${sp.y} A ${rad} ${rad} 0 ${e - s > 180 ? 1 : 0} 1 ${ep.x} ${ep.y}`;
              };
              return (
                <>
                  <path className="gauge-track" d={arc(startAngle, startAngle + sweep, r)} />
                  <text className="gauge-pct" x={cx} y={cy + 2} style={{ fontSize: "1.8rem" }}>—</text>
                  <text
                    className="gauge-confidence"
                    x={cx} y={cy + 22}
                    style={{ fontSize: "0.65rem", fill: "var(--ink-muted)" }}
                  >
                    Pending
                  </text>
                </>
              );
            })()}
          </svg>
        </div>
      </section>

      {/* DATE PICKER */}
      <div className="picker-section reveal reveal-2" style={{ animationDelay: "0.2s" }}>
        <div className="picker-title">Check a specific time window</div>
        <div className="picker-row">
          <input
            className="picker-input"
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Select date and time"
          />
          <button className="picker-btn" onClick={handleCheck} disabled={loading || !time}>
            {loading ? "Checking…" : "Check conditions"}
          </button>
        </div>
        {statusMsg && (
          <div className={`picker-status${statusType ? " " + statusType : ""}`}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* CONDITIONS NOW — real data from backend */}
      <div className="reveal reveal-3">
        <div className="section-head">Conditions now</div>
        <ConditionsNow features={data?.features} loading={loading} />
      </div>

      {/* TIDE CHART — blocked on hourly tide endpoint */}
      <div className="reveal reveal-4">
        <div className="section-head">Tide curve — today</div>
        <div className="chart-wrap" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div className="chart-title" style={{ marginBottom: "12px" }}>
            Tidal level · 24-hour forecast
          </div>
          <div style={{ color: "var(--ink-muted)", fontFamily: "var(--font-body)", fontSize: "0.9rem" }}>
            Detailed tide chart coming next
          </div>
        </div>
      </div>

      {/* COMING UP — blocked on ML model, neutral placeholder cards */}
      <div className="reveal reveal-5">
        <div className="section-head">Coming up</div>
        <div className="forecast-scroll">
          {["Today", "Tue", "Wed", "Thu", "Fri"].map((label) => (
            <div key={label} className="window-card" style={{ opacity: 0.45, cursor: "default" }}>
              <div className="wc-day">{label}</div>
              <div className="wc-time" style={{ color: "var(--ink-muted)" }}>—</div>
              <div className="wc-dur" style={{ color: "var(--ink-faint)" }}>Awaiting model</div>
              <div className="wc-score" style={{ color: "var(--ink-muted)" }}>—</div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-ts">
          {data
            ? `Last updated ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : "—"}
        </div>
        <div className="footer-mission">
          Removing the guesswork from underwater viewing · Sea Oasis
        </div>
      </footer>
    </div>
  );
}
