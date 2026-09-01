"""Color Prediction — Red/White/Orange, all pay 3x.

Mechanics:
- Round = 30 s (25 s betting + 5 s reveal)
- Wheel picks ONE color: red | white | orange
- Payout: 3x for any winning bet
- House-edge tuning: ~30% biased rounds skew result AWAY from majority-bet color
"""
import asyncio
import random
import time
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from database import db
from auth import get_current_user

router = APIRouter()

BET_SIDES = {'red', 'white', 'orange'}
PAYOUTS = {'red': 3, 'white': 3, 'orange': 3}

ROUND_TOTAL = 30
BET_WINDOW = 25
_HOUSE_EDGE = 0.30
_current_round_cache = {}


class ColorBet(BaseModel):
    side: str  # red | white | orange
    amount: float = Field(gt=0)


async def _get_config():
    doc = await db.color_game_config.find_one({'_id': 'config'})
    if not doc:
        doc = {'_id': 'config', 'min_bet': 20, 'enabled': True}
        await db.color_game_config.insert_one(doc)
    return doc


async def _pick_result(round_id: str):
    """Pick a color. With `_HOUSE_EDGE` probability, bias AWAY from majority-bet color."""
    cursor = db.color_game_bets.find({'round_id': round_id})
    totals = {'red': 0.0, 'white': 0.0, 'orange': 0.0}
    async for b in cursor:
        s = b.get('side')
        if s in totals:
            totals[s] += float(b.get('amount', 0))

    colors = ['red', 'white', 'orange']
    if random.random() < _HOUSE_EDGE and any(totals.values()):
        majority = max(totals, key=lambda k: totals[k])
        candidates = [c for c in colors if c != majority]
        color = random.choice(candidates)
    else:
        color = random.choice(colors)
    return color


@router.get('/color-game/config')
async def get_config():
    return await _get_config()


@router.get('/color-game/current')
async def get_current():
    now = time.time()
    cache = _current_round_cache.get('round')
    if cache and cache['ends_at'] > now:
        remaining = int(cache['ends_at'] - now)
        phase = 'betting' if remaining > (ROUND_TOTAL - BET_WINDOW) else 'reveal'
        return {
            'round_id': cache['round_id'],
            'phase': phase,
            'remaining': remaining,
            'ends_at': cache['ends_at'],
        }
    return {'round_id': None, 'phase': 'waiting', 'remaining': 0, 'ends_at': None}


@router.post('/color-game/bet')
async def place_bet(bet: ColorBet, request: Request):
    user = await get_current_user(request)
    if bet.side not in BET_SIDES:
        raise HTTPException(400, 'invalid side')
    cfg = await _get_config()
    if not cfg.get('enabled', True):
        raise HTTPException(400, 'game disabled')
    if bet.amount < cfg.get('min_bet', 50):
        raise HTTPException(400, f'min bet ₹{cfg.get("min_bet", 50)}')
    now = time.time()
    cache = _current_round_cache.get('round')
    if not cache or cache['ends_at'] <= now:
        raise HTTPException(400, 'no active round')
    remaining = cache['ends_at'] - now
    if remaining <= (ROUND_TOTAL - BET_WINDOW):
        raise HTTPException(400, 'betting closed')
    user_doc = await db.users.find_one({'_id': ObjectId(user['_id'])})
    if not user_doc or user_doc.get('balance', 0) < bet.amount:
        raise HTTPException(400, 'insufficient balance')
    await db.users.update_one({'_id': ObjectId(user['_id'])}, {'$inc': {'balance': -bet.amount}})
    # Atomic aggregation upsert: same user + round + side → single ticket.
    bet_id = secrets.token_hex(6)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.color_game_bets.update_one(
        {'round_id': cache['round_id'], 'user_id': user['_id'], 'side': bet.side},
        {
            '$inc': {'amount': bet.amount, 'bet_count': 1},
            '$setOnInsert': {
                'bet_id': bet_id,
                'user_phone': user_doc.get('phone', ''),
                'user_name': user_doc.get('name', 'Player'),
                'status': 'pending',
                'created_at': now_iso,
            },
        },
        upsert=True,
    )
    doc = await db.color_game_bets.find_one(
        {'round_id': cache['round_id'], 'user_id': user['_id'], 'side': bet.side},
        {'bet_id': 1}
    )
    return {'ok': True, 'bet_id': doc.get('bet_id') if doc else bet_id}


@router.get('/color-game/history')
async def my_history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    cursor = db.color_game_bets.find({'user_id': user['_id']}).sort('created_at', -1).limit(limit)
    bets = []
    async for b in cursor:
        b['_id'] = str(b.get('_id', ''))
        bets.append(b)
    return {'bets': bets}


@router.get('/color-game/recent-rounds')
async def recent_rounds(limit: int = 10):
    cursor = db.color_game_rounds.find({'color': {'$exists': True}}).sort('created_at', -1).limit(limit)
    rounds = []
    async for r in cursor:
        r['_id'] = str(r.get('_id', ''))
        rounds.append(r)
    return {'rounds': rounds}


FAKE_NAMES_CG = [
    "Rohit", "Priya", "Vikram", "Sneha", "Amit", "Kavya", "Rahul", "Anjali",
    "Karan", "Divya", "Suresh", "Meena", "Arjun", "Pooja", "Manoj", "Ritu",
    "Sanjay", "Neha", "Rajesh", "Isha", "Deepak", "Nisha", "Aakash", "Sonia",
    "Nitin", "Preeti", "Harsh", "Shalini", "Ravi", "Anita",
]
FAKE_AMOUNTS_CG = [20, 50, 100, 200, 500, 1000]


@router.get('/color-game/live-feed')
async def live_feed(limit: int = 12):
    real = []
    cursor = db.color_game_bets.find({}).sort('created_at', -1).limit(limit)
    async for b in cursor:
        _n = b.get('user_name') or 'Player'
        real.append({'name': _n[:3] + '***' if len(_n) > 3 else _n, 'side': b.get('side'), 'amount': b.get('amount'), 'fake': False})
    fake_count = max(0, limit - len(real))
    fake = [{
        'name': random.choice(FAKE_NAMES_CG),
        'side': random.choice(['red', 'white', 'orange']),
        'amount': random.choice(FAKE_AMOUNTS_CG),
        'fake': True,
    } for _ in range(fake_count)]
    combined = real + fake
    random.shuffle(combined)
    return {'feed': combined[:limit]}


async def _settle_round(round_id: str, color: str):
    cursor = db.color_game_bets.find({'round_id': round_id, 'status': 'pending'})
    async for b in cursor:
        won = b.get('side') == color
        payout = float(b['amount']) * PAYOUTS.get(b.get('side'), 0) if won else 0
        if won and payout > 0:
            await db.users.update_one({'_id': ObjectId(b['user_id'])}, {'$inc': {'balance': payout}})
        await db.color_game_bets.update_one(
            {'_id': b['_id']},
            {'$set': {
                'status': 'won' if won else 'lost',
                'color': color,
                'payout': payout,
                'settled_at': datetime.now(timezone.utc).isoformat(),
            }}
        )


async def color_game_round_loop():
    """Continuous 30s rounds — betting 25s + reveal 5s."""
    while True:
        try:
            round_id = secrets.token_hex(8)
            ends_at = time.time() + ROUND_TOTAL
            _current_round_cache['round'] = {'round_id': round_id, 'ends_at': ends_at}
            await db.color_game_rounds.insert_one({
                'round_id': round_id,
                'phase': 'betting',
                'created_at': datetime.now(timezone.utc).isoformat(),
            })
            await asyncio.sleep(BET_WINDOW)
            color = await _pick_result(round_id)
            await db.color_game_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'reveal', 'color': color}}
            )
            await asyncio.sleep(ROUND_TOTAL - BET_WINDOW - 1)
            await _settle_round(round_id, color)
            await db.color_game_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'ended', 'settled_at': datetime.now(timezone.utc).isoformat()}}
            )
            await asyncio.sleep(1)
        except Exception:
            await asyncio.sleep(2)
