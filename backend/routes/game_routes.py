from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import calendar

from database import db
from auth import get_current_user
from config import IST, BET_TYPES, GAMES
from helpers import get_games_dict
from models import BetCreate, BatchBetCreate
from bson import ObjectId
import uuid

router = APIRouter()

# Fixed display order
GAME_ORDER = ["delhi_bazaar", "shri_ganesh", "faridabad", "ghaziabad", "gali", "disawar"]


@router.get("/games")
async def get_games():
    games_list = []
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    today = ist_now.strftime("%Y-%m-%d")
    yesterday = (ist_now - timedelta(days=1)).strftime("%Y-%m-%d")

    last_day = calendar.monthrange(ist_now.year, ist_now.month)[1]
    is_holiday = ist_now.day == last_day

    games_dict = await get_games_dict()

    ordered_ids = [gid for gid in GAME_ORDER if gid in games_dict]
    for gid in games_dict:
        if gid not in ordered_ids:
            ordered_ids.append(gid)

    for game_id in ordered_ids:
        game = games_dict[game_id]
        if not game.get("is_active", True):
            continue

        today_result = await db.results.find_one({"game_id": game_id, "date": today}, {"_id": 0})
        yesterday_result = await db.results.find_one({"game_id": game_id, "date": yesterday}, {"_id": 0})

        games_list.append({
            "id": game_id,
            "name": game["name"],
            "name_hi": game["name_hi"],
            "start_time": game.get("start_time", game.get("time", "")),
            "end_time": game.get("end_time", game.get("time", "")),
            "time": game.get("end_time", game.get("time", "")),
            "display_time": game["display_time"],
            "is_holiday": is_holiday,
            "today_result": {"jodi": today_result["jodi_result"], "single": today_result["single_result"]} if today_result else None,
            "yesterday_result": {"jodi": yesterday_result["jodi_result"], "single": yesterday_result["single_result"]} if yesterday_result else None
        })

    return {"games": games_list, "is_holiday": is_holiday}


@router.get("/games/{game_id}")
async def get_game(game_id: str):
    games_dict = await get_games_dict()
    if game_id not in games_dict:
        raise HTTPException(status_code=404, detail="Game not found")

    game = games_dict[game_id]
    results = await db.results.find({"game_id": game_id}, {"_id": 0}).sort("date", -1).limit(10).to_list(10)

    return {
        "id": game_id, "name": game["name"], "name_hi": game["name_hi"],
        "start_time": game.get("start_time", game.get("time", "")),
        "end_time": game.get("end_time", game.get("time", "")),
        "time": game.get("end_time", game.get("time", "")),
        "display_time": game["display_time"],
        "results": results
    }


# Betting Routes
@router.post("/bets")
async def place_bet(bet: BetCreate, request: Request):
    user = await get_current_user(request)

    games_dict = await get_games_dict()
    if bet.game_id not in games_dict:
        raise HTTPException(status_code=400, detail="Invalid game")

    game = games_dict[bet.game_id]

    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    last_day = calendar.monthrange(ist_now.year, ist_now.month)[1]
    if ist_now.day == last_day:
        raise HTTPException(status_code=400, detail="आज छुट्टी है! महीने की आखिरी तारीख पर बेटिंग बंद रहती है।")

    start_time_str = game.get("start_time", "")
    end_time_str = game.get("end_time", "")
    if start_time_str and end_time_str:
        now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        current_minutes = now.hour * 60 + now.minute
        try:
            sh, sm = map(int, start_time_str.split(":"))
            eh, em = map(int, end_time_str.split(":"))
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            if start_min > end_min:
                betting_open = current_minutes >= start_min or current_minutes <= end_min
            else:
                betting_open = start_min <= current_minutes <= end_min
            if not betting_open:
                raise HTTPException(status_code=400, detail=f"बेटिंग बंद है! समय: {start_time_str} - {end_time_str}")
        except ValueError:
            pass

    if bet.bet_type not in BET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid bet type")

    if bet.bet_type in ("single", "haruf_andar", "haruf_bahar"):
        if not bet.number.isdigit() or len(bet.number) != 1:
            raise HTTPException(status_code=400, detail="Single/Haruf bet must be 0-9")
    else:
        if not bet.number.isdigit() or len(bet.number) != 2:
            raise HTTPException(status_code=400, detail="Jodi bet must be 00-99")

    settings_doc = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    if settings_doc:
        if bet.bet_type == "jodi":
            min_bet = int(settings_doc.get("min_bet_jodi", 10))
        elif bet.bet_type in ("haruf_andar", "haruf_bahar"):
            min_bet = int(settings_doc.get("min_bet_haruf", 10))
        else:
            min_bet = int(settings_doc.get("min_bet_crossing", 10))
    else:
        min_bet = 10
    if bet.amount < min_bet:
        raise HTTPException(status_code=400, detail=f"न्यूनतम बेट ₹{min_bet} है")

    if bet.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")

    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": -bet.amount}})

    today = datetime.now(IST).strftime("%Y-%m-%d")

    bet_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "game_id": bet.game_id,
        "game_name": games_dict[bet.game_id]["name"],
        "bet_type": bet.bet_type,
        "number": bet.number,
        "amount": bet.amount,
        "potential_win": bet.amount * BET_TYPES[bet.bet_type]["multiplier"],
        "date": today,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }

    await db.bets.insert_one(bet_doc)
    return {"message": "Bet placed successfully", "bet_id": bet_doc["id"], "potential_win": bet_doc["potential_win"]}


@router.post("/bets/batch")
async def place_batch_bets(batch: BatchBetCreate, request: Request):
    user = await get_current_user(request)

    games_dict = await get_games_dict()
    if batch.game_id not in games_dict:
        raise HTTPException(status_code=400, detail="Invalid game")

    game = games_dict[batch.game_id]

    ist_now_batch = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    last_day_batch = calendar.monthrange(ist_now_batch.year, ist_now_batch.month)[1]
    if ist_now_batch.day == last_day_batch:
        raise HTTPException(status_code=400, detail="आज छुट्टी है! महीने की आखिरी तारीख पर बेटिंग बंद रहती है।")

    start_time_str = game.get("start_time", "")
    end_time_str = game.get("end_time", "")
    if start_time_str and end_time_str:
        now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        current_minutes = now.hour * 60 + now.minute
        try:
            sh, sm = map(int, start_time_str.split(":"))
            eh, em = map(int, end_time_str.split(":"))
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            if start_min > end_min:
                betting_open = current_minutes >= start_min or current_minutes <= end_min
            else:
                betting_open = start_min <= current_minutes <= end_min
            if not betting_open:
                raise HTTPException(status_code=400, detail=f"बेटिंग बंद है! समय: {start_time_str} - {end_time_str}")
        except ValueError:
            pass

    if batch.bet_type not in BET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid bet type")

    if not batch.bets or len(batch.bets) == 0:
        raise HTTPException(status_code=400, detail="No bets provided")

    total_amount = 0
    for b in batch.bets:
        if batch.bet_type in ("single", "haruf_andar", "haruf_bahar"):
            if not b.number.isdigit() or len(b.number) != 1:
                raise HTTPException(status_code=400, detail=f"Invalid single number: {b.number}")
        else:
            if not b.number.isdigit() or len(b.number) != 2:
                raise HTTPException(status_code=400, detail=f"Invalid jodi number: {b.number}")
        if b.amount < 10:
            raise HTTPException(status_code=400, detail=f"Minimum bet ₹10 (number {b.number})")
        total_amount += b.amount

    if total_amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail=f"अपर्याप्त बैलेंस! कुल बेट: ₹{total_amount}, बैलेंस: ₹{user.get('balance', 0)}")

    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": -total_amount}})

    today = datetime.now(IST).strftime("%Y-%m-%d")
    multiplier = BET_TYPES[batch.bet_type]["multiplier"]

    bet_docs = []
    total_potential = 0
    for b in batch.bets:
        bet_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "game_id": batch.game_id,
            "game_name": game["name"],
            "bet_type": batch.bet_type,
            "number": b.number,
            "amount": b.amount,
            "potential_win": b.amount * multiplier,
            "date": today,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        bet_docs.append(bet_doc)
        total_potential += bet_doc["potential_win"]

    await db.bets.insert_many(bet_docs)

    return {
        "message": f"{len(bet_docs)} बेट्स लगाई गईं!",
        "total_bets": len(bet_docs),
        "total_amount": total_amount,
        "total_potential_win": total_potential
    }


@router.get("/bets")
async def get_user_bets(request: Request, limit: int = 100, game_id: str = None, status: str = None, date: str = None):
    user = await get_current_user(request)

    query = {"user_id": user["_id"]}
    if game_id:
        query["game_id"] = game_id
    if status and status != "all":
        query["status"] = status
    if date:
        query["date"] = date

    bets = await db.bets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"bets": bets}
