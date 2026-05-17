"""Endpoints for fetching oceanographic data from Copernicus."""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException

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
