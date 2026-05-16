# Frontend Plan — Step 4: Wire Real Backend Data

## Scope of this step

Replace hardcoded values in the React frontend with real data from `POST /api/predict`. Keep the existing visual design — only swap data sources, no redesign.

**Honest scope** — we wire only what the backend can actually deliver right now. ML-dependent and multi-datetime features stay as neutral placeholders (no fake numbers) until later steps.

---

## What gets wired vs. what waits

### Wire up now (backend has the data)

| UI element | Backend field |
|---|---|
| Header date (`16 May 2026`) | client-side `new Date()` — no API needed |
| **TIDE** card — height + direction | `features.nextTideHeightM`, `features.nextTideType` |
| **WIND** card — speed + compass direction | `features.windSpeedKmh`, `features.windDirectionDeg` |
| **WATER TEMP** card — temperature | `features.waterTemperatureC` *(needs small backend addition, see below)* |
| **MOON** card — phase name | `features.moonPhase` → phase name |

### Leave as placeholders (blocked on later steps)

| UI element | Why blocked | Placeholder to show |
|---|---|---|
| "Next Optimal Window" 14:20 → 15:50 | needs ML model + window-finding logic | `—` or `Awaiting model` |
| Confidence gauge (87% High) | needs ML model output | dimmed gauge or hide |
| Visibility score (8.4/10) | needs ML model output | `—` |
| Tide Curve (24-hour graph) | needs new hourly-tide endpoint | hide section, or flat placeholder line |
| Coming Up (TODAY/TUE/WED/THU/FRI cards) | needs multi-day endpoint + ML model | hide section, or show all `—` |

**Rule: never display fake or random numbers.** A neutral placeholder is always better than invented data.

---

## Small backend addition needed

The frontend's WATER TEMP card needs `waterTemperatureC`, which the backend doesn't currently produce. One file changes.

### `backend/app/services/marine.py`

Add `sea_surface_temperature` to the hourly request:

```python
_FIELDS = "wave_height,wave_direction,wave_period,wind_wave_peak_period,sea_surface_temperature"
```

Add `water_temperature_c` to the return dict (and the `None` fallback dict):

```python
"water_temperature_c": data["hourly"]["sea_surface_temperature"][idx],
```

### `backend/app/schemas.py`

Add the field to `FeatureRow`:

```python
water_temperature_c: Optional[float] = None
```

That's the entire backend change. After this, the new field flows through the aggregator, the response, and the CSV automatically — no other backend files need touching.

---

## Frontend file structure to create

Adapt to whatever's already there — don't recreate folders that exist. The frontend dev may already have some of this scaffolded.

```
frontend/src/
├── api/
│   └── predict.js              # POST /api/predict wrapper
├── hooks/
│   └── useForecast.js          # state + loading + error around predict.js
├── utils/
│   ├── moonPhase.js            # 0..1 float → phase name + emoji
│   ├── windDirection.js        # degrees → 16-point compass label
│   └── statusBadge.js          # value + thresholds → "Good"/"Marginal"/"Poor"
└── components/
    ├── ConditionsNow.jsx       # container for the 4 cards
    ├── TideCard.jsx
    ├── WindCard.jsx
    ├── WaterTempCard.jsx
    └── MoonCard.jsx
```

---

## Conventions

- `camelCase` for variables, functions, props (standard React/JS).
- Component files: PascalCase (`TideCard.jsx`).
- Utility files: camelCase (`moonPhase.js`).
- Each utility exports one default function — keep them tiny.
- All API calls go through `/api/...` (relative path) so the Vite proxy handles dev and so production deploys work without code changes.
- Short comments above non-trivial functions, same convention as the backend.

---

## File-by-file spec

### `src/api/predict.js`

Thin wrapper around `fetch`. No state, no caching — just the HTTP call.

```javascript
// Calls the backend prediction endpoint with the given date and time.
export async function fetchPrediction(date, time) {
  const response = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, time }),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return response.json();
}
```

### `src/hooks/useForecast.js`

Custom hook that owns the `{ data, loading, error }` state and exposes a `load(date, time)` function.

```javascript
import { useState, useCallback } from 'react';
import { fetchPrediction } from '../api/predict';

// Stateful wrapper around the prediction API.
export function useForecast() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (date, time) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPrediction(date, time);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, load };
}
```

### `src/utils/moonPhase.js`

Float in `[0, 1]` → readable phase name. Optional emoji.

```javascript
// Maps a moon phase fraction (0..1) to a human-readable name.
export function moonPhaseName(phase) {
  if (phase === null || phase === undefined) return '—';
  if (phase < 0.03 || phase > 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}
```

### `src/utils/windDirection.js`

Degrees → 16-point compass. Used for the "W" label on the WIND card.

```javascript
// Converts a bearing in degrees to a 16-point compass label.
export function compassLabel(degrees) {
  if (degrees === null || degrees === undefined) return '—';
  const points = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(degrees / 22.5) % 16;
  return points[idx];
}
```

### `src/utils/statusBadge.js`

Maps numeric values to status text + color class. Each card calls this with its own thresholds.

```javascript
// Categorizes a value against three thresholds into a status label.
export function statusBadge(value, goodMax, marginalMax) {
  if (value === null || value === undefined) return { label: '—', tone: 'neutral' };
  if (value <= goodMax) return { label: 'Good', tone: 'good' };
  if (value <= marginalMax) return { label: 'Marginal', tone: 'marginal' };
  return { label: 'Poor', tone: 'poor' };
}
```

Suggested thresholds per card:

- **TIDE** by `Math.abs(nextTideHeightM)`: good ≤ 0.3, marginal ≤ 0.6, else poor.
- **WIND** by `windSpeedKmh`: good ≤ 15, marginal ≤ 25, else poor.
- **WATER TEMP** is inverse — warm is good. Easier to write a small dedicated function:
  - ≥ 18°C → Good, 14–18 → Marginal, < 14 → Poor.

### `src/components/TideCard.jsx`

Receives the full `features` object as a prop and renders the existing card visually.

```jsx
import { statusBadge } from '../utils/statusBadge';

// Renders the tide card from the features payload.
export function TideCard({ features }) {
  const height = features?.nextTideHeightM;
  const type = features?.nextTideType;

  const displayHeight = height === null || height === undefined ? '—' : Math.abs(height).toFixed(1);
  const direction = type === 'high' ? 'Rising' : type === 'low' ? 'Falling' : '—';
  const status = statusBadge(Math.abs(height ?? 999), 0.3, 0.6);

  return (
    // existing markup, just swap hardcoded "0.4 m / Rising / Good" with displayHeight / direction / status.label
  );
}
```

Same pattern for the other three cards — pull the field, format, derive status, render. Keep the existing visual JSX as-is.

### `src/App.jsx` (or wherever the top-level state lives)

Call `useForecast` once at the top, fetch on mount with today's date + next round hour, and re-fetch on "Check conditions" button click.

```jsx
import { useEffect } from 'react';
import { useForecast } from './hooks/useForecast';

function App() {
  const { data, loading, error, load } = useForecast();

  // On first render, fetch a forecast for the next round hour today.
  useEffect(() => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hh = String(now.getHours() + 1).padStart(2, '0');
    load(date, `${hh}:00`);
  }, [load]);

  const handleCheck = (pickedDate, pickedTime) => {
    load(pickedDate, pickedTime);
  };

  // Pass data?.features down to ConditionsNow, header date down to the header, etc.
}
```

---

## Loading & error states

- **While `loading` is true**: each card shows a skeleton (animated grey block) or an `—` for its value.
- **On `error`**: render an inline message above the cards (`Couldn't reach the forecast service. Try again.`). Don't clear previously good data — last successful values stay visible.
- **`Check conditions` button** is disabled while `loading` is true.

---

## How to handle the ML-blocked UI sections

Pick **one** approach per section and apply consistently:

### Option A — keep the section, show neutral placeholders (recommended for demo)
- "Next Optimal Window" → big text reads `—`, subtext reads `Awaiting prediction model`.
- Confidence gauge → render at 0% with the label `Pending`, dimmed.
- Tide Curve → hide the chart, show `Detailed tide chart coming next` in the empty space.
- Coming Up 5-day → hide entirely OR show 5 cards with `—` values.

### Option B — hide the sections entirely
- Cleaner-looking demo, but the page feels shorter.

**Don't mix**: either every blocked section is a placeholder, or every one is hidden. Inconsistency reads as "we forgot a part".

---

## Security & hygiene

- Never put the StormGlass key (or any backend secret) in frontend code. The frontend doesn't need it — the backend handles it.
- All requests go through the relative `/api/...` path. Don't hardcode `http://localhost:8000`. The Vite proxy is already configured for dev; in production a reverse proxy or rewrites handle it.
- Don't log `data` to the browser console in production code. A temporary `console.log` during dev is fine, remove before final demo.
- Handle `null` everywhere — every field in `features` except `datetime` can be `null` (a source failed gracefully). Frontend never crashes on `null`.

---

## Things explicitly NOT in this step

- No new endpoints (other than `waterTemperatureC` field).
- No ML model integration.
- No multi-day forecast logic.
- No tide curve charting.
- No authentication.
- No production build / deploy config.
- No tests.

---

## Done when

1. Page loads. The 4 "Conditions Now" cards populate with real values within ~2 seconds.
2. Header shows today's actual date (compare against your system clock).
3. The user picks a future date/time in the picker, clicks "Check conditions" → the same 4 cards update with values for that future moment.
4. Disconnect Wi-Fi, refresh the page → graceful error message appears, no white-screen crash.
5. Set the StormGlass key wrong on the backend → TIDE card shows `—` with `—` status; the other three cards still work.
6. The 4 blocked sections (Optimal Window, Confidence, Tide Curve, Coming Up) consistently show placeholders or are hidden — no invented numbers anywhere.
7. Browser DevTools → Network tab → `predict` request body contains exactly `{ "date": "...", "time": "..." }` and nothing else. Response contains `features` and `csv`. No keys, no internal paths.

---

## Notes for the frontend dev

- Keep the existing visual design. Same colors, same fonts, same layouts. This step is purely about replacing data sources, not rethinking the UI.
- Component file structure above is a suggestion. If you already have these cards as one big component or in a different layout, adapt — the data flow is what matters.
- The current "Forecast received." green message can stay or go. Up to you. If you keep it, only show it briefly after a successful "Check conditions" click, then fade.
- When the ML model lands (step 5), you'll add a `confidence` and `visibilityScore` field to the response. The blocked sections will start populating with no further frontend restructuring — that's the whole reason to use placeholders instead of fake numbers now.
