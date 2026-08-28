"""Dragon Tiger — 30s card game.

Mechanics:
- Round = 30 s (25 s betting + 5 s reveal)
- Two cards drawn (Dragon + Tiger); higher card wins, equal = Tie
- Bets: 'dragon', 'tiger', 'tie'; Payouts 2x / 2x / 50x
- House edge tuning: ~35% profitability via biased card generation
  (skew ~35% of rounds so majority-bet side loses; rest fair)
"""
import asyncio
import random
import time
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from database import db
from auth import get_current_user

router = APIRouter()

RANKS = list(range(1, 14))  # 1 = A, 11 = J, 12 = Q, 13 = K
SUITS = ['♠', '♥', '♦', '♣']
BET_SIDES = {'dragon', 'tiger', 'tie'}
PAYOUTS = {'dragon': 2, 'tiger': 2, 'tie': 50}

ROUND_TOTAL = 30
BET_WINDOW = 25  # first 25s = betting
_HOUSE_EDGE = 0.35  # 35% biased rounds
_current_round_cache = {}


class DTBet(BaseModel):
    side: str  # dragon | tiger | tie
    amount: float = Field(gt=0)


def _draw_card():
    return {'rank': random.choice(RANKS), 'suit': random.choice(SUITS)}


async def _get_config():
    doc = await db.dragon_tiger_config.find_one({'_id': 'config'})
    if not doc:
        doc = {'_id': 'config', 'min_bet': 50, 'enabled': True}
        await db.dragon_tiger_config.insert_one(doc)
    return doc


async def _pick_result(round_id: str):
    """Pick Dragon/Tiger cards. With `_HOUSE_EDGE` prob, bias toward majority-bet side losing."""
    dragon = _draw_card()
    tiger = _draw_card()
    # Read majority-bet side to make house-favouring adjustment
    cursor = db.dragon_tiger_bets.find({'round_id': round_id})
    totals = {'dragon': 0.0, 'tiger': 0.0, 'tie': 0.0}
    async for b in cursor:
        s = b.get('side')
        if s in totals:
            totals[s] += float(b.get('amount', 0))
    house_bias = random.random() < _HOUSE_EDGE
    if house_bias and any(totals.values()):
        majority_side = max(totals, key=lambda k: totals[k])
        # Force result AWAY from majority side
        if majority_side == 'dragon':
            # Ensure tiger >= dragon (prefer tiger strictly > dragon)
            while tiger['rank'] <= dragon['rank']:
                tiger = _draw_card()
                dragon = _draw_card()
                if tiger['rank'] > dragon['rank']:
                    break
        elif majority_side == 'tiger':
            while dragon['rank'] <= tiger['rank']:
                dragon = _draw_card()
                tiger = _draw_card()
                if dragon['rank'] > tiger['rank']:
                    break
        elif majority_side == 'tie':
            # ensure ranks differ
            while dragon['rank'] == tiger['rank']:
                tiger = _draw_card()
    winner = 'dragon' if dragon['rank'] > tiger['rank'] else ('tiger' if tiger['rank'] > dragon['rank'] else 'tie')
    return dragon, tiger, winner


@router.get('/dragon-tiger/config')
async def get_config():
    return await _get_config()


@router.get('/dragon-tiger/current')
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


@router.post('/dragon-tiger/bet')
async def place_bet(bet: DTBet, request: Request):
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
    # Check user balance
    user_doc = await db.users.find_one({'_id': ObjectId(user['_id'])})
    if not user_doc or user_doc.get('balance', 0) < bet.amount:
        raise HTTPException(400, 'insufficient balance')
    # Deduct
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
    await db.dragon_tiger_bets.insert_one(doc)
    return {'ok': True, 'bet_id': bet_id}


@router.get('/dragon-tiger/history')
async def my_history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    cursor = db.dragon_tiger_bets.find({'user_id': user['_id']}).sort('created_at', -1).limit(limit)
    bets = []
    async for b in cursor:
        b['_id'] = str(b.get('_id', ''))
        bets.append(b)
    return {'bets': bets}


@router.get('/dragon-tiger/recent-rounds')
async def recent_rounds(limit: int = 10):
    cursor = db.dragon_tiger_rounds.find({}).sort('created_at', -1).limit(limit)
    rounds = []
    async for r in cursor:
        r['_id'] = str(r.get('_id', ''))
        rounds.append(r)
    return {'rounds': rounds}


@router.get('/dragon-tiger/live-feed')
async def live_feed(limit: int = 12):
    cursor = db.dragon_tiger_bets.find({}).sort('created_at', -1).limit(limit)
    feed = []
    async for b in cursor:
        feed.append({
            'name': (b.get('user_name') or 'Player')[:3] + '***',
            'side': b.get('side'),
            'amount': b.get('amount'),
        })
    return {'feed': feed}


async def _settle_round(round_id: str, dragon: dict, tiger: dict, winner: str):
    cursor = db.dragon_tiger_bets.find({'round_id': round_id, 'status': 'pending'})
    async for b in cursor:
        won = b.get('side') == winner
        payout = float(b['amount']) * PAYOUTS.get(winner, 0) if won else 0
        if won and payout > 0:
            await db.users.update_one({'_id': ObjectId(b['user_id'])}, {'$inc': {'balance': payout}})
        await db.dragon_tiger_bets.update_one(
            {'_id': b['_id']},
            {'$set': {
                'status': 'won' if won else 'lost',
                'winner': winner,
                'dragon_card': dragon,
                'tiger_card': tiger,
                'payout': payout,
                'settled_at': datetime.now(timezone.utc).isoformat(),
            }}
        )


async def dragon_tiger_round_loop():
    """Continuous 30s rounds — betting 25s + reveal 5s."""
    while True:
        try:
            round_id = secrets.token_hex(8)
            ends_at = time.time() + ROUND_TOTAL
            _current_round_cache['round'] = {'round_id': round_id, 'ends_at': ends_at}
            await db.dragon_tiger_rounds.insert_one({
                'round_id': round_id,
                'phase': 'betting',
                'created_at': datetime.now(timezone.utc).isoformat(),
            })
            # Wait until betting window ends
            await asyncio.sleep(BET_WINDOW)
            # Pick result and mark reveal
            dragon, tiger, winner = await _pick_result(round_id)
            await db.dragon_tiger_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'reveal', 'dragon': dragon, 'tiger': tiger, 'winner': winner}}
            )
            # 5s reveal window
            await asyncio.sleep(ROUND_TOTAL - BET_WINDOW - 1)
            # Settle
            await _settle_round(round_id, dragon, tiger, winner)
            await db.dragon_tiger_rounds.update_one(
                {'round_id': round_id},
                {'$set': {'phase': 'ended', 'settled_at': datetime.now(timezone.utc).isoformat()}}
            )
            await asyncio.sleep(1)
        except Exception:
            await asyncio.sleep(2)
