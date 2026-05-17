"""
Copernicus Marine -> feature CSV for the Piran underwater visibility model.

Downloads daily 100m TUR/SPM/CHL ocean-colour for the northern Adriatic
(Cape Madona + Soča/Rižana/Dragonja river mouths) for 2023-01-01 .. 2024-12-31,
then engineers Tiers 1-5 features described in FEATURES.md.

Output: piran_features_daily.csv  (~730 rows, ~80 columns)

    pip install copernicusmarine xarray netcdf4 pandas numpy
    python extract_piran_copernicus.py

First run will prompt for free Copernicus Marine credentials
(register at marine.copernicus.eu, takes a minute).
"""

from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr
import copernicusmarine

# =============================================================================
# CONFIG
# =============================================================================

# Bounding box: covers Cape Madona AND upstream river mouths
LAT_MIN, LAT_MAX = 45.45, 45.75
LON_MIN, LON_MAX = 13.40, 13.80

START = "2023-01-01"
END   = "2024-12-31"

# Points of interest (lat, lon)
POI = {
    "madona":   (45.530, 13.567),  # the dive site
    "dragonja": (45.482, 13.594),  # SI/HR border river mouth (local)
    "rizana":   (45.547, 13.722),  # feeds Koper Bay
    "soca":     (45.713, 13.566),  # Gulf of Trieste, dominant plume source
    "openadri": (45.550, 13.450),  # offshore clean-water reference
}

VARIABLES  = ["TUR", "SPM", "CHL"]
DATASET_ID = "cmems_obs_oc_med_bgc_tur-spm-chl_nrt_l4-hr-mosaic_P1D-m"

OUT_NC  = Path("piran_oc_bgc_hr_2023_2024.nc")
OUT_CSV = Path("piran_features_daily.csv")


# =============================================================================
# STEP 1 - DOWNLOAD
# =============================================================================

def download():
    if OUT_NC.exists():
        print(f"[skip] {OUT_NC} already exists. Delete it to re-download.")
        return
    print(f"[download] {DATASET_ID}")
    print(f"           bbox lat [{LAT_MIN}, {LAT_MAX}]  lon [{LON_MIN}, {LON_MAX}]")
    print(f"           {START} -> {END}")
    copernicusmarine.subset(
        dataset_id=DATASET_ID,
        variables=VARIABLES,
        minimum_longitude=LON_MIN, maximum_longitude=LON_MAX,
        minimum_latitude=LAT_MIN,  maximum_latitude=LAT_MAX,
        start_datetime=START, end_datetime=END,
        output_filename=OUT_NC.name, output_directory=".",
        force_download=True,
    )


# =============================================================================
# STEP 2 - FEATURE ENGINEERING
# =============================================================================

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (np.sin(dlat / 2) ** 2
         + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2)
    return 2 * R * np.arcsin(np.sqrt(a))


def resolve_var(ds, want):
    """Handle TUR/tur casing variations across product versions."""
    for cand in (want, want.lower(), want.upper()):
        if cand in ds.data_vars:
            return cand
    raise KeyError(f"{want} not found. Available: {list(ds.data_vars)}")


def build_features():
    print(f"[1/6] open  {OUT_NC}")
    ds = xr.open_dataset(OUT_NC)

    var_map = {v: resolve_var(ds, v) for v in VARIABLES}
    lat_vals = ds["latitude"].values
    lon_vals = ds["longitude"].values
    lon_grid, lat_grid = np.meshgrid(lon_vals, lat_vals)
    dist_madona = haversine_km(POI["madona"][0], POI["madona"][1], lat_grid, lon_grid)

    def nearest(lat_t, lon_t):
        return int(np.abs(lat_vals - lat_t).argmin()), int(np.abs(lon_vals - lon_t).argmin())

    poi_idx = {name: nearest(la, lo) for name, (la, lo) in POI.items()}

    dates = pd.to_datetime(ds["time"].values)
    df = pd.DataFrame({"date": dates})

    # ----- Tier 1: point values + Cape Madona neighborhoods --------------------
    print("[2/6] tier 1: point + neighborhood")
    mask_200m = xr.DataArray(dist_madona <= 0.2, dims=["latitude", "longitude"])
    mask_1km  = xr.DataArray(dist_madona <= 1.0, dims=["latitude", "longitude"])

    for V in VARIABLES:
        da = ds[var_map[V]]
        v  = V.lower()

        for name, (i_la, i_lo) in poi_idx.items():
            df[f"{v}_{name}_point"] = da.isel(latitude=i_la, longitude=i_lo).values

        df[f"{v}_madona_200m"] = da.where(mask_200m).mean(dim=["latitude", "longitude"]).values
        df[f"{v}_madona_1km"]  = da.where(mask_1km).mean(dim=["latitude", "longitude"]).values

    # ----- Tier 2: temporal features ------------------------------------------
    print("[3/6] tier 2: temporal")
    madona_cols = [c for c in df.columns if "madona" in c]
    for col in madona_cols:
        s = df[col]
        df[f"{col}_lag1"]     = s.shift(1)
        df[f"{col}_lag3"]     = s.shift(3)
        df[f"{col}_lag7"]     = s.shift(7)
        df[f"{col}_roll3"]    = s.rolling(3, min_periods=1).mean()
        df[f"{col}_roll7"]    = s.rolling(7, min_periods=1).mean()
        df[f"{col}_delta_1d"] = s.diff()
        df[f"{col}_max_7d"]   = s.rolling(7, min_periods=1).max()

    # Days since last turbidity spike (90th percentile)
    tur_col = "tur_madona_point"
    thr = df[tur_col].quantile(0.90)
    last = -1
    out = []
    for i, v in enumerate(df[tur_col].values):
        if not np.isnan(v) and v > thr:
            last = i
        out.append(i - last if last >= 0 else np.nan)
    df["tur_days_since_spike"] = out

    # Upstream river lag features (these are the early-warning signals)
    for V in VARIABLES:
        for poi in ("dragonja", "rizana", "soca"):
            col = f"{V.lower()}_{poi}_point"
            df[f"{col}_lag1"] = df[col].shift(1)
            df[f"{col}_lag2"] = df[col].shift(2)
            df[f"{col}_lag3"] = df[col].shift(3)

    # ----- Tier 3: spatial / plume features ------------------------------------
    print("[4/6] tier 3: spatial")
    north_mask = xr.DataArray(lat_grid >= 45.60, dims=["latitude", "longitude"])
    south_mask = xr.DataArray(lat_grid <= 45.50, dims=["latitude", "longitude"])

    for V in VARIABLES:
        da = ds[var_map[V]]
        v  = V.lower()
        north = da.where(north_mask).mean(dim=["latitude", "longitude"]).values
        south = da.where(south_mask).mean(dim=["latitude", "longitude"]).values
        madona_pt = df[f"{v}_madona_point"].values
        df[f"{v}_gradient_north"] = north - madona_pt
        df[f"{v}_gradient_south"] = south - madona_pt
        df[f"{v}_bbox_mean"] = da.mean(dim=["latitude", "longitude"]).values
        df[f"{v}_bbox_std"]  = da.std(dim=["latitude", "longitude"]).values
        df[f"{v}_bbox_p90"]  = da.quantile(0.90, dim=["latitude", "longitude"]).values

    # Plume distance: km from Cape Madona to nearest pixel where TUR > 5 FNU
    print("       plume distance ...")
    tur_arr = ds[var_map["TUR"]].values  # (time, lat, lon)
    plume_thresh = 5.0
    plume_dist = np.full(tur_arr.shape[0], np.nan)
    for t in range(tur_arr.shape[0]):
        mask = tur_arr[t] > plume_thresh
        if mask.any():
            plume_dist[t] = dist_madona[mask].min()
    df["plume_distance_km"] = plume_dist

    # ----- Tier 4: seasonal / climatology --------------------------------------
    print("[5/6] tier 4: seasonality (note: only 2 yrs, anomalies noisy)")
    df["doy"]     = df["date"].dt.dayofyear
    df["doy_sin"] = np.sin(2 * np.pi * df["doy"] / 366.0)
    df["doy_cos"] = np.cos(2 * np.pi * df["doy"] / 366.0)

    for V in VARIABLES:
        col = f"{V.lower()}_madona_point"
        clim = df.groupby("doy")[col].mean()
        clim_smooth = clim.reindex(range(1, 367)).interpolate().rolling(15, min_periods=1, center=True).mean()
        clim_std = df.groupby("doy")[col].std()
        clim_std_smooth = clim_std.reindex(range(1, 367)).interpolate().rolling(15, min_periods=1, center=True).mean()
        df[f"{V.lower()}_clim_mean"] = df["doy"].map(clim_smooth)
        df[f"{V.lower()}_anomaly"]   = df[col] - df[f"{V.lower()}_clim_mean"]
        df[f"{V.lower()}_zscore"]    = df[f"{V.lower()}_anomaly"] / (df["doy"].map(clim_std_smooth) + 1e-6)

    # ----- Tier 5: composite indicators ---------------------------------------
    print("[6/6] tier 5: composite indices")
    def mm(s):
        lo, hi = s.min(), s.max()
        return (s - lo) / (hi - lo + 1e-9)

    df["visibility_risk_index"] = (
        0.5 * mm(df["tur_madona_point"])
        + 0.3 * mm(df["spm_madona_point"])
        + 0.2 * mm(df["chl_madona_point"])
    )

    df["bloom_flag"] = (df["chl_madona_point"] > df["chl_madona_point"].quantile(0.95)).astype(int)

    # Plume inbound flag: any upstream river TUR in last 3 days above own 95th pct
    inbound = np.zeros(len(df), dtype=int)
    for poi in ("dragonja", "rizana", "soca"):
        col = df[f"tur_{poi}_point"]
        t = col.quantile(0.95)
        recent_spike = col.rolling(3, min_periods=1).max() > t
        inbound = np.maximum(inbound, recent_spike.fillna(False).astype(int).values)
    df["plume_inbound_flag"] = inbound

    # ----- Write CSV -----------------------------------------------------------
    df["date"] = df["date"].dt.date
    df.to_csv(OUT_CSV, index=False)
    print()
    print(f"wrote {OUT_CSV}: {len(df)} rows, {len(df.columns)} columns")
    print(f"date range: {df['date'].min()} -> {df['date'].max()}")
    print(f"\nNaN-heavy columns (>5% missing):")
    nan_pct = df.isna().mean() * 100
    big = nan_pct[nan_pct > 5].sort_values(ascending=False)
    if len(big) == 0:
        print("  (none)")
    else:
        for c, p in big.items():
            print(f"  {c:<40s} {p:5.1f}%")


if __name__ == "__main__":
    download()
    build_features()
