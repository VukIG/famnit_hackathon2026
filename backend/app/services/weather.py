import sys
from datetime import datetime

import httpx

from app.config import settings

_BASE_URL = "https://api.open-meteo.com/v1/forecast"
_HOURLY = "temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m"
_DAILY = "sunrise,sunset"

def _closest_hour_index(times: list[str], target: datetime) -> int:
    parsed = [datetime.fromisoformat(t) for t in times]
    naive = target.replace(tzinfo=None)
    return min(range(len(parsed)), key=lambda i: abs((parsed[i] - naive).total_seconds()))

def _closest_date_index(dates: list[str], target: datetime) -> int:
    target_date = target.date()
    parsed = [datetime.fromisoformat(d).date() for d in dates]
    return min(range(len(parsed)), key=lambda i: abs((parsed[i] - target_date).days))


# Fetches weather and sun data for the target hour from Open-Meteo Forecast.
async def fetch_weather(target: datetime) -> dict:
    try:
        params = {
            "latitude": settings.site_lat,
            "longitude": settings.site_lng,
            "hourly": _HOURLY,
            "daily": _DAILY,
            "timezone": settings.site_timezone,
        }
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

        hourly_times = data["hourly"]["time"]
        if not hourly_times:
            raise ValueError("Empty hourly times")
        h_idx = _closest_hour_index(hourly_times, target)

        daily_dates = data["daily"]["time"]
        if not daily_dates:
            raise ValueError("Empty daily dates from Open-Meteo Forecast")
        d_idx = _closest_date_index(daily_dates, target)

        return {
            "air_temperature_c": data["hourly"]["temperature_2m"][h_idx],
            "wind_speed_kmh": data["hourly"]["wind_speed_10m"][h_idx],
            "wind_direction_deg": data["hourly"]["wind_direction_10m"][h_idx],
            "cloud_cover_pct": data["hourly"]["cloud_cover"][h_idx],
            "humidity_pct": data["hourly"]["relative_humidity_2m"][h_idx],
            "sunrise": datetime.fromisoformat(data["daily"]["sunrise"][d_idx]),
            "sunset": datetime.fromisoformat(data["daily"]["sunset"][d_idx]),
        }
    except Exception as exc:
        print(f"[weather] error: {exc}", file=sys.stderr)
        return {
            "air_temperature_c": None,
            "wind_speed_kmh": None,
            "wind_direction_deg": None,
            "cloud_cover_pct": None,
            "humidity_pct": None,
            "sunrise": None,
            "sunset": None,
        }
