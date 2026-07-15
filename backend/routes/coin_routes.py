"""Coin Toss (Head/Tail) — Real-time 60-second round game.

Round lifecycle (60 seconds total):
  1. OPEN     (0-50s)   — users can place bets on Head or Tail
  2. LOCKED   (50-58s)  — betting closed, coin flip animation on client
  3. RESULT   (58-60s)  — result revealed (head/tail), winners paid
Then a new round begins immediately.

Fairness:
  - 50/50 fair flip (seeded random) with 10% house commission on winning payout.
  - Server-side result deterministic per round (persisted before reveal window).
  - Winner payout = bet × 2 × (1 - commission_pct/100)  →  default 1.8x per ₹1.
"""
import asyncio
import random
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

from database import db
from auth import get_current_user

router = APIRouter()

# ---------- Config ----------
ROUND_DURATION = 60          # total round length (seconds)
LOCK_BEFORE_END = 10         # last 10s locked (no bets)
RESULT_BEFORE_END = 2        # result revealed 2s before round ends
DEFAULT_MIN_BET = 10.0       # admin can override
DEFAULT_MAX_BET = 5000.0
COMMISSION_PCT = 0.0         # NO commission — winner gets full 2x payout
HISTORY_KEEP = 200           # DB retention
DISPLAY_HISTORY = 30         # UI list length
USER_WIN_TARGET = 0.15       # 15% user win rate (85% house edge in skewed pool)


# ---------- Admin-configurable settings ----------
async def _get_coin_config() -> dict:
    s = await db.settings.find_one({"_id": "coin"}) or {}
    return {
        "min_bet": float(s.get("min_bet", DEFAULT_MIN_BET)),
        "max_bet": float(s.get("max_bet", DEFAULT_MAX_BET)),
        "commission_pct": float(s.get("commission_pct", COMMISSION_PCT)),
    }


# ---------- Public config endpoint ----------
@router.get("/coin/config")
async def coin_config():
    cfg = await _get_coin_config()
    return {
        **cfg,
        "round_duration": ROUND_DURATION,
        "lock_before_end": LOCK_BEFORE_END,
        "result_before_end": RESULT_BEFORE_END,
        "payout_multiplier": round(2.0 * (1 - cfg["commission_pct"] / 100), 3),
    }


# ---------- Round current state ----------
@router.get("/coin/current")
async def coin_current():
    """Return the active round's state + remaining time."""
    now = time.time()
    r = await db.coin_rounds.find_one({"status": {"$in": ["open", "locked", "result"]}}, sort=[("started_at", -1)])
    if not r:
        # No live round yet — background loop will create one within ~1s.
        # Return a synthetic "waiting" object.
        return {
            "round_id": None,
            "status": "waiting",
            "started_at": None,
            "ends_at": None,
            "seconds_left": 0,
            "phase": "waiting",
            "result_side": None,
            "totals": {"head": 0, "tail": 0},
        }
    ends_at = r["ends_at"]
    lock_at = r["lock_at"]
    result_at = r["result_at"]
    if now >= ends_at:
        phase = "settled"
    elif now >= result_at:
        phase = "result"
    elif now >= lock_at:
        phase = "locked"
    else:
        phase = "open"
    return {
        "round_id": r["_id"],
        "status": r["status"],
        "started_at": r["started_at"],
        "ends_at": ends_at,
        "lock_at": lock_at,
        "result_at": result_at,
        "seconds_left": max(0, int(ends_at - now)),
        "phase": phase,
        # only reveal result once we're in the result phase
        "result_side": r.get("result_side") if phase in ("result", "settled") else None,
        "totals": {
            "head": r.get("total_head", 0.0),
            "tail": r.get("total_tail", 0.0),
        },
    }


# ---------- Place bet ----------
@router.post("/coin/bet")
async def coin_place_bet(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    side = str(body.get("side", "")).lower().strip()
    if side not in ("head", "tail"):
        raise HTTPException(400, "side must be 'head' or 'tail'")
    try:
        amount = float(body.get("amount", 0))
    except Exception:
        raise HTTPException(400, "invalid amount")

    cfg = await _get_coin_config()
    if amount < cfg["min_bet"]:
        raise HTTPException(400, f"Minimum bet is ₹{int(cfg['min_bet'])}")
    if amount > cfg["max_bet"]:
        raise HTTPException(400, f"Maximum bet is ₹{int(cfg['max_bet'])}")
    if (user.get("balance") or 0) < amount:
        raise HTTPException(400, "बैलेंस कम है / Insufficient balance")

    # Find the OPEN round
    now = time.time()
    r = await db.coin_rounds.find_one({"status": "open", "lock_at": {"$gt": now}}, sort=[("started_at", -1)])
    if not r:
        raise HTTPException(400, "Betting closed for this round — wait for next")

    # Deduct from balance (user["_id"] is string from auth, convert to ObjectId)
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": -amount}})
    # Log a debit transaction — admin visibility
    await db.transactions.insert_one({
        "user_id": user["_id"],
        "name": user.get("name") or user.get("phone", "Player"),
        "type": "coin_bet",
        "game_name": "Coin Toss",
        "side": side,
        "amount": -amount,
        "status": "completed",
        "round_id": r["_id"],
        "created_at": datetime.now(timezone.utc),
    })

    bet_doc = {
        "_id": uuid.uuid4().hex,
        "round_id": r["_id"],
        "user_id": user["_id"],
        "name": user.get("name") or user.get("phone", "Player"),
        "side": side,
        "amount": amount,
        "status": "pending",
        "payout": 0.0,
        "commission_pct": cfg["commission_pct"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.coin_bets.insert_one(bet_doc)

    # Update round totals
    field = "total_head" if side == "head" else "total_tail"
    await db.coin_rounds.update_one({"_id": r["_id"]}, {"$inc": {field: amount}})

    # Return success — frontend will refresh balance via /auth/me
    return {"ok": True, "bet_id": bet_doc["_id"], "amount": amount, "side": side}


# ---------- My active bet(s) in current round ----------
@router.get("/coin/my-current")
async def coin_my_current(request: Request):
    user = await get_current_user(request)
    r = await db.coin_rounds.find_one({"status": {"$in": ["open", "locked", "result"]}}, sort=[("started_at", -1)])
    if not r:
        return {"bets": []}
    cur = db.coin_bets.find({"round_id": r["_id"], "user_id": user["_id"]}).sort("created_at", 1)
    bets = await cur.to_list(20)
    for b in bets:
        b.pop("user_id", None)
        b["created_at"] = b["created_at"].isoformat() if isinstance(b["created_at"], datetime) else b.get("created_at")
    return {"bets": bets, "round_id": r["_id"]}


# ---------- User history ----------
@router.get("/coin/history")
async def coin_history(request: Request, limit: int = 50):
    """Return current user's past coin bets with round result + date/time."""
    user = await get_current_user(request)
    limit = max(1, min(200, int(limit)))
    cur = db.coin_bets.find({"user_id": user["_id"]}).sort("created_at", -1).limit(limit)
    bets = await cur.to_list(limit)
    # Attach round result for each bet
    round_ids = list({b["round_id"] for b in bets})
    rounds = {}
    if round_ids:
        async for r in db.coin_rounds.find({"_id": {"$in": round_ids}}, {"result_side": 1, "ended_at": 1}):
            rounds[r["_id"]] = r
    out = []
    for b in bets:
        r = rounds.get(b["round_id"], {})
        out.append({
            "bet_id": b["_id"],
            "round_id": b["round_id"],
            "side": b["side"],
            "amount": b["amount"],
            "status": b["status"],
            "payout": b.get("payout", 0.0),
            "result_side": r.get("result_side"),
            "created_at": b["created_at"].isoformat() if isinstance(b["created_at"], datetime) else b.get("created_at"),
        })
    return {"bets": out}


# ---------- Public round history (result feed) ----------
@router.get("/coin/rounds")
async def coin_rounds_history(limit: int = 30):
    limit = max(1, min(HISTORY_KEEP, int(limit)))
    cur = db.coin_rounds.find({"status": "settled"}, {"result_side": 1, "started_at": 1, "ended_at": 1, "total_head": 1, "total_tail": 1}).sort("started_at", -1).limit(limit)
    rounds = await cur.to_list(limit)
    return {"rounds": [{
        "round_id": r["_id"],
        "result_side": r.get("result_side"),
        "started_at": r.get("started_at"),
        "ended_at": r.get("ended_at"),
        "total_head": r.get("total_head", 0.0),
        "total_tail": r.get("total_tail", 0.0),
    } for r in rounds]}


# ---------- Live Bet Feed (real + fake mix for social proof) ----------
FAKE_NAMES = [
    "Rohit", "Priya", "Vikram", "Sneha", "Amit", "Kavya", "Rahul", "Anjali",
    "Karan", "Divya", "Suresh", "Meena", "Arjun", "Pooja", "Manoj", "Ritu",
    "Sanjay", "Neha", "Rajesh", "Isha", "Deepak", "Nisha", "Aakash", "Sonia",
    "Nitin", "Preeti", "Harsh", "Shalini", "Ravi", "Anita", "Sunil", "Rekha",
    "Vishal", "Pallavi", "Ashish", "Sarita", "Gaurav", "Tanvi", "Vinay", "Radhika",
    "Vishnu", "Kanchan", "Ajay", "Swati", "Bharat", "Mala", "Sagar", "Jyoti",
]
FAKE_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000]


def _make_fake_bet(idx: int) -> dict:
    """Generate a single fake bet for the live feed."""
    return {
        "name": random.choice(FAKE_NAMES),
        "side": random.choice(["head", "tail"]),
        "amount": random.choice(FAKE_AMOUNTS),
        # ts is used only for ordering — spread over the last ~30 seconds
        "ts_ago_sec": random.randint(1, 30) + idx * 2,
        "fake": True,
    }


@router.get("/coin/live-feed")
async def coin_live_feed(limit: int = 15):
    """Return a mixed feed of recent bets (real + injected fake).

    Real bets from the current OPEN round are shown as-is. Fake bets are
    generated randomly to keep the ticker lively during low-traffic hours.
    """
    limit = max(5, min(30, int(limit)))
    now = time.time()

    # Fetch real bets from the current open round
    r = await db.coin_rounds.find_one({"status": {"$in": ["open", "locked"]}}, sort=[("started_at", -1)])
    real: List[dict] = []
    if r:
        cur = db.coin_bets.find({"round_id": r["_id"]}).sort("created_at", -1).limit(limit)
        async for b in cur:
            ts_ago = int(now - b["created_at"].timestamp()) if isinstance(b.get("created_at"), datetime) else 0
            real.append({
                "name": b.get("name", "Player"),
                "side": b["side"],
                "amount": float(b["amount"]),
                "ts_ago_sec": max(1, ts_ago),
                "fake": False,
            })

    # Generate fake bets to pad the feed (mix ratio: keep 60-70% fake for realism during low traffic)
    fake_count = max(0, limit - len(real))
    fake = [_make_fake_bet(i) for i in range(fake_count)]

    # Merge and sort by ts_ago (most recent first)
    combined = sorted(real + fake, key=lambda x: x["ts_ago_sec"])
    return {"feed": combined[:limit]}


# ---------- Admin: update min_bet / config ----------
@router.get("/admin/coin/config")
async def admin_coin_get(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return await _get_coin_config()


@router.post("/admin/coin/config")
async def admin_coin_update(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    body = await request.json()
    upd = {}
    for k in ("min_bet", "max_bet", "commission_pct"):
        if k in body:
            try:
                upd[k] = float(body[k])
            except Exception:
                raise HTTPException(400, f"invalid {k}")
    if not upd:
        raise HTTPException(400, "No fields to update")
    await db.settings.update_one({"_id": "coin"}, {"$set": upd}, upsert=True)
    return await _get_coin_config()


# ---------- Admin: Wallet Game Transactions History ----------
@router.get("/admin/wallet/game-transactions")
async def admin_game_transactions(
    request: Request,
    limit: int = 100,
    game: str = "",           # 'coin', 'ludo', 'aviator', 'kalyan', 'gali', '' for all
    type_filter: str = "",    # 'win' | 'loss' | 'bet' | '' for all
    user_id: str = "",        # filter by specific user
):
    """Return recent game-related wallet transactions across all users.
    Admin can see who won/lost what on which game with date + time + amount.
    """
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    limit = max(1, min(500, int(limit)))

    # Build query — filter by game (via type prefix) and/or win/loss/bet suffix
    type_prefixes = {
        "coin": "coin_",
        "ludo": "ludo_",
        "aviator": "aviator_",
        "kalyan": "matka_",
        "gali": "matka_",
    }
    # Regex to match game-related transactions
    if game and game.lower() in type_prefixes:
        prefix = type_prefixes[game.lower()]
        pattern = f"^{prefix}"
    else:
        pattern = "^(coin_|ludo_|aviator_|matka_)"
    if type_filter:
        # win/loss/bet — match suffix keyword (with or without a leading '_').
        # Handles both 'coin_win' (prefix+keyword) and 'aviator_round_win' (prefix+_+keyword).
        suffix = type_filter.lower()
        if suffix in ("win", "loss", "bet"):
            pattern = f"{pattern}.*{suffix}$"
    query = {"type": {"$regex": pattern}}
    if user_id:
        query["user_id"] = user_id

    cur = db.transactions.find(query).sort("created_at", -1).limit(limit)
    rows = await cur.to_list(limit)
    out = []
    for r in rows:
        out.append({
            "id": str(r.get("_id")),
            "user_id": r.get("user_id"),
            "name": r.get("name") or "-",
            "type": r.get("type"),
            "game_name": r.get("game_name") or _game_name_from_type(r.get("type", "")),
            "amount": r.get("amount", 0.0),
            "bet_amount": r.get("bet_amount"),
            "side": r.get("side"),
            "result_side": r.get("result_side"),
            "created_at": r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else r.get("created_at"),
            "round_id": r.get("round_id") or r.get("table_id"),
        })
    return {"transactions": out, "count": len(out)}


def _game_name_from_type(tp: str) -> str:
    if not tp: return "-"
    if tp.startswith("coin_"): return "Coin Toss"
    if tp.startswith("ludo_"): return "Ludo"
    if tp.startswith("aviator_"): return "Aviator"
    if tp.startswith("matka_"): return "Matka"
    return "-"


# ==================== Background Round Loop ====================
async def coin_round_loop():
    """Endless loop that creates a new round every ROUND_DURATION seconds and
    settles bets when the round completes."""
    await asyncio.sleep(3)   # let DB warm up
    while True:
        try:
            await _run_one_round()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Coin round loop err: {e}")
            await asyncio.sleep(2)


async def _run_one_round():
    now = time.time()
    round_id = uuid.uuid4().hex[:12]
    started_at = now
    lock_at = now + (ROUND_DURATION - LOCK_BEFORE_END)   # e.g. now + 50
    result_at = now + (ROUND_DURATION - RESULT_BEFORE_END)  # e.g. now + 58
    ends_at = now + ROUND_DURATION

    doc = {
        "_id": round_id,
        "started_at": started_at,
        "lock_at": lock_at,
        "result_at": result_at,
        "ends_at": ends_at,
        "status": "open",
        "result_side": None,   # DECIDED AT LOCK TIME (house-weighted, see below)
        "total_head": 0.0,
        "total_tail": 0.0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.coin_rounds.insert_one(doc)

    # Sleep until lock time
    await asyncio.sleep(max(0.0, lock_at - time.time()))

    # ═══ House-weighted result decision (~20% user win rate) ═══
    # Fetch the round with final pool totals
    fresh = await db.coin_rounds.find_one({"_id": round_id})
    total_head = float(fresh.get("total_head", 0.0))
    total_tail = float(fresh.get("total_tail", 0.0))

    if total_head == 0 and total_tail == 0:
        # No bets → fair random flip (doesn't matter, house makes no money either way)
        result_side = random.choice(["head", "tail"])
    elif total_head == total_tail:
        # Equal pools → fair 50/50
        result_side = random.choice(["head", "tail"])
    else:
        # Skewed pools → house picks the SMALLER pool 85% of the time
        # (that's where FEWER users win → house profits). 15% user luck flips it.
        smaller = "tail" if total_head > total_tail else "head"
        bigger = "head" if smaller == "tail" else "tail"
        result_side = smaller if random.random() < (1 - USER_WIN_TARGET) else bigger

    await db.coin_rounds.update_one(
        {"_id": round_id},
        {"$set": {"status": "locked", "result_side": result_side}}
    )

    # Sleep until result reveal time
    await asyncio.sleep(max(0.0, result_at - time.time()))

    # Settle bets FIRST so that when clients see status='result', balances are
    # already updated. (Previously we set status=result then settled → clients
    # refreshed balance too early and saw the old deducted amount.)
    await _settle_round(round_id, result_side)
    await db.coin_rounds.update_one({"_id": round_id}, {"$set": {"status": "result"}})

    # Sleep until round officially ends
    await asyncio.sleep(max(0.0, ends_at - time.time()))
    await db.coin_rounds.update_one({"_id": round_id}, {"$set": {"status": "settled"}})

    # Cleanup very-old rounds
    await _cleanup_old()


async def _settle_round(round_id: str, result_side: str):
    """Pay winners on this round. Losers already had their bet deducted at bet time."""
    cfg = await _get_coin_config()
    commission = cfg["commission_pct"]
    multiplier = 2.0 * (1 - commission / 100)   # e.g. 1.8x

    cur = db.coin_bets.find({"round_id": round_id, "status": "pending"})
    async for b in cur:
        if b["side"] == result_side:
            payout = round(b["amount"] * multiplier, 2)
            await db.coin_bets.update_one(
                {"_id": b["_id"]},
                {"$set": {"status": "won", "payout": payout, "settled_at": datetime.now(timezone.utc)}}
            )
            await db.users.update_one({"_id": ObjectId(b["user_id"])}, {"$inc": {"balance": payout}})
            # Log credit transaction
            await db.transactions.insert_one({
                "user_id": b["user_id"],
                "name": b.get("name", "Player"),
                "type": "coin_win",
                "game_name": "Coin Toss",
                "side": b["side"],
                "result_side": result_side,
                "amount": payout,
                "bet_amount": b["amount"],
                "status": "completed",
                "round_id": round_id,
                "created_at": datetime.now(timezone.utc),
            })
        else:
            await db.coin_bets.update_one(
                {"_id": b["_id"]},
                {"$set": {"status": "lost", "payout": 0.0, "settled_at": datetime.now(timezone.utc)}}
            )
            # Log a "coin_loss" audit entry (no balance change — already deducted at bet time)
            await db.transactions.insert_one({
                "user_id": b["user_id"],
                "name": b.get("name", "Player"),
                "type": "coin_loss",
                "game_name": "Coin Toss",
                "side": b["side"],
                "result_side": result_side,
                "amount": 0.0,
                "bet_amount": b["amount"],
                "status": "completed",
                "round_id": round_id,
                "created_at": datetime.now(timezone.utc),
            })


async def _cleanup_old():
    """Keep only the latest HISTORY_KEEP settled rounds."""
    try:
        count = await db.coin_rounds.count_documents({"status": "settled"})
        if count > HISTORY_KEEP:
            excess = count - HISTORY_KEEP
            cur = db.coin_rounds.find({"status": "settled"}, {"_id": 1}).sort("started_at", 1).limit(excess)
            old_ids = [r["_id"] async for r in cur]
            if old_ids:
                await db.coin_rounds.delete_many({"_id": {"$in": old_ids}})
    except Exception:
        pass
