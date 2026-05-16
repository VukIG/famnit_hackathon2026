# Backend Plan — Step 1: Date & Time Input Processing

## Scope of this step

Build a minimal FastAPI backend in `/backend` that accepts a `date` and a `time` from the React frontend, validates the format, and acknowledges the request.

**Nothing else.** No weather/wind/moon API calls, no ML model, no database, no auth, no Docker, no tests. All of that comes in later steps.

---

## Stack

- Python 3.11+
- FastAPI
- Uvicorn (dev server)
- Pydantic v2
- pydantic-settings (env config)

---

## Folder structure to create

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── schemas.py
│   └── routes/
│       ├── __init__.py
│       └── prediction.py
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## Conventions

### Naming
- Python code (functions, variables, filenames): `snake_case`
- API JSON over the wire (request + response): `camelCase`
- Bridge with a shared Pydantic base model using `alias_generator=to_camel` and `populate_by_name=True`. Define this base once in `schemas.py` and inherit from it for every request/response model.

### Comments
- Short one-line comments above non-trivial functions and important blocks only.
- Style: "Parses and validates the incoming date and time." Describe **what**, not **how**.
- No comments on self-explanatory lines. No block of comments at the top of files.

### Imports
- Three groups separated by a blank line: stdlib, third-party, local.

### General code style
- Clean, minimal, no dead code, no `print` debugging left in.
- Type hints on every function signature.
- Return Pydantic models from endpoints (not raw dicts).

---

## Endpoint to build

### `POST /api/predict`

**Request body (JSON, camelCase):**
```json
{
  "date": "2026-05-20",
  "time": "14:30"
}
```

**Field rules:**
- `date`: string, format `YYYY-MM-DD`
- `time`: string, format `HH:MM` (24-hour)
- Validation is format-only at this stage. Do not enforce "future" or "within N days" — that's a later step.

**Success response (200):**
```json
{
  "status": "ok"
}
```

**Validation failure:**
- Return 422 (FastAPI default for Pydantic errors). Don't customize the error shape yet.

---

## File-by-file spec

### `requirements.txt`
```
fastapi
uvicorn[standard]
pydantic
pydantic-settings
```

### `.env.example`
```
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### `.gitignore`
Standard Python ignores: `__pycache__/`, `*.pyc`, `.env`, `.venv/`, `venv/`, `.pytest_cache/`, `*.egg-info/`, `.idea/`, `.vscode/`.

### `app/config.py`
- A `Settings` class extending `pydantic_settings.BaseSettings`.
- Reads `CORS_ORIGINS` from env as a comma-separated string, exposes it as `list[str]`.
- Reads `.env` automatically (`model_config = SettingsConfigDict(env_file=".env")`).
- Export a single module-level `settings = Settings()` instance.

### `app/schemas.py`
- `CamelModel`: base class extending `pydantic.BaseModel` with `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)`. Every request/response model in the project inherits from this.
- `PredictionRequest(CamelModel)`:
  - `date: str`
  - `time: str`
  - Field validator on `date`: must match `YYYY-MM-DD` and parse via `datetime.strptime`.
  - Field validator on `time`: must match `HH:MM` and parse via `datetime.strptime`.
  - On invalid format, raise `ValueError` with a clear message ("date must be in YYYY-MM-DD format", etc.).
- `PredictionResponse(CamelModel)`:
  - `status: str`

### `app/routes/prediction.py`
- An `APIRouter` with `prefix="/api"` and `tags=["prediction"]`.
- One endpoint: `POST /predict`.
- Signature receives a `PredictionRequest` and returns a `PredictionResponse`.
- Body of the function: combine `date` and `time` into a single `datetime` object for internal use (this is the "processing" step), then return `PredictionResponse(status="ok")`.
- Add a short comment above the combine step: `# Combines the validated date and time into a single datetime for downstream use.`

### `app/main.py`
- Instantiate `FastAPI(title="Backend")`.
- Add `CORSMiddleware`:
  - `allow_origins=settings.cors_origins`
  - `allow_methods=["*"]`
  - `allow_headers=["*"]`
  - `allow_credentials=True`
- Include the prediction router.
- Add a `GET /health` endpoint that returns `{"status": "ok"}` for sanity checks.

### `README.md`
Short and useful — no fluff:
- One sentence: what this backend is and what step it's at.
- **Setup**:
  ```
  cd backend
  python -m venv .venv
  .venv\Scripts\activate    # Windows
  pip install -r requirements.txt
  cp .env.example .env
  ```
- **Run**: `uvicorn app.main:app --reload`
- **Test**:
  ```
  curl -X POST http://localhost:8000/api/predict ^
    -H "Content-Type: application/json" ^
    -d "{\"date\":\"2026-05-20\",\"time\":\"14:30\"}"
  ```

---

## Explicitly NOT in scope (do not add)

- Weather, wind, moon, tide, or any external API integration
- ML model loading or inference
- Any prediction logic
- Database, ORM, migrations
- Authentication or rate limiting
- Dockerfile / docker-compose
- Tests (pytest, etc.)
- Logging configuration beyond FastAPI defaults
- Custom exception handlers

---

## Definition of done

1. `uvicorn app.main:app --reload` starts cleanly from inside `/backend` with no warnings about missing deps.
2. `GET http://localhost:8000/health` returns `{"status": "ok"}`.
3. `POST http://localhost:8000/api/predict` with body `{"date": "2026-05-20", "time": "14:30"}` returns 200 and `{"status": "ok"}`.
4. The same POST with `{"date": "20-05-2026", "time": "14:30"}` returns 422.
5. The same POST with `{"date": "2026-05-20", "time": "25:00"}` returns 422.
6. The React frontend at `http://localhost:5173` can call `/api/predict` without CORS errors.
