"""Ludo Race — 8-minute time-based, 2-4 player Ludo mini-game.

Features:
  • Matchmaking lobby (per entry-fee slab)
  • 180s Wait & Fill — auto-bot fill if no other player joins
  • Weighted dice — targets ~30% user win rate over rolling last 10 games
  • Admin-configurable commission (default 10%)
  • MongoDB-backed persistence — crash-safe reconnect
  • WebSocket real-time board updates
  • 8-minute match timer + 15s per-turn timer with auto-skip

Board (simplified linear race):
  • Each player has 1 pawn on a 30-square track (index 0 → 30)
  • Roll dice → move pawn forward; landing on opponent = capture (opp → 0)
  • Rolling a 6 = extra turn (max 3 consecutive 6s to avoid infinite loop)
  • Reaching square 30 first = instant win
  • Timer expires → highest-square player wins; tie = equal split
"""
import asyncio
import random
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from bson import ObjectId

from database import db
from auth import get_current_user

router = APIRouter()

# ---------- Config ----------
TRACK_LENGTH = 30              # Squares to reach = win
MATCH_DURATION = 8 * 60        # 8 minutes in seconds
TURN_DURATION = 15             # Per-turn seconds
BOT_FILL_WAIT = 180            # Seconds before auto-filling with bots
MAX_CONSECUTIVE_SIXES = 3      # Anti-abuse cap on 6-again rule
ENTRY_FEE_SLABS = [10, 50, 100, 500]
PLAYER_COUNTS = [2, 3, 4]
DEFAULT_COMMISSION_PCT = 10.0  # % house cut
TARGET_USER_WIN_RATE = 0.30    # 30% — matched with problem statement

# Player colors (for UI)
PLAYER_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B"]  # red, blue, green, yellow

# Bot name pool (Indian first names)
BOT_NAMES = [
    "Rohit", "Sneha", "Aakash", "Priya", "Vikram", "Anjali", "Rahul", "Meera",
    "Suresh", "Kavya", "Amit", "Neha", "Ravi", "Pooja", "Karan", "Isha",
    "Deepak", "Simran", "Manish", "Riya", "Sanjay", "Nikita", "Arjun", "Divya",
    "Sachin", "Payal", "Nitin", "Sonam", "Yash", "Tanya", "Gaurav", "Preeti",
    "Ankit", "Shreya", "Mohit", "Aarti", "Varun", "Nisha", "Kunal", "Ritu",
]

# ---------- In-memory: WebSocket clients per table ----------
_ws_clients: Dict[str, List[WebSocket]] = {}   # table_id -> [ws, ...]
_ws_lock = asyncio.Lock()


async def _broadcast(table_id: str, payload: dict) -> None:
    """Fan-out payload to all connected clients of a given table."""
    async with _ws_lock:
        clients = list(_ws_clients.get(table_id, []))
    if not clients:
        return
    dead = []
    for ws in clients:
        try:
            await asyncio.wait_for(ws.send_json(payload), timeout=2.0)
        except Exception:
            dead.append(ws)
    if dead:
        async with _ws_lock:
            lst = _ws_clients.get(table_id, [])
            for d in dead:
                if d in lst:
                    lst.remove(d)


# ---------- Commission (admin-configurable via settings collection) ----------
async def _get_commission_pct() -> float:
    s = await db.settings.find_one({"_id": "ludo"})
    if s and isinstance(s.get("commission_pct"), (int, float)):
        return float(s["commission_pct"])
    return DEFAULT_COMMISSION_PCT


# ---------- Weighted Dice: Game Integrity Manager ----------
async def _user_recent_winrate(user_id: str) -> float:
    """Look at the user's last 10 completed Ludo games and compute win rate."""
    cur = db.ludo_games.find(
        {"players.user_id": user_id, "status": "completed"},
        {"_id": 0, "winner_ids": 1}
    ).sort("ended_at", -1).limit(10)
    games = await cur.to_list(10)
    if not games:
        return 0.0
    wins = sum(1 for g in games if user_id in (g.get("winner_ids") or []))
    return wins / len(games)


async def weighted_dice_roll(user_id: str, is_bot: bool) -> int:
    """Server-side dice roll with weighting toward TARGET_USER_WIN_RATE for
    real users. Bots roll uniformly for fairness within the constraint.

    Logic:
      • If user's recent win rate is BELOW target -> boost 5/6 probability
      • If ABOVE target -> boost 1/2 probability
      • Delta magnitude scales the weight
    """
    if is_bot:
        return random.randint(1, 6)

    try:
        wr = await _user_recent_winrate(user_id)
    except Exception:
        wr = 0.0
    delta = TARGET_USER_WIN_RATE - wr   # positive => needs boost; negative => needs suppression

    # Base weights uniform
    weights = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0]   # faces 1..6

    # Boost/penalty capped so game still feels random
    boost = max(min(delta * 2.5, 0.6), -0.6)  # ~ [-0.6, 0.6]

    if boost > 0:
        # Favor high faces (5,6) — help the user advance
        weights[4] += boost * 1.2
        weights[5] += boost * 1.6
        weights[0] -= boost * 0.8
        weights[1] -= boost * 0.4
    else:
        # Suppress user — favor low faces
        b = abs(boost)
        weights[0] += b * 1.2
        weights[1] += b * 0.8
        weights[4] -= b * 0.6
        weights[5] -= b * 1.0

    # Clamp to positive
    weights = [max(0.05, w) for w in weights]
    faces = [1, 2, 3, 4, 5, 6]
    return random.choices(faces, weights=weights, k=1)[0]


# ---------- Table lifecycle helpers ----------
def _make_table_doc(entry_fee: float, max_players: int, creator: dict) -> dict:
    now = datetime.now(timezone.utc)
    table_id = uuid.uuid4().hex[:12]
    return {
        "_id": table_id,
        "table_id": table_id,
        "entry_fee": float(entry_fee),
        "max_players": int(max_players),
        "status": "waiting",             # waiting | playing | completed | cancelled
        "players": [_make_player_slot(creator, 0)],
        "current_turn_idx": 0,
        "current_turn_deadline": None,    # epoch seconds
        "last_dice": None,                # {value, roller_idx, ts}
        "consecutive_sixes": 0,
        "match_ends_at": None,           # epoch seconds when match auto-ends
        "created_at": now,
        "started_at": None,
        "ended_at": None,
        "winner_ids": [],
        "prize_pool": 0.0,
        "commission_pct": None,
        "commission_amount": 0.0,
        "log": [],                        # append-only event log
        "bot_fill_deadline": time.time() + BOT_FILL_WAIT,
    }


def _make_player_slot(user: dict, idx: int, is_bot: bool = False) -> dict:
    return {
        "user_id": user["_id"] if not is_bot else f"bot_{uuid.uuid4().hex[:8]}",
        "name": user.get("name", "Player"),
        "is_bot": is_bot,
        "position": 0,        # square index on track
        "color": PLAYER_COLORS[idx],
        "seat": idx,
        "captures": 0,
        "sixes": 0,
        "moves": 0,
    }


def _public_table(t: dict) -> dict:
    """Sanitize table doc for client (strip internal fields)."""
    out = {
        "table_id": t["table_id"],
        "entry_fee": t["entry_fee"],
        "max_players": t["max_players"],
        "status": t["status"],
        "players": [
            {k: p[k] for k in ("user_id", "name", "is_bot", "position", "color", "seat", "captures")}
            for p in t.get("players", [])
        ],
        "current_turn_idx": t.get("current_turn_idx"),
        "current_turn_deadline": t.get("current_turn_deadline"),
        "last_dice": t.get("last_dice"),
        "consecutive_sixes": t.get("consecutive_sixes", 0),
        "match_ends_at": t.get("match_ends_at"),
        "winner_ids": t.get("winner_ids", []),
        "prize_pool": t.get("prize_pool", 0.0),
        "bot_fill_deadline": t.get("bot_fill_deadline"),
        "track_length": TRACK_LENGTH,
        "log": (t.get("log") or [])[-15:],
    }
    return out


def _current_player(t: dict) -> Optional[dict]:
    players = t.get("players") or []
    idx = t.get("current_turn_idx", 0)
    if not players or idx >= len(players):
        return None
    return players[idx]


def _next_turn_idx(t: dict, extra: bool = False) -> int:
    """Advance turn (unless extra=True for a 6)."""
    if extra:
        return t["current_turn_idx"]
    return (t["current_turn_idx"] + 1) % len(t["players"])


async def _log_event(t: dict, msg: str) -> None:
    t.setdefault("log", []).append({
        "t": int(time.time()),
        "msg": msg,
    })


async def _settle_table(table_id: str, cause: str) -> None:
    """Determine winner, distribute prize, mark completed, broadcast."""
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t or t.get("status") == "completed":
        return

    players = t.get("players", [])
    prize_pool = t.get("prize_pool", 0.0)

    # Winner = highest position; ties get equal split
    max_pos = max(p["position"] for p in players)
    winners = [p for p in players if p["position"] == max_pos]
    winner_ids = [p["user_id"] for p in winners]
    per_winner = round(prize_pool / max(len(winners), 1), 2) if prize_pool > 0 else 0.0

    # Credit real users
    for w in winners:
        if not w.get("is_bot") and per_winner > 0:
            try:
                await db.users.update_one(
                    {"_id": ObjectId(w["user_id"])},
                    {"$inc": {"balance": per_winner}}
                )
                await db.transactions.insert_one({
                    "user_id": w["user_id"],
                    "type": "ludo_win",
                    "amount": per_winner,
                    "status": "completed",
                    "table_id": table_id,
                    "created_at": datetime.now(timezone.utc),
                })
            except Exception:
                pass

    now = datetime.now(timezone.utc)
    await db.ludo_tables.update_one(
        {"_id": table_id},
        {"$set": {
            "status": "completed",
            "ended_at": now,
            "winner_ids": winner_ids,
            "per_winner": per_winner,
            "end_cause": cause,
        }}
    )
    # Snapshot into ludo_games history
    t2 = await db.ludo_tables.find_one({"_id": table_id})
    if t2:
        await db.ludo_games.insert_one({
            "table_id": table_id,
            "entry_fee": t2["entry_fee"],
            "players": [{
                "user_id": p["user_id"],
                "name": p["name"],
                "is_bot": p.get("is_bot", False),
                "position": p["position"],
                "captures": p.get("captures", 0),
            } for p in t2["players"]],
            "winner_ids": winner_ids,
            "per_winner": per_winner,
            "prize_pool": t2.get("prize_pool", 0.0),
            "commission_amount": t2.get("commission_amount", 0.0),
            "started_at": t2.get("started_at"),
            "ended_at": now,
            "status": "completed",
            "end_cause": cause,
        })

    await _broadcast(table_id, {
        "type": "game_over",
        "winner_ids": winner_ids,
        "per_winner": per_winner,
        "cause": cause,
        "state": _public_table(await db.ludo_tables.find_one({"_id": table_id})),
    })


async def _start_match(t: dict) -> None:
    """Transition table from waiting -> playing, set timers."""
    now_ts = time.time()
    commission_pct = await _get_commission_pct()
    gross = t["entry_fee"] * len(t["players"])
    commission = round(gross * (commission_pct / 100.0), 2)
    prize_pool = round(gross - commission, 2)

    t["status"] = "playing"
    t["started_at"] = datetime.now(timezone.utc)
    t["match_ends_at"] = now_ts + MATCH_DURATION
    t["current_turn_idx"] = 0
    t["current_turn_deadline"] = now_ts + TURN_DURATION
    t["prize_pool"] = prize_pool
    t["commission_pct"] = commission_pct
    t["commission_amount"] = commission
    await _log_event(t, f"Match started • Prize ₹{prize_pool}")

    await db.ludo_tables.update_one({"_id": t["_id"]}, {"$set": t})
    await _broadcast(t["_id"], {"type": "match_started", "state": _public_table(t)})


async def _fill_with_bots(table_id: str) -> None:
    """Fill remaining seats with bots and start the match."""
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t or t["status"] != "waiting":
        return
    remaining = t["max_players"] - len(t["players"])
    if remaining <= 0:
        # Already full
        await _start_match(t)
        return

    used_names = {p["name"] for p in t["players"]}
    available = [n for n in BOT_NAMES if n not in used_names]
    random.shuffle(available)

    for i in range(remaining):
        bot_name = available[i] if i < len(available) else f"Bot{i+1}"
        seat = len(t["players"])
        t["players"].append(_make_player_slot({"_id": None, "name": bot_name}, seat, is_bot=True))
        await _log_event(t, f"🤖 {bot_name} joined (auto-fill)")

    await _start_match(t)


# ---------- Background loops ----------
async def ludo_watchdog():
    """Every 2s:
      • For 'waiting' tables past bot_fill_deadline -> fill with bots
      • For 'playing' tables past current_turn_deadline -> auto-play current player
      • For 'playing' tables past match_ends_at -> settle
    """
    await asyncio.sleep(3)
    while True:
        try:
            now_ts = time.time()

            # 1. Bot fill for waiting tables
            waiting = await db.ludo_tables.find({
                "status": "waiting",
                "bot_fill_deadline": {"$lte": now_ts},
            }).to_list(50)
            for t in waiting:
                try:
                    await _fill_with_bots(t["_id"])
                except Exception:
                    pass

            # 2. Auto-turn advancement
            playing = await db.ludo_tables.find({"status": "playing"}).to_list(200)
            for t in playing:
                # Match timeout -> settle
                if t.get("match_ends_at") and now_ts >= t["match_ends_at"]:
                    await _settle_table(t["_id"], "time_up")
                    continue

                # Current turn timeout OR current player is a bot -> auto-play
                deadline = t.get("current_turn_deadline") or 0
                cp = _current_player(t)
                if not cp:
                    continue
                should_auto = cp.get("is_bot") or now_ts >= deadline
                if should_auto:
                    # Small pacing delay if bot to feel natural
                    if cp.get("is_bot"):
                        await asyncio.sleep(0.5)
                    await _auto_roll_and_move(t["_id"])

        except Exception as e:
            # Don't crash the loop
            import logging
            logging.getLogger(__name__).warning(f"Ludo watchdog err: {e}")
        await asyncio.sleep(2.0)


async def _auto_roll_and_move(table_id: str) -> None:
    """Perform a dice roll + move for the current player (bot or timed-out user)."""
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t or t["status"] != "playing":
        return
    cp = _current_player(t)
    if not cp:
        return

    # If real user timed out -> skip turn (no roll) OR treat as forced roll of 1
    # We choose a forced random roll so game keeps flowing.
    is_bot = cp.get("is_bot", False)
    dice = await weighted_dice_roll(cp["user_id"], is_bot=is_bot)
    await _apply_move(table_id, cp["seat"], dice, forced=not is_bot)


async def _apply_move(table_id: str, seat: int, dice: int, forced: bool = False) -> Optional[dict]:
    """Apply a dice roll for `seat` and advance turn. Returns updated public state."""
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t or t["status"] != "playing":
        return None
    if t.get("current_turn_idx") != seat:
        return None

    players = t["players"]
    p = players[seat]

    new_pos = min(TRACK_LENGTH, p["position"] + dice)
    p["moves"] = p.get("moves", 0) + 1
    if dice == 6:
        p["sixes"] = p.get("sixes", 0) + 1

    # Capture check: any opponent on same square (not at 0 or TRACK_LENGTH)
    captured_names = []
    if 0 < new_pos < TRACK_LENGTH:
        for other in players:
            if other["seat"] != seat and other["position"] == new_pos:
                other["position"] = 0
                captured_names.append(other["name"])
                p["captures"] = p.get("captures", 0) + 1

    p["position"] = new_pos

    # Log
    msg = f"{'🤖 ' if p.get('is_bot') else ''}{p['name']} rolled {dice}"
    if forced and not p.get("is_bot"):
        msg += " (auto)"
    if captured_names:
        msg += f" • captured {', '.join(captured_names)}"
    if new_pos >= TRACK_LENGTH:
        msg += " • 🏁 HOME"
    await _log_event(t, msg)

    # Turn control (6 = extra, capped)
    extra = (dice == 6)
    if extra:
        t["consecutive_sixes"] = t.get("consecutive_sixes", 0) + 1
        if t["consecutive_sixes"] >= MAX_CONSECUTIVE_SIXES:
            extra = False
            t["consecutive_sixes"] = 0
            await _log_event(t, f"{p['name']} — 3rd six, turn passes!")
    else:
        t["consecutive_sixes"] = 0

    t["last_dice"] = {"value": dice, "roller_seat": seat, "ts": int(time.time())}

    # Win check (instant win at 30)
    instant_win = new_pos >= TRACK_LENGTH

    if instant_win:
        # Save then settle
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "dice_rolled", "seat": seat, "dice": dice,
                                     "state": _public_table(t)})
        await _settle_table(table_id, "reached_home")
        return _public_table(await db.ludo_tables.find_one({"_id": table_id}))

    t["current_turn_idx"] = _next_turn_idx(t, extra=extra)
    t["current_turn_deadline"] = time.time() + TURN_DURATION
    await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
    await _broadcast(table_id, {"type": "dice_rolled", "seat": seat, "dice": dice,
                                 "extra": extra, "state": _public_table(t)})
    return _public_table(t)


# ---------- REST endpoints ----------
@router.get("/ludo/config")
async def ludo_config():
    """Public config for lobby UI."""
    return {
        "entry_fees": ENTRY_FEE_SLABS,
        "player_counts": PLAYER_COUNTS,
        "track_length": TRACK_LENGTH,
        "match_duration": MATCH_DURATION,
        "turn_duration": TURN_DURATION,
        "bot_fill_wait": BOT_FILL_WAIT,
        "commission_pct": await _get_commission_pct(),
    }


@router.get("/ludo/tables")
async def list_tables():
    """Public list of joinable waiting tables."""
    cur = db.ludo_tables.find({"status": "waiting"}, {"_id": 0}).sort("created_at", -1).limit(30)
    tables = await cur.to_list(30)
    return {"tables": [_public_table(t) for t in tables]}


@router.post("/ludo/tables/create")
async def create_table(request: Request):
    """Create a new waiting table with the caller as the first player."""
    user = await get_current_user(request)
    body = await request.json()
    try:
        entry_fee = float(body["entry_fee"])
        max_players = int(body["max_players"])
    except Exception:
        raise HTTPException(400, "entry_fee and max_players are required")
    if entry_fee not in ENTRY_FEE_SLABS:
        raise HTTPException(400, f"entry_fee must be one of {ENTRY_FEE_SLABS}")
    if max_players not in PLAYER_COUNTS:
        raise HTTPException(400, f"max_players must be one of {PLAYER_COUNTS}")

    # Balance check + deduct
    if float(user.get("balance", 0)) < entry_fee:
        raise HTTPException(400, "बैलेंस कम है / Insufficient balance")

    # Prevent multiple active tables per user
    existing = await db.ludo_tables.find_one({
        "status": {"$in": ["waiting", "playing"]},
        "players.user_id": user["_id"],
    })
    if existing:
        raise HTTPException(400, "आप पहले से एक टेबल में हैं / Already in a table")

    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": -entry_fee}})
    await db.transactions.insert_one({
        "user_id": user["_id"],
        "type": "ludo_entry",
        "amount": -entry_fee,
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
    })

    t = _make_table_doc(entry_fee, max_players, user)
    await _log_event(t, f"{user.get('name','Player')} created table")
    await db.ludo_tables.insert_one(t)
    return {"table_id": t["_id"], "state": _public_table(t)}


@router.post("/ludo/tables/{table_id}/join")
async def join_table(table_id: str, request: Request):
    user = await get_current_user(request)
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")
    if t["status"] != "waiting":
        raise HTTPException(400, "Table already started / full")
    if any(p["user_id"] == user["_id"] for p in t["players"]):
        # Already in — return state (reconnect)
        return {"table_id": table_id, "state": _public_table(t)}
    if len(t["players"]) >= t["max_players"]:
        raise HTTPException(400, "Table full")
    if float(user.get("balance", 0)) < t["entry_fee"]:
        raise HTTPException(400, "बैलेंस कम है / Insufficient balance")

    # Check user isn't in another active table
    other = await db.ludo_tables.find_one({
        "status": {"$in": ["waiting", "playing"]},
        "players.user_id": user["_id"],
    })
    if other:
        raise HTTPException(400, "आप पहले से एक टेबल में हैं / Already in a table")

    # Deduct entry
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": -t["entry_fee"]}})
    await db.transactions.insert_one({
        "user_id": user["_id"],
        "type": "ludo_entry",
        "amount": -t["entry_fee"],
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
    })

    seat = len(t["players"])
    t["players"].append(_make_player_slot(user, seat))
    await _log_event(t, f"{user.get('name','Player')} joined")

    # If full -> auto start
    if len(t["players"]) >= t["max_players"]:
        await _start_match(t)
    else:
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "player_joined", "state": _public_table(t)})

    return {"table_id": table_id, "state": _public_table(t)}


@router.post("/ludo/tables/{table_id}/leave")
async def leave_table(table_id: str, request: Request):
    """Leave a WAITING table only (refund). Playing tables cannot be quit."""
    user = await get_current_user(request)
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")
    if t["status"] != "waiting":
        raise HTTPException(400, "गेम शुरू हो चुका है, अब leave नहीं कर सकते")

    idx = next((i for i, p in enumerate(t["players"]) if p["user_id"] == user["_id"]), -1)
    if idx < 0:
        raise HTTPException(400, "Not in this table")

    # Refund
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": t["entry_fee"]}})
    await db.transactions.insert_one({
        "user_id": user["_id"],
        "type": "ludo_refund",
        "amount": t["entry_fee"],
        "status": "completed",
        "table_id": table_id,
        "created_at": datetime.now(timezone.utc),
    })

    del t["players"][idx]
    # Re-seat remaining players
    for i, p in enumerate(t["players"]):
        p["seat"] = i
        p["color"] = PLAYER_COLORS[i]
    await _log_event(t, f"{user.get('name','Player')} left")

    if not t["players"]:
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": {"status": "cancelled", "ended_at": datetime.now(timezone.utc)}})
    else:
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "player_left", "state": _public_table(t)})
    return {"status": "OK"}


@router.get("/ludo/tables/{table_id}")
async def get_table(table_id: str, request: Request):
    # No auth required for view (reconnect friendly)
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")
    return {"state": _public_table(t)}


@router.post("/ludo/tables/{table_id}/roll")
async def roll_dice(table_id: str, request: Request):
    """User rolls dice on their turn."""
    user = await get_current_user(request)
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")
    if t["status"] != "playing":
        raise HTTPException(400, "Match not active")
    cp = _current_player(t)
    if not cp or cp["user_id"] != user["_id"] or cp.get("is_bot"):
        raise HTTPException(400, "आपकी बारी नहीं है")

    dice = await weighted_dice_roll(user["_id"], is_bot=False)
    state = await _apply_move(table_id, cp["seat"], dice, forced=False)
    return {"dice": dice, "state": state}


@router.get("/ludo/my-active")
async def my_active_table(request: Request):
    """If user is currently in a waiting/playing table, return it (for reconnect)."""
    user = await get_current_user(request)
    t = await db.ludo_tables.find_one({
        "status": {"$in": ["waiting", "playing"]},
        "players.user_id": user["_id"],
    })
    if not t:
        return {"state": None}
    return {"state": _public_table(t)}


@router.get("/ludo/history")
async def my_history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    cur = db.ludo_games.find(
        {"players.user_id": user["_id"]},
        {"_id": 0}
    ).sort("ended_at", -1).limit(limit)
    games = await cur.to_list(limit)
    return {"games": games}


# ---------- Admin endpoints ----------
@router.get("/admin/ludo/settings")
async def admin_get_settings(request: Request):
    from auth import get_admin_user
    await get_admin_user(request)
    return {
        "commission_pct": await _get_commission_pct(),
        "target_user_win_rate": TARGET_USER_WIN_RATE,
    }


@router.post("/admin/ludo/settings")
async def admin_set_settings(request: Request):
    from auth import get_admin_user
    await get_admin_user(request)
    body = await request.json()
    try:
        pct = float(body["commission_pct"])
    except Exception:
        raise HTTPException(400, "commission_pct required")
    if pct < 0 or pct > 50:
        raise HTTPException(400, "commission_pct must be 0..50")
    await db.settings.update_one(
        {"_id": "ludo"},
        {"$set": {"commission_pct": pct, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"status": "OK", "commission_pct": pct}


@router.get("/admin/ludo/tables")
async def admin_list_all_tables(request: Request, status: Optional[str] = None, limit: int = 100):
    from auth import get_admin_user
    await get_admin_user(request)
    q = {}
    if status:
        q["status"] = status
    cur = db.ludo_tables.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    tables = await cur.to_list(limit)
    return {"tables": [_public_table(t) for t in tables]}


# ---------- WebSocket ----------
@router.websocket("/ludo/ws/{table_id}")
async def ludo_ws(ws: WebSocket, table_id: str):
    await ws.accept()
    async with _ws_lock:
        _ws_clients.setdefault(table_id, []).append(ws)
    # Send snapshot
    try:
        t = await db.ludo_tables.find_one({"_id": table_id})
        if t:
            await ws.send_json({"type": "snapshot", "state": _public_table(t)})
        else:
            await ws.send_json({"type": "error", "message": "Table not found"})
    except Exception:
        pass

    try:
        while True:
            try:
                await ws.receive_text()
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        async with _ws_lock:
            lst = _ws_clients.get(table_id, [])
            if ws in lst:
                lst.remove(ws)
