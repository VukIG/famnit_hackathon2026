# Backend Plan — Step 2: External Data Aggregation

## Scope of this step

Extend the existing `POST /api/predict` endpoint. When it receives `{date, time}`:

1. Call multiple external APIs for the fixed sea location at the requested datetime.
2. Aggregate all responses into a single **feature row**.
3. Return the features as JSON so the frontend can display real values (tide, wind, moon, etc.) instead of hardcoded ones.
4. Provide a utility that serializes the feature row to CSV, ready for the ML model call in step 3.

**Still NOT in scope:** the ML model itself, persistence, auth, deployment config.

---

## Fixed site location

The app forecasts conditions for one fixed sea point near Koper/Piran (Adriatic):

- Lat: `45.5482`
- Lng: `13.7296`
- Timezone: `Europe/Ljubljana`

These values live in `.env` and are read through `config.py`. **Never hardcode them in service files.**

---

## External services to integrate

| Source | Purpose | Free? | Auth |
|---|---|---|---|
| **Open-Meteo Marine** | wave height, direction, period, peak period | yes, no key | none |
| **Open-Meteo Forecast** | air temperature, wind, humidity, cloud cover, sunrise, sunset | yes, no key | none |
| **StormGlass Tides** | next tide extreme (high/low) | 10 req/day on free tier | `Authorization` header with API key |
| **`astral` (Python library)** | moon phase | free, local, no network | none |

### Endpoint URLs

- Marine: `https://marine-api.open-meteo.com/v1/marine`
  - Params: `latitude`, `longitude`, `hourly=wave_height,wave_direction,wave_period,wave_peak_period`, `timezone`
- Forecast: `https://api.open-meteo.com/v1/forecast`
  - Params: `latitude`, `longitude`, `hourly=temperature_2m,windspeed_10m,winddirection_10m,cloudcover,relativehumidity_2m`, `daily=sunrise,sunset`, `timezone`
- StormGlass tides: `https://api.stormglass.io/v2/tide/extremes/point`
  - Params: `lat`, `lng`, `start` (ISO 8601), `end` (ISO 8601)
  - Header: `Authorization: <STORMGLASS_API_KEY>`

### Forecast horizon

All external APIs cover the next 7 days. The frontend should restrict the date picker to that window (not in this step — flag it for the frontend dev).

---

## The feature row

This is what gets returned and what will later be sent to the ML model.

| Field | Source | Type | Unit |
|---|---|---|---|
| `datetime` | input | `datetime` | ISO 8601 |
| `wave_height_m` | Marine | float | meters |
| `wave_direction_deg` | Marine | float | degrees |
| `wave_period_s` | Marine | float | seconds |
| `wave_peak_period_s` | Marine | float | seconds |
| `air_temperature_c` | Forecast | float | °C |
| `wind_speed_kmh` | Forecast | float | km/h |
| `wind_direction_deg` | Forecast | float | degrees |
| `cloud_cover_pct` | Forecast | float | % |
| `humidity_pct` | Forecast | float | % |
| `sunrise` | Forecast | `datetime` | ISO 8601 |
| `sunset` | Forecast | `datetime` | ISO 8601 |
| `next_tide_type` | StormGlass | str | `"high"` or `"low"` |
| `next_tide_height_m` | StormGlass | float | meters |
| `next_tide_time` | StormGlass | `datetime` | ISO 8601 |
| `moon_phase` | astral | float | 0..1 (0=new, 0.5=full) |

Any field can be `None` if its source fails — the response still returns the rest.

---

## Folder structure to add

```
backend/
├── app/
│   ├── services/
│   │   ├── __init__.py
│   │   ├── marine.py          # Open-Meteo Marine client
│   │   ├── weather.py         # Open-Meteo Forecast client
│   │   ├── tides.py           # StormGlass client
│   │   ├── astronomy.py       # moon phase via astral (local)
│   │   └── aggregator.py      # orchestrates all sources, builds feature row
│   ├── utils/
│   │   ├── __init__.py
│   │   └── csv_export.py      # FeatureRow → CSV string
│   └── (existing files unchanged)
```

---

## File-by-file spec

### `requirements.txt` — add
```
httpx
astral
```

### `.env.example` — add
```
SITE_LAT=45.5482
SITE_LNG=13.7296
SITE_TIMEZONE=Europe/Ljubljana
STORMGLASS_API_KEY=your_key_here
```

### `app/config.py`
Extend `Settings` with:
- `site_lat: float`
- `site_lng: float`
- `site_timezone: str`
- `stormglass_api_key: str`

### `app/schemas.py`
Add a `FeatureRow(CamelModel)` containing every field from the table above with the correct types. All fields except `datetime` are `Optional` (any source can fail).

Update `PredictionResponse(CamelModel)`:
```python
status: str
features: FeatureRow
```

### `app/services/marine.py`
- One function: `async def fetch_wave_data(target: datetime) -> dict`
- Uses `httpx.AsyncClient` with a 5s timeout.
- Hits Open-Meteo Marine, picks the hourly entry matching `target` (hour resolution).
- Returns `{ "wave_height_m": ..., "wave_direction_deg": ..., "wave_period_s": ..., "wave_peak_period_s": ... }`.
- On any exception, return all four fields as `None`.
- Comment above: `# Fetches wave data for the target hour from Open-Meteo Marine.`

### `app/services/weather.py`
- `async def fetch_weather(target: datetime) -> dict`
- One Open-Meteo Forecast call returns both hourly and daily blocks.
- Pick the hour matching `target` for hourly fields.
- Pick the day matching `target.date()` for sunrise/sunset.
- Returns a dict with all seven weather/astro fields. `None` on failure.

### `app/services/tides.py`
- `async def fetch_next_tide(target: datetime) -> dict`
- Calls StormGlass with `start=target`, `end=target + 24h`.
- Picks the **first** extreme after `target`.
- Returns `{ "next_tide_type", "next_tide_height_m", "next_tide_time" }`.
- Specifically handle HTTP 402 (quota exceeded) — log a warning, return all `None`. Don't raise.

### `app/services/astronomy.py`
- `def get_moon_phase(target: datetime) -> float`
- Synchronous (no network).
- Uses `astral.moon.phase(target.date())`, which returns 0..27.99. Divide by 28 to normalize to 0..1.
- Comment above: `# Returns the moon phase as a fraction 0..1 (0=new, 0.5=full).`

### `app/services/aggregator.py`
- `async def build_feature_row(target: datetime) -> FeatureRow`
- The three async services run in parallel via `asyncio.gather(...)`.
- Moon phase is computed synchronously after.
- All results are merged into a `FeatureRow` and returned.
- Comment above: `# Calls all external sources in parallel and assembles the feature row.`

### `app/utils/csv_export.py`
- `def feature_row_to_csv(row: FeatureRow) -> str`
- Returns a two-line CSV string: header row, then the data row.
- Uses stdlib `csv` module — no pandas dependency.
- Will be consumed in step 3 when the ML model gets wired in. Not called in this step.

### `app/routes/prediction.py`
Update the existing endpoint:
- After combining `date + time` into a `datetime`, call `await build_feature_row(target)`.
- Return `PredictionResponse(status="ok", features=row)`.

### `app/main.py`
No changes.

### `README.md`
Add a **Configuration** section:
- List the new env vars.
- Note that StormGlass requires signup at `https://stormglass.io/` for an API key (free tier: 10 requests/day).
- Note that without `STORMGLASS_API_KEY`, tide fields will be `null` but the rest of the response still works.

---

## Conventions (unchanged from step 1)

- `snake_case` in Python, `camelCase` over the wire (via `CamelModel`).
- One-line "what it does" comments above non-trivial functions.
- Type hints on every function.
- Return Pydantic models from endpoints, not raw dicts.
- Three import groups: stdlib, third-party, local.

---

## Error handling rule (important)

Each service wraps its call in `try/except`, logs the error to stderr, and returns its dict with `None` values for every field. The endpoint **never** 500s because one external API is down — the response always comes back with whatever data was successfully fetched. The frontend handles `null` fields gracefully.

---

## Explicitly NOT in scope

- No ML model loading or inference.
- No prediction output (muddy/clear).
- No database, no caching layer.
- No authentication or rate limiting.
- No retries beyond a single attempt per call.
- No tests yet.
- No Dockerfile.

---

## Done when

1. `POST /api/predict` with valid `{date, time}` (within next 7 days) returns 200 with a populated `features` object.
2. With network disabled, the same request still returns 200 — most fields `null`, `moonPhase` still populated.
3. With an invalid `STORMGLASS_API_KEY`, tide fields are `null` but all other fields are filled in.
4. The frontend can read `response.features.windSpeedKmh`, `response.features.waveHeightM`, etc. and replace its hardcoded values.
5. The four sources run in parallel — total request latency is roughly the slowest single call, not the sum of all of them.
6. `feature_row_to_csv(row)` returns a clean two-line CSV string (header + data) — verified by a quick print in `python -c`.
