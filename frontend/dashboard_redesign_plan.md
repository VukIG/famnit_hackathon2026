# Dashboard Redesign Plan — Match the Teal-Gradient System

> **For Claude Code in VS Code.** Read this end-to-end before touching code. The redesigned `App.jsx` (visibility check page) is now the source of truth for the design system. The dashboard must look like it was built by the same designer on the same day.

---

## Mission

The current `/dashboard` page (HYDROCLEAR · Water Clarity Monitor) uses a rainbow accent palette (green / cyan / purple / orange / red bars), a black background, and inconsistent typography. It looks like a different product than the now-redesigned main page.

Port it to the **same teal-gradient design language** as `App.jsx` (Fraunces serif headlines, IBM Plex Mono labels, single mint accent, glassmorphism cards on teal gradient).

Additional requirements:

1. **Two clearly-labelled sections.** Top half = **sensor data** (NIB MBP "Vida" buoy + ARSO feeds). Bottom half = **satellite analysis data** (Copernicus / ESA marine or whichever satellite source the existing code uses). Every card must carry a small tag indicating its source so a user can never confuse the two.
2. **Zero hardcoded data.** Every value must come from a real API call (or the existing data layer). No literal `0.72`, no inline `2.47 NTU`, no placeholder strings. If a field doesn't have a value yet, render a `—` and a `.micro` "no data" label, not a fake number.
3. **Shared navbar / React Router.** A single persistent navbar lets the user move between the main visibility check page (`/`) and the dashboard (`/dashboard`).
4. **All APIs remain functional.** Same endpoints, same request shapes, same response handling.

---

## Hard Constraints — DO NOT VIOLATE

- DO NOT modify any `fetch(...)`, `axios(...)`, or API endpoint URL.
- DO NOT change any `useState` / `useEffect` / `useRef` signature, initial value, or dependency array.
- DO NOT change the shape of any prop or any data field name.
- DO NOT introduce hardcoded numeric values, status strings, or mock data into JSX. Bindings only.
- DO NOT add a new color outside the established palette (`--accent`, `--state-good`, `--state-wait`, `--state-poor`, `--ink*` family). The old multi-color (purple, cyan, orange) accents must all collapse to one of these.
- DO NOT touch internals of `ConfidenceGauge`, `Recharts` data wiring, or any helper in `src/lib/`.
- After every section port, run `npm run dev` and verify zero console errors before moving to the next.

---

## Phase 1 — Inspect Both Sides

Run from repo root and report findings **before editing**:

```bash
cd frontend
ls -la src/
ls -la src/pages 2>/dev/null || ls -la src/components/Dashboard 2>/dev/null
cat src/App.jsx
cat src/index.css | head -100
# Find the dashboard entry point
grep -rn "Dashboard\|HydroClear\|hydroclear\|HYDROCLEAR" src/ -l
# Find every API the dashboard calls
grep -rn "fetch(\|axios" src/ --include="*.jsx" --include="*.js" --include="*.tsx" --include="*.ts"
# Find every hardcoded numeric literal inside the dashboard JSX (smell-check)
grep -rn -E '>[0-9]+\.[0-9]+|[0-9]+\s*(NTU|mg/m|mg/L|km/h|m/s|PSU|°C)' src/ | head -40
```

**Report items:**

1. The exact file path of the dashboard root component.
2. Every API endpoint URL the dashboard hits, the request shape, the response shape.
3. The exact data fields each card currently reads (e.g. `data.sensors.turbidity.value`, `data.satellite.waves.height`, etc.).
4. Which existing reusable components from `App.jsx` can be reused (`Header`, `Footer`, the `.conditions__tile` styles, the chart styling from `TideCurve`).
5. Whether `react-router-dom` is already installed (`grep "react-router" package.json`).
6. Any hardcoded literals inside the dashboard JSX — list them; they all have to go.

---

## Phase 2 — React Router + Shared Navbar

### 2.1 Install router (if not present)

```bash
npm install react-router-dom
```

### 2.2 Wire routes

In `src/main.jsx` (or wherever `<App />` mounts), wrap with `BrowserRouter`:

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import App from "./App";
import Dashboard from "./pages/Dashboard/Dashboard"; // adapt to actual path

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
```

### 2.3 Create `Layout.jsx`

A single layout that owns the persistent navbar + footer. Routes render in its `<Outlet />`.

```jsx
import { Outlet } from "react-router-dom";
import Header from "../Header/Header";
import Footer from "../Footer/Footer";

export default function Layout() {
  return (
    <>
      <Header />
      <main className="container"><Outlet /></main>
      <Footer />
    </>
  );
}
```

> If `Header` / `Footer` currently receive `locationName` / `generatedAt` as props from `App.jsx`, lift that fetch up into `Layout` (or a route loader / context) so both pages share it. Don't duplicate the call.

### 2.4 Upgrade `Header.jsx` with nav links

Keep the existing wordmark and pills. Insert nav links between them.

```jsx
import { NavLink } from "react-router-dom";

// inside Header JSX, between wordmark and pills:
<nav className="header__nav">
  <NavLink to="/" end className={({ isActive }) => `header__nav-link${isActive ? " header__nav-link--active" : ""}`}>
    Predict
  </NavLink>
  <NavLink to="/dashboard" className={({ isActive }) => `header__nav-link${isActive ? " header__nav-link--active" : ""}`}>
    Dashboard
  </NavLink>
</nav>
```

CSS additions to `Header.css`:

```css
.header__nav {
  display: flex;
  gap: 24px;
  margin-left: auto;
  margin-right: 24px;
}
.header__nav-link {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-muted);
  text-decoration: none;
  padding: 6px 0;
  border-bottom: 1px solid transparent;
  transition: all 0.15s ease;
}
.header__nav-link:hover { color: var(--ink); }
.header__nav-link--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
```

---

## Phase 3 — Dashboard Structure

The dashboard has **two top-level sections**, each with its own intro header and its own sub-sections. The reader must never lose track of which data source they're looking at.

```
┌─ Header (shared navbar) ───────────────────────────────────────┐

┌─ SENSOR · IN-SITU READINGS ─────────────────────────────────── ┐
│  [section intro: coords · depth · reading window · feed dot]   │
│  [dive clearance card]                                         │
│  [live sensor snapshot — 4–5 tiles]                            │
│  [latest sensor card row]                                      │
│  [safety bars row]                                             │
│  [turbidity time-series chart — primary]                       │
│  [wave height + wind speed charts — side by side]              │
│  [sea surface temp chart]                                      │
└────────────────────────────────────────────────────────────────┘

┌─ SATELLITE · OCEAN DATA ────────────────────────────────────── ┐
│  [section intro: coords · depth band · acquisition timestamp]  │
│  [satellite clearance card]                                    │
│  [water clarity tiles — turbidity, chlorophyll, particles]     │
│  [wave conditions tiles — height, swell, wind waves, period]   │
│  [ocean currents tiles — speed, direction]                     │
│  [environmental context tiles — ocean temp, salinity]          │
│  [depth structure / mixed layer depth viz]                     │
└────────────────────────────────────────────────────────────────┘

┌─ Footer (shared) ──────────────────────────────────────────────┐
```

Every tile in the satellite half must carry a small `satellite` micro-tag pill in its header. Every tile in the sensor half must carry a `sensor` micro-tag pill (or `live` for real-time readings). This is non-negotiable — it's what makes the two halves legible at a glance.

---

## Phase 4 — Section Components

### 4.1 Section Header (reusable)

Create `src/components/SectionHeader/SectionHeader.jsx`:

```jsx
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
```

CSS:

```css
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 56px 0 24px;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 32px;
}
.section-header__title {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 400;
  margin: 8px 0 4px;
  color: var(--ink);
}
.section-header__meta {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-muted);
}
.section-header__feed {
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-header__feed-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--state-good);
  box-shadow: 0 0 10px currentColor;
}
.section-header__feed-dot[data-state="wait"] { background: var(--state-wait); }
.section-header__feed-dot[data-state="poor"] { background: var(--state-poor); }
```

Usage:

```jsx
<SectionHeader
  kicker="SENSOR · IN-SITU READINGS"
  title={sensorData.locationName}
  meta={`${sensorData.coords} · Depth ${sensorData.depth} m · Window ${sensorData.windowLabel}`}
  feedStatus={{ state: sensorData.feedHealth, label: `${sensorData.readingCount} readings` }}
/>
```

### 4.2 Source Tag (reusable)

A tiny pill that goes inside every data card to mark its origin:

```jsx
// src/components/SourceTag/SourceTag.jsx
export default function SourceTag({ source }) {
  // source: "sensor" | "live" | "satellite"
  return <span className={`source-tag source-tag--${source}`}>{source}</span>;
}
```

```css
.source-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--ink-muted);
}
.source-tag--live { color: var(--accent); border-color: var(--accent-line); }
.source-tag--satellite { color: var(--ink-muted); }
.source-tag--sensor { color: var(--ink-muted); }
```

### 4.3 Clearance Card (sensor + satellite both use this)

Big visual verdict at the top of each section. Same shape, different inputs.

```jsx
// src/components/ClearanceCard/ClearanceCard.jsx
import "./ClearanceCard.css";

export default function ClearanceCard({ verdict, score, scoreMax = 100, headline, description, warning, source }) {
  // verdict: "GO" | "WAIT" | "NO-GO"  → derive class from this
  const stateClass = verdict === "GO" ? "good" : verdict === "WAIT" ? "wait" : "poor";
  return (
    <section className="clearance-card">
      <div className="clearance-card__main">
        <div className={`clearance-card__badge clearance-card__badge--${stateClass}`}>{verdict}</div>
        <div className="clearance-card__body">
          <div className="micro">{headline}</div>
          <p className="clearance-card__desc">{description}</p>
        </div>
        <div className="clearance-card__score">
          <div className="clearance-card__score-num">{score}</div>
          <div className="micro">CLARITY SCORE / {scoreMax}</div>
        </div>
      </div>
      {warning && (
        <div className="clearance-card__warning">
          <span>⚠</span> {warning}
        </div>
      )}
    </section>
  );
}
```

CSS:

```css
.clearance-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 28px 32px;
  backdrop-filter: blur(8px);
  margin-bottom: 24px;
}
.clearance-card__main { display: grid; grid-template-columns: auto 1fr auto; gap: 32px; align-items: center; }
.clearance-card__badge {
  font-family: var(--font-serif);
  font-size: 2.5rem;
  font-weight: 500;
  padding: 16px 24px;
  border-radius: 6px;
  text-align: center;
  min-width: 100px;
}
.clearance-card__badge--good { background: var(--state-good-bg); color: var(--state-good); border: 1px solid var(--accent-line); }
.clearance-card__badge--wait { background: var(--state-wait-bg); color: var(--state-wait); }
.clearance-card__badge--poor { background: var(--state-poor-bg); color: var(--state-poor); }
.clearance-card__desc { color: var(--ink); margin: 4px 0 0; font-size: 0.95rem; }
.clearance-card__score-num { font-family: var(--font-serif); font-size: 4rem; line-height: 1; color: var(--state-good); font-weight: 300; }
.clearance-card__warning {
  margin-top: 20px;
  padding: 12px 16px;
  border: 1px solid var(--state-wait);
  background: var(--state-wait-bg);
  border-radius: 6px;
  color: var(--state-wait);
  font-family: var(--font-mono);
  font-size: 0.8rem;
}
```

> **Critical:** `verdict`, `score`, `headline`, `description`, `warning` all come from the dashboard data layer. Read the existing data shape; do not invent values. If the API doesn't yet return a warning, omit the `warning` prop — don't fake one.

### 4.4 Data Tile (reusable for every metric)

Replaces every colorful card in the current dashboard. One component. One palette. Source tag in the header.

```jsx
// src/components/DataTile/DataTile.jsx
import SourceTag from "../SourceTag/SourceTag";
import "./DataTile.css";

export default function DataTile({ label, value, unit, sub, status, source }) {
  // status: optional { state: "good"|"wait"|"poor", label: string }
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
```

```css
.data-tile {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 20px;
  backdrop-filter: blur(8px);
}
.data-tile__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.data-tile__val { font-family: var(--font-serif); font-size: 2.25rem; font-weight: 300; line-height: 1.05; color: var(--ink); }
.data-tile__unit { font-family: var(--font-mono); font-size: 0.8rem; color: var(--ink-muted); margin-left: 4px; }
.data-tile__sub { margin-top: 8px; color: var(--ink-muted); }
.data-tile__status { font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 8px; }
.data-tile__status--good { color: var(--state-good); }
.data-tile__status--wait { color: var(--state-wait); }
.data-tile__status--poor { color: var(--state-poor); }
```

> The current dashboard uses different accent colors per tile (purple/cyan/orange/etc.) — **all of that goes**. Every tile uses this single component. Differentiation comes from the `source` tag and the optional `status` line, never from a unique color per category.

### 4.5 Safety Bar (replaces the rainbow horizontal bars)

The bottom of image 1 has four colored progress bars (blue, purple, orange, green). Collapse to one component, mint-only fill:

```jsx
// src/components/SafetyBar/SafetyBar.jsx
export default function SafetyBar({ label, percent, sub }) {
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="safety-bar">
      <div className="safety-bar__head">
        <span className="micro">{label}</span>
        <span className="safety-bar__pct">{percent != null ? `${clamped}%` : "—"}</span>
      </div>
      <div className="safety-bar__track">
        <div className="safety-bar__fill" style={{ width: `${clamped}%` }} />
      </div>
      {sub && <div className="safety-bar__sub micro">{sub}</div>}
    </div>
  );
}
```

```css
.safety-bar__head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.safety-bar__pct { font-family: var(--font-serif); font-size: 1.5rem; color: var(--accent); }
.safety-bar__track { height: 4px; background: var(--surface-border); border-radius: 2px; overflow: hidden; }
.safety-bar__fill { height: 100%; background: var(--accent); transition: width 0.4s ease; }
.safety-bar__sub { margin-top: 6px; color: var(--ink-faint); }
```

### 4.6 Time-Series Chart (sensor section)

Reuse the styling already proven in `TideCurve`. Wrap in the same surface card.

```jsx
// src/components/SensorChart/SensorChart.jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from "recharts";

export default function SensorChart({ title, dataKey, data, unit, threshold, badge = "PRIMARY", source = "sensor" }) {
  return (
    <section className="sensor-chart">
      <div className="sensor-chart__head">
        <div>
          <div className="micro">{title.toUpperCase()}</div>
          <div className="sensor-chart__sub">{`${dataKey} (${unit}) — raw${threshold != null ? ", with safe-dive threshold" : ""}`}</div>
        </div>
        <div className="sensor-chart__badges">
          <span className="source-tag source-tag--live">{badge}</span>
          <span className="source-tag" data-source={source}>{source}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--surface-border)" strokeDasharray="2 4" />
          <XAxis dataKey="time" tick={{ fill: "var(--ink-faint)", fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "var(--ink-faint)", fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "var(--surface-strong)",
              border: "1px solid var(--surface-border)",
              borderRadius: 6,
              fontFamily: "var(--font-mono)",
            }}
          />
          {threshold != null && (
            <ReferenceLine y={threshold} stroke="var(--state-wait)" strokeDasharray="4 4" label={{ value: `Safe limit (${threshold} ${unit})`, fill: "var(--state-wait)", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
          )}
          <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
```

CSS (reuse same surface treatment as `TideCurve`).

Mount four times in the sensor section, each bound to its existing series data: turbidity (primary, with threshold), wave height, wind speed, sea surface temp. **Do not hardcode any data array** — pass the `data` prop straight from the existing data source.

### 4.7 Depth Structure (Mixed Layer) Viz

The satellite section ends with a vertical-band depth visualization (image 4). Build it as a small custom SVG, mint accent band, mono labels for `0 m`, `mixed layer depth`, `25 m` (or whatever range the data covers). Bind every label and band height to the satellite data — no hardcoded `11.6 m`.

```jsx
export default function DepthStructure({ mixedLayerDepth, maxDepth, diveRange, source = "satellite" }) {
  if (mixedLayerDepth == null) return null; // don't fake it
  const mlPct = (mixedLayerDepth / maxDepth) * 100;
  return (
    <section className="data-tile">
      <div className="data-tile__head">
        <span className="micro">MIXED LAYER DEPTH</span>
        <SourceTag source={source} />
      </div>
      <div className="depth-viz">
        <div className="depth-viz__scale">
          <span>0 m</span>
          <span>{maxDepth} m</span>
        </div>
        <div className="depth-viz__bar">
          <div className="depth-viz__mixed" style={{ width: `${mlPct}%` }} />
          {diveRange && (
            <div
              className="depth-viz__dive"
              style={{ left: `${(diveRange.min / maxDepth) * 100}%`, width: `${((diveRange.max - diveRange.min) / maxDepth) * 100}%` }}
            />
          )}
        </div>
        <div className="depth-viz__caption micro">
          Mixed layer ends at {mixedLayerDepth} m{diveRange ? ` — your dive range (${diveRange.min}–${diveRange.max} m) extends below it` : ""}
        </div>
      </div>
    </section>
  );
}
```

---

## Phase 5 — Wire It Up

In `src/pages/Dashboard/Dashboard.jsx` (or whatever the existing dashboard root is):

```jsx
import { useEffect, useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import ClearanceCard from "../../components/ClearanceCard/ClearanceCard";
import DataTile from "../../components/DataTile/DataTile";
import SafetyBar from "../../components/SafetyBar/SafetyBar";
import SensorChart from "../../components/SensorChart/SensorChart";
import DepthStructure from "../../components/DepthStructure/DepthStructure";
import "./Dashboard.css";

export default function Dashboard() {
  // === KEEP EXISTING DATA FETCH HOOKS VERBATIM ===
  // Whatever useState + useEffect currently fetches sensor + satellite data stays untouched.
  // Bind the JSX below to the same fields the old version was reading.

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} />;

  return (
    <>
      <SectionHeader
        kicker="SENSOR · IN-SITU READINGS"
        title={sensor.title}
        meta={sensor.meta}
        feedStatus={{ state: sensor.feedHealth, label: sensor.feedLabel }}
      />
      <ClearanceCard {...sensor.clearance} source="sensor" />
      <div className="dashboard__tile-grid">
        {sensor.snapshot.map((s) => <DataTile key={s.id} {...s} source="live" />)}
      </div>
      <div className="dashboard__bars">
        {sensor.safety.map((b) => <SafetyBar key={b.id} {...b} />)}
      </div>
      <SensorChart title="Turbidity — Water Clarity Over Time" {...sensor.turbidityChart} badge="PRIMARY" source="sensor" />
      <div className="dashboard__chart-row">
        <SensorChart title="Sea Conditions — Wave Height" {...sensor.waveChart} badge="SAFETY" source="sensor" />
        <SensorChart title="Sea Conditions — Wind Speed" {...sensor.windChart} badge="SAFETY" source="sensor" />
      </div>
      <SensorChart title="Temperature Context" {...sensor.tempChart} badge="ENV" source="sensor" />

      <SectionHeader
        kicker="SATELLITE · OCEAN DATA"
        title={satellite.title}
        meta={satellite.meta}
        feedStatus={{ state: satellite.feedHealth, label: satellite.feedLabel }}
      />
      <ClearanceCard {...satellite.clearance} source="satellite" />
      <div className="dashboard__subgrid">
        <div className="micro dashboard__subgrid-label">WATER CLARITY</div>
        <div className="dashboard__tile-grid">
          {satellite.clarity.map((s) => <DataTile key={s.id} {...s} source="satellite" />)}
        </div>
      </div>
      <div className="dashboard__subgrid">
        <div className="micro dashboard__subgrid-label">WAVE CONDITIONS</div>
        <div className="dashboard__tile-grid">
          {satellite.waves.map((s) => <DataTile key={s.id} {...s} source="satellite" />)}
        </div>
      </div>
      <div className="dashboard__subgrid">
        <div className="micro dashboard__subgrid-label">OCEAN CURRENTS</div>
        <div className="dashboard__tile-grid">
          {satellite.currents.map((s) => <DataTile key={s.id} {...s} source="satellite" />)}
        </div>
      </div>
      <div className="dashboard__subgrid">
        <div className="micro dashboard__subgrid-label">ENVIRONMENTAL CONTEXT</div>
        <div className="dashboard__tile-grid">
          {satellite.environment.map((s) => <DataTile key={s.id} {...s} source="satellite" />)}
        </div>
      </div>
      {satellite.depthStructure && <DepthStructure {...satellite.depthStructure} source="satellite" />}
    </>
  );
}
```

> **The shape of `sensor` and `satellite` objects above is illustrative.** Read the existing dashboard component first, see what the data actually looks like, and adapt the bindings. If the existing data is flatter (e.g., `data.turbidity.value` not `data.sensor.clarity[0].value`), do **not** restructure the data — restructure the JSX to read it directly. The data layer is sacred; only the rendering changes.

CSS:

```css
.dashboard__tile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
.dashboard__chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.dashboard__bars { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin: 24px 0 32px; }
.dashboard__subgrid { margin-bottom: 28px; }
.dashboard__subgrid-label { margin-bottom: 12px; display: block; }

@media (max-width: 768px) {
  .dashboard__chart-row { grid-template-columns: 1fr; }
}
```

---

## Phase 6 — Cleanup

- Remove all old dashboard CSS that defined the green/cyan/purple/orange/red palette. Replace with imports of the shared system.
- `grep -rn -E "#[0-9a-fA-F]{6}" src/pages/Dashboard src/components/Dashboard 2>/dev/null` — every hex literal outside `index.css` should now be either a CSS variable or gone. Inspect remaining hex matches.
- `grep -rn -E '"[0-9]+\.[0-9]+"|>[0-9]+\.[0-9]+' src/pages/Dashboard 2>/dev/null` — should return zero matches. Any hardcoded numeric literals still inside JSX are bugs.
- Confirm `WindowChecker` and any other dead components from the previous redesign are not referenced (`grep -rn "WindowChecker" src/`).
- If the dashboard had its own duplicate copy of any helper that now exists in `lib/helpers.js`, delete the duplicate and import the shared one.

---

## Phase 7 — Verification

```bash
cd frontend
npm install
npm run dev
```

Walk through both routes:

**Main page (`/`):**
- [ ] Page still works exactly as it did after the first redesign (smoke check; no regressions).
- [ ] Navbar shows "Predict" highlighted in mint, "Dashboard" muted.

**Dashboard (`/dashboard`):**
- [ ] Same teal-gradient background as `/`.
- [ ] Navbar shows "Dashboard" highlighted, "Predict" muted.
- [ ] Two distinct `SectionHeader` blocks separate sensor from satellite.
- [ ] Every data card has a small source tag in its header (`live`, `sensor`, or `satellite`).
- [ ] No purple / cyan / orange / red accents anywhere. Only mint + the three state colors.
- [ ] All clearance card numbers and verdicts come from real API responses (Network tab shows the calls).
- [ ] All tiles show real values; no `undefined`, `NaN`, or hardcoded literal numbers.
- [ ] If a value is missing, tile shows `—` and a `.micro` "no data" label.
- [ ] All four sensor charts render real time-series, not flat lines or empty.
- [ ] DepthStructure renders only when `mixedLayerDepth` data is present.
- [ ] Safety bars fill correctly, all mint, no rainbow.
- [ ] Mobile (responsive mode 390px): grids collapse cleanly to 1–2 columns, charts stack vertically, no horizontal scroll.

**API check (Network tab):**
- [ ] Every endpoint that the old dashboard called is still being called, same URL, same method.
- [ ] No new endpoints introduced unless they already existed in the codebase.

**Build check:**
```bash
npm run build
```
- [ ] Exits 0.
- [ ] No new bundle-size warnings beyond what was there before.

**Grep checks:**
```bash
grep -rn "WindowChecker" frontend/src/ || echo "clean ✓"
grep -rn -E '">[0-9]+\.[0-9]+ ?(NTU|m|km/h|m/s|PSU|°C|mg)' frontend/src/pages/Dashboard frontend/src/components/Dashboard 2>/dev/null || echo "no hardcoded literals ✓"
```

---

## Phase 8 — Report

Write `dashboard_redesign_report.md` at repo root with:

1. **Files modified** — full list, brief description of each change.
2. **Files created** — `Layout.jsx`, `SectionHeader`, `SourceTag`, `ClearanceCard`, `DataTile`, `SafetyBar`, `SensorChart`, `DepthStructure`, etc.
3. **Files deleted** — any old dashboard sub-components replaced by the new shared ones.
4. **APIs verified** — every endpoint URL, the component that calls it, the request shape, the response shape, the in-browser test result.
5. **Hardcoded data audit** — `grep` output proving no numeric literals remain in JSX.
6. **Routing** — confirmation that `/` and `/dashboard` both work, navbar active state correct.
7. **Build status** — `npm run dev` clean? `npm run build` exit code?
8. **Visual gaps** — anything in the reference images that couldn't be matched 1:1 and why.
9. **TODOs** — follow-ups (e.g., "ConfidenceGauge internal SVG strokes still use old colors", "DepthStructure needs a real `maxDepth` field from the satellite API — currently defaulting to 25").

---

## Reference — End-State Vibe

Same as the main page. If you can't tell whether a screenshot of the dashboard is from the same product as the main page, it's wrong. The only differentiator between the two halves of the dashboard is:

- The `SectionHeader` kicker text (SENSOR vs SATELLITE).
- The `SourceTag` on each card (`live` / `sensor` for top half, `satellite` for bottom half).
- The clearance card score values, which come from different sources.

Everything else — palette, type, surface treatment, spacing, hover states — is identical.

End of plan.
