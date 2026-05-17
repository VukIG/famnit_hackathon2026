import "./DayStrip.css";
import { stateColor, stateBg } from "../../lib/helpers";
import { COMING_SOON } from "../../lib/constants";

export default function DayStrip({ windows, selectedId, onSelect }) {
  return (
    <section className="day-strip reveal reveal-5">
      <div className="day-strip__heading">
        <span className="micro">Coming Up</span>
      </div>
      <div className="day-strip__scroll">
        {windows.map((win, i) => {
          const color = stateColor(win.conditionState);
          const bg = stateBg(win.conditionState);
          const barHeight = 60 + win.confidence * 50;
          const isActive = selectedId === win.id;
          return (
            <div
              key={win.id}
              className={`day-strip__card${isActive ? " active" : ""}`}
              onClick={() => onSelect(win.id)}
              role="button"
              tabIndex={0}
            >
              <div className={`day-strip__day${i === 0 ? " day-strip__day--today" : ""}`}>
                {COMING_SOON}
              </div>
              <div className="day-strip__bar-wrap">
                <div
                  className="day-strip__bar"
                  style={{
                    height: barHeight,
                    background: color,
                    boxShadow: `0 0 8px ${color}88`,
                  }}
                />
              </div>
              <div className="day-strip__range">{COMING_SOON}</div>
              <div
                className="day-strip__badge"
                style={{ background: bg, color }}
              >
                {COMING_SOON}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
