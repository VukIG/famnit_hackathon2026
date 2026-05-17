"""
STUB ENDPOINTS — return hardcoded forecast data matching the frontend shape.
Replace internals with real model output later; do not change response shape.
"""
from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["forecast"])


@router.get("/forecast")
def get_forecast() -> dict:
    """Full forecast: location, generated timestamp, and 5 windows."""
    return {
        "locationName": "Sea Oasis — Site Alpha",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windows": [
            {
                "id": "w1",
                "label": "Today",
                "startsAt": "2025-06-10T14:20:00",
                "endsAt": "2025-06-10T15:50:00",
                "confidence": 0.87,
                "visibilityScore": 8.4,
                "conditionState": "optimal",
                "factors": {
                    "tide": {"value": 0.4, "unit": "m", "trend": "rising", "impact": "good"},
                    "wind": {"value": 12, "unit": "km/h", "direction": "W", "impact": "good"},
                    "waterTemp": {"value": 22, "unit": "°C", "impact": "good"},
                    "moonDistance": {"value": 362000, "unit": "km", "phase": "Waxing Gibbous", "impact": "neutral"},
                },
                "reasoning": [
                    "Tide rising through the window — optimal light penetration expected.",
                    "Wind below 15 km/h threshold; surface chop minimal.",
                    "Water temperature in ideal range for visibility.",
                    "Moon 92% full; no significant lunar tidal effect today.",
                ],
            },
            {
                "id": "w2",
                "label": "Tue",
                "startsAt": "2025-06-11T09:45:00",
                "endsAt": "2025-06-11T11:10:00",
                "confidence": 0.61,
                "visibilityScore": 5.9,
                "conditionState": "marginal",
                "factors": {
                    "tide": {"value": 0.7, "unit": "m", "trend": "falling", "impact": "neutral"},
                    "wind": {"value": 22, "unit": "km/h", "direction": "SW", "impact": "neutral"},
                    "waterTemp": {"value": 21, "unit": "°C", "impact": "good"},
                    "moonDistance": {"value": 370000, "unit": "km", "phase": "Full Moon", "impact": "neutral"},
                },
                "reasoning": [
                    "Tide falling — moderate silt disturbance possible.",
                    "Wind at 22 km/h may create surface chop reducing visibility.",
                    "Overall marginal — proceed with caution.",
                ],
            },
            {
                "id": "w3",
                "label": "Wed",
                "startsAt": "2025-06-12T16:00:00",
                "endsAt": "2025-06-12T17:20:00",
                "confidence": 0.29,
                "visibilityScore": 2.1,
                "conditionState": "poor",
                "factors": {
                    "tide": {"value": 1.2, "unit": "m", "trend": "falling", "impact": "bad"},
                    "wind": {"value": 38, "unit": "km/h", "direction": "NW", "impact": "bad"},
                    "waterTemp": {"value": 19, "unit": "°C", "impact": "neutral"},
                    "moonDistance": {"value": 380000, "unit": "km", "phase": "Waning Gibbous", "impact": "neutral"},
                },
                "reasoning": [
                    "High wind (38 km/h) — significant surface disturbance.",
                    "Tide at high-water mark; turbidity elevated.",
                    "Not recommended. Reschedule if possible.",
                ],
            },
            {
                "id": "w4",
                "label": "Thu",
                "startsAt": "2025-06-13T11:10:00",
                "endsAt": "2025-06-13T12:40:00",
                "confidence": 0.78,
                "visibilityScore": 7.6,
                "conditionState": "optimal",
                "factors": {
                    "tide": {"value": 0.3, "unit": "m", "trend": "rising", "impact": "good"},
                    "wind": {"value": 9, "unit": "km/h", "direction": "E", "impact": "good"},
                    "waterTemp": {"value": 23, "unit": "°C", "impact": "good"},
                    "moonDistance": {"value": 395000, "unit": "km", "phase": "Last Quarter", "impact": "good"},
                },
                "reasoning": [
                    "Low tide rising — excellent light penetration forecast.",
                    "Calm winds; glass-like surface expected.",
                    "High confidence — ideal conditions.",
                ],
            },
            {
                "id": "w5",
                "label": "Fri",
                "startsAt": "2025-06-14T13:30:00",
                "endsAt": "2025-06-14T15:00:00",
                "confidence": 0.72,
                "visibilityScore": 7.0,
                "conditionState": "optimal",
                "factors": {
                    "tide": {"value": 0.5, "unit": "m", "trend": "rising", "impact": "good"},
                    "wind": {"value": 14, "unit": "km/h", "direction": "NE", "impact": "good"},
                    "waterTemp": {"value": 22, "unit": "°C", "impact": "good"},
                    "moonDistance": {"value": 400000, "unit": "km", "phase": "Waning Crescent", "impact": "good"},
                },
                "reasoning": [
                    "Moderate rising tide with good light angles.",
                    "Wind within comfortable range.",
                    "Reliable window — recommended.",
                ],
            },
        ],
    }


@router.get("/tide-curve")
def get_tide_curve() -> dict:
    """24-hour tide level curve for the chart."""
    return {
        "points": [
            {"time": "00:00", "level": 0.9},
            {"time": "02:00", "level": 1.4},
            {"time": "04:00", "level": 1.8},
            {"time": "06:00", "level": 1.5},
            {"time": "08:00", "level": 1.0},
            {"time": "10:00", "level": 0.5},
            {"time": "12:00", "level": 0.3},
            {"time": "14:00", "level": 0.4},
            {"time": "16:00", "level": 0.8},
            {"time": "18:00", "level": 1.3},
            {"time": "20:00", "level": 1.7},
            {"time": "22:00", "level": 1.6},
            {"time": "23:59", "level": 1.2},
        ]
    }
