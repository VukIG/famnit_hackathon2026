# YOU(R) SEA Data Source Report

This report explains which data in the current project is hard-coded, which data is fetched or computed from real sources, and which frontend/backend components use each category.

## Summary

The landing page currently mixes two data systems:

1. **Hard-coded frontend presentation data**
   This powers most of the initial landing page: hero text, default visibility score, forecast cards, tide chart, trust labels, location label, and detail panel.

2. **Real backend prediction data**
   This is fetched only after the user runs a forecast scan through `/api/predict`. It uses Open-Meteo, WorldTides when configured, Astral moon calculations, site config, and the local ML model.

At page load, the user mostly sees hard-coded/mock data. After clicking `Run visibility scan` or `Check conditions`, selected sections update with real backend response data.

---

## Hard-Coded / Mock Data

Hard-coded data means values written directly in source code instead of fetched from an API, database, model, or user input.

### 1. `MOCK_FORECAST`

**File:** `frontend/src/App.jsx`

`MOCK_FORECAST` is the main mock dataset for the landing page.

It contains:

- `locationName`: `"Sea Oasis — Site Alpha"`
- `generatedAt`: current browser time via `new Date().toISOString()`
- Five predefined forecast windows
- Fixed start/end times
- Fixed confidence values
- Fixed visibility scores
- Fixed condition states
- Fixed factor values for tide, wind, water temperature, and moon
- Fixed reasoning text

Example values:

- First window starts at `2025-06-10T14:20:00`
- First window ends at `2025-06-10T15:50:00`
- Confidence is `0.87`
- Visibility score is `8.4`
- Condition state is `optimal`

### Components / functions using `MOCK_FORECAST`

| Component / Function | Usage |
|---|---|
| `App` | Sets `const hero = MOCK_FORECAST.windows[0]` for the default hero state. |
| Topbar JSX in `App` | Displays `MOCK_FORECAST.locationName`. |
| Hero JSX in `App` | Uses `hero.confidence`, `hero.startsAt`, `hero.endsAt`, `hero.factors`, and `hero.conditionState`. |
| `ConfidenceGauge` | Receives mock `hero.confidence` before real API data exists. |
| Forecast strip JSX in `App` | Maps `MOCK_FORECAST.windows` into `WindowCard` components. |
| `WindowCard` | Displays each mock forecast window. |
| Detail panel JSX in `App` | Displays selected mock window details and reasoning. |
| Footer JSX in `App` | Displays `MOCK_FORECAST.generatedAt`. |

### 2. `TIDE_CURVE`

**File:** `frontend/src/App.jsx`

`TIDE_CURVE` is a fixed list of tide levels for a 24-hour chart.

It contains hard-coded values such as:

- `00:00` -> `0.9`
- `04:00` -> `1.8`
- `12:00` -> `0.3`
- `23:59` -> `1.2`

### Components / functions using `TIDE_CURVE`

| Component / Function | Usage |
|---|---|
| Tide chart JSX in `App` | Passes `TIDE_CURVE` to Recharts `AreaChart`. |
| `TideTooltip` | Displays the hard-coded tide chart point currently hovered. |

### 3. Hard-coded hero and product copy

**File:** `frontend/src/App.jsx`

These values are fixed marketing/presentation text:

- `"Know when the ocean opens."`
- `"AI-assisted marine forecasting using tide movement, wind turbulence, water temperature, and lunar conditions."`
- `"Low tide + calm wind"`
- `"Warm water, stable moon cycle"`
- `"Run visibility scan"`
- `"Forecast a launch window"`
- `"Use live time"`

### Components using this copy

| Component / Function | Usage |
|---|---|
| Hero JSX in `App` | Displays headline, subcopy, CTA, and summary cards. |
| Picker JSX in `App` | Displays form labels and buttons. |

### 4. Hard-coded trust signals

**File:** `frontend/src/App.jsx`

The trust line currently includes partially hard-coded source labels:

- `NOAA tide feed`
- `Buoy station SO-17`
- `45.536 N, 13.730 E`

The moon phase/date inside that same line are derived from the mock `hero` object.

### Components using trust signals

| Component / Function | Usage |
|---|---|
| Hero JSX in `App` | Displays the trust line below the CTA. |

### Important note

The backend does **not** currently use NOAA or buoy station `SO-17`. The real backend uses:

- Open-Meteo Forecast API
- Open-Meteo Marine API
- WorldTides API if `worldtides_api_key` is configured
- Astral moon calculations

So the NOAA / buoy station labels are presentation placeholders, not verified live integrations.

### 5. Hard-coded chart highlight window

**File:** `frontend/src/App.jsx`

The tide chart uses fixed Recharts reference lines:

- `ReferenceLine x="14:00"`
- `ReferenceLine x="16:00"`

These are not dynamically computed from live tide or prediction data.

### Components using this data

| Component / Function | Usage |
|---|---|
| Tide chart JSX in `App` | Highlights a fixed optimal window band on the chart. |

### 6. Hard-coded styling, animations, and visual values

**Files:**

- `frontend/src/App.jsx`
- `frontend/src/components/SeaBackground.jsx`

These include:

- CSS colors
- Gradients
- Glow values
- Particle count limits
- Bubble count
- Animation durations
- Gauge dimensions
- Layout spacing

These are not data from the forecasting system. They are design constants.

### Components using visual constants

| Component / Function | Usage |
|---|---|
| `SeaBackground` | Uses hard-coded ocean layers and background structure. |
| `Caustics` | Uses hard-coded wave/caustic drawing parameters. |
| `Plankton` | Uses generated visual particles. |
| `Bubbles` | Uses module-level generated bubble positions and animation values. |
| CSS inside `App.jsx` | Controls all landing page visual presentation. |

### 7. Hidden legacy picker state

**File:** `frontend/src/App.jsx`

The redesigned visible picker uses:

- `pickerDateTime`
- `<input type="datetime-local" />`

However, the old segmented picker still exists inside a hidden `<div style={{ display: "none" }}>`.

It still contains state variables:

- `pickerDay`
- `pickerMonth`
- `pickerYear`
- `pickerHour`
- `pickerMin`
- `pickerOpen`

These hidden controls are no longer visible to users and are not used by the active `handleCheck` logic. They are effectively legacy UI code.

---

## Real Data

Real data means values fetched from external services, derived from user input, loaded from configuration, or computed by the backend model.

## 1. User-selected date and time

**File:** `frontend/src/App.jsx`

The visible picker stores user-selected date/time in:

- `pickerDateTime`

When the user clicks `Run visibility scan` or `Check conditions`, `handleCheck` splits it into:

- `date`
- `time`

These values are sent to:

```txt
POST /api/predict
```

### Components / functions using this data

| Component / Function | Usage |
|---|---|
| Visible picker JSX in `App` | Lets user choose date/time. |
| `handleCheck` in `App` | Sends date/time to backend. |
| Backend `predict` route | Parses the selected date/time into a Python `datetime`. |

## 2. Backend prediction response

**Frontend file:** `frontend/src/App.jsx`

After the API call succeeds, the response is stored in:

- `data`
- `queryInfo`

The frontend expects fields like:

- `data.visibilityScore`
- `data.statusLabel`
- `data.statusTone`
- `data.features.nextTideHeightM`
- `data.features.nextTideType`
- `data.features.windSpeedKmh`
- `data.features.waterTemperatureC`
- `data.features.moonPhase`

### Components / functions using backend prediction response

| Component / Function | Usage |
|---|---|
| Hero JSX in `App` | Replaces mock hero visibility score with real computed visibility after scan. |
| `ConfidenceGauge` | Uses real computed visibility after scan. |
| Picker result summary JSX | Displays status and selected date/time result. |
| Factor strip JSX in `App` | Displays real tide, wind, water temperature, and moon phase after scan. |
| `FactorTile` | Receives real feature values from `data.features`. |

## 3. `/api/predict` backend endpoint

**File:** `backend/app/routes/prediction.py`

The endpoint:

1. Receives `date` and `time`
2. Builds a target datetime
3. Calls `build_feature_row(target)`
4. Converts features to CSV
5. Runs `predict_visibility(...)`
6. Converts the score to a status label/tone
7. Returns a `PredictionResponse`

### Backend functions using this data

| Function | File | Usage |
|---|---|---|
| `predict` | `backend/app/routes/prediction.py` | Main API route called by frontend. |
| `build_feature_row` | `backend/app/services/aggregator.py` | Collects weather, marine, tide, and moon data. |
| `predict_visibility` | `backend/app/ml/visibility.py` | Produces model score from feature row. |
| `status_from_score` | `backend/app/ml/visibility.py` | Converts model score into UI status. |

## 4. Open-Meteo Forecast data

**File:** `backend/app/services/weather.py`

Fetched from:

```txt
https://api.open-meteo.com/v1/forecast
```

Fields requested:

- `temperature_2m`
- `windspeed_10m`
- `winddirection_10m`
- `cloudcover`
- `relativehumidity_2m`
- `sunrise`
- `sunset`

Returned backend fields:

- `air_temperature_c`
- `wind_speed_kmh`
- `wind_direction_deg`
- `cloud_cover_pct`
- `humidity_pct`
- `sunrise`
- `sunset`

### Components / functions using this data

| Component / Function | Usage |
|---|---|
| `build_feature_row` | Includes weather data in the backend feature row. |
| `predict_visibility` | Uses wind, air temperature, cloud cover, humidity, sunrise, and sunset features. |
| Frontend factor strip | Displays `windSpeedKmh` after prediction. |

## 5. Open-Meteo Marine data

**File:** `backend/app/services/marine.py`

Fetched from:

```txt
https://marine-api.open-meteo.com/v1/marine
```

Fields requested:

- `wave_height`
- `wave_direction`
- `wave_period`
- `wind_wave_peak_period`
- `sea_surface_temperature`

Returned backend fields:

- `wave_height_m`
- `wave_direction_deg`
- `wave_period_s`
- `wave_peak_period_s`
- `water_temperature_c`

### Components / functions using this data

| Component / Function | Usage |
|---|---|
| `build_feature_row` | Includes marine data in the backend feature row. |
| `predict_visibility` | Uses wave and water temperature features. |
| Frontend factor strip | Displays `waterTemperatureC` after prediction. |

## 6. WorldTides data

**File:** `backend/app/services/tides.py`

Fetched from:

```txt
https://www.worldtides.info/api/v3
```

This is only real/live if:

```txt
worldtides_api_key
```

is configured in environment settings.

If no API key exists, the backend returns empty tide values:

- `next_tide_type: None`
- `next_tide_height_m: None`
- `next_tide_time: None`

Returned backend fields when available:

- `next_tide_type`
- `next_tide_height_m`
- `next_tide_time`

The service also uses an on-disk cache:

```txt
backend/.tide_cache.json
```

### Components / functions using this data

| Component / Function | Usage |
|---|---|
| `build_feature_row` | Includes next tide extreme in the backend feature row. |
| Frontend factor strip | Displays `nextTideHeightM` and `nextTideType` after prediction. |

### Important limitation

The ML model currently does not appear to use `next_tide_type`, `next_tide_height_m`, or `next_tide_time` directly in `predict_visibility`. These fields are returned to the frontend, but the visible model input row in `visibility.py` does not include tide fields.

## 7. Astral moon phase calculation

**File:** `backend/app/services/astronomy.py`

This is not fetched from an external API. It is computed locally using:

```python
astral.moon.phase(target.date()) / 28
```

Returned backend field:

- `moon_phase`

### Components / functions using this data

| Component / Function | Usage |
|---|---|
| `build_feature_row` | Adds moon phase to the backend feature row. |
| `predict_visibility` | Uses `moon_phase` as a model feature. |
| Frontend factor strip | Displays `moonPhase` as a percentage after prediction. |

## 8. Site configuration

**File:** `backend/app/config.py`

These values are configured defaults, not fetched live:

- `site_lat: 45.5482`
- `site_lng: 13.7296`
- `site_timezone: Europe/Ljubljana`
- `site_depth_m: 22.0`
- `worldtides_api_key: ""`

They can be overridden through environment variables / `.env`.

### Components / functions using this data

| Component / Function | Usage |
|---|---|
| `fetch_weather` | Uses site latitude, longitude, and timezone. |
| `fetch_wave_data` | Uses site latitude, longitude, and timezone. |
| `fetch_next_tide` | Uses site latitude, longitude, timezone, and WorldTides key. |
| `predict_visibility` | Uses latitude, longitude, and depth as model inputs. |

## 9. ML model prediction

**Files:**

- `backend/app/ml/visibility.py`
- `backend/app/visibility_model.json`

The prediction is real computed output from the bundled XGBoost model.

Inputs include:

- Longitude
- Latitude
- Depth
- Wave height
- Wave direction
- Wave period
- Wave peak period
- Sea surface temperature
- Air temperature
- Wind speed
- Wind direction
- Cloud cover
- Humidity
- Moon phase
- Sunrise/sunset-derived daylight features
- Cyclical day/time features

Output:

- `visibility_score`

Then `status_from_score` converts it to:

- `Excellent` / `good`
- `Moderate` / `marginal`
- `Poor` / `poor`

### Components / functions using this data

| Component / Function | Usage |
|---|---|
| `predict_visibility` | Computes the visibility score. |
| `status_from_score` | Computes label and tone. |
| Hero JSX in `App` | Displays score after scan. |
| `ConfidenceGauge` | Displays score after scan. |
| Picker result summary | Displays status and message after scan. |

---

## Generated / Computed Frontend Data

This category is neither hard-coded mock forecast data nor backend real data.

### 1. Browser current time

**File:** `frontend/src/App.jsx`

Used for:

- Initial `pickerDateTime`
- `Use live time` button
- Topbar current date
- `MOCK_FORECAST.generatedAt`

This is real browser time, but it is not forecast data.

### 2. Derived labels and formatting

**File:** `frontend/src/App.jsx`

Functions:

- `formatTime`
- `formatDate`
- `windowDuration`
- `confidenceLabel`
- `stateColor`
- `stateBg`
- `stateLabel`
- `moonPhaseEmoji`
- `impactIcon`
- `impactColor`
- `toneColor`

These do not fetch data. They format or classify existing values.

### 3. Visual particles and bubbles

**File:** `frontend/src/components/SeaBackground.jsx`

`Caustics`, `Plankton`, and `Bubbles` generate visual motion using canvas, CSS, animation timing, and randomized positions.

This is generated visual data only. It is not environmental or forecast data.

---

## Component-by-Component Data Map

## `App`

**Uses hard-coded/mock data:**

- `MOCK_FORECAST`
- `TIDE_CURVE`
- Product copy
- Trust labels
- Chart highlight times

**Uses real data:**

- User selected `pickerDateTime`
- Backend prediction response stored in `data`
- Query info stored in `queryInfo`

## `ConfidenceGauge`

**Uses hard-coded/mock data before scan:**

- `hero.confidence`
- `hero.conditionState`

**Uses real data after scan:**

- `(100 - data.visibilityScore) / 100`
- `data.statusTone`

## `FactorTile`

**Uses real data after scan:**

- `data.features.nextTideHeightM`
- `data.features.nextTideType`
- `data.features.windSpeedKmh`
- `data.features.waterTemperatureC`
- `data.features.moonPhase`

**Fallback before scan:**

- Displays placeholder dash values.

## `WindowCard`

**Uses hard-coded/mock data only:**

- Each object in `MOCK_FORECAST.windows`

It does not use backend prediction data.

## Detail Panel

**Uses hard-coded/mock data only:**

- Selected item from `MOCK_FORECAST.windows`
- Mock factors
- Mock reasoning text

It does not use backend prediction data.

## Tide Chart

**Uses hard-coded/mock data only:**

- `TIDE_CURVE`
- Fixed `ReferenceLine` values

It does not use backend tide data.

## `TideTooltip`

**Uses hard-coded/mock data only:**

- Hovered point from `TIDE_CURVE`

## `SeaBackground`

**Uses generated visual data only:**

- Canvas animation values
- Module-level bubble positions
- Particle positions

It does not use forecast data.

---

## Backend Data Map

## `backend/app/routes/prediction.py`

**Real/computed data:**

- Receives date/time from frontend
- Calls external services via aggregator
- Runs ML prediction
- Returns prediction response

## `backend/app/services/aggregator.py`

**Real/computed data:**

- Combines weather, marine, tide, and moon data into one `FeatureRow`

## `backend/app/services/weather.py`

**Real external data:**

- Open-Meteo Forecast API

## `backend/app/services/marine.py`

**Real external data:**

- Open-Meteo Marine API

## `backend/app/services/tides.py`

**Real external data when configured:**

- WorldTides API

**Fallback:**

- Empty tide fields if no API key or API failure

## `backend/app/services/astronomy.py`

**Computed local data:**

- Moon phase from Astral

## `backend/app/ml/visibility.py`

**Computed model data:**

- XGBoost visibility score
- Status label and tone

---

## Current Mismatch Between UI and Real Data

The redesigned UI looks like a live marine intelligence product, but several prominent areas are still mock-driven.

### Mock-driven areas

- Forecast cards
- Detail panel
- Tide chart
- Hero default score before scan
- Next best window
- Trust labels
- Reasoning explanations

### Real-data-driven areas after scan

- Hero score
- Gauge score
- Selected-time result summary
- Factor strip values

### Real backend data not fully visualized yet

The backend returns or computes more fields than the frontend currently displays, including:

- Wave height
- Wave direction
- Wave period
- Wave peak period
- Air temperature
- Cloud cover
- Humidity
- Sunrise
- Sunset
- CSV feature row
- Next tide time

---

## Recommended Next Steps

1. Replace `MOCK_FORECAST.windows` with backend-generated forecast windows.
2. Replace `TIDE_CURVE` with real tide series data from WorldTides or another tide source.
3. Make the detail panel use real backend explanations instead of fixed reasoning strings.
4. Replace hard-coded NOAA / buoy station labels with actual configured source metadata.
5. Remove the hidden legacy segmented picker from `App.jsx`.
6. Display currently unused backend fields such as wave height, cloud cover, humidity, and sunrise/sunset.
7. Decide whether tide fields should be included in the ML model input, since the UI emphasizes tide but `predict_visibility` does not currently use tide values.

