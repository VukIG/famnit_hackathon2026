"""Endpoints for fetching oceanographic data from Copernicus."""
from __future__ import annotations

import csv
import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import CopernicusFetchRequest, CopernicusFetchResponse
from app.services import copernicus_service, firebase_service, storage_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data", tags=["data"])


@router.post("/fetch", response_model=CopernicusFetchResponse)
def fetch_copernicus(req: CopernicusFetchRequest) -> CopernicusFetchResponse:
    """Fetch Copernicus parameters for the fixed expedition site on a given date.

    Saves locally as CSV and pushes to Firebase RTDB. Time is stored but does not
    affect the daily-mean dataset query.
    """
    try:
        target_date = datetime.strptime(req.date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    warnings: list[str] = []

    # 1) Pull from Copernicus
    try:
        record = copernicus_service.fetch_for_date(target_date)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Copernicus: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Copernicus fetch failed")
        raise HTTPException(status_code=502, detail=f"Copernicus fetch failed: {exc}") from exc

    if "errors" in record:
        warnings.extend(f"{e['dataset']}: {e['error']}" for e in record["errors"])
        record.pop("errors", None)

    # 2) Save CSV
    try:
        csv_path = storage_service.save_record(record, request_time=req.time)
    except Exception as exc:  # noqa: BLE001
        logger.exception("CSV save failed")
        warnings.append(f"csv: {exc}")
        csv_path = None

    # 3) Push to Firebase
    firebase_key: str | None = None
    try:
        firebase_payload = {**record, "time": req.time}
        firebase_key = firebase_service.push_record(firebase_payload)
    except firebase_service.FirebaseError as exc:
        logger.warning("Firebase push failed: %s", exc)
        warnings.append(f"firebase: {exc}")

    return CopernicusFetchResponse(
        status="ok",
        firebase_key=firebase_key,
        csv_path=str(csv_path) if csv_path else None,
        record=record,
        warnings=warnings,
    )


@router.get("/latest")
def get_latest_satellite() -> dict:
    """Return the most recently saved Copernicus satellite record."""
    data_dir = Path(settings.data_dir)
    files = sorted(data_dir.glob("fetches_*.csv"), reverse=True)
    if not files:
        raise HTTPException(status_code=404, detail="No satellite data available yet")

    with files[0].open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        raise HTTPException(status_code=404, detail="No satellite records in latest file")

    last = rows[-1]

    def _f(v: str | None) -> float | None:
        if v in (None, "", "None", "nan"):
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    return {
        "date": last.get("date"),
        "time": last.get("time"),
        "latitude": _f(last.get("latitude")),
        "longitude": _f(last.get("longitude")),
        "depth_min_m": _f(last.get("depth_min_m")),
        "depth_max_m": _f(last.get("depth_max_m")),
        "uo": _f(last.get("uo")),
        "vo": _f(last.get("vo")),
        "current_speed": _f(last.get("current_speed")),
        "thetao": _f(last.get("thetao")),
        "so": _f(last.get("so")),
        "zos": _f(last.get("zos")),
        "mlotst": _f(last.get("mlotst")),
        "TUR": _f(last.get("TUR")),
        "SPM": _f(last.get("SPM")),
        "CHL": _f(last.get("CHL")),
        "VHM0": _f(last.get("VHM0")),
        "VTM10": _f(last.get("VTM10")),
        "VHM0_WW": _f(last.get("VHM0_WW")),
        "VHM0_SW1": _f(last.get("VHM0_SW1")),
    }
