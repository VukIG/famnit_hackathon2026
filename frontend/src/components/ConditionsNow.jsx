import { TideCard } from './TideCard';
import { WindCard } from './WindCard';
import { WaterTempCard } from './WaterTempCard';
import { MoonCard } from './MoonCard';

// Container for the four real-time conditions cards.
export function ConditionsNow({ features, loading }) {
  if (loading && !features) {
    return (
      <div className="factor-strip">
        {['Tide', 'Wind', 'Water temp', 'Moon'].map((name) => (
          <div key={name} className="factor-tile">
            <div className="factor-name">{name}</div>
            <div className="factor-value" style={{ color: 'var(--ink-muted)' }}>—</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="factor-strip">
      <TideCard features={features} />
      <WindCard features={features} />
      <WaterTempCard features={features} />
      <MoonCard features={features} />
    </div>
  );
}
