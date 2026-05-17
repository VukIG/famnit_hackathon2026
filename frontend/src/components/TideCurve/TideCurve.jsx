import "./TideCurve.css";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceArea, ResponsiveContainer,
} from "recharts";
import { COMING_SOON } from "../../lib/constants";

function TideTooltip({ active }) {
  if (!active) return null;
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
      <div>{COMING_SOON}</div>
    </div>
  );
}

export default function TideCurve({ data }) {
  return (
    <section className="tide-curve reveal reveal-4">
      <div className="tide-curve__heading">
        <span className="micro">Tide Curve / {COMING_SOON}</span>
      </div>
      <div className="tide-curve__card">
        <div className="tide-curve__sub">
          <span className="micro">Optimal window {COMING_SOON}</span>
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
              tickFormatter={() => COMING_SOON}
            />
            <Tooltip content={<TideTooltip />} />
            <ReferenceArea
              x1="Coming soon" x2="Coming soon"
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
          {["Next Low", "Next High", "Range", "Datum"].map((label) => (
            <div className="tide-curve__kv-item" key={label}>
              <span className="micro">{label}</span>
              <div className="tide-curve__kv-val">{COMING_SOON}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
