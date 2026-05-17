import "./DetailPanel.css";
import {
  formatTime, windowDuration, stateColor, stateLabel,
  impactIcon, impactColor,
} from "../../lib/helpers";

export default function DetailPanel({ window: win, onClose }) {
  const factors = [
    { name: "Tide",       val: `${win.factors.tide.value.toFixed(1)} m`,                          sub: win.factors.tide.trend,       f: win.factors.tide },
    { name: "Wind",       val: `${Math.round(win.factors.wind.value)} km/h ${win.factors.wind.direction}`, sub: null,                f: win.factors.wind },
    { name: "Water Temp", val: `${Math.round(win.factors.waterTemp.value)}°C`,                     sub: null,                         f: win.factors.waterTemp },
    { name: "Moon",       val: `${Math.round(win.factors.moonDistance.value / 1000)}k km`,        sub: win.factors.moonDistance.phase, f: win.factors.moonDistance },
  ];

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <div>
          <div className="micro" style={{ marginBottom: "6px" }}>
            {win.label} · Window Detail
          </div>
          <div className="detail-panel__title">
            {formatTime(win.startsAt)} → {formatTime(win.endsAt)}
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-ink-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
            {windowDuration(win.startsAt, win.endsAt)} · Visibility {win.visibilityScore.toFixed(1)} / 10 ·{" "}
            <span style={{ color: stateColor(win.conditionState) }}>
              {stateLabel(win.conditionState)}
            </span>
          </div>
        </div>
        <button className="detail-panel__close" onClick={onClose}>
          Close ×
        </button>
      </div>

      <div className="detail-panel__body">
        <div>
          <div className="detail-panel__section-label">
            <span className="micro">Why we think this</span>
          </div>
          <ul className="reasoning-list">
            {win.reasoning.map((r, i) => (
              <li key={i} className="reasoning-item">
                <div className="reasoning-dot" />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="detail-panel__factors">
          {factors.map(({ name, val, sub, f }) => (
            <div key={name} className="detail-panel__factor-row">
              <span className="detail-panel__factor-name">
                {name}
                {sub && <span className="detail-panel__factor-sub">· {sub}</span>}
              </span>
              <div className="detail-panel__factor-right">
                <span className="detail-panel__factor-val">{val}</span>
                <span style={{ fontSize: "0.75rem", color: impactColor(f.impact) }}>
                  {impactIcon(f.impact)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
