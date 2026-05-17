import "./Hero.css";
import ConfidenceDial from "../ConfidenceDial/ConfidenceDial";
import { COMING_SOON } from "../../lib/constants";

export default function Hero({ window: win }) {
  return (
    <section className="hero reveal reveal-2">
      <div>
        <div className="hero__micro">
          <div className="hero__dot bio-dot" />
          <span className="micro micro-bio">Next Optimal Window</span>
        </div>
        <h1 className="hero__h1">{COMING_SOON}</h1>
        <div className="hero__sub">
          <span>
            Window <span className="hero__sub-val">{COMING_SOON}</span>
          </span>
          <span className="hero__sub-sep">/</span>
          <span>
            Visibility <span className="hero__sub-val">{COMING_SOON}</span>
          </span>
        </div>
      </div>
      <div className="hero__dial-wrap">
        <ConfidenceDial value={win.confidence} size={172} />
      </div>
      <div className="hero__scroll-cue">
        <span className="micro">Descend</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v10M4 9l4 4 4-4" />
        </svg>
      </div>
    </section>
  );
}
