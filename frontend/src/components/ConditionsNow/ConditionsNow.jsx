import "./ConditionsNow.css";
import { impactColor, impactIcon } from "../../lib/helpers";
import { COMING_SOON } from "../../lib/constants";

function TideIcon() {
  return (
    <svg viewBox="0 0 24 24"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" /></svg>
  );
}
function WindIcon() {
  return (
    <svg viewBox="0 0 24 24"><path d="M5 8h11a3 3 0 0 0 0-6H5" /><path d="M5 16h14a3 3 0 0 1 0 6H5" /><path d="M3 12h16" /></svg>
  );
}
function TempIcon() {
  return (
    <svg viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
  );
}

function Tile({ label, icon, impact }) {
  return (
    <div className="conditions__tile">
      <div className="conditions__tile-head">
        <span className="micro">{label}</span>
        <span className="conditions__tile-icon">{icon}</span>
      </div>
      <div className="conditions__tile-val">{COMING_SOON}</div>
      <div className="conditions__tile-sub">{COMING_SOON}</div>
      <div className="conditions__tile-impact" style={{ color: impactColor(impact) }}>
        {impactIcon(impact)} {COMING_SOON}
      </div>
    </div>
  );
}

export default function ConditionsNow({ factors }) {
  return (
    <section className="conditions reveal reveal-3">
      <div className="conditions__heading">
        <span className="micro">Conditions Now</span>
      </div>
      <div className="conditions__grid">
        <Tile label="Tide" icon={<TideIcon />} impact={factors.tide.impact} />
        <Tile label="Wind" icon={<WindIcon />} impact={factors.wind.impact} />
        <Tile label="Water Temp" icon={<TempIcon />} impact={factors.waterTemp.impact} />
        <Tile label="Moon" icon={<MoonIcon />} impact={factors.moonDistance.impact} />
      </div>
    </section>
  );
}
