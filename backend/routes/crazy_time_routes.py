"""Crazy Time — Evolution-style money wheel.

Mechanics:
- Round = 30 s (25 s betting + 5 s reveal)
- Wheel has 8 segments with weighted probability (house edge)
- Bets: '1', '2', '5', '10', 'coin_flip', 'cash_hunt', 'pachinko', 'crazy_time'
- Payouts (total return, includes stake): 2x, 3x, 6x, 11x, 10x, 20x, 40x, 45x
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

# Segment name -> (weight, payout multiplier)
# Wheel has 10 equal segments (numbers 1-10). Payout = 10x for any winner.
# House edge is baked in via a ~20% biased-pick step in _pick_result (picks the LEAST-bet
# number that round) so on average the house keeps ~20% over infinite play.
SEGMENTS = {str(n): (1, 10) for n in range(1, 11)}
SEG_NAMES = list(SEGMENTS.keys())
SEG_WEIGHTS = [SEGMENTS[k][0] for k in SEG_NAMES]

ROUND_TOTAL = 30
BET_WINDOW = 25
_HOUSE_EDGE = 0.20   # 20% of rounds bias against majority bet
_current_round_cache = {}


class CTBet(BaseModel):
    segment: str
    amount: float = Field(gt=0)


async def _get_config():
    doc = await db.crazy_time_config.find_one({'_id': 'config'})
    if not doc:
        doc = {'_id': 'config', 'min_bet': 20, 'enabled': True}
        await db.crazy_time_config.insert_one(doc)
    return doc


async def _pick_result(round_id: str):
    """Uniform random, but 20% of rounds pick the LEAST-bet number (house edge)."""
    if random.random() < _HOUSE_EDGE:
        totals = {k: 0.0 for k in SEG_NAMES}
        cursor = db.crazy_time_bets.find({'round_id': round_id})
        async for b in cursor:
            s = b.get('segment')
            if s in totals:
                totals[s] += float(b.get('amount', 0))
        if any(v > 0 for v in totals.values()):
            # Return the least-bet segment (or a random tie-breaker among those tied at 0)
            min_val = min(totals.values())
            candidates = [k for k, v in totals.items() if v == min_val]
            return random.choice(candidates)
    return random.choice(SEG_NAMES)


@router.get('/crazy-time/config')
async def get_config():
    seg_info = [{'name': k, 'payout': v[1]} for k, v in SEGMENTS.items()]
    cfg = await _get_config()
    return {**cfg, 'segments': seg_info}


@router.get('/crazy-time/current')
async def get_current():
    now = time.time()
    cache = _current_round_cache.get('round')
    if cache and cache['ends_at'] > now:
        remaining = int(cache['ends_at'] - now)
        phase = 'betting' if remaining > (ROUND_TOTAL - BET_WINDOW) else 'reveal'
        return {'round_id': cache['round_id'], 'phase': phase, 'remaining': remaining, 'ends_at': cache['ends_at']}
    return {'round_id': None, 'phase': 'waiting', 'remaining': 0, 'ends_at': None}


@router.post('/crazy-time/bet')
async def place_bet(bet: CTBet, request: Request):
    user = await get_current_user(request)
    if bet.segment not in SEGMENTS:
        raise HTTPException(400, 'invalid segment')
    cfg = await _get_config()
    if not cfg.get('enabled', True):
        raise HTTPException(400, 'game disabled')
    if bet.amount < cfg.get('min_bet', 20):
        raise HTTPException(400, f'min bet ₹{cfg.get("min_bet", 20)}')
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
    # Atomic aggregation upsert: same user + round + segment → single ticket.
    bet_id = secrets.token_hex(6)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.crazy_time_bets.update_one(
        {'round_id': cache['round_id'], 'user_id': user['_id'], 'segment': bet.segment},
        {
            '$inc': {'amount': bet.amount, 'bet_count': 1},
            '$setOnInsert': {
                'bet_id': bet_id,
                'user_name': user_doc.get('name', 'Player'),
                'status': 'pending',
                'created_at': now_iso,
            },
        },
        upsert=True,
    )
    doc = await db.crazy_time_bets.find_one(
        {'round_id': cache['round_id'], 'user_id': user['_id'], 'segment': bet.segment},
        {'bet_id': 1}
    )
    return {'ok': True, 'bet_id': doc.get('bet_id') if doc else bet_id}


@router.get('/crazy-time/history')
async def my_history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    cursor = db.crazy_time_bets.find({'user_id': user['_id']}).sort('created_at', -1).limit(limit)
    bets = []
    async for b in cursor:
        b['_id'] = str(b.get('_id', ''))
        bets.append(b)
    return {'bets': bets}


@router.get('/crazy-time/recent-rounds')
async def recent_rounds(limit: int = 15):
    cursor = db.crazy_time_rounds.find({'winner': {'$exists': True}}).sort('created_at', -1).limit(limit)
    rounds = []
    async for r in cursor:
        r['_id'] = str(r.get('_id', ''))
        rounds.append(r)
    return {'rounds': rounds}


FAKE_NAMES_CT = [
    "Rohit", "Priya", "Vikram", "Sneha", "Amit", "Kavya", "Rahul", "Anjali",
    "Karan", "Divya", "Suresh", "Meena", "Arjun", "Pooja", "Manoj", "Ritu",
    "Sanjay", "Neha", "Rajesh", "Isha", "Deepak", "Nisha", "Aakash", "Sonia",
    "Nitin", "Preeti", "Harsh", "Shalini", "Ravi", "Anita",
]
FAKE_AMOUNTS_CT = [20, 50, 100, 200, 500, 1000]


@router.get('/crazy-time/live-feed')
async def live_feed(limit: int = 10):
    real = []
    cursor = db.crazy_time_bets.find({}).sort('created_at', -1).limit(limit)
    async for b in cursor:
        _n = b.get('user_name') or 'Player'
        real.append({'name': _n[:3] + '***' if len(_n) > 3 else _n, 'segment': b.get('segment'), 'amount': b.get('amount'), 'fake': False})
    fake_count = max(0, limit - len(real))
    fake = [{
        'name': random.choice(FAKE_NAMES_CT),
        'segment': random.choice(SEG_NAMES),
        'amount': random.choice(FAKE_AMOUNTS_CT),
        'fake': True,
    } for _ in range(fake_count)]
    combined = real + fake
    random.shuffle(combined)
    return {'feed': combined[:limit]}


async def _settle_round(round_id: str, winner: str):
    payout_mult = SEGMENTS[winner][1]
    cursor = db.crazy_time_bets.find({'round_id': round_id, 'status': 'pending'})
    async for b in cursor:
        won = b.get('segment') == winner
        payout = float(b['amount']) * payout_mult if won else 0
        if won and payout > 0:
            await db.users.update_one({'_id': ObjectId(b['user_id'])}, {'$inc': {'balance': payout}})
        await db.crazy_time_bets.update_one(
            {'_id': b['_id']},
            {'$set': {
                'status': 'won' if won else 'lost',
                'winner': winner,
                'payout': payout,
                'settled_at': datetime.now(timezone.utc).isoformat(),
            }}
        )


async def crazy_time_round_loop():
    while True:
        try:
            round_id = secrets.token_hex(8)
            ends_at = time.time() + ROUND_TOTAL
            _current_round_cache['round'] = {'round_id': round_id, 'ends_at': ends_at}
            await db.crazy_time_rounds.insert_one({
                'round_id': round_id, 'phase': 'betting',
                'created_at': datetime.now(timezone.utc).isoformat(),
            })
            await asyncio.sleep(BET_WINDOW)
            winner = await _pick_result(round_id)
            await db.crazy_time_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'reveal', 'winner': winner, 'payout_mult': SEGMENTS[winner][1]}}
            )
            await asyncio.sleep(ROUND_TOTAL - BET_WINDOW - 1)
            await _settle_round(round_id, winner)
            await db.crazy_time_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'ended', 'settled_at': datetime.now(timezone.utc).isoformat()}}
            )
            await asyncio.sleep(1)
        except Exception:
            await asyncio.sleep(2)
