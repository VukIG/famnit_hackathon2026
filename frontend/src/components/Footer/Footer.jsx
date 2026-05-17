import "./Footer.css";
import { COMING_SOON } from "../../lib/constants";

export default function Footer() {
  return (
    <footer className="footer">
      <span className="micro">Last updated {COMING_SOON}</span>
      <span className="micro">Source metadata {COMING_SOON}</span>
    </footer>
  );
}
