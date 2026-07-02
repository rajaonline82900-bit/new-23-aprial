"""Ludo (Zupee-Supreme style) — classic 4-token real-money Ludo.

Features:
  • Matchmaking lobby (2/3/4 players, ₹10/₹50/₹100/₹500 slabs)
  • 180s Wait & Fill — auto-bot fill if no other player joins
  • Weighted dice — targets ~30% user win rate over rolling last 10 games
  • Admin-configurable commission (default 10%)
  • MongoDB-backed persistence — crash-safe reconnect
  • WebSocket real-time board updates
  • 10-minute match timer + 15s per-turn timer with auto-skip

Board (classic Ludo):
  • Each player has 4 tokens starting in their color YARD
  • Roll 6 to release a token onto the main 52-square track
  • Personal `progress` per token: 0 (yard) → 1..51 (main track) → 52..57 (home column)
  • Progress 57 = token has reached FINAL HOME
  • 8 safe squares (4 color-start + 4 stars) — no capture possible
  • Landing on opponent at non-safe square = capture (back to yard)
  • 6 = extra turn (max 3 consecutive)
  • End: all 4 tokens home OR timer runs out → highest SCORE wins
    Score = home_tokens*56 + Σ token progress + captures*20
"""
import asyncio
import random
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
MAIN_TRACK_LEN = 52              # Squares on the outer loop
HOME_COLUMN_LEN = 6              # Squares in the color-specific home column
FINAL_HOME_PROGRESS = MAIN_TRACK_LEN + HOME_COLUMN_LEN - 1  # = 57
TOKENS_PER_PLAYER = 4

MATCH_DURATION = 10 * 60         # 10 minutes (Zupee-Supreme)
TURN_DURATION = 15
BOT_FILL_WAIT = 60               # 60s wait before bot autofill (per user request)
MAX_CONSECUTIVE_SIXES = 3
MAX_AUTO_SKIPS = 3               # After 3 auto-plays in a row, user forfeits on 4th
ENTRY_FEE_SLABS = [10, 50, 100, 500]
PLAYER_COUNTS = [2, 3, 4]
DEFAULT_COMMISSION_PCT = 10.0
TARGET_USER_WIN_RATE = 0.30

CAPTURE_BONUS_POINTS = 20        # Score points added for each capture

# Zupee/standard color assignments — Red top-left, Green top-right,
# Yellow bottom-right, Blue bottom-left (matches Zupee Ludo Supreme).
PLAYER_COLORS = ["#DC2626", "#16A34A", "#EAB308", "#2563EB"]  # red, green, yellow, blue
PLAYER_COLOR_NAMES = ["red", "green", "yellow", "blue"]

# Each color's start square on the shared 52-track:
PLAYER_START_POS = [0, 13, 26, 39]

# Safe squares (no captures possible):
#   • 4 color-start squares  (0, 13, 26, 39)
#   • 4 star mid-path squares (8, 21, 34, 47)
SAFE_SQUARES = {0, 8, 13, 21, 26, 34, 39, 47}

BOT_NAMES = [
    # Boys
    "Rohit Sharma", "Aakash Yadav", "Vikram Singh", "Rahul Verma", "Suresh Patel",
    "Amit Kumar", "Ravi Gupta", "Karan Malhotra", "Deepak Jain", "Manish Tiwari",
    "Sanjay Bhatt", "Arjun Rao", "Sachin Nair", "Nitin Bansal", "Yash Choudhary",
    "Gaurav Mehta", "Ankit Saini", "Mohit Rathore", "Varun Kapoor", "Kunal Aggarwal",
    "Aditya Joshi", "Rajesh Shukla", "Harish Dubey", "Naveen Reddy", "Pankaj Mishra",
    "Sumit Chauhan", "Vishal Pandey", "Abhishek Roy", "Tarun Goyal", "Devendra Sinha",
    # Girls
    "Sneha Kapoor", "Priya Iyer", "Anjali Desai", "Meera Mehra", "Kavya Nair",
    "Neha Bhatia", "Pooja Sethi", "Isha Khanna", "Simran Kaur", "Riya Chawla",
    "Nikita Arora", "Divya Menon", "Payal Bhandari", "Sonam Rana", "Tanya Bhalla",
    "Preeti Chopra", "Shreya Gill", "Aarti Bajaj", "Nisha Malhotra", "Ritu Grover",
    "Anushka Trivedi", "Radhika Modi", "Sanya Bhatt", "Aisha Sethi", "Bhavya Doshi",
    "Ishita Sood", "Komal Wadhwa", "Nandini Sen", "Ojasvi Rana", "Pallavi Naik",
]


# ---------- WebSocket clients ----------
_ws_clients: Dict[str, List[WebSocket]] = {}
_ws_lock = asyncio.Lock()


async def _broadcast(table_id: str, payload: dict) -> None:
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


# ---------- Commission ----------
async def _get_commission_pct() -> float:
    s = await db.settings.find_one({"_id": "ludo"})
    if s and isinstance(s.get("commission_pct"), (int, float)):
        return float(s["commission_pct"])
    return DEFAULT_COMMISSION_PCT


# ---------- Weighted Dice ----------
async def _user_recent_winrate(user_id: str) -> float:
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
    """Server-side weighted RNG that keeps user win rate ~30% over last 10 games."""
    if is_bot:
        return random.randint(1, 6)
    try:
        wr = await _user_recent_winrate(user_id)
    except Exception:
        wr = 0.0
    delta = TARGET_USER_WIN_RATE - wr
    weights = [1.0] * 6
    boost = max(min(delta * 2.5, 0.6), -0.6)
    if boost > 0:
        weights[4] += boost * 1.2   # face 5
        weights[5] += boost * 1.6   # face 6 (extra turn + release)
        weights[0] -= boost * 0.8
        weights[1] -= boost * 0.4
    else:
        b = abs(boost)
        weights[0] += b * 1.2
        weights[1] += b * 0.8
        weights[4] -= b * 0.6
        weights[5] -= b * 1.0
    weights = [max(0.05, w) for w in weights]
    return random.choices([1, 2, 3, 4, 5, 6], weights=weights, k=1)[0]


# ---------- Token / player helpers ----------
def _make_token(idx: int) -> dict:
    return {"id": idx, "progress": 0}   # 0 = yard, 1..51 = main, 52..57 = home column


def _abs_position_of(token: dict, start_pos: int) -> Optional[int]:
    """Return the absolute main-track square (0..51) the token occupies, or None
    if in yard/home column."""
    p = token["progress"]
    if p <= 0 or p > 51:
        return None
    return (start_pos + p - 1) % MAIN_TRACK_LEN


def _make_player_slot(user: dict, idx: int, is_bot: bool = False) -> dict:
    return {
        "user_id": user["_id"] if not is_bot else f"bot_{uuid.uuid4().hex[:8]}",
        "name": user.get("name", "Player"),
        "is_bot": is_bot,
        "seat": idx,
        "color": PLAYER_COLORS[idx],
        "color_name": PLAYER_COLOR_NAMES[idx],
        "start_pos": PLAYER_START_POS[idx],
        "tokens": [_make_token(i) for i in range(TOKENS_PER_PLAYER)],
        "captures": 0,
        "score": 0,
        "sixes": 0,
        "moves": 0,
        "auto_skips": 0,          # consecutive auto-plays without a manual roll
        "forfeited": False,       # true = eliminated (auto-skip x4 OR left game)
        "forfeit_reason": None,   # "auto_skip_limit" | "left_game" | None
    }


def _player_score(p: dict) -> int:
    home = sum(1 for t in p["tokens"] if t["progress"] >= FINAL_HOME_PROGRESS)
    prog_sum = sum(t["progress"] for t in p["tokens"] if t["progress"] < FINAL_HOME_PROGRESS)
    return home * 56 + prog_sum + p.get("captures", 0) * CAPTURE_BONUS_POINTS


# ---------- Table lifecycle ----------
def _make_table_doc(entry_fee: float, max_players: int, creator: dict) -> dict:
    now = datetime.now(timezone.utc)
    table_id = uuid.uuid4().hex[:12]
    return {
        "_id": table_id,
        "table_id": table_id,
        "entry_fee": float(entry_fee),
        "max_players": int(max_players),
        "status": "waiting",
        "players": [_make_player_slot(creator, 0)],
        "current_turn_idx": 0,
        "current_turn_deadline": None,
        "last_dice": None,
        "consecutive_sixes": 0,
        "match_ends_at": None,
        "created_at": now,
        "started_at": None,
        "ended_at": None,
        "winner_ids": [],
        "prize_pool": 0.0,
        "commission_pct": None,
        "commission_amount": 0.0,
        "log": [],
        "bot_fill_deadline": time.time() + BOT_FILL_WAIT,
        # A dice already rolled but not yet consumed (waiting for token pick):
        "pending_dice": None,     # {value, roller_seat}
    }


def _public_table(t: dict) -> dict:
    return {
        "table_id": t["table_id"],
        "entry_fee": t["entry_fee"],
        "max_players": t["max_players"],
        "status": t["status"],
        "players": [{
            "user_id": p["user_id"],
            "name": p["name"],
            # is_bot deliberately hidden from client — bots must appear as real users
            "is_bot": False,
            "seat": p["seat"],
            "color": p["color"],
            "color_name": p["color_name"],
            "start_pos": p["start_pos"],
            "tokens": p["tokens"],
            "captures": p.get("captures", 0),
            "score": _player_score(p),
            "forfeited": p.get("forfeited", False),
            "auto_skips": p.get("auto_skips", 0),
        } for p in t.get("players", [])],
        "current_turn_idx": t.get("current_turn_idx"),
        "current_turn_deadline": t.get("current_turn_deadline"),
        "last_dice": t.get("last_dice"),
        "pending_dice": t.get("pending_dice"),
        "consecutive_sixes": t.get("consecutive_sixes", 0),
        "match_ends_at": t.get("match_ends_at"),
        "winner_ids": t.get("winner_ids", []),
        "per_winner": t.get("per_winner"),
        "prize_pool": t.get("prize_pool", 0.0),
        "bot_fill_deadline": t.get("bot_fill_deadline"),
        "main_track_len": MAIN_TRACK_LEN,
        "home_column_len": HOME_COLUMN_LEN,
        "safe_squares": list(SAFE_SQUARES),
        "log": (t.get("log") or [])[-20:],
    }


def _current_player(t: dict) -> Optional[dict]:
    players = t.get("players") or []
    idx = t.get("current_turn_idx", 0)
    if not players or idx >= len(players):
        return None
    return players[idx]


def _next_turn_idx(t: dict, extra: bool = False) -> int:
    """Advance to next non-forfeited player. If `extra`, stay on current
    player (but only if they're not forfeited)."""
    players = t["players"]
    cur = t["current_turn_idx"]
    if extra and not players[cur].get("forfeited"):
        return cur
    n = len(players)
    for step in range(1, n + 1):
        idx = (cur + step) % n
        if not players[idx].get("forfeited"):
            return idx
    return cur   # everyone forfeited (fallback)


def _active_players(t: dict) -> list:
    """Non-forfeited players."""
    return [p for p in t.get("players", []) if not p.get("forfeited")]


async def _log_event(t: dict, msg: str) -> None:
    t.setdefault("log", []).append({"t": int(time.time()), "msg": msg})


async def _settle_table(table_id: str, cause: str) -> None:
    """Settle: highest score wins; ties split. Credit winners."""
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t or t.get("status") == "completed":
        return

    players = t.get("players", [])
    for p in players:
        p["score"] = _player_score(p)

    prize_pool = t.get("prize_pool", 0.0)

    # Winner selection: only NON-forfeited players are eligible
    eligible = [p for p in players if not p.get("forfeited")]
    if not eligible:
        # Edge case — everyone forfeited; house keeps commission, refund nobody (rare)
        winners = []
    else:
        max_score = max(p["score"] for p in eligible)
        winners = [p for p in eligible if p["score"] == max_score]
    winner_ids = [p["user_id"] for p in winners]
    per_winner = round(prize_pool / max(len(winners), 1), 2) if (prize_pool > 0 and winners) else 0.0

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
            "players": players,
        }}
    )
    t2 = await db.ludo_tables.find_one({"_id": table_id})
    if t2:
        await db.ludo_games.insert_one({
            "table_id": table_id,
            "entry_fee": t2["entry_fee"],
            "players": [{
                "user_id": p["user_id"],
                "name": p["name"],
                "is_bot": p.get("is_bot", False),
                "score": _player_score(p),
                "home_tokens": sum(1 for tok in p["tokens"] if tok["progress"] >= FINAL_HOME_PROGRESS),
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


async def _deduct_entry_fees(t: dict) -> None:
    """Called at match start — deduct entry fee from every REAL player.
    Bots don't pay. If a player has insufficient balance (edge case where
    their balance changed after joining), they are forfeited and refunded.
    """
    entry_fee = t["entry_fee"]
    for p in t["players"]:
        if p.get("is_bot"):
            continue
        try:
            u = await db.users.find_one({"_id": ObjectId(p["user_id"])})
            bal = float(u.get("balance", 0)) if u else 0
            if bal < entry_fee:
                # Cannot afford — mark forfeited (they won't play)
                p["forfeited"] = True
                p["forfeit_reason"] = "insufficient_balance_at_start"
                await _log_event(t, f"{p['name']} — insufficient balance, removed")
                continue
            await db.users.update_one(
                {"_id": ObjectId(p["user_id"])},
                {"$inc": {"balance": -entry_fee}}
            )
            await db.transactions.insert_one({
                "user_id": p["user_id"],
                "type": "ludo_entry",
                "amount": -entry_fee,
                "status": "completed",
                "table_id": t["_id"],
                "created_at": datetime.now(timezone.utc),
            })
        except Exception:
            pass


async def _start_match(t: dict) -> None:
    now_ts = time.time()

    # Deferred payment — deduct entry fee ONLY now (once match is actually starting)
    await _deduct_entry_fees(t)

    # Only players who successfully paid contribute to the prize pool
    paying_players = [p for p in t["players"] if not p.get("forfeited")]
    commission_pct = await _get_commission_pct()
    gross = t["entry_fee"] * len(paying_players)
    commission = round(gross * (commission_pct / 100.0), 2)
    prize_pool = round(gross - commission, 2)

    t["status"] = "playing"
    t["started_at"] = datetime.now(timezone.utc)
    t["match_ends_at"] = now_ts + MATCH_DURATION
    # Ensure first turn goes to a non-forfeited player
    t["current_turn_idx"] = 0
    if t["players"] and t["players"][0].get("forfeited"):
        t["current_turn_idx"] = _next_turn_idx(t, extra=False)
    t["current_turn_deadline"] = now_ts + TURN_DURATION
    t["prize_pool"] = prize_pool
    t["commission_pct"] = commission_pct
    t["commission_amount"] = commission
    await _log_event(t, f"Match started • Prize ₹{prize_pool}")
    await db.ludo_tables.update_one({"_id": t["_id"]}, {"$set": t})
    await _broadcast(t["_id"], {"type": "match_started", "state": _public_table(t)})


async def _fill_with_bots(table_id: str) -> None:
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t or t["status"] != "waiting":
        return
    remaining = t["max_players"] - len(t["players"])
    if remaining <= 0:
        await _start_match(t)
        return

    used_names = {p["name"] for p in t["players"]}
    available = [n for n in BOT_NAMES if n not in used_names]
    random.shuffle(available)

    for i in range(remaining):
        bot_name = available[i] if i < len(available) else f"Bot{i+1}"
        seat = len(t["players"])
        t["players"].append(_make_player_slot({"_id": None, "name": bot_name}, seat, is_bot=True))
        await _log_event(t, f"{bot_name} joined")

    await _start_match(t)


# ---------- Movement helpers ----------
def _movable_tokens(player: dict, dice: int) -> List[int]:
    """Return list of token IDs that CAN move with `dice`."""
    ids = []
    for tok in player["tokens"]:
        p = tok["progress"]
        # In yard: only 6 releases
        if p == 0:
            if dice == 6:
                ids.append(tok["id"])
            continue
        # Already home
        if p >= FINAL_HOME_PROGRESS:
            continue
        # Would over-shoot final home?
        if p + dice > FINAL_HOME_PROGRESS:
            continue
        ids.append(tok["id"])
    return ids


def _bot_choose_token(player: dict, dice: int, all_players: List[dict]) -> Optional[int]:
    """Simple heuristic: prefer capturing, then advancing furthest token,
    then releasing if 6."""
    movable = _movable_tokens(player, dice)
    if not movable:
        return None

    def capture_target_seats(tok_id: int) -> int:
        tok = player["tokens"][tok_id]
        p = tok["progress"]
        # Only main-track landings can capture
        new_prog = p + dice if p > 0 else 1
        if new_prog < 1 or new_prog > 51:
            return 0
        abs_pos = (player["start_pos"] + new_prog - 1) % MAIN_TRACK_LEN
        if abs_pos in SAFE_SQUARES:
            return 0
        count = 0
        for op in all_players:
            if op["seat"] == player["seat"]:
                continue
            for ot in op["tokens"]:
                if 0 < ot["progress"] <= 51:
                    op_abs = (op["start_pos"] + ot["progress"] - 1) % MAIN_TRACK_LEN
                    if op_abs == abs_pos:
                        count += 1
        return count

    # 1. Capture opportunity
    with_captures = [(tid, capture_target_seats(tid)) for tid in movable]
    with_captures = [x for x in with_captures if x[1] > 0]
    if with_captures:
        with_captures.sort(key=lambda x: -x[1])
        return with_captures[0][0]

    # 2. Release from yard if any (6-roll only)
    if dice == 6:
        for tid in movable:
            if player["tokens"][tid]["progress"] == 0:
                return tid

    # 3. Advance the furthest-along token
    furthest = max(movable, key=lambda tid: player["tokens"][tid]["progress"])
    return furthest


async def _apply_token_move(t: dict, seat: int, dice: int, token_id: int) -> Dict:
    """Move `token_id` for `seat` player by `dice`. Handle capture + extras."""
    p = t["players"][seat]
    tok = p["tokens"][token_id]

    was_release = (tok["progress"] == 0 and dice == 6)
    if was_release:
        tok["progress"] = 1
        moved_from_yard = True
    else:
        tok["progress"] = min(FINAL_HOME_PROGRESS, tok["progress"] + dice)
        moved_from_yard = False

    p["moves"] = p.get("moves", 0) + 1
    if dice == 6:
        p["sixes"] = p.get("sixes", 0) + 1

    # Capture check (only on main track & non-safe)
    captured_msgs = []
    if 1 <= tok["progress"] <= 51:
        abs_pos = (p["start_pos"] + tok["progress"] - 1) % MAIN_TRACK_LEN
        if abs_pos not in SAFE_SQUARES:
            for op in t["players"]:
                if op["seat"] == seat:
                    continue
                for ot in op["tokens"]:
                    if 0 < ot["progress"] <= 51:
                        op_abs = (op["start_pos"] + ot["progress"] - 1) % MAIN_TRACK_LEN
                        if op_abs == abs_pos:
                            ot["progress"] = 0    # send to yard
                            captured_msgs.append(f"{op['name']}'s token")
                            p["captures"] = p.get("captures", 0) + 1

    reached_home = tok["progress"] >= FINAL_HOME_PROGRESS

    msg_prefix = ""
    msg = f"{msg_prefix}{p['name']} rolled {dice}"
    if moved_from_yard:
        msg += " → released token"
    if captured_msgs:
        msg += f" • captured {', '.join(captured_msgs)}"
    if reached_home:
        msg += " • 🏁 token HOME"
    await _log_event(t, msg)

    # Consumed
    t["pending_dice"] = None

    # Extra turn if: rolled 6 OR captured OR reached home
    extra = (dice == 6) or bool(captured_msgs) or reached_home
    if dice == 6:
        t["consecutive_sixes"] = t.get("consecutive_sixes", 0) + 1
        if t["consecutive_sixes"] >= MAX_CONSECUTIVE_SIXES:
            extra = False
            t["consecutive_sixes"] = 0
            await _log_event(t, f"{p['name']} — 3rd six, turn passes!")
    elif not extra:
        t["consecutive_sixes"] = 0

    t["last_dice"] = {"value": dice, "roller_seat": seat, "ts": int(time.time())}

    # All 4 home? Instant match end (this player is likely winner)
    all_home_players = [pl for pl in t["players"] if all(tt["progress"] >= FINAL_HOME_PROGRESS for tt in pl["tokens"])]
    return {"extra": extra, "all_home": bool(all_home_players)}


# ---------- Watchdog ----------
async def ludo_watchdog():
    """Every 2s: bot-fill waiting tables, auto-play stuck/bot turns,
    settle matches whose timer expired."""
    await asyncio.sleep(3)
    while True:
        try:
            now_ts = time.time()

            # 1. Bot fill
            waiting = await db.ludo_tables.find({
                "status": "waiting",
                "bot_fill_deadline": {"$lte": now_ts},
            }).to_list(50)
            for t in waiting:
                try:
                    await _fill_with_bots(t["_id"])
                except Exception:
                    pass

            # 2. Turn / match progression
            playing = await db.ludo_tables.find({"status": "playing"}).to_list(200)
            for t in playing:
                if t.get("match_ends_at") and now_ts >= t["match_ends_at"]:
                    await _settle_table(t["_id"], "time_up")
                    continue
                deadline = t.get("current_turn_deadline") or 0
                cp = _current_player(t)
                if not cp:
                    continue
                should_auto = cp.get("is_bot") or now_ts >= deadline
                if should_auto:
                    if cp.get("is_bot"):
                        await asyncio.sleep(0.5)
                    await _auto_turn(t["_id"])

        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Ludo watchdog err: {e}")
        await asyncio.sleep(2.0)


async def _auto_turn(table_id: str) -> None:
    """Roll + move for the current player (bot or timed-out user).
    For real users: increments `auto_skips`. If auto_skips > MAX_AUTO_SKIPS,
    that user is forfeited (loses) — matching the "3 auto-skips allowed,
    4th means user loses" rule.
    """
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t or t["status"] != "playing":
        return
    cp = _current_player(t)
    if not cp:
        return
    is_bot = cp.get("is_bot", False)

    # Real user auto-skip forfeit check (BEFORE this auto-play)
    if not is_bot:
        current_skips = cp.get("auto_skips", 0)
        # After this auto-play, skips will be current+1. If that would EXCEED
        # the limit (i.e., 4th auto-skip), forfeit instead of auto-playing.
        if current_skips >= MAX_AUTO_SKIPS:
            cp["forfeited"] = True
            cp["forfeit_reason"] = "auto_skip_limit"
            await _log_event(t, f"{cp['name']} — {MAX_AUTO_SKIPS + 1}th miss, disqualified")
            t["pending_dice"] = None
            t["current_turn_idx"] = _next_turn_idx(t, extra=False)
            t["current_turn_deadline"] = time.time() + TURN_DURATION
            remaining = _active_players(t)
            await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
            await _broadcast(table_id, {"type": "player_forfeited", "seat": cp["seat"],
                                         "state": _public_table(t)})
            if len(remaining) <= 1:
                await _settle_table(table_id, "forfeit_end")
            return
        # Otherwise increment counter for this auto-play
        cp["auto_skips"] = current_skips + 1

    # If there's already a pending dice waiting to be consumed, resolve it
    pending = t.get("pending_dice")
    dice = pending["value"] if pending else await weighted_dice_roll(cp["user_id"], is_bot=is_bot)
    t["pending_dice"] = {"value": dice, "roller_seat": cp["seat"]}

    movable = _movable_tokens(cp, dice)
    if not movable:
        # No legal move -> skip turn
        await _log_event(t, f"{cp['name']} rolled {dice} — no legal move")
        t["pending_dice"] = None
        t["last_dice"] = {"value": dice, "roller_seat": cp["seat"], "ts": int(time.time())}
        # 6-consecutive counter still applies
        if dice == 6:
            t["consecutive_sixes"] = t.get("consecutive_sixes", 0) + 1
        else:
            t["consecutive_sixes"] = 0
        extra = (dice == 6 and t["consecutive_sixes"] < MAX_CONSECUTIVE_SIXES)
        t["current_turn_idx"] = _next_turn_idx(t, extra=extra)
        t["current_turn_deadline"] = time.time() + TURN_DURATION
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "dice_rolled", "seat": cp["seat"],
                                     "dice": dice, "no_move": True,
                                     "state": _public_table(t)})
        return

    token_id = _bot_choose_token(cp, dice, t["players"])
    result = await _apply_token_move(t, cp["seat"], dice, token_id)
    extra = result["extra"]

    # Advance turn
    if not extra:
        t["current_turn_idx"] = _next_turn_idx(t, extra=False)
    t["current_turn_deadline"] = time.time() + TURN_DURATION

    # Check for instant-win (all 4 home for someone)
    winner_now = None
    for pl in t["players"]:
        if all(tt["progress"] >= FINAL_HOME_PROGRESS for tt in pl["tokens"]):
            winner_now = pl
            break

    await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
    await _broadcast(table_id, {
        "type": "token_moved", "seat": cp["seat"], "dice": dice,
        "token_id": token_id, "extra": extra,
        "state": _public_table(t),
    })
    if winner_now:
        await _settle_table(table_id, "all_home")


# ---------- REST endpoints ----------
@router.get("/ludo/config")
async def ludo_config():
    return {
        "entry_fees": ENTRY_FEE_SLABS,
        "player_counts": PLAYER_COUNTS,
        "main_track_len": MAIN_TRACK_LEN,
        "home_column_len": HOME_COLUMN_LEN,
        "tokens_per_player": TOKENS_PER_PLAYER,
        "safe_squares": list(SAFE_SQUARES),
        "match_duration": MATCH_DURATION,
        "turn_duration": TURN_DURATION,
        "bot_fill_wait": BOT_FILL_WAIT,
        "commission_pct": await _get_commission_pct(),
        "player_start_pos": PLAYER_START_POS,
        "player_colors": PLAYER_COLORS,
    }


@router.get("/ludo/tables")
async def list_tables():
    cur = db.ludo_tables.find({"status": "waiting"}, {"_id": 0}).sort("created_at", -1).limit(30)
    tables = await cur.to_list(30)
    return {"tables": [_public_table(t) for t in tables]}


@router.post("/ludo/tables/create")
async def create_table(request: Request):
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
    if float(user.get("balance", 0)) < entry_fee:
        raise HTTPException(400, "बैलेंस कम है / Insufficient balance")

    existing = await db.ludo_tables.find_one({
        "status": {"$in": ["waiting", "playing"]},
        "players.user_id": user["_id"],
    })
    if existing:
        raise HTTPException(400, "आप पहले से एक टेबल में हैं / Already in a table")

    # NO immediate deduction — money is deducted only when the match starts.
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
        return {"table_id": table_id, "state": _public_table(t)}
    if len(t["players"]) >= t["max_players"]:
        raise HTTPException(400, "Table full")
    if float(user.get("balance", 0)) < t["entry_fee"]:
        raise HTTPException(400, "बैलेंस कम है / Insufficient balance")
    other = await db.ludo_tables.find_one({
        "status": {"$in": ["waiting", "playing"]},
        "players.user_id": user["_id"],
    })
    if other:
        raise HTTPException(400, "आप पहले से एक टेबल में हैं / Already in a table")

    # NO immediate deduction — money is only deducted at match start.
    seat = len(t["players"])
    t["players"].append(_make_player_slot(user, seat))
    await _log_event(t, f"{user.get('name','Player')} joined")

    if len(t["players"]) >= t["max_players"]:
        await _start_match(t)
    else:
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "player_joined", "state": _public_table(t)})
    return {"table_id": table_id, "state": _public_table(t)}


@router.post("/ludo/tables/{table_id}/leave")
async def leave_table(table_id: str, request: Request):
    """Leave the table.
      • If status='waiting' → simple leave (no refund needed as money isn't
        deducted until match start).
      • If status='playing' → user FORFEITS (counts as loss). Their tokens
        stop moving; if only one non-forfeited player remains, they win.
    """
    user = await get_current_user(request)
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")

    idx = next((i for i, p in enumerate(t["players"]) if p["user_id"] == user["_id"]), -1)
    if idx < 0:
        raise HTTPException(400, "Not in this table")

    # PLAYING → forfeit
    if t["status"] == "playing":
        t["players"][idx]["forfeited"] = True
        t["players"][idx]["forfeit_reason"] = "left_game"
        await _log_event(t, f"{t['players'][idx]['name']} left the game (forfeit)")

        # If it was their turn, advance
        if t.get("current_turn_idx") == idx:
            t["current_turn_idx"] = _next_turn_idx(t, extra=False)
            t["current_turn_deadline"] = time.time() + TURN_DURATION

        remaining = _active_players(t)
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "player_forfeited", "seat": idx,
                                     "state": _public_table(t)})
        if len(remaining) <= 1:
            await _settle_table(table_id, "forfeit_end")
        return {"status": "OK", "forfeited": True}

    # WAITING → simple leave (no refund, nothing was deducted)
    if t["status"] != "waiting":
        raise HTTPException(400, "Table not joinable")

    del t["players"][idx]
    for i, p in enumerate(t["players"]):
        p["seat"] = i
        p["color"] = PLAYER_COLORS[i]
        p["color_name"] = PLAYER_COLOR_NAMES[i]
        p["start_pos"] = PLAYER_START_POS[i]
    await _log_event(t, f"{user.get('name','Player')} left")

    if not t["players"]:
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": {"status": "cancelled", "ended_at": datetime.now(timezone.utc)}})
    else:
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "player_left", "state": _public_table(t)})
    return {"status": "OK", "forfeited": False}


@router.get("/ludo/tables/{table_id}")
async def get_table(table_id: str):
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")
    return {"state": _public_table(t)}


@router.post("/ludo/tables/{table_id}/roll")
async def roll_dice(table_id: str, request: Request):
    """Roll dice for the current player. Returns dice + list of movable tokens."""
    user = await get_current_user(request)
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")
    if t["status"] != "playing":
        raise HTTPException(400, "Match not active")
    cp = _current_player(t)
    if not cp or cp["user_id"] != user["_id"] or cp.get("is_bot"):
        raise HTTPException(400, "आपकी बारी नहीं है")
    if t.get("pending_dice"):
        raise HTTPException(400, "Already rolled — choose a token to move")

    # Manual roll — reset the auto-skip counter for this user
    cp["auto_skips"] = 0

    dice = await weighted_dice_roll(user["_id"], is_bot=False)
    movable = _movable_tokens(cp, dice)

    t["last_dice"] = {"value": dice, "roller_seat": cp["seat"], "ts": int(time.time())}

    if not movable:
        # No legal move — auto skip
        await _log_event(t, f"{cp['name']} rolled {dice} — no legal move")
        if dice == 6:
            t["consecutive_sixes"] = t.get("consecutive_sixes", 0) + 1
        else:
            t["consecutive_sixes"] = 0
        extra = (dice == 6 and t["consecutive_sixes"] < MAX_CONSECUTIVE_SIXES)
        t["current_turn_idx"] = _next_turn_idx(t, extra=extra)
        t["current_turn_deadline"] = time.time() + TURN_DURATION
        t["pending_dice"] = None
        await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
        await _broadcast(table_id, {"type": "dice_rolled", "dice": dice,
                                     "seat": cp["seat"], "no_move": True,
                                     "state": _public_table(t)})
        return {"dice": dice, "movable": [], "state": _public_table(t)}

    # Store pending dice; wait for user to pick token
    t["pending_dice"] = {"value": dice, "roller_seat": cp["seat"]}
    t["current_turn_deadline"] = time.time() + TURN_DURATION
    await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
    await _broadcast(table_id, {"type": "dice_rolled", "dice": dice,
                                 "seat": cp["seat"], "movable": movable,
                                 "state": _public_table(t)})
    return {"dice": dice, "movable": movable, "state": _public_table(t)}


@router.post("/ludo/tables/{table_id}/move")
async def move_token(table_id: str, request: Request):
    """User picks a token to move (after they rolled)."""
    user = await get_current_user(request)
    body = await request.json()
    try:
        token_id = int(body["token_id"])
    except Exception:
        raise HTTPException(400, "token_id required")
    t = await db.ludo_tables.find_one({"_id": table_id})
    if not t:
        raise HTTPException(404, "Table not found")
    if t["status"] != "playing":
        raise HTTPException(400, "Match not active")
    cp = _current_player(t)
    if not cp or cp["user_id"] != user["_id"] or cp.get("is_bot"):
        raise HTTPException(400, "आपकी बारी नहीं है")
    pending = t.get("pending_dice")
    if not pending:
        raise HTTPException(400, "Roll dice first")
    dice = pending["value"]

    movable = _movable_tokens(cp, dice)
    if token_id not in movable:
        raise HTTPException(400, "This token cannot move with that dice")

    result = await _apply_token_move(t, cp["seat"], dice, token_id)
    extra = result["extra"]

    if not extra:
        t["current_turn_idx"] = _next_turn_idx(t, extra=False)
    t["current_turn_deadline"] = time.time() + TURN_DURATION

    winner_now = None
    for pl in t["players"]:
        if all(tt["progress"] >= FINAL_HOME_PROGRESS for tt in pl["tokens"]):
            winner_now = pl
            break

    await db.ludo_tables.update_one({"_id": table_id}, {"$set": t})
    await _broadcast(table_id, {
        "type": "token_moved", "seat": cp["seat"], "dice": dice,
        "token_id": token_id, "extra": extra,
        "state": _public_table(t),
    })
    if winner_now:
        await _settle_table(table_id, "all_home")

    return {"state": _public_table(t)}


@router.get("/ludo/my-active")
async def my_active_table(request: Request):
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


# ---------- Admin ----------
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
