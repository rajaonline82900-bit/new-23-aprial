"""
Kalyan Auto Result Integration — DP Boss API (api.codehap.com/dp/)

Polls DP Boss API every 3 minutes and auto-declares Open/Close panna
for our mapped Kalyan games. Uses declare_kalyan_panna_internal() from
kalyan_routes.py so declaration + bet-settlement runs the exact same
code path as the manual admin declare button.
"""

import os
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Request

from helpers import get_games_dict
from auth import get_admin_user
from routes.kalyan_routes import declare_kalyan_panna_internal

logger = logging.getLogger(__name__)

router = APIRouter()

DPBOSS_API_KEY = os.environ.get("DPBOSS_API_KEY", "").strip()
DPBOSS_API_URL = os.environ.get("DPBOSS_API_URL", "https://api.codehap.com/dp/").strip()
# ENV toggle: only actually run the polling loop when explicitly enabled.
# On the preview environment we leave this false so the paid DP Boss API
# is not called; on the VPS the operator sets it to "true".
AUTO_FETCH_ENABLED = os.environ.get("KALYAN_AUTO_FETCH_ENABLED", "false").strip().lower() in ("1", "true", "yes")
POLL_INTERVAL_SEC = 180

# game_id → DP Boss market id — kept in sync with the authoritative seed
# so a new Kalyan game only needs to be added in one place.
from seeds.kalyan_games_seed import get_dpboss_mapping  # noqa: E402
KALYAN_DPBOSS_MAPPING = get_dpboss_mapping()

_running = False


def _today_ymd() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")


async def fetch_kalyan_results_from_dpboss() -> dict:
    """One-shot: fetch DP Boss live markets and declare any matches."""
    if not DPBOSS_API_KEY:
        return {"success": False, "error": "DPBOSS_API_KEY not configured"}
    date_str = _today_ymd()
    id_to_game = {v: k for k, v in KALYAN_DPBOSS_MAPPING.items()}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(DPBOSS_API_URL, params={"key": DPBOSS_API_KEY, "type": "live"})
            r.raise_for_status()
            payload = r.json()
    except Exception as e:
        logger.exception(f"[kalyan-auto] DP Boss fetch error: {e}")
        return {"success": False, "error": str(e)}

    if not payload.get("success"):
        return {"success": False, "error": payload.get("message", "API returned success=false")}

    declared = []
    errors = []
    for market in payload.get("data", []):
        mid = market.get("id")
        game_id = id_to_game.get(mid)
        if not game_id:
            continue

        for session in ("open", "close"):
            key = "number_open" if session == "open" else "number_close"
            panna = (market.get(key) or "").strip()
            if not (panna.isdigit() and len(panna) == 3):
                continue
            res = await declare_kalyan_panna_internal(
                game_id=game_id,
                session=session,
                panna=panna,
                date_str=date_str,
                source="dpboss_auto",
            )
            if res.get("ok"):
                if not res.get("already_declared"):
                    declared.append({
                        "game_id": game_id, "session": session,
                        "panna": panna, "ank": res.get("ank"),
                        "jodi": res.get("jodi"),
                    })
                    logger.info(f"[kalyan-auto] ✅ {game_id} {session}={panna} ank={res.get('ank')}")
            else:
                errors.append({"game_id": game_id, "session": session, "error": res.get("error")})

    return {
        "success": True,
        "declared_count": len(declared),
        "declared": declared,
        "errors": errors,
        "markets_checked": payload.get("count", 0),
    }


async def kalyan_auto_fetch_loop():
    global _running
    if not AUTO_FETCH_ENABLED:
        logger.warning(
            "[kalyan-auto] Skipped — KALYAN_AUTO_FETCH_ENABLED is not 'true'. "
            "Set it in backend/.env on the VPS to enable auto-fetch."
        )
        return
    if not DPBOSS_API_KEY:
        logger.warning("[kalyan-auto] Skipped — DPBOSS_API_KEY not set")
        return
    _running = True
    logger.info(f"[kalyan-auto] Loop started (every {POLL_INTERVAL_SEC}s)")
    await asyncio.sleep(15)  # let the app finish booting
    while _running:
        try:
            res = await fetch_kalyan_results_from_dpboss()
            if not res.get("success"):
                logger.error(f"[kalyan-auto] ❌ {res.get('error')}")
        except Exception as e:
            logger.exception(f"[kalyan-auto] Unhandled loop error: {e}")
        await asyncio.sleep(POLL_INTERVAL_SEC)


# ---------- Admin endpoints ----------
@router.post("/admin/kalyan/auto-fetch")
async def trigger_kalyan_auto_fetch(request: Request):
    """Manual one-shot: fetch DP Boss now."""
    await get_admin_user(request)
    return await fetch_kalyan_results_from_dpboss()


@router.get("/admin/kalyan/auto-fetch/status")
async def kalyan_auto_fetch_status(request: Request):
    """Diagnostic: show mapping, running state, and any Kalyan games in the
    DB that aren't mapped to a DP Boss market id."""
    await get_admin_user(request)
    games_dict = await get_games_dict()
    kalyan_game_ids_in_db = [gid for gid, g in games_dict.items() if g.get("category") == "kalyan"]
    unmapped = [gid for gid in kalyan_game_ids_in_db if gid not in KALYAN_DPBOSS_MAPPING]
    return {
        "running": _running,
        "auto_fetch_enabled": AUTO_FETCH_ENABLED,
        "api_url": DPBOSS_API_URL,
        "api_key_configured": bool(DPBOSS_API_KEY),
        "poll_interval_sec": POLL_INTERVAL_SEC,
        "mapped_games": KALYAN_DPBOSS_MAPPING,
        "unmapped_kalyan_games_in_db": unmapped,
    }
