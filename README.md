# FAMNIT Hackathon

Sea visibility forecast app. React frontend + FastAPI backend.

## Prerequisites

- Python 3.11+
- Node.js 18+

## First-time setup

Clone the repo, then:

### Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env

### Frontend
cd frontend
npm install

## Running

You need **two terminals**, both with the repo open.

**Terminal 1 — backend**
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload
Runs on http://localhost:8000

**Terminal 2 — frontend**
cd frontend
npm run dev
Runs on http://localhost:5173

## Sanity checks

- Open http://localhost:5173 — the app
- Open http://localhost:8000/docs — backend API docs (Swagger)
- Pick a date/time in the app, click "Check conditions" — should see "Forecast received."

## Notes

- On macOS/Linux, replace `.venv\Scripts\activate` with `source .venv/bin/activate` and `copy` with `cp`.
- Keep both terminals running while developing.