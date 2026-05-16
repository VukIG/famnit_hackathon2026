# Backend — Step 1: Date & Time Input Processing

Minimal FastAPI backend that accepts a date and time from the frontend, validates the format, and acknowledges the request.

## Setup

```
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
cp .env.example .env
```

## Run

```
uvicorn app.main:app --reload
```

## Test

```
curl -X POST http://localhost:8000/api/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"date\":\"2026-05-20\",\"time\":\"14:30\"}"
```
