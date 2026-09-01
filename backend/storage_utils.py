"""Emergent Object Storage wrapper — replaces local pod-ephemeral file writes.

Uses the platform's INTEGRATION_PROXY_URL + EMERGENT_LLM_KEY. All uploads are
prefixed with `shivshakti/uploads/` and the returned URL is
`/api/uploads/{filename}` — the /api/uploads route resolves the object via
`get_object(filename)` so downstream (chat, wallet scanner) works unchanged.
"""
import os
import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_PREFIX = "shivshakti/uploads"

_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY not set")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(filename: str, data: bytes, content_type: str) -> str:
    """Upload `data` under `shivshakti/uploads/{filename}`. Returns the filename."""
    key = init_storage()
    path = f"{APP_PREFIX}/{filename}"
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:
        # Storage key expired mid-session — mint a new one and retry once.
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return filename


def get_object(filename: str):
    """Return (bytes, content_type) for `shivshakti/uploads/{filename}`."""
    key = init_storage()
    path = f"{APP_PREFIX}/{filename}"
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 404:
        # Retry once with fresh key in case session-key died.
        key = init_storage(force=True)
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
