import "./ClearanceCard.css";

export default function ClearanceCard({ verdict, score, scoreMax = 100, headline, description, warning }) {
  if (!verdict) {
    return (
      <section className="clearance-card">
        <div className="clearance-card__loading micro">Loading data…</div>
      </section>
    );
  }
  const stateClass = verdict === "GO" ? "good" : verdict === "WAIT" ? "wait" : "poor";
  return (
    <section className="clearance-card">
      <div className="clearance-card__main">
        <div className={`clearance-card__badge clearance-card__badge--${stateClass}`}>{verdict}</div>
        <div className="clearance-card__body">
          <div className="micro">{headline}</div>
          <p className="clearance-card__desc">{description}</p>
        </div>
        <div className="clearance-card__score">
          <div className={`clearance-card__score-num clearance-card__score-num--${stateClass}`}>{score}</div>
          <div className="micro">CLARITY SCORE / {scoreMax}</div>
        </div>
      </div>
      {warning && (
        <div className="clearance-card__warning">
          <span>⚠</span> {warning}
        </div>
      )}
    </section>
  );
}
