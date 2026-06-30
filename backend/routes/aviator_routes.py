"""Aviator (in-house crash game) — Spribe-style real-time multiplier game.

Round lifecycle:
  1. betting   (8s)  — users place bets, no multiplier yet
  2. flying    (var) — multiplier grows from 1.00x; crashes at random point
  3. crashed   (3s)  — show final crash, auto-loses, pause
Then a new round begins.

Provably fair:
  - Server creates a random `server_seed` at the start of each round.
  - SHA-256 hash of `server_seed` is broadcast BEFORE the round (commit).
  - Crash point is derived deterministically from `server_seed`.
  - After the round, the raw `server_seed` is revealed so players can verify
    that `crash_point == bustabit(server_seed)` and `hash(seed) == committed`.
"""
import asyncio
import hashlib
import math
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from bson import ObjectId

from database import db
from auth import get_current_user

router = APIRouter()

# ---------- Config ----------
BETTING_DURATION = 10.0     # seconds — betting phase
CRASH_PAUSE = 3.0           # seconds shown after crash
TICK_INTERVAL = 0.2          # broadcast WS ticks every 200ms — perf-friendly
                             # on low-end Android WebView (was 100ms, caused
                             # excessive React re-renders & jank).
GROWTH_RATE = 0.06          # multiplier(t) = e^(GROWTH_RATE * t) - 1
                             # Multiplier starts at 0.00x at takeoff and grows.
                             # At t=0:  e^0 - 1 = 0
                             # At t≈12s: ~1.0 (break-even)
                             # At t≈30s: ~5.0
INSTANT_CRASH_PROBABILITY = 0.30  # 30% rounds crash before reaching 1.0x —
                                  # i.e. plane explodes early in 0.00x → 1.00x
                                  # range, all bets lose unless cashed below 1.
HOUSE_EDGE_DIVISOR = 3      # legacy — kept for unused code path; new instant-
                            # crash uses INSTANT_CRASH_PROBABILITY directly.
MIN_BET = 5.0
MAX_BET = 5000.0
MAX_AUTO_CASHOUT = 1000.0
HISTORY_LIMIT = 30          # last N crash points kept for UI
ROUND_HISTORY_KEEP = 200    # last N rounds in DB

# ---------- In-memory round state ----------
class RoundState:
    def __init__(self):
        self.round_id: str = ""
        self.phase: str = "idle"       # "betting" | "flying" | "crashed"
        self.start_ts: float = 0.0     # epoch when current phase started
        self.crash_point: float = 0.0
        self.server_seed: str = ""
        self.seed_hash: str = ""
        # Active bets in current round: { user_id: {amount, auto_cashout, cashed_out_at, won} }
        self.bets: Dict[str, dict] = {}

    def to_public(self, reveal_seed: bool = False) -> dict:
        now = time.time()
        elapsed = max(0.0, now - self.start_ts)
        d = {
            "round_id": self.round_id,
            "phase": self.phase,
            "elapsed": round(elapsed, 2),
            "seed_hash": self.seed_hash,
            "betting_duration": BETTING_DURATION,
        }
        if self.phase == "flying":
            d["multiplier"] = round(max(0.0, math.exp(GROWTH_RATE * elapsed) - 1.0), 2)
        elif self.phase == "crashed":
            d["multiplier"] = self.crash_point
            d["crash_point"] = self.crash_point
            if reveal_seed:
                d["server_seed"] = self.server_seed
        elif self.phase == "betting":
            d["multiplier"] = 0.00
            d["betting_remaining"] = round(max(0.0, BETTING_DURATION - elapsed), 2)
        return d


_state = RoundState()

# ---------- WebSocket connections ----------
_clients: Set[WebSocket] = set()
_clients_lock = asyncio.Lock()

async def _send_one(ws: WebSocket, payload: dict) -> Optional[WebSocket]:
    """Send to a single ws with a hard timeout. Returns ws if it should be removed, else None."""
    try:
        await asyncio.wait_for(ws.send_json(payload), timeout=2.0)
        return None
    except Exception:
        return ws

async def _broadcast(payload: dict):
    """Send payload to all connected ws clients in parallel.
    A slow/dead client must NEVER block the round loop — each send has a 2s
    timeout and runs concurrently via asyncio.gather. Dead clients are pruned
    after the broadcast completes.
    """
    if not _clients:
        return
    async with _clients_lock:
        ws_list = list(_clients)
    if not ws_list:
        return
    results = await asyncio.gather(
        *[_send_one(ws, payload) for ws in ws_list],
        return_exceptions=True,
    )
    dead = [r for r in results if isinstance(r, WebSocket)]
    if dead:
        async with _clients_lock:
            for ws in dead:
                _clients.discard(ws)

# ---------- Crash point (bustabit-style) ----------
def _gen_crash(server_seed: str) -> float:
    """Generates the crash point for a round. Returns a value in [0.00, ~99.0].

    New behaviour (per user spec):
      * Multiplier starts at 0.00x at takeoff (formula: e^(rt) - 1).
      * 30% of rounds crash BEFORE reaching 1.0x (i.e. crash_point in
        [0.00, 1.00)) — these are the "instant crash" early-explode rounds
        where players who waited too long get nothing.
      * 70% of rounds crash AT or ABOVE 1.0x, following a heavy-tailed
        distribution similar to bustabit, so big-multiplier rounds occur.
    """
    h = hashlib.sha256(server_seed.encode()).hexdigest()
    # Bucket A: instant-crash decision (deterministic, provably-fair)
    bucket = int(h[:8], 16) / 0xFFFFFFFF  # uniform in [0, 1]
    if bucket < INSTANT_CRASH_PROBABILITY:
        # Crash anywhere in [0.00, 1.00). Skewed toward lower values so most
        # instant-crashes are visibly early (0.05x – 0.7x).
        early_seed = int(h[8:16], 16) / 0xFFFFFFFF
        early = early_seed ** 1.6  # bias toward 0
        return round(early * 0.99, 2)  # never exactly 1.00 in this branch
    # Bucket B: normal flight — crash point in [1.00, ~99.0]
    h_int = int(h[16:29], 16)
    e = 2 ** 52
    val = (100 * e - h_int) / (e - h_int) / 100  # bustabit formula
    return max(1.00, round(val, 2))

# ---------- Round loop ----------
async def _settle_round():
    """Mark all non-cashed-out bets as lost; persist round + bets to DB."""
    crash = _state.crash_point
    rid = _state.round_id
    docs = []
    for uid, b in _state.bets.items():
        if b.get("cashed_out_at"):
            mult = b["cashed_out_at"]
            won = round(b["amount"] * mult, 2)
            # Credit winnings (originally debited at bet-time)
            await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"balance": won}})
            docs.append({
                "id": str(uuid.uuid4()),
                "round_id": rid,
                "user_id": uid,
                "amount": b["amount"],
                "cashout_multiplier": mult,
                "won_amount": won,
                "status": "won",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            docs.append({
                "id": str(uuid.uuid4()),
                "round_id": rid,
                "user_id": uid,
                "amount": b["amount"],
                "cashout_multiplier": None,
                "won_amount": 0,
                "status": "lost",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    if docs:
        await db.aviator_bets.insert_many(docs)

    # Persist round summary
    await db.aviator_rounds.insert_one({
        "round_id": rid,
        "crash_point": crash,
        "server_seed": _state.server_seed,
        "seed_hash": _state.seed_hash,
        "total_bets": len(_state.bets),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Trim history collection to keep DB lean
    cnt = await db.aviator_rounds.count_documents({})
    if cnt > ROUND_HISTORY_KEEP * 2:
        # delete oldest beyond keep size
        cursor = db.aviator_rounds.find({}, {"_id": 1}).sort("created_at", -1).skip(ROUND_HISTORY_KEEP)
        ids = [d["_id"] async for d in cursor]
        if ids:
            await db.aviator_rounds.delete_many({"_id": {"$in": ids}})

async def aviator_round_loop():
    """Background task — runs forever, managing rounds."""
    await asyncio.sleep(2)  # let server warm up
    while True:
        try:
            # 1. Initialize a new round
            _state.round_id = str(uuid.uuid4())
            _state.server_seed = secrets.token_hex(32)
            _state.seed_hash = hashlib.sha256(_state.server_seed.encode()).hexdigest()
            _state.crash_point = _gen_crash(_state.server_seed)
            _state.bets = {}
            _state.phase = "betting"
            _state.start_ts = time.time()

            await _broadcast({"type": "round_start", "state": _state.to_public()})

            # Wait through betting phase
            await asyncio.sleep(BETTING_DURATION)

            # 2. Flying phase
            _state.phase = "flying"
            _state.start_ts = time.time()
            await _broadcast({"type": "flying_start", "state": _state.to_public()})

            crash_time = math.log(_state.crash_point + 1.0) / GROWTH_RATE

            elapsed = 0.0
            while elapsed < crash_time:
                await asyncio.sleep(TICK_INTERVAL)
                elapsed = time.time() - _state.start_ts
                if elapsed >= crash_time:
                    break
                current = round(max(0.0, math.exp(GROWTH_RATE * elapsed) - 1.0), 2)
                # Process auto-cashouts
                for uid, b in list(_state.bets.items()):
                    if (not b.get("cashed_out_at")) and b.get("auto_cashout") and current >= b["auto_cashout"]:
                        b["cashed_out_at"] = b["auto_cashout"]
                        await _broadcast({
                            "type": "cashout",
                            "user_id": uid,
                            "name": b.get("name", "Player"),
                            "amount": b["amount"],
                            "multiplier": b["auto_cashout"],
                            "won": round(b["amount"] * b["auto_cashout"], 2),
                        })
                await _broadcast({"type": "tick", "multiplier": current})

            # 3. Crashed
            _state.phase = "crashed"
            _state.start_ts = time.time()
            await _broadcast({"type": "crash", "crash_point": _state.crash_point, "server_seed": _state.server_seed})

            await _settle_round()

            await asyncio.sleep(CRASH_PAUSE)
        except Exception as e:
            # Don't let one bad round kill the loop forever
            import logging
            logging.getLogger(__name__).exception(f"aviator round loop error: {e}")
            await asyncio.sleep(2)


async def aviator_watchdog():
    """Safety net: detects if the round loop is stuck in any phase for too
    long (e.g. due to an unexpected hang) and forcibly resets state so the
    main loop can recover. Runs every 5 seconds.

    Maximum phase durations (with grace buffer):
      betting → BETTING_DURATION + 15s
      flying  → log(99)/GROWTH_RATE + 20s (cap covers >99x crashes)
      crashed → CRASH_PAUSE + 10s
    """
    import logging
    logger = logging.getLogger(__name__)
    await asyncio.sleep(10)  # let the main loop establish state first
    MAX_BETTING = BETTING_DURATION + 15.0
    MAX_FLYING = (math.log(100.0) / GROWTH_RATE) + 20.0  # ~97s (handles ≤99x crash)
    MAX_CRASHED = CRASH_PAUSE + 10.0
    while True:
        try:
            await asyncio.sleep(5)
            if _state.phase == "idle":
                continue
            elapsed = time.time() - _state.start_ts
            stuck = False
            if _state.phase == "betting" and elapsed > MAX_BETTING:
                stuck = True
            elif _state.phase == "flying" and elapsed > MAX_FLYING:
                stuck = True
            elif _state.phase == "crashed" and elapsed > MAX_CRASHED:
                stuck = True
            if stuck:
                logger.warning(
                    f"aviator_watchdog: phase={_state.phase} stuck for {elapsed:.1f}s — forcing crash + reset"
                )
                # Force a clean transition through crashed → next round.
                # We just settle whatever we have and let the main loop pick
                # up the next round on its own cycle.
                try:
                    if _state.phase != "crashed":
                        _state.phase = "crashed"
                        _state.start_ts = time.time()
                        await _broadcast({
                            "type": "crash",
                            "crash_point": _state.crash_point,
                            "server_seed": _state.server_seed,
                        })
                        try:
                            await _settle_round()
                        except Exception as se:
                            logger.exception(f"watchdog settle error: {se}")
                except Exception as we:
                    logger.exception(f"watchdog recovery error: {we}")
        except Exception as outer:
            logger.exception(f"watchdog outer error: {outer}")
            await asyncio.sleep(5)


# ---------- REST endpoints ----------
@router.get("/aviator/state")
async def get_state():
    """Snapshot of current round + recent history."""
    history_cursor = db.aviator_rounds.find({}, {"_id": 0, "round_id": 1, "crash_point": 1}).sort("created_at", -1).limit(HISTORY_LIMIT)
    history = await history_cursor.to_list(HISTORY_LIMIT)
    return {
        "state": _state.to_public(reveal_seed=(_state.phase == "crashed")),
        "history": history,
    }

@router.get("/aviator/active-bets")
async def active_bets():
    """List of all bets in the current round (for live bets panel)."""
    out = []
    for uid, b in _state.bets.items():
        out.append({
            "name": b.get("name", "Player"),
            "amount": b["amount"],
            "cashed_out_at": b.get("cashed_out_at"),
            "won": round(b["amount"] * b["cashed_out_at"], 2) if b.get("cashed_out_at") else None,
        })
    return {"bets": out, "phase": _state.phase}


@router.get("/aviator/community-bets")
async def community_bets(tab: str = "all", limit: int = 30):
    """Community feed for the bottom panel.
    - tab="all":      current round's active bets (live)
    - tab="previous": last completed round's settled bets
    - tab="top":      highest-won bets across recent rounds
    Returns masked names (e.g. 'd***9') for privacy.
    """
    def _mask(name: str) -> str:
        if not name:
            return "p****r"
        n = name.strip().split(" ")[0]
        if len(n) <= 2:
            return n[0] + "****"
        return f"{n[0].lower()}***{n[-1].lower()}"

    if tab == "all":
        items = []
        for uid, b in _state.bets.items():
            items.append({
                "name": _mask(b.get("name", "Player")),
                "amount": b["amount"],
                "multiplier": b.get("cashed_out_at"),
                "won": round(b["amount"] * b["cashed_out_at"], 2) if b.get("cashed_out_at") else None,
            })
        # sort by bet amount desc
        items.sort(key=lambda x: x["amount"], reverse=True)
        return {"bets": items[:limit], "phase": _state.phase}

    if tab == "previous":
        # last completed round
        last = await db.aviator_rounds.find_one({}, sort=[("created_at", -1)])
        if not last:
            return {"bets": []}
        bets_cur = db.aviator_bets.find(
            {"round_id": last["round_id"]},
            {"_id": 0, "user_id": 1, "amount": 1, "cashout_multiplier": 1, "won_amount": 1, "status": 1}
        ).sort("amount", -1).limit(limit)
        bets = await bets_cur.to_list(limit)
        # join names
        user_ids = list({b["user_id"] for b in bets if b.get("user_id")})
        valid = [ObjectId(u) for u in user_ids]
        users = await db.users.find({"_id": {"$in": valid}}, {"name": 1}).to_list(len(valid))
        umap = {str(u["_id"]): u.get("name", "Player") for u in users}
        out = [{
            "name": _mask(umap.get(b["user_id"], "Player")),
            "amount": b["amount"],
            "multiplier": b.get("cashout_multiplier"),
            "won": b.get("won_amount") if b.get("status") == "won" else None,
        } for b in bets]
        return {"bets": out, "crash_point": last.get("crash_point")}

    # tab == "top": highest wins across recent bets
    cur = db.aviator_bets.find(
        {"status": "won"},
        {"_id": 0, "user_id": 1, "amount": 1, "cashout_multiplier": 1, "won_amount": 1}
    ).sort("won_amount", -1).limit(limit)
    bets = await cur.to_list(limit)
    user_ids = list({b["user_id"] for b in bets if b.get("user_id")})
    valid = [ObjectId(u) for u in user_ids]
    users = await db.users.find({"_id": {"$in": valid}}, {"name": 1}).to_list(len(valid))
    umap = {str(u["_id"]): u.get("name", "Player") for u in users}
    out = [{
        "name": _mask(umap.get(b["user_id"], "Player")),
        "amount": b["amount"],
        "multiplier": b.get("cashout_multiplier"),
        "won": b.get("won_amount"),
    } for b in bets]
    return {"bets": out}

@router.post("/aviator/bet")
async def place_bet(request: Request):
    user = await get_current_user(request)
    if _state.phase != "betting":
        raise HTTPException(400, "Betting phase is over for this round. Wait for next.")

    body = await request.json()
    try:
        amount = float(body.get("amount", 0))
    except Exception:
        raise HTTPException(400, "Invalid amount")
    auto_co = body.get("auto_cashout")
    if auto_co is not None:
        try:
            auto_co = float(auto_co)
            if auto_co < 1.01 or auto_co > MAX_AUTO_CASHOUT:
                raise ValueError
        except Exception:
            raise HTTPException(400, "auto_cashout must be between 1.01 and 1000")

    if amount < MIN_BET or amount > MAX_BET:
        raise HTTPException(400, f"Bet must be between ₹{int(MIN_BET)} and ₹{int(MAX_BET)}")

    uid = user["_id"]
    if uid in _state.bets:
        raise HTTPException(400, "You already have a bet in this round")
    if user.get("balance", 0) < amount:
        raise HTTPException(400, "Insufficient balance")

    # Debit balance
    await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"balance": -amount}})

    _state.bets[uid] = {
        "amount": amount,
        "auto_cashout": auto_co,
        "cashed_out_at": None,
        "name": user.get("name", "Player").split(" ")[0],
    }
    new_balance = user.get("balance", 0) - amount
    await _broadcast({
        "type": "new_bet",
        "name": _state.bets[uid]["name"],
        "amount": amount,
    })
    return {"status": "OK", "round_id": _state.round_id, "balance": new_balance}

@router.post("/aviator/cashout")
async def cashout(request: Request):
    user = await get_current_user(request)
    if _state.phase != "flying":
        raise HTTPException(400, "Not flying — cannot cash out")
    uid = user["_id"]
    b = _state.bets.get(uid)
    if not b:
        raise HTTPException(400, "No active bet")
    if b.get("cashed_out_at"):
        raise HTTPException(400, "Already cashed out")

    elapsed = time.time() - _state.start_ts
    current = round(max(0.0, math.exp(GROWTH_RATE * elapsed) - 1.0), 2)
    # Safety: never above crash point
    if current >= _state.crash_point:
        raise HTTPException(400, "Too late — already crashed")

    b["cashed_out_at"] = current
    won = round(b["amount"] * current, 2)
    await _broadcast({
        "type": "cashout",
        "user_id": uid,
        "name": b.get("name", "Player"),
        "amount": b["amount"],
        "multiplier": current,
        "won": won,
    })
    return {"status": "OK", "multiplier": current, "won": won}

@router.get("/aviator/my-bets")
async def my_bets(request: Request, limit: int = 20):
    user = await get_current_user(request)
    cursor = db.aviator_bets.find(
        {"user_id": user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    bets = await cursor.to_list(limit)
    return {"bets": bets}

# ---------- WebSocket endpoint ----------
@router.websocket("/aviator/ws")
async def aviator_ws(ws: WebSocket):
    await ws.accept()
    async with _clients_lock:
        _clients.add(ws)
    # Send current state on connect
    try:
        await ws.send_json({"type": "snapshot", "state": _state.to_public(reveal_seed=(_state.phase == "crashed"))})
    except Exception:
        async with _clients_lock:
            _clients.discard(ws)
        return
    # Receive loop — ONLY receive here. All sends happen from the round loop
    # via _broadcast(). Sending from two coroutines on the same WS would race
    # and could deadlock the round loop. Frequent broadcasts (every 200ms when
    # flying, plus round_start/flying_start/crash) keep the connection warm.
    try:
        while True:
            try:
                await ws.receive_text()
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        async with _clients_lock:
            _clients.discard(ws)
