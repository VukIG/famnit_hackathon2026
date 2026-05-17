"""Copernicus Marine data fetcher for the YourSea expedition site.

Pulls oceanographic + biogeochemistry + wave parameters for the Cape Madona
pixel on a given date. One Copernicus call per dataset, then progressive
in-memory depth slicing so a coastal point doesn't end up with all-NaN values.

Dataset families:
- Physics (MEDSEA_ANALYSIS_FORECAST_PHY_006_013):
    cur_anfc → uo, vo   (currents, daily, depth-resolved)
    tem_anfc → thetao   (temperature, daily, depth-resolved)
    sal_anfc → so       (salinity, daily, depth-resolved)
    ssh_anfc → zos      (sea surface height, daily, surface)
    mld_anfc → mlotst   (mixed layer depth, daily, surface)
- Ocean colour (OCEANCOLOUR_MED_BGC_L4_NRT_009_142):
    tur-spm-chl_nrt_l4 → TUR, SPM, CHL  (surface, daily, gap-filled L4)
- Waves (MEDSEA_ANALYSIS_FORECAST_WAV_006_017):
    wav_anfc 4.2km PT1H-i → VHM0, VTM10, VHM0_WW, VHM0_SW1  (hourly, surface)
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


# ─── Dataset spec table ────────────────────────────────────────────────────
DATASETS: list[dict[str, Any]] = [
    # Physics — depth-resolved
    {"id": "cmems_mod_med_phy-cur_anfc_4.2km_P1D-m",
     "variables": ["uo", "vo"], "with_depth": True, "kind": "physics"},
    {"id": "cmems_mod_med_phy-tem_anfc_4.2km_P1D-m",
     "variables": ["thetao"],   "with_depth": True, "kind": "physics"},
    {"id": "cmems_mod_med_phy-sal_anfc_4.2km_P1D-m",
     "variables": ["so"],       "with_depth": True, "kind": "physics"},
    # Physics — surface
    {"id": "cmems_mod_med_phy-ssh_anfc_4.2km_P1D-m",
     "variables": ["zos"],      "with_depth": False, "kind": "physics"},
    {"id": "cmems_mod_med_phy-mld_anfc_4.2km_P1D-m",
     "variables": ["mlotst"],   "with_depth": False, "kind": "physics"},
    # Ocean colour — surface, biology + turbidity (the visibility-critical ones)
    {"id": "cmems_obs_oc_med_bgc_tur-spm-chl_nrt_l4-hr-mosaic_P1D-m",
     "variables": ["TUR", "SPM", "CHL"], "with_depth": False,
     "kind": "ocean_color"},
    # Waves — hourly, averaged to daily mean
    {"id": "cmems_mod_med_wav_anfc_4.2km_PT1H-i",
     "variables": ["VHM0", "VTM10", "VHM0_WW", "VHM0_SW1"],
     "with_depth": False, "kind": "waves"},
]


# ─── Regional fallback for Gulf-of-Trieste ─────────────────────────────────
# Reasonable annual averages near Cape Madona. Used ONLY when the live fetch
# returns NaN at every depth/bbox we try. Demo-grade — not for ML training.
REGIONAL_FALLBACK: dict[str, float] = {
    "uo": 0.04, "vo": -0.02, "current_speed": 0.045,
    "thetao": 16.5, "so": 38.0,
    "zos": 0.10, "mlotst": 12.0,
    "TUR": 1.0, "SPM": 0.8, "CHL": 0.5,
    "VHM0": 0.30, "VTM10": 4.0, "VHM0_WW": 0.20, "VHM0_SW1": 0.20,
}


# ─── Credentials ───────────────────────────────────────────────────────────
def _ensure_credentials() -> None:
    if settings.copernicusmarine_service_username:
        os.environ["COPERNICUSMARINE_SERVICE_USERNAME"] = (
            settings.copernicusmarine_service_username
        )
    if settings.copernicusmarine_service_password:
        os.environ["COPERNICUSMARINE_SERVICE_PASSWORD"] = (
            settings.copernicusmarine_service_password
        )
    if not (os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME")
            and os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD")):
        raise RuntimeError(
            "Copernicus Marine credentials missing — set "
            "COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD in backend/.env"
        )


# ─── Helpers ───────────────────────────────────────────────────────────────
def _mean_across(ds_or_slice, variables: list[str]) -> dict[str, float | None]:
    """NaN-aware mean across all remaining spatial+time dims. Returns scalar per var."""
    dims = [d for d in ("latitude", "longitude", "depth", "time")
            if d in ds_or_slice.dims]
    collapsed = ds_or_slice.mean(dim=dims, skipna=True) if dims else ds_or_slice
    out: dict[str, float | None] = {}
    for var in variables:
        try:
            val = float(collapsed[var].values)
            out[var] = None if np.isnan(val) else val
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not extract %s: %s", var, exc)
            out[var] = None
    return out


def _all_present(values: dict[str, float | None]) -> bool:
    return all(v is not None for v in values.values())


def _pull_single(dataset_id: str, variables: list[str], target_date: date,
                 with_depth: bool) -> tuple[dict[str, float | None], str]:
    """Open one dataset, average to scalars, return (values, quality_tag)."""
    import copernicusmarine  # type: ignore

    pad = settings.site_bbox_pad
    lat = settings.site_latitude
    lon = settings.site_longitude

    start = datetime.combine(target_date, datetime.min.time())
    end = start + timedelta(hours=23, minutes=59)

    kwargs: dict[str, Any] = dict(
        dataset_id=dataset_id,
        variables=variables,
        minimum_latitude=lat - pad,
        maximum_latitude=lat + pad,
        minimum_longitude=lon - pad,
        maximum_longitude=lon + pad,
        start_datetime=start.strftime("%Y-%m-%dT%H:%M:%S"),
        end_datetime=end.strftime("%Y-%m-%dT%H:%M:%S"),
    )
    # For depth-resolved datasets, fetch a WIDE depth net once. We slice it
    # progressively in memory below — saves redundant network calls.
    if with_depth:
        kwargs.update(minimum_depth=0.0, maximum_depth=50.0)

    ds = copernicusmarine.open_dataset(**kwargs)

    try:
        if with_depth and "depth" in ds.dims:
            # Try configured band first (e.g. 18–22 m for diving expedition).
            target_slice = ds.sel(depth=slice(settings.site_depth_min,
                                              settings.site_depth_max))
            values = _mean_across(target_slice, variables)
            if _all_present(values):
                return values, "real_configured"

            # Widen to 0–30 m (still ecologically relevant near-surface).
            widened = ds.sel(depth=slice(0.0, 30.0))
            values = _mean_across(widened, variables)
            if _all_present(values):
                return values, "real_widened"

            # Last try: surface only (0–5 m), where coastal coverage is best.
            surface = ds.sel(depth=slice(0.0, 5.0))
            values = _mean_across(surface, variables)
            return values, "real_surface" if _all_present(values) else "partial"

        # Surface-only datasets — single pass.
        values = _mean_across(ds, variables)
        return values, "real_configured" if _all_present(values) else "partial"

    finally:
        try:
            ds.close()
        except Exception:  # noqa: BLE001
            pass


# ─── Public entry point ───────────────────────────────────────────────────
def fetch_for_date(target_date: date) -> dict[str, Any]:
    """Fetch every configured Copernicus variable for one date at the site.

    Returns a flat record dict + a 'data_quality' sub-dict marking which
    variables are real fetches vs regional fallbacks.
    """
    _ensure_credentials()

    record: dict[str, Any] = {
        "date": target_date.isoformat(),
        "latitude": settings.site_latitude,
        "longitude": settings.site_longitude,
        "depth_min_m": settings.site_depth_min,
        "depth_max_m": settings.site_depth_max,
    }
    quality: dict[str, str] = {}
    errors: list[dict[str, str]] = []

    for ds_spec in DATASETS:
        logger.info("Pulling %s ...", ds_spec["id"])
        try:
            values, tag = _pull_single(
                dataset_id=ds_spec["id"],
                variables=ds_spec["variables"],
                target_date=target_date,
                with_depth=ds_spec["with_depth"],
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to pull %s", ds_spec["id"])
            values = {v: None for v in ds_spec["variables"]}
            tag = "fetch_failed"
            errors.append({"dataset": ds_spec["id"], "error": str(exc)})

        for var, val in values.items():
            if val is None:
                # Substitute regional fallback so the demo isn't full of nulls.
                fb = REGIONAL_FALLBACK.get(var)
                record[var] = fb if fb is not None else 0.0
                quality[var] = "fallback"
            else:
                record[var] = val
                quality[var] = tag

    # Derived: current speed magnitude.
    uo = record.get("uo")
    vo = record.get("vo")
    if uo is not None and vo is not None:
        record["current_speed"] = float(np.sqrt(uo * uo + vo * vo))
        # current_speed quality matches the worse of uo/vo
        q_uo = quality.get("uo", "fallback")
        q_vo = quality.get("vo", "fallback")
        quality["current_speed"] = (
            "fallback" if "fallback" in (q_uo, q_vo) else q_uo
        )
    else:
        record["current_speed"] = REGIONAL_FALLBACK["current_speed"]
        quality["current_speed"] = "fallback"

    record["data_quality"] = quality
    if errors:
        record["errors"] = errors

    return record
