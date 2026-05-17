import "./Header.css";
import { COMING_SOON } from "../../lib/constants";

export default function Header() {
  const dateStr = new Date()
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    .toUpperCase();

  return (
    <header className="header reveal reveal-1">
      <div className="header__wordmark">
        You<sup>(R)</sup> Sea
      </div>
      <div className="header__pills">
        <span className="header__pill">/ {COMING_SOON}</span>
        <span className="header__pill">{dateStr}</span>
      </div>
    </header>
  );
}
