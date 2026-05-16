import sys
from datetime import datetime

import httpx

from app.config import settings

_BASE_URL = "https://marine-api.open-meteo.com/v1/marine"
_FIELDS = "wave_height,wave_direction,wave_period,wind_wave_peak_period,sea_surface_temperature"


# Fetches wave data for the target hour from Open-Meteo Marine.
async def fetch_wave_data(target: datetime) -> dict:
    try:
        params = {
            "latitude": settings.site_lat,
            "longitude": settings.site_lng,
            "hourly": _FIELDS,
            "timezone": settings.site_timezone,
        }
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

        times = data["hourly"]["time"]
        target_str = target.strftime("%Y-%m-%dT%H:00")
        idx = times.index(target_str)

        return {
            "wave_height_m": data["hourly"]["wave_height"][idx],
            "wave_direction_deg": data["hourly"]["wave_direction"][idx],
            "wave_period_s": data["hourly"]["wave_period"][idx],
            "wave_peak_period_s": data["hourly"]["wind_wave_peak_period"][idx],
            "water_temperature_c": data["hourly"]["sea_surface_temperature"][idx],
        }
    except Exception as exc:
        print(f"[marine] error: {exc}", file=sys.stderr)
        return {
            "wave_height_m": None,
            "wave_direction_deg": None,
            "wave_period_s": None,
            "wave_peak_period_s": None,
            "water_temperature_c": None,
        }
