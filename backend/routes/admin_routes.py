from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
import os
import logging
import uuid
import asyncio
import httpx

from database import db
from auth import get_admin_user, get_current_user
from config import (
    GAMES, DEFAULT_GAMES, IST, SETTINGS_DEFAULTS,
    MARKET_TO_GAME, MATKA_API_BASE, MATKA_API_USERNAME, MATKA_API_PASSWORD,
    matka_api_tokens, matka_api_last_error,
    NEW_MATKA_API_URL, NEW_MATKA_API_KEY, NEW_MATKA_DOMAIN_KEY, NEW_MATKA_DOMAIN
)
from helpers import get_games_dict, load_games, send_push_to_all
from models import (
    GameCreate, GameUpdate, WalletAdjustment, HelpMessageCreate
)
from notifications import notification_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== Admin User Management =====

@router.get("/admin/users")
async def get_all_users(request: Request, skip: int = 0, limit: int = 500):
    await get_admin_user(request)
    users = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    # Enrich with total_deposited for frontend filter
    for user in users:
        user["_id"] = str(user["_id"])
        try:
            agg = await db.transactions.aggregate([
                {"$match": {"user_id": user["_id"], "type": "deposit", "status": "completed"}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            user["total_deposited"] = agg[0]["total"] if agg else 0
        except Exception:
            user["total_deposited"] = 0
    total = await db.users.count_documents({})
    return {"users": users, "total": total}


@router.get("/admin/users/{user_id}")
async def get_user_details(user_id: str, request: Request):
    await get_admin_user(request)
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["_id"] = str(user["_id"])
    return {"user": user}


@router.get("/admin/users/{user_id}/deposits")
async def get_user_deposits(user_id: str, request: Request):
    await get_admin_user(request)
    deposits = await db.transactions.find(
        {"user_id": user_id, "type": "deposit"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    total_deposited = sum(d["amount"] for d in deposits if d.get("status") == "completed")
    return {"deposits": deposits, "total_deposited": total_deposited}


@router.get("/admin/users/{user_id}/withdrawals")
async def get_user_withdrawals(user_id: str, request: Request):
    await get_admin_user(request)
    withdrawals = await db.transactions.find(
        {"user_id": user_id, "type": "withdrawal"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    total_withdrawn = sum(w["amount"] for w in withdrawals if w.get("status") in ["completed", "approved"])
    pending_amount = sum(w["amount"] for w in withdrawals if w.get("status") == "pending")
    return {"withdrawals": withdrawals, "total_withdrawn": total_withdrawn, "pending_amount": pending_amount}


@router.get("/admin/users/{user_id}/bets")
async def get_user_bets(user_id: str, request: Request):
    await get_admin_user(request)
    bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    stats = {
        "total_bets": len(bets),
        "total_wagered": sum(b["amount"] for b in bets),
        "won": len([b for b in bets if b.get("status") == "won"]),
        "lost": len([b for b in bets if b.get("status") == "lost"]),
        "pending": len([b for b in bets if b.get("status") == "pending"])
    }
    return {"bets": bets, "stats": stats}


@router.get("/admin/users/{user_id}/winnings")
async def get_user_winnings(user_id: str, request: Request):
    await get_admin_user(request)
    winning_bets = await db.bets.find({"user_id": user_id, "status": "won"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    total_winnings = sum(b.get("won_amount", 0) for b in winning_bets)
    return {"winnings": winning_bets, "total_winnings": total_winnings}


@router.post("/admin/users/{user_id}/wallet")
async def adjust_user_wallet(user_id: str, adjustment: WalletAdjustment, request: Request):
    admin = await get_admin_user(request)
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if adjustment.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    if adjustment.type == "deduct":
        if adjustment.amount > user.get("balance", 0):
            raise HTTPException(status_code=400, detail="Cannot deduct more than current balance")
        change = -adjustment.amount
    else:
        change = adjustment.amount

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"balance": change}})

    transaction_doc = {
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": f"admin_{adjustment.type}", "amount": adjustment.amount,
        "reason": adjustment.reason, "admin_email": admin["email"],
        "status": "completed", "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(transaction_doc)

    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return {
        "message": f"Balance {'added' if adjustment.type == 'add' else 'deducted'} successfully",
        "new_balance": updated_user.get("balance", 0)
    }


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    await get_admin_user(request)
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="एडमिन अकाउंट डिलीट नहीं किया जा सकता")

    await db.bets.delete_many({"user_id": user_id})
    await db.transactions.delete_many({"user_id": user_id})
    await db.referrals.delete_many({"user_id": user_id})
    await db.push_subscriptions.delete_many({"user_id": user_id})
    await db.users.delete_one({"_id": ObjectId(user_id)})

    return {"message": f"यूजर '{user.get('name', '')}' का अकाउंट डिलीट कर दिया गया"}


# ===== Admin Stats =====

@router.get("/admin/stats")
async def get_admin_stats(request: Request):
    await get_admin_user(request)

    total_users = await db.users.count_documents({})
    total_bets = await db.bets.count_documents({})
    pending_withdrawals = await db.transactions.count_documents({"type": "withdrawal", "status": "pending"})

    today = datetime.now(IST).strftime("%Y-%m-%d")
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_bets = await db.bets.count_documents({"date": today})
    today_new_users = await db.users.count_documents({"created_at": {"$gte": today_start}})

    # Calculate today's total bet amount
    today_bets_list = await db.bets.find({"date": today}, {"amount": 1}).to_list(10000)
    today_bet_amount = sum(b.get("amount", 0) for b in today_bets_list)

    today_deposits = await db.transactions.find({
        "type": "deposit", "status": "completed", "created_at": {"$gte": today_start}
    }).to_list(1000)
    today_deposit_amount = sum(d.get("amount", 0) for d in today_deposits)

    today_withdrawals = await db.transactions.find({
        "type": "withdrawal", "status": {"$in": ["approved", "completed"]}, "created_at": {"$gte": today_start}
    }).to_list(1000)
    today_withdrawal_amount = sum(w.get("amount", 0) for w in today_withdrawals)

    pending_withdrawal_list = await db.transactions.find({"type": "withdrawal", "status": "pending"}).to_list(1000)
    pending_withdrawal_amount = sum(w.get("amount", 0) for w in pending_withdrawal_list)

    all_deposits = await db.transactions.find({"type": "deposit", "status": "completed"}).to_list(10000)
    total_deposit_amount = sum(d.get("amount", 0) for d in all_deposits)

    all_withdrawals = await db.transactions.find({
        "type": "withdrawal", "status": {"$in": ["approved", "completed"]}
    }).to_list(10000)
    total_withdrawal_amount = sum(w.get("amount", 0) for w in all_withdrawals)

    notification_status = notification_service.get_status()
    total_subscribers = await db.notification_subscribers.count_documents({})

    return {
        "total_users": total_users, "total_bets": total_bets,
        "pending_withdrawals": pending_withdrawals,
        "today_bets": today_bets, "today_new_users": today_new_users,
        "today_bet_amount": today_bet_amount,
        "today_deposit_amount": today_deposit_amount,
        "today_withdrawal_amount": today_withdrawal_amount,
        "pending_withdrawal_amount": pending_withdrawal_amount,
        "total_deposit_amount": total_deposit_amount,
        "total_withdrawal_amount": total_withdrawal_amount,
        "notifications": {**notification_status, "total_subscribers": total_subscribers}
    }


@router.get("/admin/today-new-users")
async def get_today_new_users(request: Request):
    await get_admin_user(request)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    users = await db.users.find({"created_at": {"$gte": today_start}}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    for u in users:
        u["_id"] = str(u["_id"])
    return {"users": users, "total": len(users)}


@router.get("/admin/today-deposits")
async def get_today_deposits(request: Request):
    await get_admin_user(request)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    deposits = await db.transactions.find({
        "type": "deposit", "status": "completed", "created_at": {"$gte": today_start}
    }, {"_id": 0}).sort("created_at", -1).to_list(500)

    for d in deposits:
        user = await db.users.find_one({"_id": ObjectId(d["user_id"])}, {"name": 1, "phone": 1, "email": 1, "balance": 1})
        if user:
            d["user_name"] = user.get("name", "")
            d["user_phone"] = user.get("phone", "")
            d["user_email"] = user.get("email", "")
            d["user_balance"] = user.get("balance", 0)

    total_amount = sum(d.get("amount", 0) for d in deposits)
    return {"deposits": deposits, "total": len(deposits), "total_amount": total_amount}



# ===== Admin Withdrawals & Deposits =====

@router.get("/admin/withdrawals")
async def get_withdrawals(request: Request, status: str = "pending"):
    await get_admin_user(request)
    withdrawals = await db.transactions.find(
        {"type": "withdrawal", "status": status}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    for w in withdrawals:
        if not w.get("user_phone"):
            user = await db.users.find_one({"_id": ObjectId(w["user_id"])}, {"phone": 1})
            w["user_phone"] = user.get("phone", "") if user else ""

    return {"withdrawals": withdrawals}


@router.get("/admin/deposits")
async def get_admin_deposits(request: Request, skip: int = 0, limit: int = 50, status: str = "all"):
    await get_admin_user(request)
    query = {"type": "deposit"}
    if status and status != "all":
        query["status"] = status
    
    deposits = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Batch fetch users
    user_ids = list(set(d.get("user_id") for d in deposits if d.get("user_id")))
    users_list = await db.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}, {"name": 1, "phone": 1, "email": 1}).to_list(500)
    user_map = {str(u["_id"]): u for u in users_list}
    for d in deposits:
        user = user_map.get(d.get("user_id"), {})
        d["user_name"] = user.get("name", "")
        d["user_phone"] = user.get("phone", "")
        d["user_email"] = user.get("email", "")

    total = await db.transactions.count_documents(query)
    total_amount = sum(d.get("amount", 0) for d in deposits)
    
    # Stats
    stats = {
        "all": await db.transactions.count_documents({"type": "deposit"}),
        "pending": await db.transactions.count_documents({"type": "deposit", "status": "pending"}),
        "completed": await db.transactions.count_documents({"type": "deposit", "status": "completed"}),
        "failed": await db.transactions.count_documents({"type": "deposit", "status": "failed"}),
        "expired": await db.transactions.count_documents({"type": "deposit", "status": "expired"}),
    }
    return {"deposits": deposits, "total": total, "total_amount": total_amount, "stats": stats}


@router.post("/admin/deposits/{order_id}/approve")
async def admin_approve_deposit(order_id: str, request: Request):
    """Admin manually approves a pending/failed/expired deposit"""
    await get_admin_user(request)
    transaction = await db.transactions.find_one({"order_id": order_id, "type": "deposit"})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if transaction["status"] == "completed":
        raise HTTPException(status_code=400, detail="Already completed")
    
    await db.users.update_one(
        {"_id": ObjectId(transaction["user_id"])},
        {"$inc": {"balance": transaction["amount"]}}
    )
    await db.transactions.update_one(
        {"order_id": order_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc), "approved_by_admin": True}}
    )
    logger.info(f"Admin approved deposit: order={order_id}, amount={transaction['amount']}, user={transaction['user_id']}")
    return {"message": f"₹{transaction['amount']} जमा approve हो गया"}


@router.post("/admin/deposits/{order_id}/reject")
async def admin_reject_deposit(order_id: str, request: Request):
    """Admin manually rejects a deposit"""
    await get_admin_user(request)
    transaction = await db.transactions.find_one({"order_id": order_id, "type": "deposit"})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if transaction["status"] == "completed":
        raise HTTPException(status_code=400, detail="Already completed - cannot reject")
    
    await db.transactions.update_one({"order_id": order_id}, {"$set": {"status": "rejected"}})
    return {"message": "Deposit rejected"}


@router.post("/admin/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, request: Request):
    await get_admin_user(request)
    result = await db.transactions.update_one(
        {"id": withdrawal_id, "type": "withdrawal", "status": "pending"},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Withdrawal not found or already processed")
    return {"message": "Withdrawal approved"}


@router.post("/admin/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str, request: Request):
    await get_admin_user(request)
    withdrawal = await db.transactions.find_one({"id": withdrawal_id, "type": "withdrawal", "status": "pending"})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found or already processed")

    await db.users.update_one({"_id": ObjectId(withdrawal["user_id"])}, {"$inc": {"balance": withdrawal["amount"]}})
    await db.transactions.update_one(
        {"id": withdrawal_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Withdrawal rejected and amount refunded"}


# ===== Bet Distribution =====

@router.get("/admin/bet-distribution")
async def get_bet_distribution(request: Request, game_id: Optional[str] = None, date: Optional[str] = None):
    await get_admin_user(request)

    if not date:
        date = datetime.now(IST).strftime("%Y-%m-%d")

    query = {"date": date, "status": "pending"}
    if game_id and game_id != "all":
        query["game_id"] = game_id

    bets = await db.bets.find(query, {"_id": 0}).to_list(10000)

    distribution = {}
    total_bet_amount = 0
    total_potential_payout = 0

    for bet in bets:
        game = bet["game_id"]
        bet_type = bet["bet_type"]
        number = bet["number"]
        amount = bet["amount"]
        potential_win = bet.get("potential_win", 0)

        if game not in distribution:
            distribution[game] = {
                "game_name": GAMES[game]["name_hi"] if game in GAMES else game,
                "single": {}, "jodi": {}, "haruf_andar": {}, "haruf_bahar": {},
                "total_amount": 0, "total_potential": 0
            }

        if bet_type not in distribution[game]:
            distribution[game][bet_type] = {}

        if number not in distribution[game][bet_type]:
            distribution[game][bet_type][number] = {"count": 0, "amount": 0, "potential_payout": 0}

        distribution[game][bet_type][number]["count"] += 1
        distribution[game][bet_type][number]["amount"] += amount
        distribution[game][bet_type][number]["potential_payout"] += potential_win
        distribution[game]["total_amount"] += amount
        distribution[game]["total_potential"] += potential_win
        total_bet_amount += amount
        total_potential_payout += potential_win

    for game in distribution:
        for bet_type in ["jodi", "single", "haruf_andar", "haruf_bahar"]:
            if bet_type in distribution[game]:
                distribution[game][bet_type] = dict(
                    sorted(distribution[game][bet_type].items(), key=lambda x: x[1]["amount"], reverse=True)
                )

    return {
        "date": date, "distribution": distribution,
        "summary": {"total_bet_amount": total_bet_amount, "total_potential_payout": total_potential_payout, "total_bets": len(bets)}
    }


# ===== Jantri Report (Bid History) =====

@router.get("/admin/jantri-report")
async def get_jantri_bid_report(request: Request, game_id: str = "all", date: Optional[str] = None):
    """Jantri report showing bet amounts on each number (00-99 jodi, 0-9 haruf)"""
    await get_admin_user(request)

    if not date:
        date = datetime.now(IST).strftime("%Y-%m-%d")

    query = {"date": date}
    if game_id and game_id != "all":
        query["game_id"] = game_id

    bets = await db.bets.find(query, {"_id": 0}).to_list(10000)

    # Initialize all numbers with 0
    jodi = {f"{i:02d}": 0 for i in range(100)}
    andar = {str(i): 0 for i in range(10)}
    bahar = {str(i): 0 for i in range(10)}
    crossing = {}

    for bet in bets:
        bt = bet.get("bet_type", "")
        num = bet.get("number", "")
        amt = bet.get("amount", 0)
        if bt == "jodi" and num in jodi:
            jodi[num] += amt
        elif bt == "haruf_andar" and num in andar:
            andar[num] += amt
        elif bt == "haruf_bahar" and num in bahar:
            bahar[num] += amt
        elif bt == "crossing" and len(num) == 2:
            crossing[num] = crossing.get(num, 0) + amt

    jodi_total = sum(jodi.values())
    andar_total = sum(andar.values())
    bahar_total = sum(bahar.values())
    crossing_total = sum(crossing.values())
    total = jodi_total + andar_total + bahar_total + crossing_total

    # Calculate max loss (worst case payout for operator if a specific result wins)
    # For each possible jodi result, calculate the total payout
    max_loss = 0
    worst_jodi = "00"
    jodi_mult = 100
    haruf_mult = 10
    crossing_mult = 100  # crossing pays same as jodi

    for num in range(100):
        jodi_num = f"{num:02d}"
        d1 = jodi_num[0]  # andar digit
        d2 = jodi_num[1]  # bahar digit
        payout = jodi[jodi_num] * jodi_mult + andar[d1] * haruf_mult + bahar[d2] * haruf_mult
        # Add crossing payouts for this result
        for cn, ca in crossing.items():
            if len(cn) == 2:
                cd1, cd2 = cn[0], cn[1]
                if (cd1 == d1 and cd2 == d2) or (cd1 == d2 and cd2 == d1):
                    payout += ca * crossing_mult
        if payout > max_loss:
            max_loss = payout
            worst_jodi = jodi_num

    profit = total - max_loss

    return {
        "date": date,
        "game_id": game_id,
        "jodi": jodi,
        "andar": andar,
        "bahar": bahar,
        "crossing": crossing,
        "summary": {
            "jodi_total": jodi_total,
            "andar_total": andar_total,
            "bahar_total": bahar_total,
            "crossing_total": crossing_total,
            "total": total,
            "max_loss": max_loss,
            "worst_jodi": worst_jodi,
            "profit": profit
        }
    }


# ===== Jantri Results History =====

@router.get("/admin/jantri")
async def get_jantri_report(request: Request, game_id: Optional[str] = None, days: int = 30):
    await get_admin_user(request)

    end_date = datetime.now(IST)
    start_date = end_date - timedelta(days=days)
    start_date_str = start_date.strftime("%Y-%m-%d")

    query = {"date": {"$gte": start_date_str}}
    if game_id and game_id != "all":
        query["game_id"] = game_id

    results = await db.results.find(query, {"_id": 0}).sort("date", -1).to_list(1000)

    jantri_data = {}
    for result in results:
        date = result["date"]
        if date not in jantri_data:
            jantri_data[date] = {}
        jantri_data[date][result["game_id"]] = {"single": result["single_result"], "jodi": result["jodi_result"]}

    jantri_list = [{"date": date, "results": jantri_data[date]} for date in sorted(jantri_data.keys(), reverse=True)]

    return {"jantri": jantri_list, "games": list(GAMES.keys()), "game_names": {k: v["name_hi"] for k, v in GAMES.items()}}


@router.get("/admin/jantri/export")
async def export_jantri(request: Request, game_id: Optional[str] = None, days: int = 30):
    await get_admin_user(request)

    end_date = datetime.now(IST)
    start_date = end_date - timedelta(days=days)
    start_date_str = start_date.strftime("%Y-%m-%d")

    query = {"date": {"$gte": start_date_str}}
    if game_id and game_id != "all":
        query["game_id"] = game_id

    results = await db.results.find(query, {"_id": 0}).sort([("date", -1), ("game_id", 1)]).to_list(1000)

    export_data = []
    for result in results:
        game_info = GAMES.get(result["game_id"], {})
        export_data.append({
            "date": result["date"], "game": game_info.get("name_hi", result["game_id"]),
            "game_english": game_info.get("name", result["game_id"]),
            "time": game_info.get("display_time", ""),
            "single": result["single_result"], "jodi": result["jodi_result"]
        })
    return {"export_data": export_data}


# ===== Game Management =====

@router.get("/admin/games")
async def get_all_games_admin(request: Request):
    await get_admin_user(request)
    games = await db.games.find({}, {"_id": 0}).to_list(100)
    if not games:
        games = [{"game_id": k, **v} for k, v in DEFAULT_GAMES.items()]
    return {"games": games}


@router.post("/admin/games")
async def create_game(game: GameCreate, request: Request):
    await get_admin_user(request)
    existing = await db.games.find_one({"game_id": game.game_id})
    if existing:
        raise HTTPException(status_code=400, detail="Game ID already exists")

    game_doc = {
        "game_id": game.game_id, "name": game.name, "name_hi": game.name_hi,
        "category": game.category,
        "start_time": game.start_time, "end_time": game.end_time,
        "time": game.end_time, "display_time": game.display_time,
        "is_active": game.is_active, "created_at": datetime.now(timezone.utc)
    }
    await db.games.insert_one(game_doc)
    await load_games()
    return {"message": "Game created successfully", "game_id": game.game_id}


@router.put("/admin/games/{game_id}")
async def update_game(game_id: str, game: GameUpdate, request: Request):
    await get_admin_user(request)

    existing = await db.games.find_one({"game_id": game_id})
    if not existing:
        if game_id in DEFAULT_GAMES:
            default_game = DEFAULT_GAMES[game_id]
            await db.games.insert_one({"game_id": game_id, **default_game, "created_at": datetime.now(timezone.utc)})
        else:
            raise HTTPException(status_code=404, detail="Game not found")

    update_data = {}
    if game.name is not None:
        update_data["name"] = game.name
    if game.name_hi is not None:
        update_data["name_hi"] = game.name_hi
    if game.category is not None:
        update_data["category"] = game.category
    if game.start_time is not None:
        update_data["start_time"] = game.start_time
    if game.end_time is not None:
        update_data["end_time"] = game.end_time
        update_data["time"] = game.end_time
    if game.display_time is not None:
        update_data["display_time"] = game.display_time
    if game.is_active is not None:
        update_data["is_active"] = game.is_active

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.games.update_one({"game_id": game_id}, {"$set": update_data})

    await load_games()
    return {"message": "Game updated successfully"}


@router.delete("/admin/games/{game_id}")
async def delete_game(game_id: str, request: Request):
    await get_admin_user(request)
    result = await db.games.delete_one({"game_id": game_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game not found")
    await load_games()
    return {"message": "Game deleted successfully"}


@router.post("/admin/games/seed-kalyan")
async def seed_kalyan_games(request: Request):
    """Insert default Kalyan games. Skips games that already exist."""
    await get_admin_user(request)
    inserted = 0
    skipped = 0
    for gid, gdata in DEFAULT_GAMES.items():
        if gdata.get("category") != "kalyan":
            continue
        existing = await db.games.find_one({"game_id": gid})
        if existing:
            skipped += 1
            # Ensure category field is set on existing games
            await db.games.update_one({"game_id": gid}, {"$set": {"category": "kalyan"}})
            continue
        doc = {"game_id": gid, **gdata, "created_at": datetime.now(timezone.utc)}
        await db.games.insert_one(doc)
        inserted += 1
    await load_games()
    return {"message": f"{inserted} games added, {skipped} already present", "inserted": inserted, "skipped": skipped}


# ===== Settings =====

@router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    result = {**SETTINGS_DEFAULTS}
    if settings:
        for k in SETTINGS_DEFAULTS:
            if k in settings:
                result[k] = settings[k]
    return result


@router.get("/admin/settings")
async def get_admin_settings(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    result = {**SETTINGS_DEFAULTS}
    if settings:
        for k in SETTINGS_DEFAULTS:
            if k in settings:
                result[k] = settings[k]
    return result


@router.put("/admin/settings")
async def update_settings(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    update_doc = {"key": "app_settings", "updated_at": datetime.now(timezone.utc)}
    for k in SETTINGS_DEFAULTS:
        if k in body:
            update_doc[k] = body[k]
    await db.settings.update_one({"key": "app_settings"}, {"$set": update_doc}, upsert=True)
    return {"message": "Settings updated successfully"}




# ===== Admin Winners =====

@router.get("/admin/winners")
async def get_admin_winners(request: Request, date: Optional[str] = None, game_id: str = "all", limit: int = 50):
    await get_admin_user(request)
    if not date:
        date = datetime.now(IST).strftime("%Y-%m-%d")
    query = {"status": "won"}
    if date:
        query["date"] = date
    if game_id and game_id != "all":
        query["game_id"] = game_id
    
    bets = await db.bets.find(query, {"_id": 0}).sort("won_amount", -1).limit(limit).to_list(limit)
    
    # Fetch user details
    user_ids = list(set(b.get("user_id") for b in bets if b.get("user_id")))
    users_list = await db.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}, {"name": 1, "phone": 1, "balance": 1}).to_list(500)
    user_map = {str(u["_id"]): u for u in users_list}
    
    result = []
    total_won = 0
    for b in bets:
        user = user_map.get(b.get("user_id"), {})
        total_won += b.get("won_amount", 0)
        result.append({
            "user_name": user.get("name", "?"),
            "user_phone": user.get("phone", ""),
            "user_balance": user.get("balance", 0),
            "game_id": b.get("game_id", ""),
            "bet_type": b.get("bet_type", ""),
            "number": b.get("number", ""),
            "amount": b.get("amount", 0),
            "won_amount": b.get("won_amount", 0),
            "date": b.get("date", ""),
        })
    
    return {"winners": result, "total": len(result), "total_won": total_won, "date": date}


# ===== Admin Referrals =====

@router.get("/admin/referrals")
async def get_admin_referrals(request: Request, limit: int = 50):
    await get_admin_user(request)
    
    # Find users who have referred_by set
    referred_users = await db.users.find(
        {"referred_by": {"$exists": True, "$nin": [None, ""]}},
        {"_id": 0, "name": 1, "phone": 1, "email": 1, "referred_by": 1, "created_at": 1, "balance": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get referrer details
    referrer_codes = list(set(u.get("referred_by") for u in referred_users if u.get("referred_by")))
    referrers = await db.users.find(
        {"referral_code": {"$in": referrer_codes}},
        {"name": 1, "phone": 1, "referral_code": 1}
    ).to_list(500)
    referrer_map = {r["referral_code"]: r for r in referrers}
    
    result = []
    for u in referred_users:
        ref_code = u.get("referred_by", "")
        referrer = referrer_map.get(ref_code, {})
        result.append({
            "user_name": u.get("name", "?"),
            "user_phone": u.get("phone", ""),
            "user_balance": u.get("balance", 0),
            "referred_by_code": ref_code,
            "referrer_name": referrer.get("name", "?"),
            "referrer_phone": referrer.get("phone", ""),
            "joined_at": u.get("created_at"),
        })
    
    # Referral stats
    total_referrals = await db.users.count_documents({"referred_by": {"$exists": True, "$nin": [None, ""]}})
    
    return {"referrals": result, "total": total_referrals}


# ===== Help Messages =====

@router.get("/help/messages")
async def get_help_messages():
    messages = await db.help_messages.find({"is_active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"messages": messages}


@router.post("/admin/help/messages")
async def create_help_message(msg: HelpMessageCreate, request: Request):
    await get_admin_user(request)
    doc = {
        "id": str(uuid.uuid4()), "title": msg.title, "message": msg.message,
        "is_active": msg.is_active, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.help_messages.insert_one(doc)
    return {"message": "Message created", "id": doc["id"]}


@router.delete("/admin/help/messages/{message_id}")
async def delete_help_message(message_id: str, request: Request):
    await get_admin_user(request)
    await db.help_messages.delete_one({"id": message_id})
    return {"message": "Message deleted"}



@router.get("/admin/auto-fetch-debug")
async def auto_fetch_debug(request: Request):
    """Debug endpoint - directly call matkaapi.com and return raw response + match summary."""
    await get_admin_user(request)
    import config as cfg
    debug_info = {
        "api_url": NEW_MATKA_API_URL,
        "api_key_set": bool(NEW_MATKA_API_KEY),
        "domain_key_set": bool(NEW_MATKA_DOMAIN_KEY),
        "domain": NEW_MATKA_DOMAIN,
        "auto_fetch_running": cfg.auto_fetch_running,
    }
    raw_responses = {}
    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            for label, body in [("gali_all", {"gali": "all"}), ("market_all", {"market": "all"})]:
                data, status_code, raw = await _matkaapi_post(client, body)
                raw_responses[label] = {
                    "http": status_code,
                    "json": data if data else None,
                    "raw": raw if not data else None,
                }
    except Exception as e:
        raw_responses["error"] = f"{type(e).__name__}: {e}"

    fetch_result = await fetch_matka_results()
    debug_info["raw_responses"] = raw_responses
    debug_info["fetch_result"] = fetch_result
    return debug_info


@router.post("/admin/reverify-deposits")
async def reverify_deposits(request: Request):
    """Admin endpoint: recheck all pending/failed deposits against IMB and credit if actually paid."""
    await get_admin_user(request)
    import httpx as _httpx
    from config import IMB_API_URL, IMB_API_TOKEN
    from routes.wallet_routes import process_referral_reward

    if not IMB_API_URL or not IMB_API_TOKEN:
        return {"credited": 0, "checked": 0, "error": "IMB not configured"}

    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    deposits = await db.transactions.find(
        {"type": "deposit", "status": {"$in": ["pending", "failed", "expired"]}, "created_at": {"$gt": cutoff}},
        {"_id": 0}
    ).to_list(500)

    credited = 0
    checked = 0
    async with _httpx.AsyncClient(timeout=20, verify=False) as client:
        for dep in deposits:
            order_id = dep.get("order_id", "")
            if not order_id:
                continue
            try:
                resp = await client.post(
                    f"{IMB_API_URL}/api/check-order-status",
                    data={"user_token": IMB_API_TOKEN, "order_id": order_id},
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                checked += 1
                verify_data = resp.json()
                imb_result = verify_data.get("result", {})
                txn_status = (imb_result.get("txnStatus") or imb_result.get("status") or "").upper()
                if txn_status in ("COMPLETED", "SUCCESS"):
                    fresh = await db.transactions.find_one({"order_id": order_id})
                    if fresh and fresh.get("status") != "completed":
                        await db.users.update_one(
                            {"_id": ObjectId(dep["user_id"])},
                            {"$inc": {"balance": dep["amount"]}}
                        )
                        await db.transactions.update_one(
                            {"order_id": order_id},
                            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc), "reverified_by_admin": True}}
                        )
                        await process_referral_reward(dep["user_id"], dep["amount"])
                        credited += 1
                        logger.info(f"Admin re-verify CREDITED: {order_id} ₹{dep['amount']}")
            except Exception as e:
                logger.error(f"Re-verify error {order_id}: {e}")

    return {"credited": credited, "checked": checked, "total_pending": len(deposits)}


@router.post("/admin/results/push-external")
async def push_results_external(request: Request):
    """Accept results pushed from external source (preview server cron)"""
    body = await request.json()
    secret = body.get("secret", "")
    if secret != os.environ.get("JWT_SECRET", ""):
        raise HTTPException(status_code=403, detail="Invalid secret")
    
    results_list = body.get("results", [])
    applied = []
    games_dict = await get_games_dict()
    
    for r in results_list:
        game_id = r.get("game_id", "")
        jodi = r.get("jodi", "")
        result_date = r.get("date", "")
        
        if not game_id or not jodi or not result_date or game_id not in games_dict:
            continue
        
        existing = await db.results.find_one({"game_id": game_id, "date": result_date})
        if existing:
            continue
        
        single_result = jodi[-1]
        result_doc = {
            "id": str(uuid.uuid4()), "game_id": game_id, "date": result_date,
            "single_result": single_result, "jodi_result": jodi,
            "declared_at": datetime.now(timezone.utc), "auto_declared": True
        }
        await db.results.insert_one(result_doc)
        
        # Process winning bets
        andar_digit = jodi[0]
        bahar_digit = jodi[1]
        winning_jodi = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "jodi", "number": jodi, "status": "pending"}).to_list(1000)
        winning_andar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_andar", "number": andar_digit, "status": "pending"}).to_list(1000)
        winning_bahar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_bahar", "number": bahar_digit, "status": "pending"}).to_list(1000)
        winning_crossing = []
        crossing_bets = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "crossing", "status": "pending"}).to_list(1000)
        for cb in crossing_bets:
            cn = cb.get("number", "")
            if len(cn) == 2:
                d1, d2 = cn[0], cn[1]
                if (d1 == andar_digit and d2 == bahar_digit) or (d1 == bahar_digit and d2 == andar_digit):
                    winning_crossing.append(cb)
        
        all_winners = winning_jodi + winning_andar + winning_bahar + winning_crossing
        for bet in all_winners:
            await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": bet["potential_win"]}})
            await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "won", "won_amount": bet["potential_win"]}})
        await db.bets.update_many({"game_id": game_id, "date": result_date, "status": "pending"}, {"$set": {"status": "lost"}})
        
        game_info = games_dict[game_id]
        await send_push_to_all(f"{game_info['name_hi']} - रिजल्ट आ गया!", f"जोड़ी: {jodi} | सिंगल: {single_result}", "/dashboard")
        
        applied.append({"game": game_id, "jodi": jodi, "date": result_date, "winners": len(all_winners)})
        logger.info(f"External push result: {game_info['name_hi']} = {jodi} ({result_date}), Winners: {len(all_winners)}")
    
    return {"applied": applied, "total": len(applied)}


@router.post("/results/webhook")
@router.post("/results/webhook/{webhook_secret}")
async def matkaapi_webhook(request: Request, webhook_secret: str = ""):
    """Public webhook endpoint that matkaapi.com (or any external provider) can POST results to.
    No IP whitelist needed — matkaapi.com pushes results to us instead of us pulling.

    Setup: On matkaapi.com dashboard, set webhook URL to:
        https://matka11.online/api/results/webhook/<RESULT_WEBHOOK_SECRET>

    Accepts multiple JSON shapes (matkaapi.com may differ):
      A) { "gali_result": [ {"game":"GALI","new":"46","time":"23:30"}, ... ] }
      B) { "markets": [ {"name":"DELHI BAZAR","close":"7","time":"15:00"}, ... ] }
      C) { "game":"GALI","new":"46" }   # single result push
      D) form-data with same fields
    """
    expected_secret = os.environ.get("RESULT_WEBHOOK_SECRET", "")
    # Validate secret (path param OR ?secret= OR header X-Webhook-Secret OR body.secret)
    body = {}
    try:
        body = await request.json()
    except Exception:
        try:
            form = await request.form()
            body = dict(form)
        except Exception:
            body = {}

    provided = (
        webhook_secret
        or request.query_params.get("secret", "")
        or request.headers.get("X-Webhook-Secret", "")
        or body.get("secret", "")
    )
    if expected_secret and provided != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    # Build list of {market_name, jodi}
    incoming = []

    def _add(name, jodi):
        from routes.admin_routes import _normalize_jodi as _nj  # safe self-import
        nj = _normalize_jodi(jodi)
        if name and nj:
            incoming.append({"market_name": str(name).upper().strip(), "jodi": nj})

    # Shape A: gali_result list
    for r in (body.get("gali_result") or []):
        _add(r.get("game") or r.get("market"), r.get("new") or r.get("result") or r.get("jodi"))

    # Shape B: markets list (open+close)
    for r in (body.get("markets") or body.get("market_result") or []):
        jodi = r.get("jodi") or r.get("result") or r.get("new")
        if not jodi:
            opn = str(r.get("open", "")).strip()
            cls = str(r.get("close", "")).strip()
            if opn.isdigit() and cls.isdigit():
                jodi = f"{opn[-1]}{cls[-1]}"
        _add(r.get("name") or r.get("market"), jodi)

    # Shape C/D: single result fields at top-level
    if not incoming:
        single_jodi = body.get("new") or body.get("jodi") or body.get("result")
        single_name = body.get("game") or body.get("market") or body.get("name")
        if single_jodi and single_name:
            _add(single_name, single_jodi)

    if not incoming:
        return {"applied": 0, "received": 0, "hint": "No recognizable result fields. Expected one of: gali_result[], markets[], or top-level {game,new}."}

    games_dict = await get_games_dict()
    ist_now = datetime.now(IST)
    result_date = ist_now.strftime("%Y-%m-%d")

    applied = []
    skipped_no_match = []
    skipped_existing = []
    for r in incoming:
        market_name = r["market_name"]
        jodi = r["jodi"]
        game_id = _match_market_to_game(market_name)
        if not game_id or game_id not in games_dict:
            skipped_no_match.append(market_name)
            continue
        existing = await db.results.find_one({"game_id": game_id, "date": result_date})
        if existing:
            skipped_existing.append(f"{market_name}={jodi}")
            continue

        single_result = jodi[-1]
        await db.results.insert_one({
            "id": str(uuid.uuid4()), "game_id": game_id, "date": result_date,
            "single_result": single_result, "jodi_result": jodi,
            "declared_at": datetime.now(timezone.utc), "auto_declared": True
        })

        andar_digit = jodi[0]
        bahar_digit = jodi[1]
        winning_jodi = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "jodi", "number": jodi, "status": "pending"}).to_list(1000)
        winning_andar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_andar", "number": andar_digit, "status": "pending"}).to_list(1000)
        winning_bahar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_bahar", "number": bahar_digit, "status": "pending"}).to_list(1000)
        winning_crossing = []
        for cb in await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "crossing", "status": "pending"}).to_list(1000):
            cn = cb.get("number", "")
            if len(cn) == 2 and ((cn[0] == andar_digit and cn[1] == bahar_digit) or (cn[0] == bahar_digit and cn[1] == andar_digit)):
                winning_crossing.append(cb)

        all_winners = winning_jodi + winning_andar + winning_bahar + winning_crossing
        for bet in all_winners:
            await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": bet["potential_win"]}})
            await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "won", "won_amount": bet["potential_win"]}})
        await db.bets.update_many({"game_id": game_id, "date": result_date, "status": "pending"}, {"$set": {"status": "lost"}})

        game_info = games_dict[game_id]
        await send_push_to_all(f"{game_info['name_hi']} - रिजल्ट आ गया!", f"जोड़ी: {jodi} | सिंगल: {single_result}", "/dashboard")
        applied.append({"game": game_id, "jodi": jodi, "winners": len(all_winners)})
        logger.info(f"WEBHOOK result: {game_info['name_hi']} = {jodi} ({result_date}), Winners: {len(all_winners)}")

    return {
        "applied": len(applied), "received": len(incoming),
        "results": applied,
        "skipped_no_match": skipped_no_match,
        "skipped_existing": skipped_existing,
    }



# ===== Auto Result Fetch (matkaapi.com) =====

async def _matkaapi_post(client, body):
    """POST to matkaapi.com market_api.php with auth keys merged in."""
    payload = {
        "domain": NEW_MATKA_DOMAIN,
        "api_key": NEW_MATKA_API_KEY,
        "domain_key": NEW_MATKA_DOMAIN_KEY,
        **body,
    }
    resp = await client.post(NEW_MATKA_API_URL, json=payload)
    try:
        return resp.json(), resp.status_code, resp.text[:300]
    except Exception:
        return None, resp.status_code, resp.text[:300]


def _normalize_jodi(val):
    """Accept '7', '07', '46' etc → return 2-digit jodi or None."""
    if val is None:
        return None
    s = str(val).strip()
    if not s.isdigit():
        return None
    if len(s) == 1:
        s = "0" + s
    if len(s) != 2:
        return None
    return s


def _match_market_to_game(raw_name: str):
    """Robust matcher: first try exact MARKET_TO_GAME map, then fall back to keyword
    substring matching so 'DELHI GALI', 'GALI BAZAR', 'NEW DISAWER' etc all map correctly."""
    if not raw_name:
        return None
    name = raw_name.upper().strip()
    # Exact match
    if name in MARKET_TO_GAME:
        return MARKET_TO_GAME[name]
    # Keyword fallback (order matters — longer/more specific keywords first)
    keyword_map = [
        ("DELHI BAZ", "delhi_bazaar"),     # delhi bazar / delhi bazaar
        ("SHRI GANESH", "shri_ganesh"),
        ("SHREE GANESH", "shri_ganesh"),
        ("GANESH", "shri_ganesh"),
        ("FARIDABAD", "faridabad"),
        ("FARIDABA", "faridabad"),
        ("GHAZIABAD", "ghaziabad"),
        ("GAJIYABAD", "ghaziabad"),
        ("GAZIABAD", "ghaziabad"),
        ("GAZIABA", "ghaziabad"),
        ("DISAWER", "disawar"),
        ("DISAWAR", "disawar"),
        ("DESAWAR", "disawar"),
        ("DESAWER", "disawar"),
        ("GALI", "gali"),                  # last so that "DELHI GALI" still maps to gali
    ]
    for kw, gid in keyword_map:
        if kw in name:
            return gid
    return None


async def fetch_matka_results(date_str=None):
    """Fetch results from matkaapi.com (POST market_api.php) and apply winners."""
    if not NEW_MATKA_API_KEY or not NEW_MATKA_DOMAIN_KEY:
        logger.error("matkaapi.com credentials missing (NEW_MATKA_API_KEY/NEW_MATKA_DOMAIN_KEY)")
        return {"error": "matkaapi.com credentials not configured"}

    ist_now = datetime.now(IST)
    if not date_str:
        date_str = ist_now.strftime("%Y-%m-%d")

    api_results = []  # list of {market_name, jodi, time}
    api_errors = []

    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            # 1) Gali/Disawar family (covers GALI, DISAWER, FARIDABAD, GHAZIABAD, DELHI BAZAR, SHRI GANESH)
            try:
                data, status_code, raw = await _matkaapi_post(client, {"gali": "all"})
                if data and data.get("status"):
                    for r in (data.get("gali_result") or []):
                        jodi = _normalize_jodi(r.get("new") or r.get("result") or r.get("jodi"))
                        if jodi:
                            api_results.append({
                                "market_name": (r.get("game") or r.get("market") or "").upper().strip(),
                                "jodi": jodi,
                                "time": r.get("time", ""),
                            })
                else:
                    api_errors.append(f"gali HTTP {status_code}: {(data or {}).get('message') or raw}")
            except Exception as e:
                api_errors.append(f"gali exception: {type(e).__name__}: {e}")

            # 2) General markets (in case some games appear there too)
            try:
                data, status_code, raw = await _matkaapi_post(client, {"market": "all"})
                if data and data.get("status"):
                    for r in (data.get("markets") or data.get("market_result") or []):
                        # General markets sometimes have open+close. Build jodi as last digit of each.
                        jodi = _normalize_jodi(r.get("jodi") or r.get("result") or r.get("new"))
                        if not jodi:
                            opn = str(r.get("open", "")).strip()
                            cls = str(r.get("close", "")).strip()
                            if opn.isdigit() and cls.isdigit():
                                jodi = f"{opn[-1]}{cls[-1]}"
                        if jodi:
                            api_results.append({
                                "market_name": (r.get("name") or r.get("market") or "").upper().strip(),
                                "jodi": jodi,
                                "time": r.get("time", ""),
                            })
                else:
                    api_errors.append(f"market HTTP {status_code}: {(data or {}).get('message') or raw}")
            except Exception as e:
                api_errors.append(f"market exception: {type(e).__name__}: {e}")

        games_dict = await get_games_dict()

        # Dedup by market_name (today's result only)
        seen = set()
        unique = []
        for r in api_results:
            mn = r["market_name"]
            if mn and mn not in seen:
                seen.add(mn)
                unique.append(r)

        results_applied = []
        skipped_no_match = []
        skipped_existing = []

        for r in unique:
            market_name = r["market_name"]
            jodi = r["jodi"]
            result_date = date_str

            game_id = _match_market_to_game(market_name)
            if not game_id or game_id not in games_dict:
                skipped_no_match.append(market_name)
                continue

            existing = await db.results.find_one({"game_id": game_id, "date": result_date})
            if existing:
                skipped_existing.append(f"{market_name}={jodi}@{result_date}")
                continue

            single_result = jodi[-1]
            result_doc = {
                "id": str(uuid.uuid4()), "game_id": game_id, "date": result_date,
                "single_result": single_result, "jodi_result": jodi,
                "declared_at": datetime.now(timezone.utc), "auto_declared": True
            }
            await db.results.insert_one(result_doc)

            andar_digit = jodi[0]
            bahar_digit = jodi[1]

            winning_jodi = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "jodi", "number": jodi, "status": "pending"}).to_list(1000)
            winning_andar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_andar", "number": andar_digit, "status": "pending"}).to_list(1000)
            winning_bahar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_bahar", "number": bahar_digit, "status": "pending"}).to_list(1000)

            winning_crossing = []
            crossing_bets = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "crossing", "status": "pending"}).to_list(1000)
            for cb in crossing_bets:
                cn = cb.get("number", "")
                if len(cn) == 2:
                    d1, d2 = cn[0], cn[1]
                    if (d1 == andar_digit and d2 == bahar_digit) or (d1 == bahar_digit and d2 == andar_digit):
                        winning_crossing.append(cb)

            all_winners = winning_jodi + winning_andar + winning_bahar + winning_crossing
            for bet in all_winners:
                await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": bet["potential_win"]}})
                await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "won", "won_amount": bet["potential_win"]}})

            await db.bets.update_many({"game_id": game_id, "date": result_date, "status": "pending"}, {"$set": {"status": "lost"}})

            game_info = games_dict[game_id]
            push_title = f"{game_info['name_hi']} - रिजल्ट आ गया!"
            push_body = f"जोड़ी: {jodi} | सिंगल: {single_result}"
            await send_push_to_all(push_title, push_body, "/dashboard")

            results_applied.append({"game": game_id, "jodi": jodi, "date": result_date, "winners": len(all_winners)})
            logger.info(f"matkaapi.com auto-result: {game_info['name_hi']} = {jodi} ({result_date}), Winners: {len(all_winners)}")

        if api_errors:
            logger.warning(f"matkaapi.com errors: {api_errors}")
        if skipped_existing:
            logger.info(f"matkaapi.com skipped (already exist): {skipped_existing}")
        if skipped_no_match and len(results_applied) == 0:
            logger.info(f"matkaapi.com no match for: {skipped_no_match[:20]}")
        # ALL market names seen from API (for debugging in admin debug endpoint)
        all_market_names = [r["market_name"] for r in unique]
        return {
            "results_applied": results_applied,
            "total": len(results_applied),
            "skipped_existing": len(skipped_existing),
            "skipped_no_match": skipped_no_match[:20],
            "all_market_names_from_api": all_market_names[:30],
            "api_results_count": len(unique),
            "errors": api_errors,
        }

    except Exception as e:
        logger.error(f"matkaapi.com fetch error: {e}")
        return {"error": str(e)}


async def push_results_to_production(results_applied):
    """Push newly declared results to production server"""
    prod_url = os.environ.get("PRODUCTION_URL", "")
    if not prod_url or not results_applied:
        return
    jwt_secret = os.environ.get("JWT_SECRET", "")
    try:
        payload = {
            "secret": jwt_secret,
            "results": [{"game_id": r["game"], "jodi": r["jodi"], "date": r["date"]} for r in results_applied]
        }
        async with httpx.AsyncClient(timeout=15, verify=False) as client:
            resp = await client.post(f"{prod_url}/api/admin/results/push-external", json=payload)
            logger.info(f"Push to production: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        logger.error(f"Push to production failed: {e}")


async def auto_fetch_loop():
    import config
    config.auto_fetch_running = True
    logger.info(f"Auto-result fetch loop started (matkaapi.com domain={NEW_MATKA_DOMAIN})")
    # First fetch immediately on startup
    try:
        result = await fetch_matka_results()
        total = result.get("total", 0)
        logger.info(f"Auto-fetch initial: {total} new results declared")
        if total > 0:
            await push_results_to_production(result.get("results_applied", []))
    except Exception as e:
        logger.error(f"Auto-fetch initial error: {e}")
    # Then loop every 2 minutes (faster so production gets results sooner)
    while config.auto_fetch_running:
        await asyncio.sleep(120)
        try:
            result = await fetch_matka_results()
            if result.get("total", 0) > 0:
                logger.info(f"Auto-fetch: {result['total']} new results declared")
                await push_results_to_production(result.get("results_applied", []))
            elif result.get("error"):
                logger.error(f"Auto-fetch error: {result['error']}")
        except Exception as e:
            logger.error(f"Auto-fetch loop error: {e}")


async def expire_pending_deposits_loop():
    """Mark pending deposits as expired after 2 hours"""
    logger.info("Pending deposit expiry loop started (2 hour timeout)")
    while True:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
            result = await db.transactions.update_many(
                {"type": "deposit", "status": "pending", "created_at": {"$lt": cutoff}},
                {"$set": {"status": "expired"}}
            )
            if result.modified_count > 0:
                logger.info(f"Expired {result.modified_count} pending deposits (2 hours)")
        except Exception as e:
            logger.error(f"Deposit expiry loop error: {e}")
        await asyncio.sleep(120)



@router.post("/admin/results/auto-fetch")
async def trigger_auto_fetch(request: Request):
    await get_admin_user(request)
    result = await fetch_matka_results()
    return result


@router.post("/admin/results/auto-fetch-public")
async def trigger_auto_fetch_public(request: Request):
    """JWT-secret authenticated endpoint so prod can be triggered without admin login.
    This allows preview to POKE prod to run its own auto-fetch. Useful as fallback
    when preview itself cannot push or when prod should self-declare."""
    body = await request.json()
    if body.get("secret", "") != os.environ.get("JWT_SECRET", ""):
        raise HTTPException(status_code=403, detail="Invalid secret")
    result = await fetch_matka_results()
    return result


# ===== Stripe Webhook =====

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)

        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            transaction = await db.transactions.find_one({"session_id": session_id})

            if transaction and transaction["status"] != "completed":
                await db.users.update_one({"_id": ObjectId(transaction["user_id"])}, {"$inc": {"balance": transaction["amount"]}})
                await db.transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
                )
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "status": "completed"}}
                )

        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}
