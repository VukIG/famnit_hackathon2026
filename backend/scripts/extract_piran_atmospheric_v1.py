"""
extract_piran_atmospheric_v1.py

Atmospheric + marine driver features from Open-Meteo (free, no auth) for the
Piran underwater visibility model.

Pulls 2023-01-01..2024-12-31 hourly data for two locations:
  - Cape Madona      (45.530, 13.567): local wind, waves, precip, air
  - Soca upper basin (46.30,  13.55): rainfall that becomes plume in 1-3 days

Hourly -> daily aggregation, lag/rolling/composite features.
Joins on 'date' with piran_features_daily_v2.csv.

    pip install requests pandas numpy
    python extract_piran_atmospheric_v1.py

Cached JSON in ./openmeteo_cache/ so re-runs are instant.
"""

from pathlib import Path
import json
import time
import numpy as np
import pandas as pd
import requests

# =============================================================================
# CONFIG
# =============================================================================

START = "2023-01-01"
END   = "2024-12-31"

LOC = {
    "madona":     (45.530, 13.567),   # dive site
    "soca_basin": (46.30,  13.55),    # Bovec area, upper Soca valley
}

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
MARINE_URL  = "https://marine-api.open-meteo.com/v1/marine"

ARCHIVE_VARS = [
    "temperature_2m", "precipitation", "wind_speed_10m",
    "wind_direction_10m", "wind_gusts_10m", "pressure_msl", "cloud_cover",
]
MARINE_VARS = [
    "wave_height", "wave_direction", "wave_period",
    "wind_wave_height", "swell_wave_height", "sea_surface_temperature",
]

CACHE_DIR = Path("openmeteo_cache")
CACHE_DIR.mkdir(exist_ok=True)
OUT_CSV = Path("piran_atmospheric_daily.csv")


# =============================================================================
# FETCH
# =============================================================================

def fetch(url, lat, lon, vars_, cache_name):
    cache = CACHE_DIR / f"{cache_name}.json"
    if cache.exists():
        print(f"  [cache] {cache_name}")
        return json.loads(cache.read_text())
    print(f"  [http]  {cache_name} @ ({lat:.3f}, {lon:.3f})")
    params = {
        "latitude": lat, "longitude": lon,
        "start_date": START, "end_date": END,
        "hourly": ",".join(vars_),
        "timezone": "UTC",
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    data = r.json()
    cache.write_text(json.dumps(data))
    time.sleep(0.3)
    return data


def to_hourly_df(data):
    df = pd.DataFrame(data["hourly"])
    df["time"] = pd.to_datetime(df["time"])
    df["date"] = df["time"].dt.date
    return df


# =============================================================================
# DAILY AGGREGATION
# =============================================================================

DIR_COLS = {"wind_direction_10m", "wave_direction", "wind_wave_direction", "swell_wave_direction"}
MEAN_MAX = {"wind_speed_10m", "wind_gusts_10m", "wave_height", "wind_wave_height", "swell_wave_height"}


def daily_features(df_hourly, suffix):
    """Aggregate hourly -> daily. Wind direction is vector-handled.

    Returns one row per date with columns suffixed by `suffix` (e.g. _madona).
    """
    df_hourly = df_hourly.copy()

    # Vector wind decomposition (meteorological convention: dir = FROM direction)
    #   wind_from_north = ws * cos(dir)  -> positive when wind comes FROM north
    #                                       (pushes water southward toward Madona)
    #   wind_from_east  = ws * sin(dir)  -> positive when wind from E (pushes W)
    if "wind_speed_10m" in df_hourly.columns and "wind_direction_10m" in df_hourly.columns:
        ws = df_hourly["wind_speed_10m"].values
        dr = np.radians(df_hourly["wind_direction_10m"].values)
        df_hourly["wind_from_north"] = ws * np.cos(dr)
        df_hourly["wind_from_east"]  = ws * np.sin(dr)

    g = df_hourly.groupby("date")
    out = {"date": [d for d, _ in g]}

    for col in df_hourly.columns:
        if col in ("time", "date"):
            continue
        if col in DIR_COLS:
            continue  # raw direction is not informative as an arithmetic mean
        if col == "precipitation":
            out[f"precip_sum_{suffix}"] = g[col].sum().values
        elif col in MEAN_MAX:
            out[f"{col}_mean_{suffix}"] = g[col].mean().values
            out[f"{col}_max_{suffix}"]  = g[col].max().values
        elif col in ("wind_from_north", "wind_from_east"):
            out[f"{col}_{suffix}"] = g[col].mean().values
        else:
            out[f"{col}_mean_{suffix}"] = g[col].mean().values

    return pd.DataFrame(out)


# =============================================================================
# MAIN
# =============================================================================

def build():
    print("[1/4] Open-Meteo Archive (atmospheric)")
    arch_m = daily_features(to_hourly_df(fetch(ARCHIVE_URL, *LOC["madona"],     ARCHIVE_VARS, "arch_madona")),     "madona")
    arch_s = daily_features(to_hourly_df(fetch(ARCHIVE_URL, *LOC["soca_basin"], ARCHIVE_VARS, "arch_soca_basin")), "soca_basin")

    print("[2/4] Open-Meteo Marine (waves at Piran)")
    marine = None
    try:
        marine = daily_features(to_hourly_df(fetch(MARINE_URL, *LOC["madona"], MARINE_VARS, "marine_madona")), "madona_wave")
    except Exception as e:
        print(f"  [warn] marine API failed: {e}")
        print("         continuing without wave features.")

    print("[3/4] merge + feature engineering")
    df = arch_m.merge(arch_s, on="date", how="outer")
    if marine is not None:
        df = df.merge(marine, on="date", how="outer")
    df = df.sort_values("date").reset_index(drop=True)

    # ----- Lag features (1-3 days) -------------------------------------------
    new_cols = {}
    lag_targets = [c for c in df.columns if any(s in c for s in [
        "wind_speed_10m_max", "wind_gusts_10m_max",
        "precip_sum", "wave_height_max", "wind_from_north",
    ])]
    for c in lag_targets:
        new_cols[f"{c}_lag1"] = df[c].shift(1)
        new_cols[f"{c}_lag2"] = df[c].shift(2)
        new_cols[f"{c}_lag3"] = df[c].shift(3)

    # ----- Rolling precipitation accumulation --------------------------------
    for c in ["precip_sum_madona", "precip_sum_soca_basin"]:
        if c in df.columns:
            new_cols[f"{c}_3d"]  = df[c].rolling(3,  min_periods=1).sum()
            new_cols[f"{c}_7d"]  = df[c].rolling(7,  min_periods=1).sum()
            new_cols[f"{c}_14d"] = df[c].rolling(14, min_periods=1).sum()

    # ----- Rolling 3-day max for storm aftermath -----------------------------
    for c in ["wave_height_max_madona_wave", "wind_speed_10m_max_madona", "wind_gusts_10m_max_madona"]:
        if c in df.columns:
            new_cols[f"{c}_3d_max"] = df[c].rolling(3, min_periods=1).max()

    # ----- Composite event flags --------------------------------------------
    if "wind_from_north_madona" in df.columns and "wind_speed_10m_mean_madona" in df.columns:
        new_cols["bora_event_flag"] = (
            (df["wind_from_north_madona"]    > df["wind_from_north_madona"].quantile(0.75)) &
            (df["wind_speed_10m_mean_madona"] > df["wind_speed_10m_mean_madona"].quantile(0.75))
        ).astype(int)

    if "wave_height_max_madona_wave" in df.columns:
        thr = df["wave_height_max_madona_wave"].quantile(0.90)
        new_cols["storm_aftermath_flag"] = (
            df["wave_height_max_madona_wave"].rolling(2, min_periods=1).max() > thr
        ).astype(int)

    if "precip_sum_soca_basin" in df.columns:
        roll3 = df["precip_sum_soca_basin"].rolling(3, min_periods=1).sum()
        new_cols["wet_basin_flag"] = (roll3 > roll3.quantile(0.90)).astype(int)

    if "precip_sum_madona" in df.columns:
        new_cols["wet_local_flag"] = (df["precip_sum_madona"] > df["precip_sum_madona"].quantile(0.90)).astype(int)

    df = pd.concat([df, pd.DataFrame(new_cols, index=df.index)], axis=1)

    # ----- Write -------------------------------------------------------------
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df.to_csv(OUT_CSV, index=False)
    print(f"[4/4] wrote {OUT_CSV}: {len(df)} rows, {len(df.columns)} columns")

    nan_pct = df.isna().mean() * 100
    big = nan_pct[nan_pct > 1].sort_values(ascending=False)
    if len(big) == 0:
        print("       no significant NaNs")
    else:
        print("       columns with NaN > 1% (mostly lags at series start):")
        for c, p in big.head(15).items():
            print(f"         {c:<55s} {p:5.1f}%")


if __name__ == "__main__":
    build()
