import "./SectionHeader.css";

export default function SectionHeader({ kicker, title, meta, feedStatus }) {
  return (
    <header className="section-header">
      <div className="section-header__left">
        <div className="micro">{kicker}</div>
        <h2 className="section-header__title">{title}</h2>
        {meta && <div className="section-header__meta">{meta}</div>}
      </div>
      {feedStatus && (
        <div className="section-header__feed">
          <span className="section-header__feed-dot" data-state={feedStatus.state} />
          <span className="micro">{feedStatus.label}</span>
        </div>
      )}
    </header>
  );
}
