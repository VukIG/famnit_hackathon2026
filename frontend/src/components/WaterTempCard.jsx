// Renders the water temperature card with real backend data.
export function WaterTempCard({ features }) {
  const temp = features?.waterTemperatureC;
  const displayTemp = temp == null ? '—' : Math.round(temp);

  let label = '—', color = 'var(--ink-muted)';
  if (temp != null) {
    if (temp >= 18) { label = 'Good'; color = 'var(--accent)'; }
    else if (temp >= 14) { label = 'Marginal'; color = 'var(--warn)'; }
    else { label = 'Poor'; color = 'var(--danger)'; }
  }

  return (
    <div className="factor-tile">
      <div className="factor-icon">🌡</div>
      <div className="factor-name">Water temp</div>
      <div className="factor-value">
        {displayTemp}<span className="factor-unit">°C</span>
      </div>
      <div className="factor-impact" style={{ color }}>{label}</div>
    </div>
  );
}
