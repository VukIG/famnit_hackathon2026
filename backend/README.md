# Backend — Step 2: External Data Aggregation

FastAPI backend that accepts a date and time, fetches live marine/weather/tide/moon data, and returns a feature row for the frontend and (in the next step) the ML model.

## Setup

```
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
cp .env.example .env
```

## Configuration

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `CORS_ORIGINS` | JSON array of allowed frontend origins |
| `SITE_LAT` | Fixed site latitude (default: 45.5482) |
| `SITE_LNG` | Fixed site longitude (default: 13.7296) |
| `SITE_TIMEZONE` | IANA timezone string (default: Europe/Ljubljana) |
| `STORMGLASS_API_KEY` | API key from stormglass.io (free tier: 10 req/day) |

> StormGlass requires signup at https://stormglass.io/ for an API key.
> Without `STORMGLASS_API_KEY`, tide fields will be `null` — the rest of the response still works.

## Run

```
uvicorn app.main:app --reload
```

## Test

```
curl -X POST http://localhost:8000/api/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"date\":\"2026-05-20\",\"time\":\"14:00\"}"
```
