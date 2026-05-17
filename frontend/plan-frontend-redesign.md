# YOU(R) SEA — Frontend Redesign Plan
> **For Claude Code (VS Code terminal).** Read this entire document before touching any file. Scan the repo first, then execute each step in order.

---

## 0. What This Plan Does

Restructures and redesigns the frontend of a React + Vite app from a single monolithic `App.jsx` into a properly separated component tree, applying a deep-ocean aesthetic. **Zero functional changes.** All API calls, state, event handlers, and data shapes are preserved exactly as they exist today.

---

## 1. Stack (confirmed)

- **React 18 + Vite**
- **Recharts** — already installed, used for tide chart (keep it)
- **Plain CSS** — currently injected as a JS string; move to proper CSS files
- **No TypeScript** — stay in `.jsx`
- **No component library** — keep it zero-dependency beyond what's already installed
- **Fonts via Google Fonts** — update from current to Fraunces + IBM Plex Mono

---

## 2. Hard Constraints — DO NOT TOUCH

1. The `handleCheck` function and its `fetch("/api/predict", { method: "POST", ... })` call — preserve byte-for-byte logic.
2. All picker state: `pickerDay`, `pickerMonth`, `pickerYear`, `pickerHour`, `pickerMin`, `pickerOpen`, `status`, `loading`, `selectedWin`.
3. The dropdown close-on-outside-click `useEffect` with `pickerRef`.
4. The `MOCK_FORECAST` and `TIDE_CURVE` data shapes — do not rename keys.
5. All helper functions (`formatTime`, `formatDate`, `windowDuration`, `confidenceLabel`, `stateColor`, `stateBg`, `stateLabel`, `moonPhaseEmoji`, `impactIcon`, `impactColor`) — move them, do not rewrite them.
6. `recharts` `AreaChart` in the tide section — keep it. Only restyle the wrapper, colors, and tooltip.
7. The `WindowCard` click-to-expand `DetailPanel` behavior.
8. The style injection `useEffect` that cleans up on unmount — replace with real CSS files but keep the cleanup pattern if the style tag approach is still used, OR simply remove it once CSS is in actual files.

---

## 3. Before → After File Structure

### Before (current)
```
src/
  App.jsx          ← everything: styles, data, helpers, components, App
  main.jsx
  index.css        ← likely near-empty (Vite default)
```

### After (target)
```
src/
  main.jsx                          ← untouched
  index.css                         ← global reset + CSS custom properties + fonts
  App.jsx                           ← thin root: imports sections, renders in order
  data/
    mock.js                         ← MOCK_FORECAST, TIDE_CURVE
  lib/
    helpers.js                      ← all pure helper functions
    constants.js                    ← VERDICT map, color tokens as JS (for dynamic use)
  components/
    Background/
      Background.jsx                ← ocean depth gradient + animated light shafts
      Background.css
    Header/
      Header.jsx                    ← wordmark + location pill + date pill
      Header.css
    Hero/
      Hero.jsx                      ← next optimal window headline + confidence dial
      Hero.css
    ConfidenceDial/
      ConfidenceDial.jsx            ← SVG arc dial (extracted from ConfidenceGauge)
      ConfidenceDial.css
    WindowChecker/
      WindowChecker.jsx             ← date/time picker + API call + verdict result
      WindowChecker.css
    ConditionsNow/
      ConditionsNow.jsx             ← 4-tile conditions grid
      ConditionsNow.css
    TideCurve/
      TideCurve.jsx                 ← recharts AreaChart, restyled
      TideCurve.css
    DayStrip/
      DayStrip.jsx                  ← 7-day horizontal forecast cards
      DayStrip.css
    DetailPanel/
      DetailPanel.jsx               ← expanded window reasoning panel
      DetailPanel.css
    Footer/
      Footer.jsx
      Footer.css
```

---

## 4. Section Order in App.jsx

```jsx
<Background />
<Header />
<Hero />           {/* next optimal window */}
<WindowChecker />  {/* MAIN FEATURE — sits directly under Hero */}
<ConditionsNow />
<TideCurve />
<DayStrip />       {/* 7-day forecast — moved below conditions */}
{selectedWin && <DetailPanel />}
<Footer />
```

State that is shared (`selectedWin`, `selectedWinData`) lives in `App.jsx` and is passed down as props.

---

## 5. Design System

### 5.1 Google Fonts
Replace the current font import in `index.css` with:
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
```

### 5.2 CSS Custom Properties (put in `index.css :root`)
```css
:root {
  /* Palette */
  --color-abyss:      #061827;   /* page background — deep ocean */
  --color-marine:     #0F3F5E;   /* card surface */
  --color-surface:    #0A2D44;   /* slightly lighter surface */
  --color-sunlit:     #4FB8C9;   /* near-surface teal */
  --color-bio:        #5FF3D6;   /* bioluminescent accent */
  --color-warn:       #E6B454;   /* marginal / wait */
  --color-nogo:       #C46B6B;   /* no-go / danger */

  /* Text */
  --color-ink:        #E6F0F4;
  --color-ink-muted:  rgba(180, 210, 220, 0.55);
  --color-ink-faint:  rgba(180, 210, 220, 0.18);

  /* Borders */
  --color-hairline:        rgba(180, 210, 220, 0.10);
  --color-hairline-strong: rgba(180, 210, 220, 0.22);

  /* Typography */
  --font-display: 'Fraunces', serif;
  --font-mono:    'IBM Plex Mono', monospace;

  /* Spacing */
  --section-px:    clamp(24px, 4vw, 48px);
  --section-py:    clamp(32px, 4vw, 48px);
  --card-radius:   8px;
  --card-bg:       rgba(255, 255, 255, 0.012);
  --card-border:   1px solid var(--color-hairline);
  --card-padding:  24px;
}
```

### 5.3 Global Reset (in `index.css`)
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: var(--color-abyss);
  color: var(--color-ink);
  font-family: var(--font-mono);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--color-abyss); }
::-webkit-scrollbar-thumb { background: var(--color-hairline-strong); border-radius: 3px; }

/* Micro label utility */
.micro {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--color-ink-muted);
}
.micro-bio { color: var(--color-bio); }

/* Display heading utility */
.display {
  font-family: var(--font-display);
  font-weight: 300;
  letter-spacing: -0.02em;
  font-optical-sizing: auto;
}

/* Fade-in reveal */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.reveal { animation: fadeUp 0.7s ease both; }
.reveal-1 { animation-delay: 0.05s; }
.reveal-2 { animation-delay: 0.18s; }
.reveal-3 { animation-delay: 0.32s; }
.reveal-4 { animation-delay: 0.48s; }
.reveal-5 { animation-delay: 0.64s; }

/* Bio dot pulse */
@keyframes bioPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(95,243,214,0.55); }
  50%       { box-shadow: 0 0 0 5px rgba(95,243,214,0); }
}
.bio-dot { animation: bioPulse 2.6s ease-in-out infinite; }

/* Light shaft drift */
@keyframes shaftDrift {
  0%   { transform: translateX(-4%) skewX(-8deg); opacity: 0.18; }
  50%  { transform: translateX(2%)  skewX(-6deg); opacity: 0.28; }
  100% { transform: translateX(-4%) skewX(-8deg); opacity: 0.18; }
}
```

### 5.4 Verdict Color Map (`src/lib/constants.js`)
```js
export const VERDICT = {
  optimal:  { color: "#5FF3D6", label: "GO",      dim: "rgba(95,243,214,0.18)" },
  marginal: { color: "#E6B454", label: "WAIT",    dim: "rgba(230,180,84,0.18)" },
  poor:     { color: "#C46B6B", label: "NO-GO",   dim: "rgba(196,107,107,0.18)" },
};
// Map from conditionState string to VERDICT key (same keys already)
```

---

## 6. Component Specifications

### 6.1 `Background.jsx`
Renders behind everything (`position: fixed; inset: 0; z-index: 0`).

**Visual:** vertical gradient simulating ocean depth:
```css
background: linear-gradient(180deg,
  #4FB8C9 0%,
  #2C7E96 8%,
  #19587A 20%,
  #0F3F5E 40%,
  #0A2D44 62%,
  #07203A 80%,
  #061827 100%
);
```

**Light shafts:** 3 absolutely-positioned `<div>` elements, each a narrow tall rectangle (`width: 2px, height: 120%`), semi-transparent white, skewed with `skewX(-8deg)`, using the `shaftDrift` keyframe animation at 11s / 17s / 23s durations, staggered delays, `opacity: 0.18–0.28`.

**No canvas required.** Pure CSS is enough.

Props: none.

---

### 6.2 `Header.jsx`
```
[YOU(R) SEA wordmark]          [· SEA OASIS — SITE ALPHA pill] [17 MAY 2026 pill]
```

- Wordmark: `<span class="display">You<sup>(R)</sup> Sea</span>` — `(R)` in `--color-bio`, small superscript mono font
- Pills: small rounded border containers, `micro` class text, `background: rgba(255,255,255,0.015)`, `border: 1px solid var(--color-hairline)`
- Location name comes from `MOCK_FORECAST.locationName`
- Date: `new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase()`
- Layout: `display: flex; justify-content: space-between; align-items: center`
- Padding: `var(--section-px)` horizontal, `28px` top
- `z-index: 20`

Props: `locationName: string`

---

### 6.3 `Hero.jsx`
The "Next Optimal Window" section. Large full-width section.

**Layout:** 12-column grid, headline left (9 cols), confidence dial right (3 cols).

**Headline block:**
- Micro label: `• NEXT OPTIMAL WINDOW` — use bio-dot span + `micro micro-bio` class
- `<h1 class="display">` — `font-size: clamp(48px, 9vw, 140px)`, `font-weight: 300`, `line-height: 0.95`
- Time range: `{formatTime(hero.startsAt)}` + `→` (in `--color-bio`) + `{formatTime(hero.endsAt)}`
- Sub-row: "Opens in X D Y H Z M" + separator + "Window Nh Mm" (use `windowDuration`)
  - Data styled with `font-family: var(--font-mono)`, numbers in white, units in muted
- Note: the countdown logic (live D/H/M ticking) is a **nice-to-have** — if already absent from the current app, do not add it. Only port what exists.

**Right column:**
- `ConfidenceDial` component, `size={172}`

**Bottom scroll cue:**
- `DESCEND` micro label + down arrow SVG, centered, `position: absolute; bottom: 24px`

**Section padding:** `padding: clamp(48px, 6vw, 80px) var(--section-px) clamp(32px, 4vw, 48px)`

Props: `window: object` (the hero window from MOCK_FORECAST.windows[0])

---

### 6.4 `ConfidenceDial.jsx`
Extracted from the current `ConfidenceGauge`. Thin SVG arc.

Keep the same arc math that's already in `ConfidenceGauge` (`polarToXY`, `arcPath`, `gauge-fill` animation) — just restyle:
- Track stroke: `var(--color-hairline)`
- Fill stroke: `var(--color-bio)` with `drop-shadow(0 0 8px rgba(95,243,214,0.6))`
- Center text: percentage in `display` font, `CONFIDENCE` micro label above it
- Remove the background card wrapper (Hero provides the card context)

Props: `value: number (0–1)`, `size: number (default 132)`

---

### 6.5 `WindowChecker.jsx`
**This is the main feature. It sits directly below Hero.**

Preserve the entire picker state and `handleCheck` exactly. Only restructure the JSX and CSS.

**Layout:** two-column grid (`5fr 7fr`) on desktop, stacked on mobile.

**Left card — input:**
```
WHEN ARE YOU THINKING?          [micro label]

DATE        START TIME
05/22/2026  09:30 AM
[date input] [time input]

RANGE QUERIED · ±90 MIN        [micro faint]
```
- Card: `background: var(--card-bg); border: var(--card-border); border-radius: var(--card-radius); padding: var(--card-padding)`
- Keep ALL existing picker dropdown logic (the `pickerOpen` state, dropdown renders, `onMouseDown` handlers, `pickerRef`)
- Inputs styled to match ocean theme: `background: transparent`, `border-bottom: 1px solid var(--color-hairline-strong)`, `color: var(--color-ink)`, `font-family: var(--font-mono)`, `font-size: 1.5rem`
- Status message below inputs (keep `.ok` / `.err` color logic)

**Right card — verdict result:**
- Background tinted by verdict color: `background: linear-gradient(180deg, {v.dim} 0%, transparent 60%)`
- `VERDICT — {date formatted}` micro label in bio color if GO
- Verdict word (`GO` / `WAIT` / `NO-GO`) in display font, `font-size: clamp(40px, 6vw, 72px)`, colored by state
- Time range: `{result.window}` in mono
- `ConfidenceDial` top-right, `size={108}`
- Reasoning line in italic display font below

State that stays in this component: `date`, `time`, `result` (the local result object from the canned map), `status`, `loading`.
The `pickerDay/Month/Year/Hour/Min/Open` state and `handleCheck` with the real API fetch also stay here.

**Section padding:** `padding: var(--section-py) var(--section-px)`

Props: none (self-contained with its own state, same as today)

---

### 6.6 `ConditionsNow.jsx`
4-tile grid: Tide · Wind · Water · Moon.

**Layout:** `grid-template-columns: repeat(4, 1fr)`, collapses to 2-col on tablet, 1-col on mobile.

Each tile:
- `background: var(--card-bg); border: var(--card-border); border-radius: var(--card-radius); padding: var(--card-padding)`
- Header row: micro label left, glyph icon right (use the existing `Glyph`-style thin SVG icons — **no emoji**)
- Large value: `display` font, `font-size: clamp(2.5rem, 4vw, 3.5rem)`, white
- Sub line: state/direction/etc. in micro muted
- Mini visualization at bottom of each tile:
  - **Tide:** animated SVG sine wave (use `requestAnimationFrame` — port the `MiniSine` pattern from prototype if desired, otherwise a static SVG wave is fine)
  - **Wind:** angled hairline SVG pattern (static is fine)
  - **Water:** horizontal scale bar with current temp dot
  - **Moon:** SVG half-sphere approximation (see prototype `MoonSphere`) or simply display the percentage prominently

Data source: `hero.factors` from `MOCK_FORECAST.windows[0]` (same as today).

Props: `factors: object`

---

### 6.7 `TideCurve.jsx`
Keep `recharts` `AreaChart`. Restyle everything around it.

**Recharts colors to update:**
- Area gradient: `--color-bio` at 25% opacity → transparent
- Area stroke: `--color-bio`, `strokeWidth: 2`
- XAxis/YAxis ticks: `fill: var(--color-ink-muted)`, `fontFamily: var(--font-mono)`
- Tooltip: restyle `TideTooltip` — `background: var(--color-marine)`, `border: 1px solid var(--color-hairline)`, mono font
- Optimal window `ReferenceLine` — replace the two separate lines with a `<ReferenceArea>` spanning `startsAt` to `endsAt`, `fill="rgba(95,243,214,0.08)"`, `stroke="rgba(95,243,214,0.25)"`

**Wrapper card:** `background: var(--card-bg); border: var(--card-border); border-radius: var(--card-radius); padding: var(--card-padding)`

**Below chart — KV row:** Next Low · Next High · Range · Datum (4 items, `grid-template-columns: repeat(4,1fr)`, each with `border-top: 1px solid var(--color-hairline)` separator)

Props: `data: array`, `optimalStart: string`, `optimalEnd: string`, `conditions: object`

---

### 6.8 `DayStrip.jsx`
7-day horizontal card strip. Moved to **below** TideCurve.

Each card:
- `flex: 0 0 auto; min-width: 150px` in a horizontal scrollable container
- Day name in display font (`font-size: 1.5rem`), today highlighted in `--color-bio`
- Vertical bar indicator: `width: 6px`, colored by verdict, height proportional to confidence (60px + confidence × 110px), centered, with glow `box-shadow`
- Time range in mono below the bar
- `REASON` micro label + verdict badge (`GO` / `WAIT` / `NO-GO`) at bottom

Data source: `MOCK_FORECAST.windows` (map each window to a card, derive day from `startsAt`).

Props: `windows: array`, `onSelect: function`

---

### 6.9 `DetailPanel.jsx`
Rendered conditionally when `selectedWin !== null`. Keep existing close button and all reasoning/factor display.

Restyle only:
- Card background/border matches ocean theme
- Reasoning dots: `--color-bio` filled circles
- Factor rows: `background: rgba(255,255,255,0.015)`, `border-radius: var(--card-radius)`, mono values
- `detail-close` button: `border: 1px solid var(--color-hairline)`, hover → `--color-nogo`

Props: `window: object`, `onClose: function`

---

### 6.10 `Footer.jsx`
Simple. `border-top: 1px solid var(--color-hairline)`. Two lines of micro text, flex space-between.

Props: `generatedAt: string`, `locationName: string`

---

## 7. Data & Helpers Migration

### `src/data/mock.js`
Move `MOCK_FORECAST` and `TIDE_CURVE` here. Named exports.
```js
export const MOCK_FORECAST = { ... };
export const TIDE_CURVE = [ ... ];
```

### `src/lib/helpers.js`
Move all helper functions here. Named exports. Do not modify their logic.
```js
export function formatTime(iso) { ... }
export function formatDate(iso) { ... }
export function windowDuration(start, end) { ... }
export function confidenceLabel(c) { ... }
export function stateColor(state) { ... }
export function stateBg(state) { ... }
export function stateLabel(state) { ... }
export function moonPhaseEmoji(phase) { ... }
export function impactIcon(impact) { ... }
export function impactColor(impact) { ... }
```

---

## 8. App.jsx After Refactor

```jsx
import { useState, useRef, useEffect } from "react";
import { MOCK_FORECAST, TIDE_CURVE } from "./data/mock";
import Background   from "./components/Background/Background";
import Header       from "./components/Header/Header";
import Hero         from "./components/Hero/Hero";
import WindowChecker from "./components/WindowChecker/WindowChecker";
import ConditionsNow from "./components/ConditionsNow/ConditionsNow";
import TideCurve    from "./components/TideCurve/TideCurve";
import DayStrip     from "./components/DayStrip/DayStrip";
import DetailPanel  from "./components/DetailPanel/DetailPanel";
import Footer       from "./components/Footer/Footer";

export default function App() {
  const [selectedWin, setSelectedWin] = useState(null);
  const hero    = MOCK_FORECAST.windows[0];
  const selected = selectedWin
    ? MOCK_FORECAST.windows.find((w) => w.id === selectedWin)
    : null;

  return (
    <>
      <Background />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Header locationName={MOCK_FORECAST.locationName} />
        <Hero window={hero} />
        <WindowChecker />
        <ConditionsNow factors={hero.factors} />
        <TideCurve
          data={TIDE_CURVE}
          optimalStart={hero.startsAt}
          optimalEnd={hero.endsAt}
          conditions={hero.factors}
        />
        <DayStrip
          windows={MOCK_FORECAST.windows}
          selectedId={selectedWin}
          onSelect={(id) => setSelectedWin(selectedWin === id ? null : id)}
        />
        {selected && (
          <DetailPanel window={selected} onClose={() => setSelectedWin(null)} />
        )}
        <Footer
          generatedAt={MOCK_FORECAST.generatedAt}
          locationName={MOCK_FORECAST.locationName}
        />
      </div>
    </>
  );
}
```

**`WindowChecker` keeps all its own state internally** (picker fields, loading, status, result) — it does not need props from App.

---

## 9. Remove From the Codebase

- The `css` const string and the `useEffect` that injects it into `<head>` — CSS now lives in real files
- The `styleRef` ref
- The `document.title = ...` line in that same useEffect — move to `index.html` `<title>` tag

---

## 10. `index.html` Updates

```html
<title>YOU(R) SEA — Forecast · Sea Oasis</title>
```

No other changes needed to `index.html`.

---

## 11. Execution Order for Claude Code

Execute strictly in this order. After each step, verify no console errors before proceeding.

1. **Scaffold directories:** `src/data/`, `src/lib/`, `src/components/` with all subdirectories
2. **Create `src/data/mock.js`** — copy MOCK_FORECAST and TIDE_CURVE from App.jsx, add named exports
3. **Create `src/lib/helpers.js`** — copy all helper functions, add named exports
4. **Create `src/lib/constants.js`** — VERDICT map
5. **Rewrite `src/index.css`** — full design system (section 5.2 + 5.3 above)
6. **Create `Background`** component
7. **Create `ConfidenceDial`** component (extract from ConfidenceGauge, restyle)
8. **Create `Header`** component
9. **Create `Hero`** component
10. **Create `WindowChecker`** component — move ALL picker state and `handleCheck` here, preserve exactly
11. **Create `ConditionsNow`** component
12. **Create `TideCurve`** component — keep recharts, restyle
13. **Create `DayStrip`** component
14. **Create `DetailPanel`** component — keep close button, reasoning list, factor rows
15. **Create `Footer`** component
16. **Rewrite `App.jsx`** to thin root (section 8 above)
17. **Verify:** run `npm run dev`, check all sections render, picker dropdowns work, "Check conditions" button fires the POST request, window card click opens DetailPanel

---

## 12. Claude Code Prompt

Use this prompt verbatim when handing this plan to Claude Code in the VS Code terminal:

---

> Read the file `plan-frontend-redesign.md` in full before doing anything. Then scan the entire `src/` directory.
>
> Execute the redesign plan exactly as written, step by step in the order specified in Section 11. Your only job is to restructure and restyle — do not change any API call logic, state variable names, event handler logic, or data shapes.
>
> Specifically: the `handleCheck` function and its `fetch("/api/predict", ...)` call must be preserved byte-for-byte inside `WindowChecker.jsx`. The picker state (`pickerDay`, `pickerMonth`, `pickerYear`, `pickerHour`, `pickerMin`, `pickerOpen`, `status`, `loading`) must all survive in `WindowChecker.jsx`. The `selectedWin` state moves to `App.jsx`.
>
> After completing all steps, run `npm run dev` and confirm no console errors.

---

## 13. Notes & Assumptions

- The `/api/predict` endpoint is already working server-side. The response body is not yet consumed by the frontend (the current code only checks `response.ok`). **Do not change this** — leave the response handling as-is.
- `MOCK_FORECAST` is the live data shape. When the real API is wired up later, it will return the same shape.
- The animated mini-visualizations in ConditionsNow (sine wave, wind hairlines, moon sphere) are **progressive enhancement** — if they add complexity that risks breaking other things, implement static SVG placeholders first and mark them with a `// TODO: animate` comment.
- Windows PowerShell is the terminal — use `mkdir` with `-Force` flag or create files directly through the editor, not `mkdir -p`.
