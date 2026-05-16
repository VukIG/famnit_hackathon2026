import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx

from app.config import settings

_BASE_URL = "https://www.worldtides.info/api/v3"
_CACHE_FILE = Path(__file__).parent.parent.parent / ".tide_cache.json"
_CACHE_TTL_SECONDS = 5 * 24 * 60 * 60  # 5 days; data covers 7, so we refresh with overlap


# Reads the on-disk tide cache if it exists and hasn't expired.
def _load_cache() -> dict | None:
    if not _CACHE_FILE.exists():
        return None
    try:
        with open(_CACHE_FILE) as f:
            cache = json.load(f)
        if time.time() - cache["fetched_at"] > _CACHE_TTL_SECONDS:
            return None
        return cache
    except Exception:
        return None


# Writes the fetched tide window to disk so restarts don't burn credits.
def _save_cache(extremes: list, lat: float, lng: float) -> None:
    try:
        with open(_CACHE_FILE, "w") as f:
            json.dump({
                "fetched_at": time.time(),
                "lat": lat,
                "lng": lng,
                "extremes": extremes,
            }, f)
    except Exception as exc:
        print(f"[tides] cache write failed: {exc}", file=sys.stderr)


# Builds the response dict from a single WorldTides extreme entry.
def _format_tide(extreme: dict) -> dict:
    return {
        "next_tide_type": extreme["type"].lower(),
        "next_tide_height_m": extreme.get("height"),
        "next_tide_time": datetime.fromtimestamp(extreme["dt"], tz=timezone.utc),
    }


# Fetches the next tide extreme after target from WorldTides, with 7-day on-disk caching.
async def fetch_next_tide(target: datetime) -> dict:
    _empty = {"next_tide_type": None, "next_tide_height_m": None, "next_tide_time": None}

    if not settings.worldtides_api_key:
        return _empty

    try:
        target_utc = target.replace(tzinfo=ZoneInfo(settings.site_timezone)).astimezone(timezone.utc)
        target_ts = target_utc.timestamp()

        # Try cache first to avoid burning API credits.
        cache = _load_cache()
        if cache and cache["lat"] == settings.site_lat and cache["lng"] == settings.site_lng:
            future = [e for e in cache["extremes"] if e["dt"] > target_ts]
            if future:
                print("[tides] cache hit — no API call made", file=sys.stderr)
                return _format_tide(future[0])

        # Cache miss → fetch a fresh 7-day window starting at the target's date.
        print("[tides] cache miss — calling WorldTides API (1 credit)", file=sys.stderr)
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
        _save_cache(extremes, settings.site_lat, settings.site_lng)

        future = [e for e in extremes if e["dt"] > target_ts]
        if not future:
            return _empty
        return _format_tide(future[0])
    except Exception as exc:
        print(f"[tides] error: {exc}", file=sys.stderr)
        return _empty