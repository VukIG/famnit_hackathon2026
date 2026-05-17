import { moonPhaseName, moonEmoji } from '../utils/moonPhase';

// Renders the moon phase card with real backend data.
export function MoonCard({ features }) {
  const phase = features?.moonPhase;
  const phaseName = moonPhaseName(phase);
  const emoji = moonEmoji(phase);

  return (
    <div className="factor-tile">
      <div className="factor-icon">{emoji}</div>
      <div className="factor-name">Moon</div>
      <div className="factor-value" style={{ fontSize: '0.95rem' }}>
        {phaseName}
      </div>
      {phase != null && (
        <div className="factor-sub">{Math.round(phase * 100)}% cycle</div>
      )}
      <div className="factor-impact" style={{ color: 'var(--ink-muted)' }}>Neutral</div>
    </div>
  );
}
