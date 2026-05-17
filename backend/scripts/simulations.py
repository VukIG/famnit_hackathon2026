"""
simulate.py — Sea Oasis Dive Conditions Simulator
Gulf of Piran, Slovenia (lat 45.52, lon 13.57, depth 20m)

Usage:
    python simulate.py                              # 24h from now, hourly
    python simulate.py --hours 72                  # 72h forecast
    python simulate.py --start "2025-06-01 08:00"  # specific start
    python simulate.py --out my_forecast.csv       # custom output path

Completely self-contained — no external CSV needed.
All distributions derived from 1916 real observations from the site.
"""

import argparse
import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ─────────────────────────────────────────────────────────────────────────────
# MONTHLY DISTRIBUTIONS
# Derived from real observations (Gulf of Piran, 2023–2024)
# Each entry: (mean, std, min, max)
# ─────────────────────────────────────────────────────────────────────────────

MONTHLY = {
    #  month: sst_c              air_c               wind_kmh            wave_m              cloud_pct           humidity_pct
    1:  dict(sst=(13.8, 1.2, 11.0, 16.0), air=(11.8, 3.5,  4.0, 18.0), wind=(8.5,  4.5, 0.5, 35.0), wave=(0.57, 0.30, 0.04, 1.8), cloud=(68, 35, 0, 100), hum=(80, 10, 40, 97)),
    2:  dict(sst=(13.8, 1.0, 11.5, 16.0), air=(12.6, 3.2,  5.0, 19.0), wind=(7.6,  4.2, 0.5, 30.0), wave=(0.46, 0.25, 0.04, 1.5), cloud=(57, 38, 0, 100), hum=(67, 12, 35, 97)),
    3:  dict(sst=(14.8, 1.5, 12.0, 18.0), air=(13.9, 4.0,  5.0, 22.0), wind=(12.2, 5.5, 0.5, 40.0), wave=(0.51, 0.28, 0.04, 1.8), cloud=(63, 36, 0, 100), hum=(71, 11, 40, 97)),
    4:  dict(sst=(15.3, 1.8, 12.5, 19.0), air=(13.0, 4.5,  5.0, 22.0), wind=(13.0, 5.8, 0.5, 42.0), wave=(0.51, 0.27, 0.04, 1.8), cloud=(23, 30, 0, 100), hum=(65, 13, 35, 97)),
    5:  dict(sst=(19.2, 2.5, 15.0, 24.0), air=(19.1, 4.2,  9.0, 27.0), wind=(10.7, 5.0, 0.5, 38.0), wave=(0.53, 0.28, 0.04, 1.9), cloud=(45, 38, 0, 100), hum=(71, 11, 40, 97)),
    6:  dict(sst=(21.5, 2.8, 17.0, 27.0), air=(20.7, 3.8, 12.0, 29.0), wind=(11.7, 5.2, 0.5, 40.0), wave=(0.63, 0.30, 0.04, 2.1), cloud=(48, 38, 0, 100), hum=(64, 12, 30, 97)),
    7:  dict(sst=(26.5, 1.8, 22.0, 29.5), air=(26.0, 3.0, 17.0, 33.0), wind=(11.6, 5.0, 0.5, 40.0), wave=(0.50, 0.26, 0.04, 1.8), cloud=(38, 36, 0, 100), hum=(72, 10, 40, 97)),
    8:  dict(sst=(27.5, 1.5, 24.0, 29.5), air=(26.0, 3.0, 18.0, 33.0), wind=(11.5, 5.0, 0.5, 38.0), wave=(0.45, 0.24, 0.04, 1.7), cloud=(33, 35, 0, 100), hum=(65, 11, 30, 97)),
    9:  dict(sst=(24.8, 2.2, 20.0, 29.0), air=(22.5, 4.0, 12.0, 30.0), wind=(9.7,  4.8, 0.5, 38.0), wave=(0.45, 0.24, 0.04, 1.7), cloud=(48, 38, 0, 100), hum=(72, 11, 35, 97)),
    10: dict(sst=(23.9, 2.5, 18.0, 28.0), air=(21.8, 4.2, 10.0, 28.0), wind=(8.8,  4.5, 0.5, 35.0), wave=(0.28, 0.18, 0.04, 1.2), cloud=(45, 38, 0, 100), hum=(78, 10, 40, 97)),
    11: dict(sst=(15.6, 2.0, 11.0, 20.0), air=(16.4, 4.5,  5.0, 24.0), wind=(13.5, 5.8, 0.5, 42.0), wave=(0.65, 0.32, 0.04, 2.1), cloud=(69, 35, 0, 100), hum=(61, 14, 25, 97)),
    12: dict(sst=(15.9, 1.5, 12.0, 19.0), air=(11.7, 3.5,  4.0, 18.0), wind=(12.8, 5.5, 0.5, 46.0), wave=(0.98, 0.40, 0.04, 2.1), cloud=(49, 38, 0, 100), hum=(69, 11, 35, 97)),
}

# Wave period tightly coupled to wave height (longer waves = longer periods)
WAVE_PERIOD_BASE = 4.3    # seconds, mean
WAVE_PERIOD_STD  = 0.9

# Wind direction: prevailing NW-SE in Adriatic (Bora = NE, Jugo = SE)
# Encoded as mixture: 60% chance directional (bora/jugo), 40% variable
BORA_DIR  = 50    # NE bora
JUGO_DIR  = 150   # SE jugo/sirocco

# Turbidity: lognormal, driven by waves + season + plume events
TURBIDITY_MU    = np.log(2.0)   # NTU, log-scale mean (clear Adriatic)
TURBIDITY_SIGMA = 0.35

# Salinity: normally ~37.5 PSU in open Adriatic, drops with Soča plumes
SALINITY_MEAN = 37.5
SALINITY_STD  = 0.3

# Visibility score mapping (0=worst, 100=best) — inverse of turbidity
# Score ≈ 100 * exp(-k * turbidity_ntu)
VISIBILITY_K = 0.18


# ─────────────────────────────────────────────────────────────────────────────
# PHYSICS HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def moon_phase(dt: datetime) -> float:
    """Simplified moon phase 0–1 (0=new, 0.5=full) using known epoch."""
    known_new = datetime(2000, 1, 6, 18, 14)
    cycle = 29.53058867
    elapsed = (dt - known_new).total_seconds() / 86400
    return (elapsed % cycle) / cycle


def sunrise_sunset(dt: datetime, lat=45.52, lon=13.57):
    """Approximate sunrise/sunset times (local time) using Spencer formula."""
    doy = dt.timetuple().tm_yday
    B = 2 * np.pi * (doy - 1) / 365
    eq_time = 229.18 * (0.000075 + 0.001868 * np.cos(B) - 0.032077 * np.sin(B)
                         - 0.014615 * np.cos(2*B) - 0.04089 * np.sin(2*B))
    lat_r = np.radians(lat)
    decl  = (0.006918 - 0.399912*np.cos(B) + 0.070257*np.sin(B)
             - 0.006758*np.cos(2*B) + 0.000907*np.sin(2*B)
             - 0.002697*np.cos(3*B) + 0.00148*np.sin(3*B))
    cos_ha = (np.cos(np.radians(90.833)) / (np.cos(lat_r)*np.cos(decl))
              - np.tan(lat_r)*np.tan(decl))
    cos_ha = np.clip(cos_ha, -1, 1)
    ha     = np.degrees(np.arccos(cos_ha))
    utc_offset = 1 + int(dt.month in range(3, 11))  # CET/CEST rough
    noon   = 720 - 4*lon - eq_time + utc_offset*60
    sr_min = noon - 4*ha
    ss_min = noon + 4*ha
    def _fmt(mins): 
        h, m = divmod(int(mins), 60)
        return f"{h:02d}:{m:02d}"
    return _fmt(sr_min), _fmt(ss_min)


def _sample_truncated_normal(mean, std, lo, hi, size, rng):
    """Sample from a normal distribution truncated to [lo, hi]."""
    raw = rng.normal(mean, std, size=size * 3)
    raw = raw[(raw >= lo) & (raw <= hi)]
    if len(raw) < size:
        raw = np.concatenate([raw, np.full(size - len(raw), mean)])
    return raw[:size]


def _wind_direction(rng, n):
    """Realistic wind direction for Gulf of Piran: Bora (NE), Jugo (SE), calm/var."""
    dirs = []
    for _ in range(n):
        r = rng.random()
        if r < 0.30:   dirs.append(rng.normal(BORA_DIR, 20))   # Bora
        elif r < 0.55: dirs.append(rng.normal(JUGO_DIR, 25))   # Jugo
        else:          dirs.append(rng.uniform(0, 360))          # variable
    return np.clip(np.array(dirs), 0, 360)


# ─────────────────────────────────────────────────────────────────────────────
# TURBIDITY SIMULATION
# ─────────────────────────────────────────────────────────────────────────────

def _simulate_turbidity(wave_height, month, rng, n):
    """
    Turbidity (NTU) = lognormal baseline + wave-driven resuspension + seasonal.
    Higher waves → more sediment → higher turbidity.
    Summer months: cleaner water (stable thermocline suppresses mixing).
    """
    seasonal_shift = {
        1: 0.25, 2: 0.20, 3: 0.15, 4: 0.00, 5:-0.10,
        6:-0.20, 7:-0.30, 8:-0.30, 9:-0.15, 10: 0.00, 11: 0.20, 12: 0.30
    }[month]

    mu    = TURBIDITY_MU + seasonal_shift
    baseline = np.exp(mu + TURBIDITY_SIGMA * rng.standard_normal(n))

    # Wave resuspension: threshold at 0.4m, scales with wave^1.5
    threshold = 0.40
    wave_effect = np.where(
        wave_height > threshold,
        3.5 * (np.maximum(wave_height - threshold, 0) ** 1.5) * rng.uniform(0.7, 1.3, n),
        0.0
    )

    noise = rng.normal(0, 0.8, n)
    turb  = np.maximum(baseline + wave_effect + noise, 0.05)
    return turb


def _simulate_salinity(turb, month, rng, n):
    """
    Salinity (PSU): ~37.5 open Adriatic.
    Drops with Soča plume events — correlated with turbidity spikes.
    More plume risk in spring/autumn high-rain months.
    """
    plume_months = {3, 4, 5, 10, 11, 12}
    plume_prob   = 0.15 if month in plume_months else 0.03

    sal = rng.normal(SALINITY_MEAN, SALINITY_STD, n)

    # Plume: turbidity spike often co-occurs with salinity drop
    plume_mask = (rng.random(n) < plume_prob) & (turb > 8.0)
    sal[plume_mask] -= rng.uniform(2.0, 8.0, plume_mask.sum())

    return np.clip(sal, 20.0, 38.5)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SIMULATION
# ─────────────────────────────────────────────────────────────────────────────

def simulate(
    start: datetime,
    hours: int = 24,
    seed: int = None,
) -> pd.DataFrame:
    """
    Returns a DataFrame with one row per hour of simulated conditions.

    Parameters
    ----------
    start : datetime  — simulation start (local time)
    hours : int       — number of hourly timesteps
    seed  : int       — random seed for reproducibility
    """
    rng = np.random.default_rng(seed)
    dt_index = pd.date_range(start, periods=hours, freq="h")
    n = len(dt_index)

    rows = []
    for i, dt in enumerate(dt_index):
        m  = dt.month
        hr = dt.hour
        mp = MONTHLY[m]

        # ── Weather variables ────────────────────────────────────────────
        sst  = float(_sample_truncated_normal(mp["sst"][0], mp["sst"][1], mp["sst"][2], mp["sst"][3], 1, rng)[0])
        air  = float(_sample_truncated_normal(mp["air"][0], mp["air"][1], mp["air"][2], mp["air"][3], 1, rng)[0])
        wind = float(_sample_truncated_normal(mp["wind"][0], mp["wind"][1], mp["wind"][2], mp["wind"][3], 1, rng)[0])
        wave = float(_sample_truncated_normal(mp["wave"][0], mp["wave"][1], mp["wave"][2], mp["wave"][3], 1, rng)[0])
        cloud= float(np.clip(rng.normal(mp["cloud"][0], mp["cloud"][1]), mp["cloud"][2], mp["cloud"][3]))
        hum  = float(np.clip(rng.normal(mp["hum"][0], mp["hum"][1]),   mp["hum"][2],   mp["hum"][3]))

        # Wave period: correlated with wave height (bigger waves → longer period)
        wave_period = float(np.clip(
            rng.normal(WAVE_PERIOD_BASE + 0.8 * wave, WAVE_PERIOD_STD), 2.0, 9.0
        ))

        # Wind/wave direction
        wind_dir = float(_wind_direction(rng, 1)[0])
        wave_dir = float(np.clip(wind_dir + rng.normal(0, 20), 0, 360))

        # Diurnal modulation — SST peaks mid-afternoon, wind picks up mid-morning
        sst  += 0.3 * np.sin(2 * np.pi * (hr - 14) / 24)
        wind *= 1.0 + 0.15 * np.sin(2 * np.pi * (hr - 11) / 24)

        # ── Ocean variables ───────────────────────────────────────────────
        turb = float(_simulate_turbidity(np.array([wave]), m, rng, 1)[0])
        sal  = float(_simulate_salinity(np.array([turb]), m, rng, 1)[0])

        # Sensor temp ≈ SST + tiny noise
        sensor_temp = sst + float(rng.normal(0, 0.15))

        # ── Derived / astronomical ────────────────────────────────────────
        mp_val = moon_phase(dt)
        sr, ss = sunrise_sunset(dt)

        # Visibility score 0–100 (100 = crystal clear)
        visibility_score = float(np.clip(100 * np.exp(-VISIBILITY_K * turb), 0, 100))

        # Dive recommendation: True if conditions are good
        is_good_diving = (
            wave <= 0.8 and
            wind <= 20.0 and
            visibility_score >= 40 and
            turb <= 5.0
        )

        rows.append({
            "datetime":                   dt.isoformat(),
            "longitude":                  13.57,
            "latitude":                   45.52,
            "depth_m":                    20,
            "sea_surface_temperature_c":  round(sst,  2),
            "air_temperature_c":          round(air,  2),
            "wind_speed_kmh":             round(wind, 2),
            "wind_direction_deg":         round(wind_dir, 1),
            "wave_height_m":              round(wave, 3),
            "wave_direction_deg":         round(wave_dir, 1),
            "wave_period_s":              round(wave_period, 2),
            "cloud_cover_pct":            round(cloud, 1),
            "humidity_pct":               round(hum,  1),
            "turbidity_ntu":              round(turb, 3),
            "salinity_psu":               round(sal,  3),
            "sensor_temp_c":              round(sensor_temp, 2),
            "moon_phase":                 round(mp_val, 5),
            "sunrise":                    sr,
            "sunset":                     ss,
            "visibility_score":           round(visibility_score, 1),
            "good_diving":                is_good_diving,
        })

    return pd.DataFrame(rows)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Sea Oasis dive conditions simulator")
    p.add_argument("--start",  default=None,
                   help="Start datetime ISO format e.g. '2025-06-01 08:00' (default: now)")
    p.add_argument("--hours",  type=int, default=24,
                   help="Number of hourly timesteps (default: 24)")
    p.add_argument("--seed",   type=int, default=None,
                   help="Random seed for reproducibility")
    p.add_argument("--out",    default="simulation.csv",
                   help="Output CSV path (default: simulation.csv)")
    return p.parse_args()


def main():
    args = parse_args()

    start = datetime.fromisoformat(args.start) if args.start else datetime.now().replace(minute=0, second=0, microsecond=0)

    print(f"Simulating {args.hours}h from {start.isoformat()} ...")
    df = simulate(start=start, hours=args.hours, seed=args.seed)

    os.makedirs(os.path.dirname(args.out) if os.path.dirname(args.out) else ".", exist_ok=True)
    df.to_csv(args.out, index=False)

    print(f"✅ Saved {len(df)} rows → {args.out}")
    print(f"\nPreview:")
    print(df[["datetime","sea_surface_temperature_c","wave_height_m",
              "wind_speed_kmh","turbidity_ntu","visibility_score","good_diving"]].head(6).to_string(index=False))

    # Quick stats
    good = df["good_diving"].sum()
    print(f"\nGood diving windows: {good}/{len(df)} hours ({100*good/len(df):.0f}%)")
    print(f"Avg visibility score: {df['visibility_score'].mean():.1f}/100")
    print(f"Avg turbidity: {df['turbidity_ntu'].mean():.2f} NTU")


if __name__ == "__main__":
    main()