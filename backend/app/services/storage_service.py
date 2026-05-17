"""Local CSV storage for fetched Copernicus records.

Appends each fetch to a daily CSV under settings.data_dir. New files get a
header row; existing files just get the row appended.
"""
from __future__ import annotations

import csv
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# Stable column order — Firebase + CSV should match.
COLUMNS = [
    "fetched_at",
    "date",
    "time",
    "latitude",
    "longitude",
    "depth_min_m",
    "depth_max_m",
    # Physics
    "uo", "vo", "current_speed",
    "thetao", "so",
    "zos", "mlotst",
    # Ocean colour — the visibility-critical block
    "TUR", "SPM", "CHL",
    # Waves
    "VHM0", "VTM10", "VHM0_WW", "VHM0_SW1",
]


def save_record(record: dict[str, Any], request_time: str) -> Path:
    """Append one record to today's CSV. Returns the file path."""
    data_dir = Path(settings.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    fetched_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    row = {
        "fetched_at": fetched_at,
        "date": record.get("date"),
        "time": request_time,
        "latitude": record.get("latitude"),
        "longitude": record.get("longitude"),
        "depth_min_m": record.get("depth_min_m"),
        "depth_max_m": record.get("depth_max_m"),
        # Physics
        "uo": record.get("uo"),
        "vo": record.get("vo"),
        "current_speed": record.get("current_speed"),
        "thetao": record.get("thetao"),
        "so": record.get("so"),
        "zos": record.get("zos"),
        "mlotst": record.get("mlotst"),
        # Ocean colour
        "TUR": record.get("TUR"),
        "SPM": record.get("SPM"),
        "CHL": record.get("CHL"),
        # Waves
        "VHM0": record.get("VHM0"),
        "VTM10": record.get("VTM10"),
        "VHM0_WW": record.get("VHM0_WW"),
        "VHM0_SW1": record.get("VHM0_SW1"),
    }

    file_path = data_dir / f"fetches_{datetime.utcnow().strftime('%Y-%m-%d')}.csv"
    is_new = not file_path.exists()

    with file_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        if is_new:
            writer.writeheader()
        writer.writerow(row)

    logger.info("Appended record to %s", file_path)
    return file_path
