# Wire Frontend to Backend — Implementation Report

## 1. Files Changed

| Path | Description |
|------|-------------|
| `backend/app/routes/forecast.py` | Created — stub GET /api/forecast and GET /api/tide-curve endpoints |
| `backend/app/main.py` | Added import and include_router for forecast_router |
| `backend/app/routes/prediction.py` | Extended POST /api/predict to return a full window object alongside status |
| `frontend/src/App.jsx` | Added forecast/tideCurve state, fetch-on-mount useEffect, swapped MOCK_FORECAST → forecast and TIDE_CURVE → tideCurve in JSX, updated handleCheck to consume window from response |

## 2. What Was Tested

- Frontend build: `npm run build` completed with zero errors (one pre-existing chunk-size warning).
- Vite proxy config confirmed: `/api` → `http://localhost:8000` already present in `vite.config.js`.
- Code review confirmed all five MOCK_FORECAST references inside JSX were replaced with `forecast`.
- TIDE_CURVE reference in AreaChart replaced with `tideCurve`.
- `handleCheck` replacement verified by reading file after edit.
- `MOCK_FORECAST` constant and `TIDE_CURVE` constant left intact as fallbacks.

## 3. What Was NOT Tested

- Live curl requests to the running backend (uvicorn not started during this session).
- Browser DevTools network tab verification (UI not launched).
- Fallback behaviour (backend down, mock data renders) — not tested at runtime.
- POST /api/predict end-to-end in browser (requires running both servers).

## 4. Deviations from Plan

None. All changes follow the plan exactly:
- Only the four specified files were modified.
- No npm or pip dependencies added.
- No UI/CSS/layout changes.
- MOCK_FORECAST and TIDE_CURVE constants preserved.
- CORS, config.py, schemas.py base classes left untouched.

## 5. Known Limitations

- All three endpoints return hardcoded stub data. The `/api/forecast` generatedAt is live (UTC now), but the window datetimes are fixed to June 2025.
- `/api/predict` returns the same stub conditions regardless of the queried datetime — only `startsAt`, `endsAt`, `id`, and `label` reflect the actual input.
- To plug in real ML output: replace the return bodies in `forecast.py` and `prediction.py` with calls to the model inference layer. The response shape must remain identical.

## 6. Vite Proxy Status

Confirmed working. `frontend/vite.config.js` already contains:

```js
server: {
  proxy: {
    '/api': 'http://localhost:8000',
  },
},
```

No changes needed.
