import logging
import json as _json
from pywebpush import webpush, WebPushException
from database import db
from config import DEFAULT_GAMES, GAMES, VAPID_PRIVATE_KEY

logger = logging.getLogger(__name__)


async def load_games():
    """Load games from database"""
    global_games = GAMES
    global_games.clear()
    games_from_db = await db.games.find({}).to_list(100)
    if games_from_db:
        for g in games_from_db:
            global_games[g["game_id"]] = {
                "name": g["name"],
                "name_hi": g["name_hi"],
                "start_time": g.get("start_time", g.get("time", "00:00")),
                "end_time": g.get("end_time", g.get("time", "00:00")),
                "time": g.get("end_time", g.get("time", "00:00")),
                "display_time": g["display_time"],
                "is_active": g.get("is_active", True)
            }
    else:
        global_games.update(DEFAULT_GAMES.copy())


async def get_games_dict():
    """Get current games configuration"""
    if not GAMES:
        await load_games()
    return GAMES


async def send_push_to_all(title: str, body: str, url: str = "/dashboard"):
    subs = await db.push_subscriptions.find({}).to_list(5000)
    sent = 0
    for sub in subs:
        try:
            webpush(
                subscription_info=sub["subscription"],
                data=_json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": "mailto:admin@sattamatka.com"}
            )
            sent += 1
        except WebPushException:
            await db.push_subscriptions.delete_one({"_id": sub["_id"]})
        except Exception as e:
            logger.error(f"Push error: {e}")
    logger.info(f"Push notifications sent: {sent}/{len(subs)}")
    return sent
