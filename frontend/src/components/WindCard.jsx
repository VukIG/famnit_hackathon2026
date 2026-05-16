import { statusBadge } from '../utils/statusBadge';
import { compassLabel } from '../utils/windDirection';

const toneColor = {
  good: 'var(--accent)',
  marginal: 'var(--warn)',
  poor: 'var(--danger)',
  neutral: 'var(--ink-muted)',
};

// Renders the wind conditions card with real backend data.
export function WindCard({ features }) {
  const speed = features?.windSpeedKmh;
  const degrees = features?.windDirectionDeg;

  const displaySpeed = speed == null ? '—' : Math.round(speed);
  const compass = compassLabel(degrees);
  const status = statusBadge(speed, 15, 25);

  return (
    <div className="factor-tile">
      <div className="factor-icon">💨</div>
      <div className="factor-name">Wind</div>
      <div className="factor-value">
        {displaySpeed}<span className="factor-unit"> km/h</span>
      </div>
      <div className="factor-sub">{compass}</div>
      <div className="factor-impact" style={{ color: toneColor[status.tone] }}>
        {status.label}
      </div>
    </div>
  );
}
