# Redesign Plan — Dark → Light Teal-Gradient Port

> **For Claude Code in VS Code.** Read this file end-to-end before touching any code. Execute the phases in order. Run the build after each component port; do not batch changes across components without verifying.

---

## Mission

Port the existing working dark-themed underwater visibility predictor (the current code in this repo) to the new light teal-gradient aesthetic. **All API calls, React hooks, data bindings, and component logic must remain functional.** Only visuals, layout, and one structural merge change.

Structural change: `WindowChecker` is merged **into** `Hero` as one component. The old "next optimal window" auto-display is **removed entirely** — that feature moves to a Telegram bot and no longer lives in the web UI.

---

## Hard Constraints — DO NOT VIOLATE

- DO NOT modify any `fetch(...)`, `axios(...)`, or API endpoint URL.
- DO NOT change any `useState` / `useEffect` / `useRef` signature, initial value, or dependency array.
- DO NOT change the shape of any prop a component receives — only how it's rendered.
- DO NOT modify exports in `frontend/src/lib/helpers.js`.
- DO NOT delete `frontend/src/lib/constants.js` (the `COMING_SOON` and `VERDICT` exports may stay even if unused).
- DO NOT rename any data field on the forecast object (`factors.tide.value`, `factors.wind.direction`, `factors.moonDistance.phase`, `visibilityScore`, `confidence`, `conditionState`, `reasoning`, `startsAt`, `endsAt`, `label`, etc.).
- DO NOT touch the internals of `ConfidenceDial.jsx` logic — only its parent container styling.
- After every component port: run `npm run dev` and verify the page still loads with zero console errors before moving to the next component.

---

## Phase 1 — Repo Scan (do this first, report findings before editing)

Run from repo root:

```bash
cd frontend
ls -la src/
ls -la src/components/
ls -la src/lib/
cat src/App.jsx
cat src/lib/helpers.js
cat src/lib/constants.js
cat src/data/mock.js | head -60
grep -rn "fetch(" src/ || true
grep -rn "axios" src/ || true
grep -rn "import.*WindowChecker" src/ || true
```

**Report before editing:**
1. Every API endpoint URL the frontend calls.
2. Where the forecast data enters the React tree (which component does the fetch / receives the data as a prop).
3. The exact shape of the forecast object (paste a sample).
4. The current font stack and any existing CSS variables in `index.css` / `App.css`.
5. Where `WindowChecker` is rendered and what props it currently receives.
6. The exact submit-handler logic inside `WindowChecker` — endpoint URL, request body shape, response shape.

---

## Phase 2 — Global Theme

### 2.1 Fonts

Add to `frontend/index.html` `<head>` if not already present:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=IBM+Plex+Mono:wght@300;400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

### 2.2 CSS Variables

Update `frontend/src/index.css` (or whichever global CSS file owns `:root`) to set this palette. Replace existing dark-theme variable **values**; keep variable **names** if they're already referenced elsewhere:

```css
:root {
  /* Background gradient (top → bottom) */
  --bg-top: #5BA8B0;
  --bg-mid: #2E6670;
  --bg-bottom: #133341;
  --bg-gradient: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 45%, var(--bg-bottom) 100%);

  /* Surfaces */
  --surface: rgba(255, 255, 255, 0.04);
  --surface-strong: rgba(255, 255, 255, 0.07);
  --surface-border: rgba(255, 255, 255, 0.12);
  --surface-border-strong: rgba(255, 255, 255, 0.22);

  /* Ink */
  --ink: #F4F8F8;
  --ink-muted: rgba(244, 248, 248, 0.65);
  --ink-faint: rgba(244, 248, 248, 0.4);

  /* Accent */
  --accent: #7FF5DC;
  --accent-dim: rgba(127, 245, 220, 0.18);
  --accent-line: rgba(127, 245, 220, 0.45);

  /* States */
  --state-good: #7FF5DC;
  --state-wait: #E6B454;
  --state-poor: #C46B6B;
  --state-good-bg: rgba(127, 245, 220, 0.15);
  --state-wait-bg: rgba(230, 180, 84, 0.18);
  --state-poor-bg: rgba(196, 107, 107, 0.18);

  /* Fonts */
  --font-serif: "Fraunces", Georgia, serif;
  --font-mono: "IBM Plex Mono", "Courier New", monospace;
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
}

html, body {
  margin: 0;
  background: var(--bg-gradient);
  background-attachment: fixed;
  min-height: 100vh;
  color: var(--ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.micro {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
```

### 2.3 Decorative Diagonal Light Rays (optional polish)

Add a fixed-position SVG overlay (`src/components/Decor/LightRays.jsx`) with `pointer-events: none`, opacity ~0.06, containing 3–4 diagonal lines spanning the viewport. Mount once in `App.jsx` before the main content. Skip if time-constrained — polish, not critical.

---

## Phase 3 — Component Ports

> **Order: Header → Footer → ConditionsNow → TideCurve → DayStrip → DetailPanel → Hero (with WindowChecker merge).** Build after each. Hero last because it's the biggest change.

### 3.1 Header

**File:** `src/components/Header/Header.jsx` + `Header.css`

- Keep `locationName` prop and the existing date-formatting logic intact.
- Layout: thin single row, wordmark left, two pills right.
- Wordmark: `You<sup>(R)</sup> Sea` — "You" and "Sea" in `--font-serif` (medium weight, ~1.6rem), `(R)` superscript in `--font-mono` with `color: var(--accent)`.
- Pills: `border: 1px solid var(--surface-border)`, `background: var(--surface)`, padding `6px 14px`, `border-radius: 999px`, font `--font-mono` uppercase, font-size `0.7rem`, letter-spacing `0.15em`.
- Location pill: small map-pin dot in `--accent` followed by `· {locationName}`.
- Date pill: the formatted date string.

### 3.2 Footer

**File:** `src/components/Footer/Footer.jsx` + `Footer.css`

- Keep `generatedAt` and `locationName` props and the `timeStr` formatter intact.
- `border-top: 1px solid var(--surface-border)`, padding `20px 0`, flex row space-between, both spans `.micro`.
- Left: `Last updated {timeStr}`. Right: `Removing the guesswork from underwater viewing · {locationName}`.

### 3.3 ConditionsNow

**File:** `src/components/ConditionsNow/ConditionsNow.jsx` + `ConditionsNow.css`

- Keep `factors` prop. Keep all four `<Tile />` children with current data bindings: `factors.tide.value.toFixed(1)`, `factors.tide.trend`, `factors.wind.value`, `factors.wind.direction`, `factors.waterTemp.value`, `factors.moonDistance.value`, `factors.moonDistance.phase`, and all four `.impact` fields.
- Keep `impactColor` and `impactIcon` helper calls. If `moonPhaseEmoji` is imported, keep it for the moon tile sub-line.
- Layout: section heading `<span class="micro">CONDITIONS NOW</span>`, then `.conditions__grid` as `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px`.
- Each tile (`.conditions__tile`):
  - `background: var(--surface)`, `border: 1px solid var(--surface-border)`, `border-radius: 6px`, padding `24px`, `backdrop-filter: blur(8px)`.
  - Top row: flex space-between — `.micro` label left, line-icon SVG right (keep existing `TideIcon` / `WindIcon` / `TempIcon` / `MoonIcon`).
  - Value row: `font-family: var(--font-serif)`, `font-size: 3.5rem`, `font-weight: 300`, `line-height: 1.05`, color `--ink`. Unit inline, mono, `0.85rem`, `margin-left: 4px`, color `--ink-muted`.
  - Sub: `.micro`, margin-top `8px`.
  - Impact line: mono small, color from `impactColor(impact)`, margin-top `6px`. Format: `{impactIcon(impact)} — {capitalized impact}`.

### 3.4 TideCurve

**File:** `src/components/TideCurve/TideCurve.jsx` + `TideCurve.css`

- Keep `data`, `optimalStart`, `optimalEnd`, `conditions` props.
- Keep the Recharts `<AreaChart>` and all data wiring. Change only colors, stroke, fill gradient, tooltip styling.
- Section heading: `<span class="micro">TIDE CURVE / TODAY</span>`.
- Card wrapper: same surface treatment as ConditionsNow tiles, padding `24px`.
- Inside card: top label `<span class="micro">Optimal window {formatTime(optimalStart)} – {formatTime(optimalEnd)} highlighted</span>`, then the chart, then a 4-column KV row.
- Recharts updates:
  - `<defs>` gradient stops → `var(--accent)` at top, transparent at bottom.
  - `<Area>` stroke `var(--accent)`, strokeWidth `2`, fill the gradient.
  - `<XAxis>` and `<YAxis>` tick fill `var(--ink-faint)`, font IBM Plex Mono 11px.
  - `<ReferenceArea x1={formatTime(optimalStart)} x2={formatTime(optimalEnd)}>`: fill `var(--accent-dim)`, stroke `var(--accent-line)`.
  - Custom `<TideTooltip>`: surface bg, border, mono font, reads `payload[0].payload.time` and `payload[0].value.toFixed(1) m` — preserve the payload-reading logic.
- KV row: 4 columns — Next Low, Next High, Range, Datum. Each: `.micro` label + serif (or mono) value. Bind to `conditions?.nextLow ?? "—"` etc.

### 3.5 DayStrip

**File:** `src/components/DayStrip/DayStrip.jsx` + `DayStrip.css`

- Keep `windows`, `selectedId`, `onSelect` props and the existing `windows.map((win, i) => ...)` iteration with `onClick={() => onSelect(win.id)}`, `tabIndex={0}`, and the `i === 0` "today" check.
- Section heading: `<span class="micro">COMING UP</span>`.
- Row: `display: flex; gap: 12px; overflow-x: auto`.
- Card (`.day-strip__card`): surface bg, border, padding `16px`, min-width `150px`, rounded, hover transition (translateY -2px + brighter border).
- Selected (`selectedId === win.id`): `border-color: var(--accent-line)`, subtle glow.
- Content top→bottom:
  - Day label `{win.label}` — micro mono. Today gets class `--today` and color `var(--accent)`.
  - Confidence bar (keep existing width logic based on `win.confidence * 100`%).
  - Big confidence number `{Math.round(win.confidence * 100)}%` — serif `2rem`, color `stateColor(win.conditionState)`.
  - Time range `{formatTime(win.startsAt)}<br />→ {formatTime(win.endsAt)}` — mono small, muted.
  - State badge with `stateLabel(win.conditionState)` — mono uppercase, padded pill.

### 3.6 DetailPanel

**File:** `src/components/DetailPanel/DetailPanel.jsx` + `DetailPanel.css`

- Keep all props (`window: win`, `onClose`), the `factors` array construction with `val`/`sub`/`f`, the `win.reasoning.map` iteration, all helper calls.
- Re-style as a card or modal with surface treatment. Two-column body: reasoning bullets left (~60%), factor table right (~40%).
- Header: `{win.label} · Window Detail` (micro), then `{formatTime(win.startsAt)} → {formatTime(win.endsAt)}` in serif `2rem`, then meta line with `{windowDuration(...)} · Visibility {win.visibilityScore.toFixed(1)} / 10 · {stateLabel(win.conditionState)}` (mono, muted, state-colored span).
- Close button top-right: "Close ×", thin border, hover bg.
- Reasoning list: bullet dot in `var(--accent)`, body text in sans, line-height 1.5.
- Factor rows: flex space-between, name in serif `1.1rem`, sub muted mono, val in mono large, impact icon at end colored by `impactColor(f.impact)`.

### 3.7 Hero (with WindowChecker MERGE) — Biggest Change

**Files:**
- Modify: `src/components/Hero/Hero.jsx` + `Hero.css`
- **Delete after merge:** `src/components/WindowChecker/` and its import + render in `App.jsx`.

**Step 1 — Inspect `WindowChecker.jsx` first.** Lift these into `Hero.jsx`:
- All `useState` hooks (day, month, year, hour, min, prediction/result state, loading state) with the **exact** initial values.
- The submit handler that calls the prediction API — same endpoint URL, same request body shape, same response handling.
- Any `useEffect` that initializes defaults to "now".
- The shape of the prediction result.

**Step 2 — Remove the old auto-next-optimal logic from Hero.** The current Hero takes a `window` prop (the auto next-optimal window) and renders `formatTime(win.startsAt)` etc. as a giant headline. Delete that. Hero no longer receives a `window` prop. The optimal-window feature is moving to a Telegram bot and is not part of the web UI anymore.

**Step 3 — Build the new Hero:**

```jsx
import { useState } from "react";
import ConfidenceDial from "../ConfidenceDial/ConfidenceDial";
import "./Hero.css";

export default function Hero() {
  // === LIFTED FROM WindowChecker — preserve initial values + handlers EXACTLY ===
  const now = new Date();
  const [day, setDay]     = useState(/* existing init from WindowChecker */);
  const [month, setMonth] = useState(/* existing init */);
  const [year, setYear]   = useState(/* existing init */);
  const [hour, setHour]   = useState(/* existing init */);
  const [min, setMin]     = useState(/* existing init */);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck() {
    // EXACTLY the existing WindowChecker submit logic — same fetch URL, same body, same response handling
  }

  const hasResult = prediction !== null;

  return (
    <section className="hero">
      <div className="hero__top-label">
        <span className="hero__dot" />
        <span className="micro">VISIBILITY CHECK</span>
      </div>

      <div className="hero__main">
        <div className="hero__left">
          {hasResult ? (
            <>
              <h1 className="hero__headline">{prediction.percent}%</h1>
              <div className="hero__state-line">
                {prediction.state.toUpperCase()} · {prediction.description}
              </div>
            </>
          ) : (
            <>
              <h1 className="hero__headline hero__headline--placeholder">Select a date and time</h1>
              <div className="hero__state-line">Choose when you want to dive — we'll predict visibility</div>
            </>
          )}
        </div>
        <div className="hero__right">
          <div className="micro" style={{ textAlign: "center", marginBottom: 8 }}>CONFIDENCE</div>
          <ConfidenceDial value={prediction?.confidence ?? 0} />
        </div>
      </div>

      <div className="hero__form-card">
        <div className="micro" style={{ marginBottom: 16 }}>WHEN ARE YOU THINKING?</div>
        <div className="hero__form-row">
          <div className="hero__input-group">
            <span className="micro">DAY</span>
            <input className="hero__input" value={day} onChange={(e) => setDay(e.target.value)} maxLength={2} />
          </div>
          <span className="hero__sep">/</span>
          <div className="hero__input-group">
            <span className="micro">MONTH</span>
            <input className="hero__input" value={month} onChange={(e) => setMonth(e.target.value)} maxLength={2} />
          </div>
          <span className="hero__sep">/</span>
          <div className="hero__input-group">
            <span className="micro">YEAR</span>
            <input className="hero__input hero__input--wide" value={year} onChange={(e) => setYear(e.target.value)} maxLength={4} />
          </div>
          <span className="hero__sep hero__sep--gap">|</span>
          <div className="hero__input-group">
            <span className="micro">HOUR</span>
            <input className="hero__input" value={hour} onChange={(e) => setHour(e.target.value)} maxLength={2} />
          </div>
          <span className="hero__sep">:</span>
          <div className="hero__input-group">
            <span className="micro">MIN</span>
            <input className="hero__input" value={min} onChange={(e) => setMin(e.target.value)} maxLength={2} />
          </div>
          <button className="hero__check-btn" onClick={handleCheck} disabled={loading}>
            {loading ? "Checking..." : "Check conditions"}
          </button>
        </div>
      </div>
    </section>
  );
}
```

> **Critical:** Adapt the result-field names (`prediction.percent`, `prediction.state`, `prediction.description`, `prediction.confidence`) to whatever the actual API response uses. Do not invent fields — read them from the existing WindowChecker code and bind to those exact names.

**Hero CSS:**

```css
.hero {
  padding: 80px 0 60px;
  position: relative;
}

.hero__top-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}

.hero__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
}

.hero__main {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 48px;
  align-items: center;
  margin-bottom: 56px;
}

.hero__headline {
  font-family: var(--font-serif);
  font-size: clamp(3.5rem, 9vw, 9rem);
  font-weight: 300;
  line-height: 0.95;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
  color: var(--ink);
}

.hero__headline--placeholder {
  font-style: italic;
  color: rgba(244, 248, 248, 0.85);
}

.hero__state-line {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: var(--ink-muted);
  text-transform: uppercase;
}

.hero__form-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 28px 32px;
  backdrop-filter: blur(8px);
}

.hero__form-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.hero__input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero__input {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  width: 56px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--surface-border);
  color: var(--ink);
  text-align: center;
  padding: 4px 0;
  outline: none;
}

.hero__input--wide { width: 84px; }
.hero__input:focus { border-bottom-color: var(--accent); }

.hero__sep {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  color: var(--ink-faint);
  padding-bottom: 4px;
}

.hero__sep--gap { margin: 0 12px; }

.hero__check-btn {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid var(--surface-border-strong);
  border-radius: 6px;
  color: var(--ink);
  padding: 10px 20px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.hero__check-btn:hover { border-color: var(--accent); color: var(--accent); }
.hero__check-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

**Step 4 — Update App.jsx**
- Remove `import WindowChecker from './components/WindowChecker/WindowChecker';`.
- Remove `<WindowChecker />` render.
- Remove any `window` prop being passed to Hero: `<Hero />` (no props now).
- If the prediction API call needs to be lifted higher in the tree to share data with ConditionsNow/TideCurve, do that — lift the `prediction` state up to App and pass it down. But only if those components currently depend on the same prediction data.

**Step 5 — Delete the directory**
```bash
rm -rf frontend/src/components/WindowChecker
```

---

## Phase 4 — Cleanup

- Confirm no orphaned `WindowChecker` references: `grep -rn "WindowChecker" frontend/src/ || true` should return empty.
- If `mock.js` has been zeroed out with `"Coming soon"` placeholders, restore realistic seed values so dev mode renders end-to-end. Each window needs: ISO timestamps, numeric `confidence` (0–1), numeric `visibilityScore`, valid `conditionState` (`optimal` | `marginal` | `poor`), full `factors` object with numeric values + valid trend/direction/phase/impact strings, and a non-empty `reasoning` array of strings.
- If `mock.js` is fine, leave it.

---

## Phase 5 — Verification

```bash
cd frontend
npm install
npm run dev
```

Visit the dev URL. Verify:

- [ ] Page background is the teal gradient, not the old dark.
- [ ] Header wordmark and pills render.
- [ ] Hero shows "Select a date and time" giant serif on first load.
- [ ] ConfidenceDial on the right shows 0% on first load.
- [ ] Entering day/month/year/hour/min and clicking "Check conditions" calls the prediction API (Network tab confirms the same endpoint that WindowChecker used to call).
- [ ] After a successful response the hero headline replaces the placeholder with the prediction.
- [ ] ConditionsNow tiles populate with real factor values (no `undefined`, no `NaN`).
- [ ] TideCurve renders a curve (not a flat line) with the optimal window highlighted.
- [ ] DayStrip "Coming up" shows 5 cards. Each is clickable and opens DetailPanel with reasoning + factor table populated.
- [ ] Footer shows `Last updated HH:MM` left and tagline + location right.
- [ ] Zero red errors in DevTools console.

Then:
```bash
npm run build
```
Must exit 0. Log any build warnings.

---

## Phase 6 — Final Report

Write `redesign_report.md` at repo root containing:

1. **Files modified** — full list with brief description of each change.
2. **Files deleted** — `WindowChecker/` contents.
3. **APIs verified** — every endpoint URL, the component that calls it, the request body shape, the response shape. Confirm each was tested in the running dev server.
4. **Build status** — dev clean? build exit code?
5. **Console warnings** — any non-error console output.
6. **Visual gaps** — anything in the reference that couldn't be matched 1:1 and why (e.g., decorative diagonals skipped).
7. **TODOs** — follow-up notes (e.g., "ConfidenceDial internal SVG strokes still match the old dark theme — recommend a follow-up pass").

---

## Reference — End-State Vibe

- **Background:** teal-cyan gradient, light at top to dark navy-teal at bottom, fixed-attachment.
- **Type hierarchy:** giant thin Fraunces serif for hero headline + tile values; IBM Plex Mono uppercase letter-spaced for every label, micro tag, and form input; Inter for body prose.
- **Cards:** very low-contrast surfaces (`rgba(255,255,255,0.04–0.07)`) with thin borders, backdrop blur, rounded ~6px. No drop shadows, no heavy fills.
- **Accent:** a single mint `#7FF5DC` used sparingly — pulse dot, focus borders, accent text, chart stroke.
- **Mood:** quiet, editorial, "Apple keynote × oceanography paper." Generous whitespace, no busy gradients, no neon.

End of plan.
