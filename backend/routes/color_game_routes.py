"""Color Prediction (Wingo-style) — 30s rounds.

Mechanics:
- Round = 30 s (25 s betting + 5 s reveal)
- Result: a number 0-9 mapped to color(s)
  • 0        -> Red + Violet
  • 5        -> Green + Violet
  • 1,3,7,9  -> Red
  • 2,4,6,8  -> Green
- Bets: 'red', 'green', 'violet'
- Payouts: red 2x, green 2x, violet 4.5x
- House-edge tuning: ~35% biased rounds skew result AWAY from majority-bet color
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

BET_SIDES = {'red', 'green', 'violet'}
PAYOUTS = {'red': 2, 'green': 2, 'violet': 4.5}

ROUND_TOTAL = 30
BET_WINDOW = 25  # first 25s = betting
_HOUSE_EDGE = 0.35
_current_round_cache = {}

RED_NUMBERS = {1, 3, 7, 9}       # pure red
GREEN_NUMBERS = {2, 4, 6, 8}     # pure green
VIOLET_MIXED = {0: 'red', 5: 'green'}  # 0 = red+violet, 5 = green+violet


class ColorBet(BaseModel):
    side: str  # red | green | violet
    amount: float = Field(gt=0)


def _colors_for(number: int):
    """Return the set of colors this number pays out on."""
    if number in RED_NUMBERS:
        return {'red'}
    if number in GREEN_NUMBERS:
        return {'green'}
    if number == 0:
        return {'red', 'violet'}
    if number == 5:
        return {'green', 'violet'}
    return set()


async def _get_config():
    doc = await db.color_game_config.find_one({'_id': 'config'})
    if not doc:
        doc = {'_id': 'config', 'min_bet': 50, 'enabled': True}
        await db.color_game_config.insert_one(doc)
    return doc


async def _pick_result(round_id: str):
    """Draw 0-9. With `_HOUSE_EDGE` probability, bias result AWAY from majority-bet color."""
    cursor = db.color_game_bets.find({'round_id': round_id})
    totals = {'red': 0.0, 'green': 0.0, 'violet': 0.0}
    async for b in cursor:
        s = b.get('side')
        if s in totals:
            totals[s] += float(b.get('amount', 0))

    number = random.randint(0, 9)
    if random.random() < _HOUSE_EDGE and any(totals.values()):
        majority = max(totals, key=lambda k: totals[k])
        # Pick a number whose colors do NOT include the majority color
        candidates = [n for n in range(10) if majority not in _colors_for(n)]
        if candidates:
            number = random.choice(candidates)

    colors = _colors_for(number)
    return number, sorted(colors)


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
    bet_id = secrets.token_hex(6)
    doc = {
        'bet_id': bet_id,
        'round_id': cache['round_id'],
        'user_id': user['_id'],
        'user_phone': user_doc.get('phone', ''),
        'user_name': user_doc.get('name', 'Player'),
        'side': bet.side,
        'amount': bet.amount,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.color_game_bets.insert_one(doc)
    return {'ok': True, 'bet_id': bet_id}


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
    cursor = db.color_game_rounds.find({'number': {'$exists': True}}).sort('created_at', -1).limit(limit)
    rounds = []
    async for r in cursor:
        r['_id'] = str(r.get('_id', ''))
        rounds.append(r)
    return {'rounds': rounds}


@router.get('/color-game/live-feed')
async def live_feed(limit: int = 12):
    cursor = db.color_game_bets.find({}).sort('created_at', -1).limit(limit)
    feed = []
    async for b in cursor:
        name = b.get('user_name') or 'Player'
        feed.append({
            'name': name[:3] + '***',
            'side': b.get('side'),
            'amount': b.get('amount'),
        })
    return {'feed': feed}


async def _settle_round(round_id: str, number: int, colors):
    cursor = db.color_game_bets.find({'round_id': round_id, 'status': 'pending'})
    async for b in cursor:
        won = b.get('side') in colors
        payout = float(b['amount']) * PAYOUTS.get(b.get('side'), 0) if won else 0
        if won and payout > 0:
            await db.users.update_one({'_id': ObjectId(b['user_id'])}, {'$inc': {'balance': payout}})
        await db.color_game_bets.update_one(
            {'_id': b['_id']},
            {'$set': {
                'status': 'won' if won else 'lost',
                'number': number,
                'colors': colors,
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
            number, colors = await _pick_result(round_id)
            await db.color_game_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'reveal', 'number': number, 'colors': colors}}
            )
            await asyncio.sleep(ROUND_TOTAL - BET_WINDOW - 1)
            await _settle_round(round_id, number, colors)
            await db.color_game_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'ended', 'settled_at': datetime.now(timezone.utc).isoformat()}}
            )
            await asyncio.sleep(1)
        except Exception:
            await asyncio.sleep(2)
