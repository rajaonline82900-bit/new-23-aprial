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
import random
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
GROWTH_RATE = 0.06          # multiplier(t) = e^(GROWTH_RATE * t)
HOUSE_EDGE_DIVISOR = 3      # ~33% house edge — every 3rd round is instant 1.00x.
                            # This gives P(crash >= 2x) ≈ 33% i.e. ~30% win
                            # rate for typical 2x cashout play (per user spec).
MIN_BET = 5.0               # DEFAULT — admin can override via settings.aviator.min_bet
MAX_BET = 5000.0
MAX_AUTO_CASHOUT = 1000.0
HISTORY_LIMIT = 30          # last N crash points kept for UI
ROUND_HISTORY_KEEP = 200    # last N rounds in DB


# ---------- Aviator settings (admin-configurable min_bet) ----------
async def _get_aviator_min_bet() -> float:
    s = await db.settings.find_one({"_id": "aviator"})
    if s and isinstance(s.get("min_bet"), (int, float)):
        return float(s["min_bet"])
    return MIN_BET

# ---------- In-memory round state ----------
class RoundState:
    def __init__(self):
        self.round_id: str = ""
        self.phase: str = "idle"       # "betting" | "flying" | "crashed"
        self.start_ts: float = 0.0     # epoch when current phase started
        self.crash_point: float = 1.0
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
            d["multiplier"] = round(math.exp(GROWTH_RATE * elapsed), 2)
        elif self.phase == "crashed":
            d["multiplier"] = self.crash_point
            d["crash_point"] = self.crash_point
            if reveal_seed:
                d["server_seed"] = self.server_seed
        elif self.phase == "betting":
            d["multiplier"] = 1.00
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
    h = hashlib.sha256(server_seed.encode()).hexdigest()
    h_int = int(h[:13], 16)
    if h_int % HOUSE_EDGE_DIVISOR == 0:
        return 1.00
    e = 2 ** 52
    # bustabit formula  →  max(1.00, (100e - h)/(e - h) / 100)
    val = (100 * e - h_int) / (e - h_int) / 100
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

            crash_time = math.log(_state.crash_point) / GROWTH_RATE if _state.crash_point > 1.0 else 0.0

            elapsed = 0.0
            while elapsed < crash_time:
                await asyncio.sleep(TICK_INTERVAL)
                elapsed = time.time() - _state.start_ts
                if elapsed >= crash_time:
                    break
                current = round(math.exp(GROWTH_RATE * elapsed), 2)
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
    MAX_FLYING = (math.log(99) / GROWTH_RATE) + 20.0  # ~96s
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
    - tab="all":      current round's active bets (live) + fake activity
    - tab="previous": last completed round's settled bets + fake activity
    - tab="top":      highest-won bets across recent rounds + fake big wins
    Real user names are masked (e.g. 'd***9') for privacy; fake bets use
    realistic Indian first names so the feed always looks active.
    """
    def _mask(name: str) -> str:
        if not name:
            return "p****r"
        n = name.strip().split(" ")[0]
        if len(n) <= 2:
            return n[0] + "****"
        return f"{n[0].lower()}***{n[-1].lower()}"

    # ---- Fake bet generators (Indian first-name pool + realistic amounts) ----
    _FAKE_NAMES = [
        "Rohit", "Priya", "Vikram", "Sneha", "Amit", "Kavya", "Rahul", "Anjali",
        "Karan", "Divya", "Suresh", "Meena", "Arjun", "Pooja", "Manoj", "Ritu",
        "Nikhil", "Shreya", "Deepak", "Aakash", "Neha", "Sanjay", "Isha",
        "Ravi", "Jyoti", "Preeti", "Harsh", "Ajay", "Nitin", "Pallavi",
        "Vishnu", "Shalini", "Sonia", "Kunal", "Simran", "Rakesh", "Farah",
        "Yogesh", "Bhavna", "Ashish", "Tanvi", "Gaurav", "Poonam",
    ]
    def _fake_amt():
        # Weighted toward small/mid amounts (realistic distribution)
        return random.choices(
            [50, 100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000],
            weights=[18, 22, 14, 10, 10, 10, 6, 5, 3, 2],
            k=1,
        )[0]

    def _fake_all_bets(n: int):
        """Fake bets during OPEN/betting phase — no multiplier yet OR
        already cashed out mid-flight."""
        out = []
        for _ in range(n):
            amt = _fake_amt()
            # 45% still active, 55% already cashed out
            if random.random() < 0.45:
                out.append({
                    "name": random.choice(_FAKE_NAMES),
                    "amount": amt,
                    "multiplier": None,
                    "won": None,
                })
            else:
                mult = round(random.uniform(1.10, 4.50), 2)
                out.append({
                    "name": random.choice(_FAKE_NAMES),
                    "amount": amt,
                    "multiplier": mult,
                    "won": round(amt * mult, 2),
                })
        return out

    def _fake_prev_bets(n: int):
        """Historical bets — mix of won/lost. Crash was at some point."""
        out = []
        for _ in range(n):
            amt = _fake_amt()
            if random.random() < 0.5:
                mult = round(random.uniform(1.15, 6.00), 2)
                out.append({
                    "name": random.choice(_FAKE_NAMES),
                    "amount": amt,
                    "multiplier": mult,
                    "won": round(amt * mult, 2),
                })
            else:
                out.append({
                    "name": random.choice(_FAKE_NAMES),
                    "amount": amt,
                    "multiplier": None,   # crashed before cashout
                    "won": None,
                })
        return out

    def _fake_top_bets(n: int):
        """Top winners — high multipliers, decent amounts."""
        out = []
        for _ in range(n):
            amt = random.choices([100, 500, 1000, 2000, 3000, 5000],
                                 weights=[10, 22, 25, 20, 15, 8], k=1)[0]
            mult = round(random.uniform(2.50, 25.00), 2)
            out.append({
                "name": random.choice(_FAKE_NAMES),
                "amount": amt,
                "multiplier": mult,
                "won": round(amt * mult, 2),
            })
        return out

    if tab == "all":
        items = []
        for uid, b in _state.bets.items():
            items.append({
                "name": _mask(b.get("name", "Player")),
                "amount": b["amount"],
                "multiplier": b.get("cashed_out_at"),
                "won": round(b["amount"] * b["cashed_out_at"], 2) if b.get("cashed_out_at") else None,
            })
        # Mix in ~18 fake bets so the feed always looks active
        items.extend(_fake_all_bets(18))
        items.sort(key=lambda x: x["amount"], reverse=True)
        return {"bets": items[:limit], "phase": _state.phase}

    if tab == "previous":
        # last completed round
        last = await db.aviator_rounds.find_one({}, sort=[("created_at", -1)])
        bets = []
        if last:
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
        out.extend(_fake_prev_bets(18))
        out.sort(key=lambda x: x["amount"], reverse=True)
        return {"bets": out[:limit], "crash_point": (last or {}).get("crash_point")}

    # tab == "top": highest wins across recent bets + fake big wins
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
    out.extend(_fake_top_bets(14))
    out.sort(key=lambda x: x.get("won") or 0, reverse=True)
    return {"bets": out[:limit]}

@router.post("/aviator/bet")
async def place_bet(request: Request):
    from routes.game_toggles import assert_game_enabled
    await assert_game_enabled("aviator")
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

    min_bet = await _get_aviator_min_bet()
    if amount < min_bet or amount > MAX_BET:
        raise HTTPException(400, f"Bet must be between ₹{int(min_bet)} and ₹{int(MAX_BET)}")

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
    current = round(math.exp(GROWTH_RATE * elapsed), 2)
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



# ---------- Aviator settings endpoints ----------
@router.get("/aviator/settings")
async def aviator_public_settings():
    """Public config — used by frontend to display current min bet."""
    return {
        "min_bet": await _get_aviator_min_bet(),
        "max_bet": MAX_BET,
        "max_auto_cashout": MAX_AUTO_CASHOUT,
    }


@router.get("/admin/aviator/settings")
async def admin_aviator_settings(request: Request):
    from auth import get_admin_user
    await get_admin_user(request)
    return {
        "min_bet": await _get_aviator_min_bet(),
        "max_bet": MAX_BET,
        "default_min_bet": MIN_BET,
    }


@router.post("/admin/aviator/settings")
async def admin_aviator_settings_update(request: Request):
    from auth import get_admin_user
    from datetime import datetime as _dt
    from datetime import timezone as _tz
    await get_admin_user(request)
    body = await request.json()
    try:
        min_bet = float(body["min_bet"])
    except Exception:
        raise HTTPException(400, "min_bet is required")
    if min_bet < 1 or min_bet > MAX_BET:
        raise HTTPException(400, f"min_bet must be between 1 and {int(MAX_BET)}")
    await db.settings.update_one(
        {"_id": "aviator"},
        {"$set": {"min_bet": min_bet, "updated_at": _dt.now(_tz.utc)}},
        upsert=True,
    )
    return {"status": "OK", "min_bet": min_bet}
