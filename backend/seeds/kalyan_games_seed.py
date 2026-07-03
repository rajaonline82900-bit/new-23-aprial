"""Seed / sync the 13 official Kalyan games as per user's authoritative list
(Feb 2026). Idempotent: safe to run any number of times, will NOT create
duplicates. Also updates DP Boss auto-fetch mapping.

Usage:
    python -m backend.seeds.kalyan_games_seed
or from within backend/:
    python -c "import asyncio; from seeds.kalyan_games_seed import seed_kalyan_games; asyncio.run(seed_kalyan_games())"

This script is also invoked automatically on backend startup so any
Kalyan game inserted manually or by earlier scripts is normalised to the
authoritative list.
"""
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# The single source of truth for Kalyan games.
# game_id must be lowercase snake_case, matches DP Boss auto-fetch mapping.
KALYAN_GAMES = [
    # (game_id,             display_name,          name_hi,               open_time, close_time, dpboss_market_id)
    ("milan_morning",       "Milan Morning",       "मिलन मॉर्निंग",           "10:15",  "11:15",     2),
    ("time_bazar_morning",  "Time Bazar Morning",  "टाइम बाज़ार मॉर्निंग",     "11:00",  "12:00",    10),
    ("sridevi",             "Sridevi",             "श्रीदेवी",                 "11:35",  "12:35",     3),
    ("madhuri_day",         "Madhuri Day",         "माधुरी डे",                "12:00",  "13:00",     5),
    ("time_bazar",          "Time Bazar",          "टाइम बाज़ार",              "13:10",  "14:10",    12),
    ("milan_day",           "Milan Day",           "मिलन डे",                  "15:00",  "17:00",    17),
    ("kalyan_day",          "Kalyan Day",          "कल्याण डे",                "16:00",  "18:00",    21),
    ("sridevi_night",       "Sridevi Night",       "श्रीदेवी नाइट",             "19:00",  "20:00",    22),
    ("madhur_night",        "Madhur Night",        "मधुर नाइट",                "20:30",  "22:30",    43),
    ("milan_night",         "Milan Night",         "मिलन नाइट",                "21:00",  "23:00",    27),
    ("kalyan_night",        "Kalyan Night",        "कल्याण नाइट",              "21:30",  "23:30",    34),
    ("rajdhani_night",      "Rajdhani Night",      "राजधानी नाइट",             "21:35",  "23:55",    28),
    ("main_bazar",          "Main Bazar",          "मेन बाज़ार",                "21:40",  "00:05",    29),
]

# Betting window starts at 07:00 (per platform-wide rule) — Jodi/Open bets
# gated by open_time, Single/Patti Close bets gated by close_time.
BETTING_WINDOW_START = "07:00"


async def seed_kalyan_games():
    """Idempotently upsert the 13 authoritative Kalyan games. Also removes
    stray old Kalyan game_ids not in the list (to guarantee no double-count).
    """
    # Allow running as a script (adds /app/backend to sys.path)
    if __name__ == "__main__":
        sys.path.insert(0, "/app/backend")

    from database import db

    now = datetime.now(timezone.utc)
    keep_game_ids = {g[0] for g in KALYAN_GAMES}

    # 1. Upsert each game
    for game_id, name, name_hi, open_time, close_time, _dpboss_id in KALYAN_GAMES:
        display_time = f"Open {open_time} • Close {close_time}"
        await db.games.update_one(
            {"game_id": game_id, "category": "kalyan"},
            {
                "$set": {
                    "game_id": game_id,
                    "name": name,
                    "name_hi": name_hi,
                    "category": "kalyan",
                    "open_time": open_time,
                    "close_time": close_time,
                    "end_time": close_time,
                    "start_time": BETTING_WINDOW_START,
                    "display_time": display_time,
                    "is_active": True,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

    # 2. Delete any Kalyan game NOT in the authoritative list — this is
    #    what prevents "double counting" if older duplicate rows exist
    #    under different names (e.g. "Kalyan" 16:02-18:02 vs "Kalyan Day"
    #    16:00-18:00).
    result = await db.games.delete_many({
        "category": "kalyan",
        "$nor": [{"game_id": gid} for gid in keep_game_ids],
    })

    logger.info(f"[seed:kalyan] Upserted {len(KALYAN_GAMES)} games, "
                f"removed {result.deleted_count} stray rows")
    return {
        "upserted": len(KALYAN_GAMES),
        "removed_stray": result.deleted_count,
    }


def get_dpboss_mapping() -> dict:
    """Return {game_id: dpboss_market_id} for use by auto-fetch."""
    return {g[0]: g[5] for g in KALYAN_GAMES if g[5] is not None}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = asyncio.run(seed_kalyan_games())
    print(res)
