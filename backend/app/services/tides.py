import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

from app.config import settings

_BASE_URL = "https://api.stormglass.io/v2/tide/extremes/point"


# Fetches the next tide extreme after target from StormGlass.
async def fetch_next_tide(target: datetime) -> dict:
    _empty = {"next_tide_type": None, "next_tide_height_m": None, "next_tide_time": None}

    if not settings.stormglass_api_key:
        return _empty

    try:
        # Convert naive local target to UTC for StormGlass (which speaks UTC).
        target_utc = target.replace(tzinfo=ZoneInfo(settings.site_timezone)).astimezone(timezone.utc)

        params = {
            "lat": settings.site_lat,
            "lng": settings.site_lng,
            "start": target_utc.isoformat(),
            "end": (target_utc + timedelta(hours=24)).isoformat(),
        }
        headers = {"Authorization": settings.stormglass_api_key}
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(_BASE_URL, params=params, headers=headers)

        if response.status_code == 402:
            print("[tides] StormGlass quota exceeded (402)", file=sys.stderr)
            return _empty

        response.raise_for_status()
        data = response.json()

        extremes = data.get("data", [])
        future = [e for e in extremes if datetime.fromisoformat(e["time"].replace("Z", "+00:00")) > target_utc]
        if not future:
            return _empty

        first = future[0]
        return {
            "next_tide_type": first["type"],
            "next_tide_height_m": first.get("height"),
            "next_tide_time": datetime.fromisoformat(first["time"].replace("Z", "+00:00")),
        }
    except Exception as exc:
        print(f"[tides] error: {exc}", file=sys.stderr)
        return _empty