import SourceTag from "../SourceTag/SourceTag";
import "./DataTile.css";

export default function DataTile({ label, value, unit, sub, status, source }) {
  return (
    <div className="data-tile">
      <div className="data-tile__head">
        <span className="micro">{label}</span>
        <SourceTag source={source} />
      </div>
      <div className="data-tile__val">
        {value ?? "—"}
        {value != null && unit && <span className="data-tile__unit">{unit}</span>}
      </div>
      {sub && <div className="data-tile__sub micro">{sub}</div>}
      {status && (
        <div className={`data-tile__status data-tile__status--${status.state}`}>
          {status.label}
        </div>
      )}
    </div>
  );
}
