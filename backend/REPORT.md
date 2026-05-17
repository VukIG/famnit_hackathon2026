# Copernicus Fetch API — Implementation Report

## Iteration 2 — Ocean colour + waves + fallback

### Modified
- `app/services/copernicus_service.py` — replaced entirely. Adds 2 new datasets
  (ocean colour TUR/SPM/CHL, waves VHM0/VTM10/VHM0_WW/VHM0_SW1). Implements
  progressive depth widening (configured → 0–30m → 0–5m surface) in one
  Copernicus call per dataset. Adds REGIONAL_FALLBACK constants and a
  `data_quality` per-variable tag (real_configured / real_widened /
  real_surface / fallback / fetch_failed).
- `app/services/storage_service.py` — extended COLUMNS and row mapping with
  the 7 new variables. `data_quality` deliberately excluded from CSV.

### Untouched
- `app/routes/data.py` — handler is variable-agnostic, no changes needed.
- `app/schemas.py` — record field is `dict`, passes new vars through.
- `app/main.py`, `app/config.py`, `requirements.txt`, `.gitignore`.

### Verification
- py_compile passed for copernicus_service.py, storage_service.py, data.py
- import check output:
  ```
  ['/openapi.json', '/docs', '/docs/oauth2-redirect', '/redoc', '/api/predict', '/data/fetch', '/health']
  ```

### What to test
```powershell
curl -X POST http://127.0.0.1:8000/data/fetch `
  -H "Content-Type: application/json" `
  -d '{\"date\": \"2026-05-18\", \"time\": \"09:00\"}'
```
Expect: every variable present and numeric; `data_quality` dict shows which
are real fetches vs fallback.

---


## Files created

- `app/services/copernicus_service.py` — Copernicus Marine data fetcher; pulls uo, vo, thetao, so, zos, mlotst for the fixed Cape Madona site on a given date
- `app/services/storage_service.py` — CSV append-only writer; one daily file under settings.data_dir
- `app/services/firebase_service.py` — Firebase RTDB REST client; POSTs to /fetches.json
- `app/routes/data.py` — POST /data/fetch endpoint; orchestrates Copernicus -> CSV -> Firebase
- `backend/.gitignore` — created (was missing); ignores .env, data/copernicus/, *.csv, __pycache__, .venv

## Files edited

- `requirements.txt` — added: copernicusmarine>=2.0.0, xarray>=2024.0.0, requests>=2.32, python-dotenv>=1.0
- `app/config.py` — added extra="ignore" to model_config (fixes worldtides_api_key validation error); added copernicusmarine_service_username/password, firebase_db_url/auth, data_dir, site_latitude/longitude/depth_min/depth_max/bbox_pad; all existing fields preserved
- `app/schemas.py` — appended CopernicusFetchRequest and CopernicusFetchResponse; PredictionRequest and PredictionResponse untouched
- `app/main.py` — added import + include_router for data_router; prediction_router untouched

## Verification

- [x] py_compile (and ast.parse) passed for every new and edited file:
  - app/config.py: OK
  - app/schemas.py: OK
  - app/main.py: OK
  - app/routes/data.py: OK
  - app/services/copernicus_service.py: OK
  - app/services/storage_service.py: OK
  - app/services/firebase_service.py: OK
- [ ] Full import check (`from app.main import app`) could not run — `requests` is not installed in the venv yet.
  Run `pip install -r requirements.txt` first, then:
  ```
  python -c "from app.main import app; print([r.path for r in app.routes])"
  ```
  Expected output includes: `/api/predict`, `/data/fetch`, `/health`

## Deviations

- `app/services/__init__.py` was already present (not created). No change needed.
- `app/routes/forecast.py` also exists but is not wired into main.py (left as-is per plan — plan only adds data_router).
- Full import check failed because `requests` is not yet installed. All syntax checks pass.

## Manual test (user runs after pip install + uvicorn start)

```powershell
curl -X POST http://127.0.0.1:8000/data/fetch `
  -H "Content-Type: application/json" `
  -d '{\"date\": \"2026-05-18\", \"time\": \"09:00\"}'
```

Or via Swagger at http://127.0.0.1:8000/docs → POST /data/fetch.

## Next step for user

```powershell
cd D:\Projects\GDG-Hackathon\famnit_hackathon2026\backend
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
