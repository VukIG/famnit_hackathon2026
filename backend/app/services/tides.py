import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx

from app.config import settings

_BASE_URL = "https://www.worldtides.info/api/v3"


# Builds the response dict from a single WorldTides extreme entry.
def _format_tide(extreme: dict) -> dict:
    return {
        "next_tide_type": extreme["type"].lower(),
        "next_tide_height_m": extreme.get("height"),
        "next_tide_time": datetime.fromtimestamp(extreme["dt"], tz=timezone.utc),
    }


# Fetches the next tide extreme after target from WorldTides.
async def fetch_next_tide(target: datetime) -> dict:
    _empty = {"next_tide_type": None, "next_tide_height_m": None, "next_tide_time": None}

    if not settings.worldtides_api_key:
        return _empty

    try:
        target_utc = target.replace(tzinfo=ZoneInfo(settings.site_timezone)).astimezone(timezone.utc)
        target_ts = target_utc.timestamp()

        print("[tides] calling WorldTides API (1 credit)", file=sys.stderr)
        params = {
            "extremes": "",
            "lat": settings.site_lat,
            "lon": settings.site_lng,
            "date": target.strftime("%Y-%m-%d"),
            "days": 7,
            "key": settings.worldtides_api_key,
        }
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(_BASE_URL, params=params)

        response.raise_for_status()
        data = response.json()

        if data.get("status") != 200:
            print(f"[tides] WorldTides error: {data.get('error', 'unknown')}", file=sys.stderr)
            return _empty

        extremes = data.get("extremes", [])

        future = [e for e in extremes if e["dt"] > target_ts]
        if not future:
            return _empty
        return _format_tide(future[0])
    except Exception as exc:
        print(f"[tides] error: {exc}", file=sys.stderr)
        return _empty