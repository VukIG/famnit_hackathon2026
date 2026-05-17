import "./ConfidenceDial.css";

export default function ConfidenceDial({ value, size = 132 }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -220;
  const sweep = 260;
  const pct = Math.round(value * 100);
  const filled = (pct / 100) * sweep;

  function polarToXY(angleDeg, radius) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function arcPath(startDeg, endDeg, radius) {
    const s = polarToXY(startDeg, radius);
    const e = polarToXY(endDeg, radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackD = arcPath(startAngle, startAngle + sweep, r);
  const fillD = pct > 0 ? arcPath(startAngle, startAngle + filled, r) : null;
  const fontSize = size * 0.22;

  return (
    <div className="confidence-dial">
      <svg className="confidence-dial__svg" width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`}>
        <path className="confidence-dial__track" d={trackD} />
        {fillD && <path className="confidence-dial__fill" d={fillD} />}
        <text className="confidence-dial__label" x={cx} y={cy - fontSize * 0.6} fontSize={9}> CONFIDENCE</text>
        <text className="confidence-dial__pct" x={cx} y={cy + fontSize * 0.15} fontSize={fontSize}>{pct}%</text>
      </svg>
    </div>
  );
}
