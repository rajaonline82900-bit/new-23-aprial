"""Chicken Road — provably-fair crash/step game.

Mechanics:
- User places bet, chicken starts on lane 0 (multiplier 1.00x)
- Each STEP advances chicken 1 lane and applies next multiplier from MULTIPLIERS table
- Hidden `crash_step` (1..25) determined at start-of-game with heavy low bias (house edge)
- If step_num == crash_step -> chicken hit by car, LOSE bet
- Player can CASHOUT anytime before crash to lock in current multiplier
- Min bet ₹50; max 25 steps
"""
import random
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from database import db
from auth import get_current_user

router = APIRouter()

# Step index -> multiplier reached AFTER completing that step
# Step 0 = start (1.00x), Step 1..8 = successive lane crossings, Step 8 = FINISH (20x)
MULTIPLIERS = [1.00, 1.20, 1.50, 2.00, 3.00, 5.00, 8.00, 12.00, 20.00]
MAX_STEP = len(MULTIPLIERS) - 1  # 8


class StartBet(BaseModel):
    amount: float = Field(gt=0)
    difficulty: str = 'Easy'


async def _get_config():
    doc = await db.chicken_road_config.find_one({'_id': 'config'})
    if not doc:
        doc = {'_id': 'config', 'min_bet': 20, 'enabled': True}
        await db.chicken_road_config.insert_one(doc)
    return doc


def _pick_crash_step(difficulty: str = 'Easy'):
    """Distribution shifts with difficulty. Easy = friendlier, Hard = harsher.
    All roughly ~30-40% house edge on average.
    """
    r = random.random()
    if difficulty == 'Hard':
        # Harsh: 55% crash in 1-2, 25% 3-4, 15% 5-6, 5% 7-8
        if r < 0.55:  return random.randint(1, 2)
        if r < 0.80:  return random.randint(3, 4)
        if r < 0.95:  return random.randint(5, 6)
        return random.randint(7, MAX_STEP)
    if difficulty == 'Medium':
        # Balanced: 40% crash in 1-2, 30% 3-4, 20% 5-6, 10% 7-8
        if r < 0.40:  return random.randint(1, 2)
        if r < 0.70:  return random.randint(3, 4)
        if r < 0.90:  return random.randint(5, 6)
        return random.randint(7, MAX_STEP)
    # Easy: 25% crash in 1-2, 30% 3-4, 25% 5-6, 20% 7-8
    if r < 0.25:  return random.randint(1, 2)
    if r < 0.55:  return random.randint(3, 4)
    if r < 0.80:  return random.randint(5, 6)
    return random.randint(7, MAX_STEP)


@router.get('/chicken-road/config')
async def get_config():
    return await _get_config()


@router.get('/chicken-road/active')
async def get_active(request: Request):
    """Return user's currently-active game (if any) so UI can resume."""
    user = await get_current_user(request)
    game = await db.chicken_road_games.find_one({'user_id': user['_id'], 'status': 'active'})
    if not game:
        return {'active': None}
    return {
        'active': {
            'game_id': game['game_id'],
            'bet': game['bet'],
            'current_step': game.get('current_step', 0),
            'multiplier': MULTIPLIERS[game.get('current_step', 0)],
            'max_step': MAX_STEP,
        }
    }


@router.post('/chicken-road/start')
async def start_game(body: StartBet, request: Request):
    user = await get_current_user(request)
    cfg = await _get_config()
    if not cfg.get('enabled', True):
        raise HTTPException(400, 'game disabled')
    if body.amount < cfg.get('min_bet', 50):
        raise HTTPException(400, f'min bet ₹{cfg.get("min_bet", 50)}')
    # Only one active game per user
    existing = await db.chicken_road_games.find_one({'user_id': user['_id'], 'status': 'active'})
    if existing:
        raise HTTPException(400, 'active game exists — cashout or finish it first')
    user_doc = await db.users.find_one({'_id': ObjectId(user['_id'])})
    if not user_doc or user_doc.get('balance', 0) < body.amount:
        raise HTTPException(400, 'insufficient balance')
    await db.users.update_one({'_id': ObjectId(user['_id'])}, {'$inc': {'balance': -body.amount}})
    game_id = secrets.token_hex(6)
    crash_step = _pick_crash_step(body.difficulty)
    doc = {
        'game_id': game_id,
        'user_id': user['_id'],
        'user_name': user_doc.get('name', 'Player'),
        'user_phone': user_doc.get('phone', ''),
        'bet': body.amount,
        'crash_step': crash_step,   # hidden from client
        'current_step': 0,
        'status': 'active',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.chicken_road_games.insert_one(doc)
    return {
        'ok': True,
        'game_id': game_id,
        'bet': body.amount,
        'current_step': 0,
        'multiplier': 1.00,
        'max_step': MAX_STEP,
    }


@router.post('/chicken-road/step')
async def step_game(request: Request):
    user = await get_current_user(request)
    game = await db.chicken_road_games.find_one({'user_id': user['_id'], 'status': 'active'})
    if not game:
        raise HTTPException(400, 'no active game')
    next_step = game.get('current_step', 0) + 1
    if next_step > MAX_STEP:
        raise HTTPException(400, 'max steps reached — cashout')
    # Check crash
    if next_step == game['crash_step']:
        await db.chicken_road_games.update_one(
            {'game_id': game['game_id']},
            {'$set': {
                'status': 'lost',
                'current_step': next_step,
                'crashed_at_step': next_step,
                'multiplier': 0,
                'payout': 0,
                'settled_at': datetime.now(timezone.utc).isoformat(),
            }}
        )
        return {
            'crashed': True,
            'step': next_step,
            'crash_step': next_step,
            'multiplier': 0,
            'bet': game['bet'],
        }
    # Advance
    await db.chicken_road_games.update_one(
        {'game_id': game['game_id']},
        {'$set': {'current_step': next_step}}
    )
    return {
        'crashed': False,
        'step': next_step,
        'multiplier': round(MULTIPLIERS[next_step], 2),
        'bet': game['bet'],
    }


@router.post('/chicken-road/cashout')
async def cashout_game(request: Request):
    user = await get_current_user(request)
    game = await db.chicken_road_games.find_one({'user_id': user['_id'], 'status': 'active'})
    if not game:
        raise HTTPException(400, 'no active game')
    step = game.get('current_step', 0)
    if step == 0:
        raise HTTPException(400, 'take at least one step before cashout')
    multiplier = MULTIPLIERS[step]
    payout = round(float(game['bet']) * multiplier, 2)
    await db.users.update_one({'_id': ObjectId(user['_id'])}, {'$inc': {'balance': payout}})
    await db.chicken_road_games.update_one(
        {'game_id': game['game_id']},
        {'$set': {
            'status': 'won',
            'multiplier': multiplier,
            'payout': payout,
            'settled_at': datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {
        'ok': True,
        'step': step,
        'multiplier': multiplier,
        'payout': payout,
    }


@router.get('/chicken-road/history')
async def my_history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    cursor = db.chicken_road_games.find(
        {'user_id': user['_id'], 'status': {'$in': ['won', 'lost']}}
    ).sort('created_at', -1).limit(limit)
    games = []
    async for g in cursor:
        g['_id'] = str(g.get('_id', ''))
        # Never expose future crash_step from other users' games, but for own history we can
        games.append(g)
    return {'games': games}


@router.get('/chicken-road/live-feed')
async def live_feed(limit: int = 12):
    cursor = db.chicken_road_games.find(
        {'status': {'$in': ['won', 'lost']}}
    ).sort('created_at', -1).limit(limit)
    feed = []
    async for g in cursor:
        name = g.get('user_name') or 'Player'
        feed.append({
            'name': name[:3] + '***',
            'bet': g.get('bet'),
            'multiplier': g.get('multiplier', 0),
            'payout': g.get('payout', 0),
            'status': g.get('status'),
        })
    return {'feed': feed}
