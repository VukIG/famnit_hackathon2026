from datetime import datetime
from fastapi import APIRouter
from app.schemas import PredictionRequest

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict")
def predict(body: PredictionRequest) -> dict:
    """
    STUB: returns a fabricated forecast window for the requested datetime.
    Replace internals with real model output later; keep response shape stable.
    """
    combined = datetime.strptime(f"{body.date} {body.time}", "%Y-%m-%d %H:%M")
    starts = combined.replace(minute=0, second=0, microsecond=0)
    ends = starts.replace(hour=(starts.hour + 1) % 24)

    return {
        "status": "ok",
        "window": {
            "id": f"q-{int(starts.timestamp())}",
            "label": starts.strftime("%a %d %b"),
            "startsAt": starts.isoformat(),
            "endsAt": ends.isoformat(),
            "confidence": 0.74,
            "visibilityScore": 7.1,
            "conditionState": "optimal",
            "factors": {
                "tide": {"value": 0.5, "unit": "m", "trend": "rising", "impact": "good"},
                "wind": {"value": 11, "unit": "km/h", "direction": "W", "impact": "good"},
                "waterTemp": {"value": 22, "unit": "°C", "impact": "good"},
                "moonDistance": {"value": 372000, "unit": "km", "phase": "Waxing Gibbous", "impact": "neutral"},
            },
            "reasoning": [
                f"Queried window: {starts.strftime('%H:%M')} – {ends.strftime('%H:%M')}.",
                "Stub response — replace with ML inference output.",
                "Conditions look favourable in this window based on stub data.",
            ],
        },
    }
