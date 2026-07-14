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
GAME_ORDER = [
    # Gali/Disawar order (by time of day)
    "delhi_bazaar", "shri_ganesh", "faridabad", "ghaziabad", "gali", "disawar",
    # Kalyan order (by time of day)
    "kalyan_morning", "main_bazar_morning", "shagun", "sridevi",
    "madhur_morning", "padmavathi", "worli_morning", "day_bombay",
    "maharani", "sunday_bazar",
    "milan_day", "rajdhani_day", "kalyan", "milan_night", "rajdhani_night", "main_bazar",
]


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

        # Kalyan games never go on month-end holiday — they run every day
        category = game.get("category", "gali_disawar")
        game_is_holiday = is_holiday and category != "kalyan"

        games_list.append({
            "id": game_id,
            "game_id": game_id,
            "name": game["name"],
            "name_hi": game["name_hi"],
            "category": category,
            "start_time": game.get("start_time", game.get("time", "")),
            "end_time": game.get("end_time", game.get("time", "")),
            "open_time": game.get("open_time"),
            "close_time": game.get("close_time") or game.get("end_time"),
            "time": game.get("end_time", game.get("time", "")),
            "display_time": game["display_time"],
            "is_active": game.get("is_active", True),
            "is_holiday": game_is_holiday,
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

    # Enforce admin game-category toggle
    from routes.game_toggles import assert_game_enabled
    category = game.get("category") or "gali_disawar"
    await assert_game_enabled(category)

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

    # Enforce admin game-category toggle
    from routes.game_toggles import assert_game_enabled
    category = game.get("category") or "gali_disawar"
    await assert_game_enabled(category)

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

    # Enrich with game_name + game_category + digit + winning result number
    games_dict = await get_games_dict()

    # Batch-fetch results for (game_id, date) pairs so we can show winning number
    pairs = list({(b.get("game_id"), b.get("date")) for b in bets if b.get("game_id") and b.get("date")})
    result_map = {}  # (game_id, date) -> {single, jodi, ...}
    if pairs:
        or_query = [{"game_id": g, "date": d} for g, d in pairs]
        async for r in db.results.find({"$or": or_query}, {"_id": 0}):
            result_map[(r["game_id"], r["date"])] = r

    # Also fetch kalyan session-wise results if any
    kalyan_pairs = [(b.get("game_id"), b.get("date")) for b in bets
                    if games_dict.get(b.get("game_id"), {}).get("category") == "kalyan"]
    kalyan_map = {}
    if kalyan_pairs:
        or_q = [{"game_id": g, "date": d} for g, d in set(kalyan_pairs)]
        async for r in db.kalyan_results.find({"$or": or_q}, {"_id": 0}):
            kalyan_map[(r["game_id"], r["date"])] = r

    def _winning_for(bet):
        """Return the winning number for a bet as short string ('05', '134', 'X-Y')."""
        gid, dt, bt = bet.get("game_id"), bet.get("date"), bet.get("bet_type")
        session = bet.get("session")
        # Kalyan
        kr = kalyan_map.get((gid, dt))
        if kr:
            if bt == "jodi":
                return kr.get("jodi") or f"{kr.get('open_ank','')}{kr.get('close_ank','')}"
            if bt == "single_ank":
                return kr.get("close_ank") if session == "close" else kr.get("open_ank")
            if bt in ("single_panna", "double_panna", "triple_panna"):
                return kr.get("close_panna") if session == "close" else kr.get("open_panna")
            if bt == "half_sangam":
                return f"{kr.get('open_panna','')}-{kr.get('close_ank','')}"
            if bt == "full_sangam":
                return f"{kr.get('open_panna','')}-{kr.get('close_panna','')}"
        # Gali/Disawar
        r = result_map.get((gid, dt))
        if r:
            if bt == "jodi":
                return r.get("jodi_result")
            if bt in ("haruf_andar", "haruf_bahar", "single_ank"):
                return r.get("single_result")
        return None

    for b in bets:
        gid = b.get("game_id")
        meta = games_dict.get(gid, {})
        b["game_name"] = meta.get("name_hi") or meta.get("name") or gid
        b["game_category"] = meta.get("category") or b.get("game_category") or "gali_disawar"
        # Backwards-compat: frontend BetsPage reads `bet.digit`. Backend actually
        # stores `bet.number`. Expose both.
        if b.get("digit") is None:
            b["digit"] = b.get("number")
        # Winning number for this bet's game+date (if declared)
        b["result_number"] = _winning_for(b)
        # Standardise winnings key so frontend can pick either
        if b.get("winnings") is None:
            b["winnings"] = b.get("won_amount", 0)

    # Merge Aviator bets (unless a specific gali/kalyan game_id filter was set)
    if not game_id:
        aviator_q = {"user_id": user["_id"]}
        if status and status != "all":
            aviator_q["status"] = status
        if date:
            aviator_q["date"] = date
        av_bets = await db.aviator_bets.find(aviator_q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        for a in av_bets:
            av_status = a.get("status", "pending")
            # aviator_bets stores status directly as 'won' / 'lost' / 'pending'
            is_won = av_status == "won"
            cashout = a.get("cashout_multiplier") or 0
            bet_amt = a.get("amount", 0) or a.get("bet_amount", 0)
            won_amt = a.get("won_amount", 0) or (bet_amt * cashout if is_won else 0)
            # Derive date from created_at if missing (aviator doc doesn't always store it)
            av_date = a.get("date")
            if not av_date and a.get("created_at"):
                ca = a.get("created_at")
                av_date = ca[:10] if isinstance(ca, str) else ca.strftime("%Y-%m-%d")
            bets.append({
                "id": a.get("id") or a.get("round_id"),
                "user_id": a.get("user_id"),
                "game_id": "aviator",
                "game_name": "Aviator",
                "game_category": "aviator",
                "bet_type": "aviator",
                "session": None,
                "digit": f"{cashout:.2f}x" if is_won and cashout else ("crashed" if av_status == "lost" else "-"),
                "number": None,
                "amount": bet_amt,
                "status": av_status,
                "winnings": won_amt,
                "won_amount": won_amt,
                "cashout_multiplier": cashout if is_won else None,
                "crash_point": a.get("crash_point"),
                "round_id": a.get("round_id"),
                "date": av_date,
                "result_number": None,
                "created_at": a.get("created_at"),
            })
        # Re-sort merged list by created_at desc (datetime + ISO-str safe)
        def _sk(x):
            v = x.get("created_at")
            if v is None:
                return ""
            if hasattr(v, "isoformat"):
                return v.isoformat()
            return str(v)
        bets.sort(key=_sk, reverse=True)
        bets = bets[:limit]

    return {"bets": bets}


@router.get("/games/{game_id}/jantri")
async def public_game_jantri(game_id: str, request: Request, date: str = None):
    """Public number-wise bet summary for a game — 'kaunse number pe kitna laga'.

    Rules to keep it fair/anonymised:
      * Only returns TODAY's date by default (IST). Historical dates require
        an authenticated request but here we simply cap to today.
      * Aggregates across all users — never exposes user ids.
      * Sorts per bet_type by total amount desc, so hot numbers surface first.
      * Once result is declared for that game+date, endpoint returns
        `locked: True` and `hides` amounts to prevent post-result reveals.
    """
    ist_now = datetime.now(IST)
    today = ist_now.strftime("%Y-%m-%d")
    if not date:
        date = today
    # Never allow future or beyond today
    if date > today:
        raise HTTPException(400, "Future date not allowed")

    games_dict = await get_games_dict()
    game = games_dict.get(game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    # If the result for this game+date is already declared, lock the report
    result_doc = None
    if game.get("category") == "kalyan":
        result_doc = await db.kalyan_results.find_one({"game_id": game_id, "date": date})
        if result_doc and (result_doc.get("close_ank") or result_doc.get("jodi")):
            return {"locked": True, "reason": "Result declared — jantri hidden"}
    else:
        result_doc = await db.results.find_one({"game_id": game_id, "date": date})
        if result_doc and (result_doc.get("jodi_result") or result_doc.get("single_result")):
            return {"locked": True, "reason": "Result declared — jantri hidden"}

    pipeline = [
        {"$match": {"game_id": game_id, "date": date, "status": {"$in": ["pending", "won", "lost"]}}},
        {"$group": {
            "_id": {"bet_type": "$bet_type", "number": "$number", "session": "$session"},
            "total_amount": {"$sum": "$amount"},
            "bet_count": {"$sum": 1},
        }},
        {"$sort": {"total_amount": -1}},
    ]
    raw = await db.bets.aggregate(pipeline).to_list(2000)

    # Group by (bet_type, session) → list of {number, total_amount, bet_count}
    grouped = {}
    for r in raw:
        bt = r["_id"].get("bet_type") or "unknown"
        session = r["_id"].get("session") or ""
        key = f"{bt}__{session}" if session else bt
        grouped.setdefault(key, []).append({
            "number": r["_id"].get("number") or "-",
            "total_amount": round(r["total_amount"], 2),
            "bet_count": r["bet_count"],
        })

    total_bets = sum(len(v) for v in grouped.values())
    total_amount = sum(r["total_amount"] for r in raw)

    return {
        "locked": False,
        "game_id": game_id,
        "game_name": game.get("name_hi") or game.get("name"),
        "date": date,
        "category": game.get("category"),
        "total_bet_types": len(grouped),
        "total_unique_numbers": total_bets,
        "total_amount": round(total_amount, 2),
        "sections": grouped,
    }


@router.delete("/bets/{bet_id}")
async def cancel_bet(bet_id: str, request: Request):
    """User cancels a PENDING Gali/Kalyan bet.

    Allowed only if the game's close_time (Kalyan) or start_time (Gali) is
    at least 10 minutes away from now. This gives the user a real "change
    of mind" window while preventing last-minute cancels that could
    weaponise result knowledge.

    On success:
      • Bet doc is marked status="cancelled" (kept for audit trail)
      • Amount is refunded to user balance
      • A transaction row (type=bet_refund) is inserted
    """
    user = await get_current_user(request)
    bet = await db.bets.find_one({"id": bet_id, "user_id": user["_id"]})
    if not bet:
        raise HTTPException(404, "बेट नहीं मिली / Bet not found")
    if bet.get("status") != "pending":
        raise HTTPException(400, "यह बेट cancel नहीं हो सकती (result declared)")

    games_dict = await get_games_dict()
    game = games_dict.get(bet.get("game_id"))
    if not game:
        raise HTTPException(400, "Game not found")

    # Compute the effective cut-off. For Kalyan Close bets → use close_time;
    # for Open bets or Gali → use open_time / close_time as-is.
    session = bet.get("session")  # "open" | "close" | None
    cutoff_str = game.get("close_time") if session == "close" else (game.get("open_time") or game.get("close_time"))
    if not cutoff_str:
        raise HTTPException(400, "Cannot determine game cutoff time")

    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    try:
        cutoff_hour, cutoff_min = [int(x) for x in cutoff_str.split(":")]
    except Exception:
        raise HTTPException(400, "Invalid game time config")
    cutoff_dt = ist_now.replace(hour=cutoff_hour, minute=cutoff_min, second=0, microsecond=0)
    # Handle games that cross midnight — if cutoff already past today, use tomorrow
    if cutoff_dt < ist_now - timedelta(hours=6):
        cutoff_dt = cutoff_dt + timedelta(days=1)

    seconds_left = (cutoff_dt - ist_now).total_seconds()
    if seconds_left < 600:   # 10 minutes = 600 seconds
        minutes = max(0, int(seconds_left // 60))
        raise HTTPException(
            400,
            f"Cancel करने के लिए {minutes} min बचे हैं. Cut-off से 10 मिनट पहले तक cancel कर सकते हैं.",
        )

    # Refund + mark cancelled
    amount = float(bet.get("amount", 0))
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": amount}})
    await db.bets.update_one(
        {"id": bet_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}},
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "type": "bet_refund",
        "amount": amount,
        "bet_id": bet_id,
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
    })
    return {"message": "बेट cancel हो गई, ₹" + str(int(amount)) + " वापस आ गए", "refunded": amount}
