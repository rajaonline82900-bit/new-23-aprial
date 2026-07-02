"""Game category ON/OFF toggles — admin controls whether each game
category (gali_disawar, kalyan, aviator, ludo) is available to users.

Public endpoint returns the current state; admin endpoint updates it.
Backend request handlers for each game import `assert_game_enabled(...)`
to block bet placement / table creation when a category is disabled.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from database import db
from auth import get_admin_user

router = APIRouter()

GAME_CATEGORIES = ["gali_disawar", "kalyan", "aviator", "ludo"]
DEFAULT_TOGGLES = {c: True for c in GAME_CATEGORIES}


async def get_game_toggles() -> dict:
    """Return current toggle state, filling in defaults for missing keys."""
    s = await db.settings.find_one({"_id": "game_toggles"})
    out = dict(DEFAULT_TOGGLES)
    if s and isinstance(s.get("toggles"), dict):
        for k, v in s["toggles"].items():
            if k in GAME_CATEGORIES:
                out[k] = bool(v)
    return out


async def assert_game_enabled(category: str) -> None:
    """Raise HTTP 403 if `category` is turned off by admin."""
    if category not in GAME_CATEGORIES:
        return
    toggles = await get_game_toggles()
    if not toggles.get(category, True):
        raise HTTPException(
            403,
            "यह गेम अभी बंद है / This game is currently unavailable"
        )


# ---------- Public read ----------
@router.get("/settings/game-toggles")
async def public_game_toggles():
    return {"toggles": await get_game_toggles()}


# ---------- Admin ----------
@router.get("/admin/game-toggles")
async def admin_get_toggles(request: Request):
    await get_admin_user(request)
    return {"toggles": await get_game_toggles()}


@router.post("/admin/game-toggles")
async def admin_set_toggles(request: Request):
    await get_admin_user(request)
    body = await request.json()
    incoming = body.get("toggles") or {}
    if not isinstance(incoming, dict):
        raise HTTPException(400, "toggles must be an object")
    current = await get_game_toggles()
    for k in GAME_CATEGORIES:
        if k in incoming:
            current[k] = bool(incoming[k])
    await db.settings.update_one(
        {"_id": "game_toggles"},
        {"$set": {"toggles": current, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"toggles": current}
