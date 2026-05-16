"""
One-time script: enrich a dataset of underwater image timestamps with
environmental features (weather, marine, moon) from free archive APIs.

Usage: python process_dataset.py

Reads:  backend/dataset/input.csv
Writes: backend/dataset/output.csv

All images share the same location (Tarragona, Spain). The script fetches
the full date range in two API calls total, then looks up each row's hour
in memory.
"""

import asyncio
import csv
import sys
from datetime import date, datetime
from pathlib import Path

import httpx
from astral.moon import phase


# === Configuration ===
INPUT_PATH = Path(__file__).parent / "dataset" / "input_two.csv"
OUTPUT_PATH = Path(__file__).parent / "dataset" / "output_two.csv"

# Fixed site (Western Mediterranean, off Tarragona).
LAT = 41.18212
LNG = 1.75257
TIMEZONE = "Europe/Madrid"

WEATHER_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"

OUTPUT_COLUMNS = [
    "filename", "date", "time", "longitude", "latitude", "depth_m",
    "datetime_iso",
    "wave_height_m", "wave_direction_deg", "wave_period_s", "wave_peak_period_s",
    "sea_surface_temperature_c",
    "air_temperature_c", "wind_speed_kmh", "wind_direction_deg",
    "cloud_cover_pct", "humidity_pct",
    "sunrise", "sunset",
    "moon_phase",
]


def read_input(path: Path) -> list[dict]:
    rows = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            date_str = raw["Date"].strip()
            time_str = raw["Time"].strip()
            try:
                dt = datetime.strptime(f"{date_str} {time_str}", "%d-%m-%Y %H:%M:%S")
            except ValueError as exc:
                print(f"  skipping malformed row: {raw} ({exc})", file=sys.stderr)
                continue
            rows.append({
                "filename": raw["Filename"].strip(),
                "date": date_str,
                "time": time_str,
                "longitude": raw["Longitude"].strip(),
                "latitude": raw["Latitude"].strip(),
                "depth_m": raw["Depth(m)"].strip(),
                "datetime": dt,
            })
    return rows


async def fetch_weather_archive(start: date, end: date) -> dict:
    params = {
        "latitude": LAT,
        "longitude": LNG,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "hourly": "temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m",
        "daily": "sunrise,sunset",
        "timezone": TIMEZONE,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.get(WEATHER_ARCHIVE_URL, params=params)
        response.raise_for_status()
        return response.json()


async def fetch_marine_archive(start: date, end: date) -> dict:
    params = {
        "latitude": LAT,
        "longitude": LNG,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "hourly": "wave_height,wave_direction,wave_period,wind_wave_peak_period,sea_surface_temperature",
        "timezone": TIMEZONE,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.get(MARINE_URL, params=params)
        response.raise_for_status()
        return response.json()


def get_moon_phase(target: datetime) -> float:
    return phase(target.date()) / 28.0


def build_hour_lookup(times: list[str]) -> dict:
    return {t: i for i, t in enumerate(times)}


def build_day_lookup(dates: list[str]) -> dict:
    return {d: i for i, d in enumerate(dates)}


def enrich_row(row: dict, weather: dict, marine: dict,
               weather_hours: dict, marine_hours: dict, weather_days: dict) -> dict:
    dt = row["datetime"]
    hour_key = dt.replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:00")
    day_key = dt.strftime("%Y-%m-%d")

    h_idx = weather_hours.get(hour_key)
    wh = weather["hourly"]
    weather_fields = {
        "air_temperature_c": wh["temperature_2m"][h_idx] if h_idx is not None else None,
        "wind_speed_kmh": wh["wind_speed_10m"][h_idx] if h_idx is not None else None,
        "wind_direction_deg": wh["wind_direction_10m"][h_idx] if h_idx is not None else None,
        "cloud_cover_pct": wh["cloud_cover"][h_idx] if h_idx is not None else None,
        "humidity_pct": wh["relative_humidity_2m"][h_idx] if h_idx is not None else None,
    }

    d_idx = weather_days.get(day_key)
    wd = weather["daily"]
    daily_fields = {
        "sunrise": wd["sunrise"][d_idx] if d_idx is not None else None,
        "sunset": wd["sunset"][d_idx] if d_idx is not None else None,
    }

    m_idx = marine_hours.get(hour_key)
    mh = marine["hourly"]
    marine_fields = {
        "wave_height_m": mh["wave_height"][m_idx] if m_idx is not None else None,
        "wave_direction_deg": mh["wave_direction"][m_idx] if m_idx is not None else None,
        "wave_period_s": mh["wave_period"][m_idx] if m_idx is not None else None,
        "wave_peak_period_s": mh["wind_wave_peak_period"][m_idx] if m_idx is not None else None,
        "sea_surface_temperature_c": mh["sea_surface_temperature"][m_idx] if m_idx is not None else None,
    }

    return {
        "filename": row["filename"],
        "date": row["date"],
        "time": row["time"],
        "longitude": row["longitude"],
        "latitude": row["latitude"],
        "depth_m": row["depth_m"],
        "datetime_iso": dt.isoformat(),
        **marine_fields,
        **weather_fields,
        **daily_fields,
        "moon_phase": get_moon_phase(dt),
    }


def write_output(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


async def main():
    print(f"Reading {INPUT_PATH}...")
    rows = read_input(INPUT_PATH)
    print(f"  {len(rows)} rows loaded")

    if not rows:
        print("No rows in input. Exiting.")
        return

    dates = [r["datetime"].date() for r in rows]
    start, end = min(dates), max(dates)
    print(f"Date range: {start} -> {end} ({(end - start).days + 1} days)")

    print("Fetching weather archive (single call)...")
    weather = await fetch_weather_archive(start, end)
    print(f"  {len(weather['hourly']['time'])} hourly entries")

    print("Fetching marine archive (single call)...")
    marine = await fetch_marine_archive(start, end)
    print(f"  {len(marine['hourly']['time'])} hourly entries")

    print("Enriching rows in memory...")
    weather_hours = build_hour_lookup(weather["hourly"]["time"])
    marine_hours = build_hour_lookup(marine["hourly"]["time"])
    weather_days = build_day_lookup(weather["daily"]["time"])

    enriched = [
        enrich_row(r, weather, marine, weather_hours, marine_hours, weather_days)
        for r in rows
    ]

    print(f"Writing {OUTPUT_PATH}...")
    write_output(OUTPUT_PATH, enriched)
    print(f"  Done. {len(enriched)} rows written.")


if __name__ == "__main__":
    asyncio.run(main())
