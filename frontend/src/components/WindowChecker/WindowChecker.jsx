import { useState, useRef, useEffect } from "react";
import "./WindowChecker.css";

export default function WindowChecker() {
  const now = new Date();
  const [pickerDay,   setPickerDay]   = useState(String(now.getDate()).padStart(2, "0"));
  const [pickerMonth, setPickerMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [pickerYear,  setPickerYear]  = useState(String(now.getFullYear()));
  const [pickerHour,  setPickerHour]  = useState(String(now.getHours()).padStart(2, "0"));
  const [pickerMin,   setPickerMin]   = useState(String(now.getMinutes()).padStart(2, "0"));
  const [pickerOpen,  setPickerOpen]  = useState(null);
  const [status, setStatus] = useState({ msg: "", type: "" });
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCheck = async () => {
    const d = parseInt(pickerDay, 10);
    const mo = parseInt(pickerMonth, 10);
    const y = parseInt(pickerYear, 10);
    const h = parseInt(pickerHour, 10);
    const mi = parseInt(pickerMin, 10);
    if (!d || !mo || !y || isNaN(h) || isNaN(mi)) {
      setStatus({ msg: "Fill in all date and time fields.", type: "err" });
      return;
    }
    const date = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const timeOfDay = `${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}:00`;
    setLoading(true);
    setStatus({ msg: "Querying forecast engine…", type: "" });
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time: timeOfDay }),
      });
      if (response.ok) {
        setStatus({ msg: "Forecast received.", type: "ok" });
      } else {
        setStatus({ msg: "Server returned an error.", type: "err" });
      }
    } catch {
      setStatus({ msg: "Network error — showing cached forecast.", type: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="wc reveal reveal-3">
      {/* Left card — input */}
      <div className="wc__card" ref={pickerRef}>
        <div className="wc__title">
          <span className="micro">When are you thinking?</span>
        </div>
        <div className="wc__inputs">
          {/* DAY */}
          <div className="wc__group">
            <span className="wc__input-label">Day</span>
            <input className="wc__input" type="number" min="1" max="31"
              placeholder="DD" value={pickerDay}
              onChange={e => setPickerDay(e.target.value)}
              onFocus={() => setPickerOpen("day")} />
            {pickerOpen === "day" && (
              <div className="wc__dropdown">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(v => {
                  const val = String(v).padStart(2, "0");
                  return (
                    <div key={v} className={`wc__option${pickerDay === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerDay(val); setPickerOpen(null); }}>
                      {val}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <span className="wc__sep">/</span>

          {/* MONTH */}
          <div className="wc__group">
            <span className="wc__input-label">Month</span>
            <input className="wc__input" type="number" min="1" max="12"
              placeholder="MM" value={pickerMonth}
              onChange={e => setPickerMonth(e.target.value)}
              onFocus={() => setPickerOpen("month")} />
            {pickerOpen === "month" && (
              <div className="wc__dropdown">
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((name, i) => {
                  const val = String(i + 1).padStart(2, "0");
                  return (
                    <div key={i} className={`wc__option${pickerMonth === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerMonth(val); setPickerOpen(null); }}>
                      {val} · {name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <span className="wc__sep">/</span>

          {/* YEAR */}
          <div className="wc__group">
            <span className="wc__input-label">Year</span>
            <input className="wc__input wc__input--year" type="number" min="2024" max="2099"
              placeholder="YYYY" value={pickerYear}
              onChange={e => setPickerYear(e.target.value)}
              onFocus={() => setPickerOpen("year")} />
            {pickerOpen === "year" && (
              <div className="wc__dropdown">
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(y => (
                  <div key={y} className={`wc__option${pickerYear === String(y) ? " active" : ""}`}
                    onMouseDown={e => { e.preventDefault(); setPickerYear(String(y)); setPickerOpen(null); }}>
                    {y}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="wc__divider" />

          {/* HOUR */}
          <div className="wc__group">
            <span className="wc__input-label">Hour</span>
            <input className="wc__input" type="number" min="0" max="23"
              placeholder="HH" value={pickerHour}
              onChange={e => setPickerHour(e.target.value)}
              onFocus={() => setPickerOpen("hour")} />
            {pickerOpen === "hour" && (
              <div className="wc__dropdown">
                {Array.from({ length: 24 }, (_, i) => i).map(h => {
                  const val = String(h).padStart(2, "0");
                  return (
                    <div key={h} className={`wc__option${pickerHour === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerHour(val); setPickerOpen(null); }}>
                      {val}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <span className="wc__sep wc__sep--bio">:</span>

          {/* MINUTE */}
          <div className="wc__group">
            <span className="wc__input-label">Min</span>
            <input className="wc__input" type="number" min="0" max="59"
              placeholder="MM" value={pickerMin}
              onChange={e => setPickerMin(e.target.value)}
              onFocus={() => setPickerOpen("min")} />
            {pickerOpen === "min" && (
              <div className="wc__dropdown">
                {Array.from({ length: 12 }, (_, i) => i * 5).map(m => {
                  const val = String(m).padStart(2, "0");
                  return (
                    <div key={m} className={`wc__option${pickerMin === val ? " active" : ""}`}
                      onMouseDown={e => { e.preventDefault(); setPickerMin(val); setPickerOpen(null); }}>
                      {val}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button className="wc__btn" onClick={handleCheck} disabled={loading}>
            {loading ? "Checking…" : "Check conditions"}
          </button>
        </div>
        <div className="micro wc__hint">Range queried · ±90 min</div>
        {status.msg && (
          <div className={`wc__status${status.type ? " " + status.type : ""}`}>
            {status.msg}
          </div>
        )}
      </div>

      {/* Right card — verdict placeholder */}
      <div className="wc__card wc__result">
        <div className="wc__empty">
          <p className="wc__empty-text">Select a date and time,<br />then check conditions.</p>
        </div>
      </div>
    </section>
  );
}
