"""Firebase Realtime Database push via REST.

Uses HTTP POST to /fetches.json — Firebase generates a unique key. If
settings.firebase_db_auth is set, it's appended as ?auth=<token>.
"""
from __future__ import annotations

import logging
from typing import Any

import requests

from app.config import settings

logger = logging.getLogger(__name__)

PATH = "/fetches"
TIMEOUT_SECONDS = 15


class FirebaseError(RuntimeError):
    pass


def push_record(payload: dict[str, Any]) -> str:
    """POST a record to /fetches.json. Returns the auto-generated Firebase key."""
    base = settings.firebase_db_url.rstrip("/")
    if not base:
        raise FirebaseError("FIREBASE_DB_URL not configured")

    url = f"{base}{PATH}.json"
    if settings.firebase_db_auth:
        url = f"{url}?auth={settings.firebase_db_auth}"

    try:
        resp = requests.post(url, json=payload, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise FirebaseError(f"Network error talking to Firebase: {exc}") from exc

    if not resp.ok:
        raise FirebaseError(
            f"Firebase rejected the write: {resp.status_code} {resp.text[:200]}"
        )

    data = resp.json()
    key = data.get("name", "")
    logger.info("Firebase wrote %s -> %s", PATH, key)
    return key
