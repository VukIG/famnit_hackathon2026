import { useState, useEffect, useRef } from "react";

const MOCK_DATA = {
  date: "2026-05-18",
  time: "09:00",
  latitude: 45.52,
  longitude: 13.57,
  depth_min_m: 5.0,
  depth_max_m: 15.0,
  CHL: 1.84,
  SPM: 3.21,
  TUR: 2.47,
  VHM0: 0.72,
  VHM0_SW1: 0.51,
  VHM0_WW: 0.38,
  VTM10: 6.4,
  current_speed: 0.14,
  uo: 0.000846,
  vo: -0.01106,
  mlotst: 11.64,
  so: 37.83,
  thetao: 17.39,
  zos: -0.364,
};

function clarityScore(d) {
  let s = 100;
  if (d.TUR > 10) s -= 40; else if (d.TUR > 5) s -= 25; else if (d.TUR > 3) s -= 12; else if (d.TUR > 1.5) s -= 4;
  if (d.VHM0 > 2) s -= 30; else if (d.VHM0 > 1.5) s -= 20; else if (d.VHM0 > 1) s -= 10; else if (d.VHM0 > 0.6) s -= 4;
  if (d.CHL > 5) s -= 15; else if (d.CHL > 2) s -= 6;
  if (d.SPM > 5) s -= 15; else if (d.SPM > 3) s -= 6;
  return Math.max(0, Math.round(s));
}

function currentAngle(uo, vo) {
  return Math.atan2(uo, vo) * (180 / Math.PI);
}

function useCounter(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(ease * target);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function AnimatedValue({ value, decimals = 2 }) {
  const v = useCounter(value);
  return <>{v.toFixed(decimals)}</>;
}

function ScoreRing({ score }) {
  const animated = useCounter(score, 1400);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (animated / 100) * circ;
  const color = score >= 75 ? "#00e5a0" : score >= 50 ? "#f5a623" : "#ff4d6a";

  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="65" cy="65" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 65 65)"
        style={{ transition: "stroke-dashoffset 0.05s linear" }}
      />
      <text x="65" y="60" textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily="'Space Grotesk', monospace">
        {Math.round(animated)}
      </text>
      <text x="65" y="78" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="'DM Mono', monospace" letterSpacing="0.08em">
        / 100
      </text>
    </svg>
  );
}

function CurrentArrow({ angle }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <g transform={`rotate(${angle} 22 22)`}>
        <polygon points="22,6 26,26 22,22 18,26" fill="#38beff" opacity="0.9" />
        <circle cx="22" cy="22" r="2.5" fill="#38beff" />
      </g>
    </svg>
  );
}

function MixedLayerBar({ depth, diveMin, diveMax }) {
  const totalDepth = 25;
  const pct = (depth / totalDepth) * 100;
  const pctMin = (diveMin / totalDepth) * 100;
  const pctMax = (diveMax / totalDepth) * 100;

  return (
    <div style={{ position: "relative", width: "100%", height: "110px", marginTop: "8px" }}>
      <div style={{
        position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
        background: "linear-gradient(to bottom, rgba(56,190,255,0.18) 0%, rgba(56,190,255,0.04) 100%)",
        borderRadius: "6px", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: `${pct}%`, left: 0, right: 0, height: "1.5px",
          background: "rgba(245,166,35,0.8)",
        }} />
        <div style={{
          position: "absolute",
          top: `${pctMin}%`,
          height: `${pctMax - pctMin}%`,
          left: "30%", right: "30%",
          background: "rgba(0,229,160,0.12)",
          border: "1px dashed rgba(0,229,160,0.4)",
          borderRadius: "3px",
        }} />
      </div>
      <div style={{ position: "absolute", top: `${pct}%`, right: "8px", transform: "translateY(-50%)", fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "rgba(245,166,35,0.9)" }}>
        {depth.toFixed(1)} m
      </div>
      <div style={{ position: "absolute", top: `${pctMin}%`, left: "8px", fontSize: "9px", fontFamily: "'DM Mono', monospace", color: "rgba(0,229,160,0.7)" }}>
        {diveMin} m
      </div>
      <div style={{ position: "absolute", top: `${pctMax}%`, left: "8px", fontSize: "9px", fontFamily: "'DM Mono', monospace", color: "rgba(0,229,160,0.7)", transform: "translateY(-100%)" }}>
        {diveMax} m
      </div>
      <div style={{ position: "absolute", top: "2px", right: "8px", fontSize: "9px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)" }}>0 m</div>
      <div style={{ position: "absolute", bottom: "2px", right: "8px", fontSize: "9px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)" }}>{totalDepth} m</div>
    </div>
  );
}

function MetricCard({ label, value, unit, source, status, children, wide, note }) {
  const statusColor = status === "good" ? "#00e5a0" : status === "caution" ? "#f5a623" : status === "alert" ? "#ff4d6a" : "rgba(255,255,255,0.3)";

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "0.5px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      padding: "14px 16px",
      gridColumn: wide ? "span 2" : undefined,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: statusColor, opacity: 0.6 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
        {source && (
          <span style={{ fontSize: "9px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "3px" }}>
            {source}
          </span>
        )}
      </div>
      {value !== undefined && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ fontSize: "22px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", color: "#fff", lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.4)" }}>{unit}</span>
        </div>
      )}
      {children}
      {note && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: 1.5, marginTop: "2px" }}>{note}</div>}
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
      <div style={{ height: "0.5px", flex: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{ fontSize: "9px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
      <div style={{ height: "0.5px", flex: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

export default function Satelite() {
  const d = MOCK_DATA;
  const score = clarityScore(d);
  const verdict = score >= 75 ? { label: "GO", color: "#00e5a0" } : score >= 50 ? { label: "CAUTION", color: "#f5a623" } : { label: "NO-GO", color: "#ff4d6a" };
  const angle = currentAngle(d.uo, d.vo);
  const [mounted, setMounted] = useState(false);
  const belowMixed = d.depth_max_m > d.mlotst;

  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#040d18",
      color: "#e8f0ff",
      fontFamily: "'Space Grotesk', sans-serif",
      padding: "0",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
        background: "rgba(255,255,255,0.015)",
      }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "700", letterSpacing: "0.08em", color: "#fff" }}>
            SATELLITE <span style={{ color: "#38beff" }}>·</span> OCEAN DATA
          </div>
          <div style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
            {d.latitude}°N {d.longitude}°E · {d.depth_min_m}–{d.depth_max_m} m · {d.date} {d.time}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00e5a0", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.3)" }}>SATELLITE FEED</span>
          </div>
          <div style={{
            padding: "4px 12px", borderRadius: "5px",
            background: `${verdict.color}18`,
            border: `0.5px solid ${verdict.color}44`,
            fontSize: "11px", fontWeight: "700", fontFamily: "'DM Mono', monospace",
            color: verdict.color, letterSpacing: "0.1em"
          }}>
            {verdict.label}
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          {mounted && <ScoreRing score={score} />}
          <span style={{ fontSize: "9px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Clarity score</span>
        </div>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <div style={{ fontSize: "28px", fontWeight: "700", color: verdict.color, lineHeight: 1 }}>{verdict.label}</div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "6px", lineHeight: 1.6 }}>
            {score >= 75
              ? "Water clarity is good. Satellite confirms safe conditions for diving."
              : score >= 50
              ? "Marginal clarity. Satellite data shows moderate particle load — exercise caution."
              : "Poor clarity detected. High turbidity or wave energy — do not dive."}
          </div>
          {belowMixed && (
            <div style={{
              marginTop: "10px", padding: "8px 10px", borderRadius: "6px",
              background: "rgba(245,166,35,0.08)", border: "0.5px solid rgba(245,166,35,0.3)",
              fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "rgba(245,166,35,0.9)", lineHeight: 1.5
            }}>
              ⚠ Mixed layer ends at {d.mlotst.toFixed(1)} m — dives below this depth enter different water conditions
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 24px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>

        <Divider label="Water clarity" />

        <MetricCard label="Turbidity" unit="NTU" source="satellite" status={d.TUR <= 3 ? "good" : d.TUR <= 5 ? "caution" : "alert"}
          value={mounted ? <AnimatedValue value={d.TUR} decimals={2} /> : d.TUR.toFixed(2)}
          note="Direct clarity indicator" />

        <MetricCard label="Chlorophyll" unit="mg/m³" source="satellite" status={d.CHL <= 2 ? "good" : d.CHL <= 5 ? "caution" : "alert"}
          value={mounted ? <AnimatedValue value={d.CHL} decimals={2} /> : d.CHL.toFixed(2)}
          note="Algal bloom indicator" />

        <MetricCard label="Suspended particles" unit="mg/L" source="satellite" status={d.SPM <= 3 ? "good" : d.SPM <= 5 ? "caution" : "alert"}
          value={mounted ? <AnimatedValue value={d.SPM} decimals={2} /> : d.SPM.toFixed(2)}
          note="Sediment load" />

        <Divider label="Wave conditions" />

        <MetricCard label="Wave height" unit="m" source="satellite" status={d.VHM0 <= 0.6 ? "good" : d.VHM0 <= 1.2 ? "caution" : "alert"}
          value={mounted ? <AnimatedValue value={d.VHM0} decimals={2} /> : d.VHM0.toFixed(2)}
          note="Significant wave height" />

        <MetricCard label="Swell height" unit="m" source="satellite" status={d.VHM0_SW1 <= 0.5 ? "good" : "caution"}
          value={mounted ? <AnimatedValue value={d.VHM0_SW1} decimals={2} /> : d.VHM0_SW1.toFixed(2)}
          note="Long-period swell" />

        <MetricCard label="Wind waves" unit="m" source="satellite" status={d.VHM0_WW <= 0.4 ? "good" : "caution"}
          value={mounted ? <AnimatedValue value={d.VHM0_WW} decimals={2} /> : d.VHM0_WW.toFixed(2)}
          note="Short-period chop" />

        <MetricCard label="Wave period" unit="s" source="satellite" status="good"
          value={mounted ? <AnimatedValue value={d.VTM10} decimals={1} /> : d.VTM10.toFixed(1)}
          note="Mean period" />

        <Divider label="Ocean currents" />

        <MetricCard label="Current speed" unit="m/s" source="satellite" status={d.current_speed <= 0.2 ? "good" : d.current_speed <= 0.5 ? "caution" : "alert"}
          value={mounted ? <AnimatedValue value={d.current_speed} decimals={2} /> : d.current_speed.toFixed(2)}
          note="Surface current magnitude" />

        <MetricCard label="Current direction" source="satellite" status="good">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
            <CurrentArrow angle={angle} />
            <div>
              <div style={{ fontSize: "13px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.6)" }}>
                {Math.round(((angle % 360) + 360) % 360)}°
              </div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>u: {d.uo.toFixed(4)} · v: {d.vo.toFixed(4)}</div>
            </div>
          </div>
        </MetricCard>

        <Divider label="Environmental context" />

        <MetricCard label="Ocean temp" unit="°C" source="satellite" status="good"
          value={mounted ? <AnimatedValue value={d.thetao} decimals={1} /> : d.thetao.toFixed(1)}
          note="Cross-validates in-situ sensor" />

        <MetricCard label="Salinity" unit="PSU" source="satellite" status="good"
          value={mounted ? <AnimatedValue value={d.so} decimals={2} /> : d.so.toFixed(2)}
          note="Cross-validates in-situ sensor" />

        <Divider label="Depth structure" />

        <MetricCard label="Mixed layer depth" unit="m" source="satellite" status={belowMixed ? "caution" : "good"} wide
          note={belowMixed ? `Your dive range (${d.depth_min_m}–${d.depth_max_m} m) extends below the mixed layer. Water properties change below ${d.mlotst.toFixed(1)} m.` : `Mixed layer covers your full dive range (${d.depth_min_m}–${d.depth_max_m} m). Conditions consistent throughout.`}>
          <MixedLayerBar depth={d.mlotst} diveMin={d.depth_min_m} diveMax={d.depth_max_m} />
        </MetricCard>

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
    </div>
  );
}