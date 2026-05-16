// Categorizes a value against three thresholds into a status label.
export function statusBadge(value, goodMax, marginalMax) {
  if (value === null || value === undefined) return { label: '—', tone: 'neutral' };
  if (value <= goodMax) return { label: 'Good', tone: 'good' };
  if (value <= marginalMax) return { label: 'Marginal', tone: 'marginal' };
  return { label: 'Poor', tone: 'poor' };
}
