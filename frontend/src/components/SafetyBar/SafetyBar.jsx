import "./SafetyBar.css";

export default function SafetyBar({ label, percent, sub }) {
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="safety-bar">
      <div className="safety-bar__head">
        <span className="micro">{label}</span>
        <span className="safety-bar__pct">{percent != null ? `${clamped}%` : "—"}</span>
      </div>
      <div className="safety-bar__track">
        <div className="safety-bar__fill" style={{ width: `${clamped}%` }} />
      </div>
      {sub && <div className="safety-bar__sub micro">{sub}</div>}
    </div>
  );
}
