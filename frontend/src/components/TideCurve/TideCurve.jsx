import "./TideCurve.css";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceArea, ResponsiveContainer,
} from "recharts";
import { formatTime } from "../../lib/helpers";

function TideTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--color-marine)",
      border: "1px solid var(--color-hairline)",
      borderRadius: "var(--card-radius)",
      padding: "8px 14px",
      fontFamily: "var(--font-mono)",
      fontSize: "0.8125rem",
      color: "var(--color-ink)",
    }}>
      <div style={{ color: "var(--color-ink-muted)", fontSize: "0.7rem" }}>{payload[0]?.payload?.time}</div>
      <div>{payload[0]?.value?.toFixed(1)} m</div>
    </div>
  );
}

export default function TideCurve({ data, optimalStart, optimalEnd, conditions }) {
  const startTime = formatTime(optimalStart);
  const endTime = formatTime(optimalEnd);

  return (
    <section className="tide-curve reveal reveal-4">
      <div className="tide-curve__heading">
        <span className="micro">Tide Curve — Today</span>
      </div>
      <div className="tide-curve__card">
        <div className="tide-curve__sub">
          <span className="micro">Optimal window {startTime} – {endTime} highlighted</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5FF3D6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#5FF3D6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fill: "rgba(180,210,220,0.55)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(180,210,220,0.10)" }}
              interval={2}
            />
            <YAxis
              tick={{ fill: "rgba(180,210,220,0.55)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}m`}
            />
            <Tooltip content={<TideTooltip />} />
            <ReferenceArea
              x1="14:00" x2="16:00"
              fill="rgba(95,243,214,0.08)"
              stroke="rgba(95,243,214,0.25)"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="level"
              stroke="#5FF3D6"
              strokeWidth={2}
              fill="url(#tideGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#5FF3D6", stroke: "none" }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="tide-curve__kv">
          <div className="tide-curve__kv-item">
            <span className="micro">Next Low</span>
            <div className="tide-curve__kv-val">12:00</div>
          </div>
          <div className="tide-curve__kv-item">
            <span className="micro">Next High</span>
            <div className="tide-curve__kv-val">20:00</div>
          </div>
          <div className="tide-curve__kv-item">
            <span className="micro">Range</span>
            <div className="tide-curve__kv-val">1.5 m</div>
          </div>
          <div className="tide-curve__kv-item">
            <span className="micro">Datum</span>
            <div className="tide-curve__kv-val">LAT</div>
          </div>
        </div>
      </div>
    </section>
  );
}
