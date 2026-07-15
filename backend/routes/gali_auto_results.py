"""Auto-fetch Gali/Disawar results from king.sattaapi.com.

Runs in the background every 5 minutes. Silently no-ops if
SATTA_API_URL is not configured in env.

Environment vars:
  - SATTA_API_URL       e.g. "https://king.sattaapi.com/wp-json/satta/v1/results"
  - SATTA_API_KEY       provider api key
  - SATTA_DOMAIN_KEY    provider domain key
"""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

import httpx
from bson import ObjectId

from database import db

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))


async def _settle_bets(game_id: str, date: str, jodi: str, single: str):
    """Settle pending bets for the given game+date+result. Credits winners' balance.

    Mirrors the logic in result_routes.declare_result but scoped to auto-fetch
    scenarios (idempotent — only touches pending bets).
    """
    if not jodi or len(jodi) < 2:
        return
    andar_digit = jodi[0]
    bahar_digit = jodi[1]

    # Fetch all winner categories
    q_base = {"game_id": game_id, "date": date, "status": "pending"}
    winners = []
    winners += await db.bets.find({**q_base, "bet_type": "single", "number": single}).to_list(1000)
    winners += await db.bets.find({**q_base, "bet_type": "jodi", "number": jodi}).to_list(1000)
    winners += await db.bets.find({**q_base, "bet_type": "haruf_andar", "number": andar_digit}).to_list(1000)
    winners += await db.bets.find({**q_base, "bet_type": "haruf_bahar", "number": bahar_digit}).to_list(1000)

    # Crossing bets
    crossing = await db.bets.find({**q_base, "bet_type": "crossing"}).to_list(1000)
    for cb in crossing:
        n = cb.get("number", "")
        if len(n) == 2 and ({n[0], n[1]} == {andar_digit, bahar_digit} or n == andar_digit + bahar_digit):
            winners.append(cb)

    for bet in winners:
        try:
            await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": bet["potential_win"]}})
            await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "won", "won_amount": bet["potential_win"]}})
        except Exception as e:
            logger.warning(f"[SattaAPI] settle winner failed for bet {bet.get('id')}: {e}")

    # Mark all remaining pending → lost
    await db.bets.update_many(
        {"game_id": game_id, "date": date, "status": "pending"},
        {"$set": {"status": "lost"}}
    )
    logger.info(f"[SattaAPI] Settled {len(winners)} winner bets for {game_id} {date}")

# Map from provider's game names (case-insensitive) → our internal game_id
NAME_TO_GAME_ID = {
    "gali": "gali",
    "disawar": "disawar",
    "faridabad": "faridabad",
    "ghaziabad": "ghaziabad",
    "shri ganesh": "shri_ganesh",
    "shreeganesh": "shri_ganesh",
    "shri_ganesh": "shri_ganesh",
    "delhi bazar": "delhi_bazaar",
    "delhi bazaar": "delhi_bazaar",
    "delhi_bazaar": "delhi_bazaar",
    "delhi": "delhi_bazaar",
}


def _normalize_name(n: str) -> str:
    return (n or "").strip().lower().replace("-", " ").replace("_", " ").replace("  ", " ")


def _extract_result(item: dict):
    """Pull (game_id, jodi, date) from a provider result item — flexible parser."""
    # game / market / name
    raw_name = (
        item.get("game") or item.get("market") or item.get("name")
        or item.get("game_name") or item.get("title") or ""
    )
    gid = NAME_TO_GAME_ID.get(_normalize_name(raw_name))
    if not gid:
        return None

    # jodi / result number — try several possible field names
    jodi = (
        item.get("result") or item.get("jodi") or item.get("number")
        or item.get("today_result") or item.get("value") or ""
    )
    jodi = str(jodi).strip()
    if not jodi or jodi.lower() in ("xx", "--", "wait", "loading"):
        return None
    # Some APIs return "42XX" or "XX42" — clean up
    jodi = jodi.replace("XX", "").replace("xx", "").strip()
    if not jodi.isdigit():
        return None
    # normalise 1-digit → prefix 0
    if len(jodi) == 1:
        jodi = "0" + jodi

    # date — default to today IST
    date_str = item.get("date") or item.get("result_date") or item.get("day")
    if not date_str:
        date_str = datetime.now(IST).strftime("%Y-%m-%d")
    else:
        # accept 2026-07-14 or 14-07-2026 formats
        date_str = str(date_str).strip()[:10]
        if "/" in date_str:
            date_str = date_str.replace("/", "-")
        if len(date_str) == 10 and date_str[2] == "-":
            # DD-MM-YYYY → YYYY-MM-DD
            d, m, y = date_str.split("-")
            date_str = f"{y}-{m}-{d}"

    return {"game_id": gid, "jodi": jodi, "date": date_str}


async def _fetch_once(client: httpx.AsyncClient, api_url: str, api_key: str, domain_key: str):
    # Cache-buster
    v = int(datetime.now().timestamp())
    tried = []

    # Attempt 1: keys as HTTP headers (most REST APIs)
    tried.append("headers")
    try:
        resp = await client.get(
            api_url,
            params={"v": v},
            headers={
                "X-API-Key": api_key, "X-Domain-Key": domain_key,
                "api-key": api_key, "domain-key": domain_key,
                "Accept": "application/json",
            },
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"[SattaAPI] headers attempt failed: {e}")

    # Attempt 2: keys as query params
    tried.append("query")
    try:
        resp = await client.get(
            api_url,
            params={"v": v, "api_key": api_key, "domain_key": domain_key},
            headers={"Accept": "application/json"},
        )
        if resp.status_code == 200:
            return resp.json()
        logger.warning(f"[SattaAPI] query attempt HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"[SattaAPI] query attempt failed: {e}")

    logger.warning(f"[SattaAPI] all attempts failed ({', '.join(tried)})")
    return None


async def satta_auto_fetch_loop():
    """Poll king.sattaapi.com every 5 min and upsert results into db.results."""
    api_url = (os.environ.get("SATTA_API_URL") or "").strip()
    api_key = (os.environ.get("SATTA_API_KEY") or "").strip()
    domain_key = (os.environ.get("SATTA_DOMAIN_KEY") or "").strip()

    if not (api_url and api_key and domain_key):
        logger.info("[SattaAPI] SATTA_API_URL / SATTA_API_KEY / SATTA_DOMAIN_KEY not set — Gali auto-fetch skipped")
        return

    logger.info(f"[SattaAPI] Gali auto-fetch loop started → {api_url}")

    async with httpx.AsyncClient(verify=False, timeout=20.0) as client:
        while True:
            try:
                data = await _fetch_once(client, api_url, api_key, domain_key)
                if data is not None:
                    # Response may be a list or {"results": [...]} — normalise
                    if isinstance(data, dict):
                        items = data.get("results") or data.get("data") or data.get("games") or []
                    elif isinstance(data, list):
                        items = data
                    else:
                        items = []

                    for it in items:
                        if not isinstance(it, dict):
                            continue
                        parsed = _extract_result(it)
                        if not parsed:
                            continue
                        # Upsert into db.results (skip if unchanged)
                        existing = await db.results.find_one({"game_id": parsed["game_id"], "date": parsed["date"]})
                        if existing and existing.get("jodi_result") == parsed["jodi"]:
                            continue
                        import uuid
                        single = parsed["jodi"][-1] if parsed["jodi"] else ""
                        doc = {
                            "id": (existing or {}).get("id") or uuid.uuid4().hex,
                            "game_id": parsed["game_id"],
                            "date": parsed["date"],
                            "jodi_result": parsed["jodi"],
                            "single_result": single,
                            "declared_at": datetime.now(timezone.utc),
                            "source": "sattaapi_auto",
                        }
                        await db.results.update_one(
                            {"game_id": parsed["game_id"], "date": parsed["date"]},
                            {"$set": doc},
                            upsert=True,
                        )
                        await _settle_bets(parsed["game_id"], parsed["date"], parsed["jodi"], single)
                        logger.info(f"[SattaAPI] Auto-result: {parsed['game_id']} {parsed['date']} → jodi={parsed['jodi']}")
            except Exception as e:
                logger.exception(f"[SattaAPI] loop error: {e}")

            await asyncio.sleep(300)  # 5 min poll
