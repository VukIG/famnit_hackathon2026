import "./DetailPanel.css";
import { impactColor, impactIcon } from "../../lib/helpers";
import { COMING_SOON } from "../../lib/constants";

export default function DetailPanel({ window: win, onClose }) {
  const factors = [
    { name: "Tide", f: win.factors.tide },
    { name: "Wind", f: win.factors.wind },
    { name: "Water Temp", f: win.factors.waterTemp },
    { name: "Moon", f: win.factors.moonDistance },
  ];

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <div>
          <div className="micro" style={{ marginBottom: "6px" }}>
            {COMING_SOON}
          </div>
          <div className="detail-panel__title">{COMING_SOON}</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-ink-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
            {COMING_SOON}
          </div>
        </div>
        <button className="detail-panel__close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="detail-panel__body">
        <div>
          <div className="detail-panel__section-label">
            <span className="micro">Why we think this</span>
          </div>
          <ul className="reasoning-list">
            <li className="reasoning-item">
              <div className="reasoning-dot" />
              {COMING_SOON}
            </li>
          </ul>
        </div>
        <div className="detail-panel__factors">
          {factors.map(({ name, f }) => (
            <div key={name} className="detail-panel__factor-row">
              <span className="detail-panel__factor-name">
                {name}
                <span className="detail-panel__factor-sub"> / {COMING_SOON}</span>
              </span>
              <div className="detail-panel__factor-right">
                <span className="detail-panel__factor-val">{COMING_SOON}</span>
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
