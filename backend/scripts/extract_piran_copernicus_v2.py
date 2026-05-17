"""
extract_piran_copernicus_v2.py

v2 fixes for the Piran feature extractor:

  Problem 1 in v1: 100% NaN at *_madona_point and *_soca_point columns.
    Cause: the HR ocean-colour product permanently masks coastal/land-adjacent
    pixels. The 100m pixel at Cape Madona (45.530, 13.567) is land-adjacent
    and excluded. Same for the Soca/Isonzo delta.
    Fix: auto-pick the nearest pixel within 5 km that has actual data
    coverage across the time series.

  Problem 2 in v1: 75% NaN even in neighborhood means.
    Cause: the "L4 mosaic" product is NOT gap-filled in time despite the
    name. It is a daily mosaic of clear-sky Sentinel-2 observations. Cloudy
    days have no data anywhere in the bbox.
    Fix: temporal linear interpolation across gaps up to 7 days. Turbidity
    is autocorrelated so this is a reasonable estimate; longer gaps remain
    NaN (legitimate uncertainty).

Reuses the existing piran_oc_bgc_hr_2023_2024.nc — no re-download.

Output:
  piran_features_daily_v2.csv         (the full feature table)
  piran_poi_pixel_choices.csv         (which pixel was picked for each POI)
"""

from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr

# =============================================================================
# CONFIG
# =============================================================================

POI = {
    "madona":   (45.530, 13.567),
    "dragonja": (45.482, 13.594),
    "rizana":   (45.547, 13.722),
    "soca":     (45.713, 13.566),
    "openadri": (45.550, 13.450),
}

VARIABLES = ["TUR", "SPM", "CHL"]

IN_NC      = Path("piran_oc_bgc_hr_2023_2024.nc")
OUT_CSV    = Path("piran_features_daily_v2.csv")
OUT_PIXELS = Path("piran_poi_pixel_choices.csv")

SEARCH_RADIUS_KM = 5.0       # how far from each POI to look for a usable pixel
MIN_PIXEL_AVAIL  = 0.20      # require >=20% time coverage for a pixel
INTERP_MAX_GAP   = 7         # days; longer gaps are left as NaN


# =============================================================================
# UTILITIES
# =============================================================================

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (np.sin(dlat / 2) ** 2
         + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2)
    return 2 * R * np.arcsin(np.sqrt(a))


def resolve_var(ds, want):
    for cand in (want, want.lower(), want.upper()):
        if cand in ds.data_vars:
            return cand
    raise KeyError(f"{want} not found. Available: {list(ds.data_vars)}")


def auto_pick_pixel(ds, var_names, target_lat, target_lon, search_radius_km, min_avail):
    """Find nearest pixel within radius that has adequate coverage in all variables."""
    lat_vals = ds["latitude"].values
    lon_vals = ds["longitude"].values
    lon_grid, lat_grid = np.meshgrid(lon_vals, lat_vals)
    dist = haversine_km(target_lat, target_lon, lat_grid, lon_grid)

    # Min coverage across all variables = pixel must have data in all of them
    min_cov = np.ones_like(dist)
    for v in var_names:
        cov = (~np.isnan(ds[v].values)).mean(axis=0)
        min_cov = np.minimum(min_cov, cov)

    in_radius = dist <= search_radius_km
    good = in_radius & (min_cov >= min_avail)

    if good.any():
        masked = np.where(good, dist, np.inf)
        i, j = np.unravel_index(masked.argmin(), masked.shape)
        status = "good"
    else:
        # Fallback: best-coverage pixel in radius, even if below threshold
        masked = np.where(in_radius, min_cov, -np.inf)
        i, j = np.unravel_index(masked.argmax(), masked.shape)
        status = "fallback"

    return {
        "i": int(i), "j": int(j),
        "lat": float(lat_vals[i]), "lon": float(lon_vals[j]),
        "offset_km": float(dist[i, j]),
        "coverage_pct": float(min_cov[i, j] * 100),
        "status": status,
    }


# =============================================================================
# MAIN
# =============================================================================

def build():
    print(f"[1/7] open {IN_NC}")
    if not IN_NC.exists():
        raise FileNotFoundError(f"{IN_NC} not found. Run v1 first to download the NetCDF.")
    ds = xr.open_dataset(IN_NC)

    var_map = {v: resolve_var(ds, v) for v in VARIABLES}
    actual_vars = list(var_map.values())
    lat_vals = ds["latitude"].values
    lon_vals = ds["longitude"].values
    lon_grid, lat_grid = np.meshgrid(lon_vals, lat_vals)

    # --- Auto-pick water pixels --------------------------------------------
    print("[2/7] auto-picking water pixels (target -> actual):")
    poi_pick = {}
    for name, (la, lo) in POI.items():
        p = auto_pick_pixel(ds, actual_vars, la, lo, SEARCH_RADIUS_KM, MIN_PIXEL_AVAIL)
        poi_pick[name] = p
        print(f"  {name:<10s} target=({la:.4f},{lo:.4f})  "
              f"picked=({p['lat']:.4f},{p['lon']:.4f})  "
              f"offset={p['offset_km']:.2f}km  "
              f"coverage={p['coverage_pct']:.0f}%  [{p['status']}]")

    # Save pixel choices for transparency
    pd.DataFrame.from_dict(poi_pick, orient="index").reset_index().rename(
        columns={"index": "poi"}
    ).to_csv(OUT_PIXELS, index=False)
    print(f"      pixel choices saved to {OUT_PIXELS}")

    # Use the actually-picked Madona pixel as the reference for all neighborhoods
    mad_lat = poi_pick["madona"]["lat"]
    mad_lon = poi_pick["madona"]["lon"]
    dist_madona = haversine_km(mad_lat, mad_lon, lat_grid, lon_grid)
    mask_200m = xr.DataArray(dist_madona <= 0.2, dims=["latitude", "longitude"])
    mask_1km  = xr.DataArray(dist_madona <= 1.0, dims=["latitude", "longitude"])
    mask_2km  = xr.DataArray(dist_madona <= 2.0, dims=["latitude", "longitude"])

    feats = {"date": pd.to_datetime(ds["time"].values)}

    # --- Tier 1: point + neighborhoods -------------------------------------
    print("[3/7] tier 1: point + neighborhood")
    for V in VARIABLES:
        da = ds[var_map[V]]
        v = V.lower()
        for name, p in poi_pick.items():
            feats[f"{v}_{name}_point"] = da.isel(latitude=p["i"], longitude=p["j"]).values
        feats[f"{v}_madona_200m"] = da.where(mask_200m).mean(dim=["latitude", "longitude"]).values
        feats[f"{v}_madona_1km"]  = da.where(mask_1km).mean(dim=["latitude", "longitude"]).values
        feats[f"{v}_madona_2km"]  = da.where(mask_2km).mean(dim=["latitude", "longitude"]).values

    # --- Tier 3 first (uses spatial dims, before we lose ds) ---------------
    print("[4/7] tier 3: spatial")
    north_mask = xr.DataArray(lat_grid >= 45.60, dims=["latitude", "longitude"])
    south_mask = xr.DataArray(lat_grid <= 45.50, dims=["latitude", "longitude"])

    for V in VARIABLES:
        da = ds[var_map[V]]
        v = V.lower()
        north = da.where(north_mask).mean(dim=["latitude", "longitude"]).values
        south = da.where(south_mask).mean(dim=["latitude", "longitude"]).values
        madona_pt = feats[f"{v}_madona_point"]
        feats[f"{v}_gradient_north"] = north - madona_pt
        feats[f"{v}_gradient_south"] = south - madona_pt
        feats[f"{v}_bbox_mean"] = da.mean(dim=["latitude", "longitude"]).values
        feats[f"{v}_bbox_std"]  = da.std(dim=["latitude", "longitude"]).values
        feats[f"{v}_bbox_p90"]  = da.quantile(0.90, dim=["latitude", "longitude"]).values

    # plume distance
    print("      plume distance ...")
    tur_arr = ds[var_map["TUR"]].values
    plume_thresh = 5.0
    plume_dist = np.full(tur_arr.shape[0], np.nan)
    for t in range(tur_arr.shape[0]):
        slab = tur_arr[t]
        mask = (slab > plume_thresh) & ~np.isnan(slab)
        if mask.any():
            plume_dist[t] = dist_madona[mask].min()
    feats["plume_distance_km"] = plume_dist

    # Build initial dataframe in one shot (no fragmentation)
    df = pd.DataFrame(feats)

    # --- TEMPORAL GAP-FILL -------------------------------------------------
    # Done BEFORE temporal features so lag/rolling work on filled values
    print("[5/7] temporal interpolation (linear, max gap = 7 days)")
    nan_before = df.isna().mean().mean() * 100
    df = df.set_index("date").sort_index()
    numeric = df.select_dtypes(include=[np.number]).columns
    df[numeric] = df[numeric].interpolate(method="time", limit=INTERP_MAX_GAP, limit_direction="both")
    df = df.reset_index()
    nan_after = df.isna().mean().mean() * 100
    print(f"      mean NaN rate: {nan_before:.1f}% -> {nan_after:.1f}%")

    # --- Tier 2: temporal features (on interpolated data) ------------------
    print("[6/7] tier 2: temporal features")
    new_cols = {}
    madona_cols = [c for c in df.columns if "madona" in c]
    for col in madona_cols:
        s = df[col]
        new_cols[f"{col}_lag1"]     = s.shift(1)
        new_cols[f"{col}_lag3"]     = s.shift(3)
        new_cols[f"{col}_lag7"]     = s.shift(7)
        new_cols[f"{col}_roll3"]    = s.rolling(3, min_periods=1).mean()
        new_cols[f"{col}_roll7"]    = s.rolling(7, min_periods=1).mean()
        new_cols[f"{col}_delta_1d"] = s.diff()
        new_cols[f"{col}_max_7d"]   = s.rolling(7, min_periods=1).max()

    # days since spike at Madona point
    tur_col = "tur_madona_point"
    thr = df[tur_col].quantile(0.90)
    last = -1
    out = []
    for i, v in enumerate(df[tur_col].values):
        if not np.isnan(v) and v > thr:
            last = i
        out.append(i - last if last >= 0 else np.nan)
    new_cols["tur_days_since_spike"] = out

    for V in VARIABLES:
        for poi in ("dragonja", "rizana", "soca"):
            col = f"{V.lower()}_{poi}_point"
            new_cols[f"{col}_lag1"] = df[col].shift(1)
            new_cols[f"{col}_lag2"] = df[col].shift(2)
            new_cols[f"{col}_lag3"] = df[col].shift(3)

    df = pd.concat([df, pd.DataFrame(new_cols, index=df.index)], axis=1)

    # --- Tier 4 + 5 --------------------------------------------------------
    print("[7/7] tier 4 + 5: seasonality + composites")
    new_cols = {}
    doy = df["date"].dt.dayofyear
    new_cols["doy"]     = doy
    new_cols["doy_sin"] = np.sin(2 * np.pi * doy / 366.0)
    new_cols["doy_cos"] = np.cos(2 * np.pi * doy / 366.0)

    for V in VARIABLES:
        col = f"{V.lower()}_madona_point"
        clim = df.groupby(doy)[col].mean()
        clim_smooth = clim.reindex(range(1, 367)).interpolate().rolling(15, min_periods=1, center=True).mean()
        clim_std = df.groupby(doy)[col].std()
        clim_std_smooth = clim_std.reindex(range(1, 367)).interpolate().rolling(15, min_periods=1, center=True).mean()
        new_cols[f"{V.lower()}_clim_mean"] = doy.map(clim_smooth).values
        new_cols[f"{V.lower()}_anomaly"]   = df[col].values - new_cols[f"{V.lower()}_clim_mean"]
        new_cols[f"{V.lower()}_zscore"]    = new_cols[f"{V.lower()}_anomaly"] / (doy.map(clim_std_smooth).values + 1e-6)

    def mm(s):
        s = pd.Series(s)
        lo, hi = s.min(), s.max()
        return (s - lo) / (hi - lo + 1e-9)

    new_cols["visibility_risk_index"] = (
        0.5 * mm(df["tur_madona_point"]).values
        + 0.3 * mm(df["spm_madona_point"]).values
        + 0.2 * mm(df["chl_madona_point"]).values
    )
    new_cols["bloom_flag"] = (df["chl_madona_point"] > df["chl_madona_point"].quantile(0.95)).astype(int).values

    inbound = np.zeros(len(df), dtype=int)
    for poi in ("dragonja", "rizana", "soca"):
        col = df[f"tur_{poi}_point"]
        t = col.quantile(0.95)
        recent_spike = col.rolling(3, min_periods=1).max() > t
        inbound = np.maximum(inbound, recent_spike.fillna(False).astype(int).values)
    new_cols["plume_inbound_flag"] = inbound

    df = pd.concat([df, pd.DataFrame(new_cols, index=df.index)], axis=1)

    # --- Write CSV ---------------------------------------------------------
    df["date"] = df["date"].dt.date
    df.to_csv(OUT_CSV, index=False)

    print()
    print(f"wrote {OUT_CSV}: {len(df)} rows, {len(df.columns)} columns")
    nan_final = df.isna().mean() * 100
    print(f"mean NaN rate final: {nan_final.mean():.1f}%")
    print(f"columns >50% NaN remaining: {(nan_final > 50).sum()} (these are likely permanent-mask POIs)")
    print()
    print("Top remaining gappy columns:")
    big = nan_final[nan_final > 5].sort_values(ascending=False)
    if len(big) == 0:
        print("  (none above 5%)")
    else:
        for c, p in big.head(25).items():
            print(f"  {c:<40s} {p:5.1f}%")


if __name__ == "__main__":
    build()
