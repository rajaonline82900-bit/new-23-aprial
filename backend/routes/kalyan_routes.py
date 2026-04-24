"""Kalyan game routes - separate betting, result declaration, reverse."""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import uuid
import logging

from database import db
from auth import get_current_user, get_admin_user
from config import BET_TYPES
from helpers import get_games_dict

router = APIRouter()
logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))


def get_ank(panna_str: str) -> str:
    """Sum of panna digits, last digit = ank."""
    if not panna_str or not panna_str.isdigit() or len(panna_str) != 3:
        return ""
    total = sum(int(d) for d in panna_str)
    return str(total % 10)


def categorize_panna(panna: str) -> str:
    """Single / Double / Triple panna based on digit repetition."""
    if len(panna) != 3 or not panna.isdigit():
        return ""
    digits = list(panna)
    unique = len(set(digits))
    if unique == 3:
        return "single_panna"
    if unique == 1:
        return "triple_panna"
    return "double_panna"


@router.post("/kalyan/bet")
async def place_kalyan_bet(request: Request):
    """Place a single Kalyan bet."""
    user = await get_current_user(request)
    body = await request.json()

    game_id = body.get("game_id")
    bet_type = body.get("bet_type")
    session = body.get("session", "open")  # open/close
    digit = str(body.get("digit", "")).strip()
    amount = float(body.get("amount", 0))
    bet_date = body.get("date") or datetime.now(IST).strftime("%Y-%m-%d")

    if bet_type not in BET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid bet type")
    if session not in ("open", "close"):
        raise HTTPException(status_code=400, detail="Invalid session")
    if amount < 10:
        raise HTTPException(status_code=400, detail="Minimum bet is ₹10")
    if user.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    games = await get_games_dict()
    game = games.get(game_id)
    if not game or game.get("category") != "kalyan":
        raise HTTPException(status_code=400, detail="Invalid Kalyan game")

    # Validate digit format per bet type
    if bet_type in ("single_ank",):
        if not (digit.isdigit() and len(digit) == 1):
            raise HTTPException(status_code=400, detail="Ank must be a single digit 0-9")
    elif bet_type == "kalyan_jodi":
        if not (digit.isdigit() and len(digit) == 2):
            raise HTTPException(status_code=400, detail="Jodi must be 2 digits")
    elif bet_type in ("single_panna", "double_panna", "triple_panna"):
        if not (digit.isdigit() and len(digit) == 3):
            raise HTTPException(status_code=400, detail="Panna must be 3 digits")
        if categorize_panna(digit) != bet_type:
            raise HTTPException(status_code=400, detail=f"Digit {digit} is not a valid {bet_type}")
    elif bet_type == "half_sangam":
        # Format: "A-BCD" (ank-panna) or "ABC-D"
        if "-" not in digit:
            raise HTTPException(status_code=400, detail="Half Sangam format: A-BCD or ABC-D")
        parts = digit.split("-")
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid Half Sangam format")
        left, right = parts[0].strip(), parts[1].strip()
        if not ((len(left) == 1 and len(right) == 3) or (len(left) == 3 and len(right) == 1)):
            raise HTTPException(status_code=400, detail="Half Sangam: one side 1 digit, other 3")
    elif bet_type == "full_sangam":
        # Format: "ABC-DEF" (open panna - close panna)
        if "-" not in digit:
            raise HTTPException(status_code=400, detail="Full Sangam format: ABC-DEF")
        parts = digit.split("-")
        if len(parts) != 2 or len(parts[0]) != 3 or len(parts[1]) != 3:
            raise HTTPException(status_code=400, detail="Full Sangam: 3 digits - 3 digits")

    # Deduct from balance
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": -amount}})

    bet_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "game_id": game_id,
        "game_category": "kalyan",
        "bet_type": bet_type,
        "session": session,
        "digit": digit,
        "amount": amount,
        "date": bet_date,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bets.insert_one(bet_doc)

    return {"message": "Bet placed", "bet_id": bet_doc["id"], "new_balance": user.get("balance", 0) - amount}


@router.get("/kalyan/my-bets")
async def my_kalyan_bets(request: Request, game_id: str = "", date: str = "", limit: int = 100):
    user = await get_current_user(request)
    query = {"user_id": user["_id"], "game_category": "kalyan"}
    if game_id:
        query["game_id"] = game_id
    if date:
        query["date"] = date
    bets = await db.bets.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"bets": bets}


@router.post("/admin/kalyan/declare")
async def declare_kalyan_result(request: Request):
    """Admin declares open panna OR close panna (in sequence)."""
    await get_admin_user(request)
    body = await request.json()
    game_id = body.get("game_id")
    session = body.get("session")  # open / close
    panna = str(body.get("panna", "")).strip()
    date_str = body.get("date") or datetime.now(IST).strftime("%Y-%m-%d")

    if session not in ("open", "close"):
        raise HTTPException(status_code=400, detail="session must be open or close")
    if not (panna.isdigit() and len(panna) == 3):
        raise HTTPException(status_code=400, detail="Panna must be exactly 3 digits")

    games = await get_games_dict()
    game = games.get(game_id)
    if not game or game.get("category") != "kalyan":
        raise HTTPException(status_code=400, detail="Invalid Kalyan game")

    ank = get_ank(panna)

    # Upsert result
    existing = await db.kalyan_results.find_one({"game_id": game_id, "date": date_str})
    update = {
        f"{session}_panna": panna,
        f"{session}_ank": ank,
        f"{session}_declared_at": datetime.now(timezone.utc).isoformat(),
    }
    if existing:
        merged = {**existing, **update}
        if merged.get("open_ank") and merged.get("close_ank"):
            merged["jodi"] = f"{merged['open_ank']}{merged['close_ank']}"
            update["jodi"] = merged["jodi"]
        await db.kalyan_results.update_one({"_id": existing["_id"]}, {"$set": update})
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "game_id": game_id,
            "date": date_str,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **update,
        }
        await db.kalyan_results.insert_one(doc)
        existing = doc

    # Settle bets for this session
    await _settle_kalyan_bets(game_id, date_str, session, panna, ank, existing)

    return {"message": f"{session.title()} result declared", "panna": panna, "ank": ank}


async def _settle_kalyan_bets(game_id: str, date_str: str, session: str, panna: str, ank: str, result_doc):
    """Settle all pending Kalyan bets for this session+game+date."""
    bets = await db.bets.find({
        "game_id": game_id, "date": date_str, "status": "pending",
        "game_category": "kalyan", "session": session
    }, {"_id": 0}).to_list(10000)

    total_won = 0
    total_winners = 0
    jodi = result_doc.get("jodi", "")

    for bet in bets:
        bt = bet["bet_type"]
        digit = bet["digit"]
        multiplier = BET_TYPES.get(bt, {}).get("multiplier", 0)
        won = False

        if bt == "single_ank":
            won = (digit == ank)
        elif bt == "kalyan_jodi":
            # only settle on close (jodi forms after close)
            if session != "close":
                continue
            won = (digit == jodi)
        elif bt in ("single_panna", "double_panna", "triple_panna"):
            won = (digit == panna)
        elif bt == "half_sangam":
            # only settle on close (needs both sides)
            if session != "close":
                continue
            parts = digit.split("-")
            if len(parts) != 2:
                continue
            l_part, r_part = parts[0], parts[1]
            open_panna = result_doc.get("open_panna", "")
            close_panna = result_doc.get("close_panna", panna)
            open_ank = result_doc.get("open_ank", "")
            close_ank = ank
            if len(l_part) == 1 and len(r_part) == 3:
                # Open ank - Close panna
                won = (l_part == open_ank and r_part == close_panna)
            elif len(l_part) == 3 and len(r_part) == 1:
                # Open panna - Close ank
                won = (l_part == open_panna and r_part == close_ank)
        elif bt == "full_sangam":
            if session != "close":
                continue
            parts = digit.split("-")
            if len(parts) != 2:
                continue
            open_panna = result_doc.get("open_panna", "")
            close_panna = panna
            won = (parts[0] == open_panna and parts[1] == close_panna)

        if won:
            payout = bet["amount"] * multiplier
            await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": payout}})
            await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "won", "payout": payout, "settled_at": datetime.now(timezone.utc).isoformat()}})
            total_won += payout
            total_winners += 1
        else:
            await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "lost", "payout": 0, "settled_at": datetime.now(timezone.utc).isoformat()}})

    logger.info(f"Kalyan settle: {game_id} {session} — {len(bets)} bets, {total_winners} winners, ₹{total_won} paid out")


@router.post("/admin/kalyan/reverse")
async def reverse_kalyan_result(request: Request):
    """Reverse/undo a Kalyan session result. Refunds winners, re-pending all bets, clears result."""
    await get_admin_user(request)
    body = await request.json()
    game_id = body.get("game_id")
    session = body.get("session")  # open / close / both
    date_str = body.get("date") or datetime.now(IST).strftime("%Y-%m-%d")

    if session not in ("open", "close", "both"):
        raise HTTPException(status_code=400, detail="session must be open, close or both")

    result = await db.kalyan_results.find_one({"game_id": game_id, "date": date_str})
    if not result:
        raise HTTPException(status_code=404, detail="No result found")

    sessions_to_reverse = ["open", "close"] if session == "both" else [session]

    total_reversed = 0
    for sess in sessions_to_reverse:
        # Find all settled bets for this session
        settled = await db.bets.find({
            "game_id": game_id, "date": date_str,
            "game_category": "kalyan", "session": sess,
            "status": {"$in": ["won", "lost"]}
        }, {"_id": 0}).to_list(10000)

        for bet in settled:
            # Refund original amount
            refund = bet["amount"]
            # If was won, deduct payout first (take back winnings)
            if bet.get("status") == "won":
                payout = bet.get("payout", 0)
                # Net: user keeps their original amount, but we take back the profit
                # Easiest: set balance change = amount (original) and remove payout
                await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": refund - payout}})
            else:
                # Lost bet - just refund original amount
                await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": refund}})
            await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "reversed", "payout": 0, "reversed_at": datetime.now(timezone.utc).isoformat()}})
            total_reversed += 1

        # Clear session fields in result doc
        unset = {f"{sess}_panna": "", f"{sess}_ank": "", f"{sess}_declared_at": ""}
        await db.kalyan_results.update_one(
            {"_id": result["_id"]},
            {"$unset": unset}
        )

    # Clear jodi if either open or close got cleared
    await db.kalyan_results.update_one({"_id": result["_id"]}, {"$unset": {"jodi": ""}})

    return {"message": f"Reversed {total_reversed} bets", "reversed_count": total_reversed}


@router.get("/kalyan/results/{game_id}")
async def get_kalyan_results(game_id: str, limit: int = 30):
    """Get recent Kalyan results for a game."""
    results = await db.kalyan_results.find({"game_id": game_id}, {"_id": 0}).sort("date", -1).to_list(limit)
    return {"results": results}


@router.get("/kalyan/today/{game_id}")
async def get_today_kalyan(game_id: str):
    """Today's Kalyan result (open/close/jodi)."""
    today = datetime.now(IST).strftime("%Y-%m-%d")
    result = await db.kalyan_results.find_one({"game_id": game_id, "date": today}, {"_id": 0})
    return {"result": result}


@router.get("/admin/kalyan/results")
async def admin_list_kalyan_results(request: Request, date: str = "", limit: int = 100):
    await get_admin_user(request)
    query = {}
    if date:
        query["date"] = date
    results = await db.kalyan_results.find(query, {"_id": 0}).sort("date", -1).to_list(limit)
    return {"results": results}
