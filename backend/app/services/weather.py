import sys
from datetime import datetime

import httpx

from app.config import settings

_BASE_URL = "https://api.open-meteo.com/v1/forecast"
_HOURLY = "temperature_2m,windspeed_10m,winddirection_10m,cloudcover,relativehumidity_2m"
_DAILY = "sunrise,sunset"


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
        target_hour_str = target.strftime("%Y-%m-%dT%H:00")
        h_idx = hourly_times.index(target_hour_str)

        daily_dates = data["daily"]["time"]
        target_date_str = target.strftime("%Y-%m-%d")
        d_idx = daily_dates.index(target_date_str)

        return {
            "air_temperature_c": data["hourly"]["temperature_2m"][h_idx],
            "wind_speed_kmh": data["hourly"]["windspeed_10m"][h_idx],
            "wind_direction_deg": data["hourly"]["winddirection_10m"][h_idx],
            "cloud_cover_pct": data["hourly"]["cloudcover"][h_idx],
            "humidity_pct": data["hourly"]["relativehumidity_2m"][h_idx],
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
