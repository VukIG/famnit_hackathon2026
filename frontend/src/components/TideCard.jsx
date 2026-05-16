import { statusBadge } from '../utils/statusBadge';

const toneColor = {
  good: 'var(--accent)',
  marginal: 'var(--warn)',
  poor: 'var(--danger)',
  neutral: 'var(--ink-muted)',
};

// Renders the tide conditions card with real backend data.
export function TideCard({ features }) {
  const height = features?.nextTideHeightM;
  const type = features?.nextTideType;

  const displayHeight = height == null ? '—' : Math.abs(height).toFixed(1);
  const direction = type === 'high' ? 'Rising' : type === 'low' ? 'Falling' : '—';
  const status = statusBadge(height == null ? null : Math.abs(height), 0.3, 0.6);

  return (
    <div className="factor-tile">
      <div className="factor-icon">🌊</div>
      <div className="factor-name">Tide</div>
      <div className="factor-value">
        {displayHeight}<span className="factor-unit"> m</span>
      </div>
      {direction !== '—' && <div className="factor-sub">{direction}</div>}
      <div className="factor-impact" style={{ color: toneColor[status.tone] }}>
        {status.label}
      </div>
    </div>
  );
}
