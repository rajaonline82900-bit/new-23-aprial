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
    matka_api_tokens
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
async def get_all_users(request: Request, skip: int = 0, limit: int = 50):
    await get_admin_user(request)
    users = await db.users.find({}, {"password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    for user in users:
        user["_id"] = str(user["_id"])
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
async def get_admin_deposits(request: Request, skip: int = 0, limit: int = 50):
    await get_admin_user(request)
    deposits = await db.transactions.find(
        {"type": "deposit", "status": "completed"}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for d in deposits:
        user = await db.users.find_one({"_id": ObjectId(d["user_id"])}, {"name": 1, "phone": 1, "email": 1})
        if user:
            d["user_name"] = user.get("name", "")
            d["user_phone"] = user.get("phone", "")
            d["user_email"] = user.get("email", "")

    total = await db.transactions.count_documents({"type": "deposit", "status": "completed"})
    total_amount = sum(d.get("amount", 0) for d in deposits)
    return {"deposits": deposits, "total": total, "total_amount": total_amount}


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


# ===== Jantri Report =====

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


# ===== Auto Result Fetch =====

async def refresh_matka_token(group="delhi"):
    endpoint = "get-refresh-token-delhi" if group == "delhi" else "get-refresh-token"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{MATKA_API_BASE}/{endpoint}",
                data={"username": MATKA_API_USERNAME, "password": MATKA_API_PASSWORD}
            )
            data = resp.json()
            if data.get("status"):
                matka_api_tokens[group] = data["refresh_token"]
                logger.info(f"Matka API [{group}] token refreshed: {matka_api_tokens[group][:8]}...")
                return True
    except Exception as e:
        logger.error(f"Matka API [{group}] token refresh failed: {e}")
    return False


async def fetch_from_endpoint(client, endpoint, token, market_name, date_str):
    resp = await client.post(
        f"{MATKA_API_BASE}/{endpoint}",
        data={"username": MATKA_API_USERNAME, "API_token": token, "markte_name": market_name, "date": date_str}
    )
    return resp.json()


async def fetch_matka_results(date_str=None):
    if not MATKA_API_USERNAME or not MATKA_API_PASSWORD:
        return {"error": "Matka API credentials not configured"}

    for group in ["delhi", "general"]:
        if not matka_api_tokens[group]:
            await refresh_matka_token(group)

    ist_now = datetime.now(IST)
    if not date_str:
        date_str = ist_now.strftime("%Y-%m-%d")

    all_api_results = []

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for group, endpoint in [("delhi", "market-data-delhi"), ("general", "market-data")]:
                token = matka_api_tokens.get(group)
                if not token:
                    continue
                try:
                    data = await fetch_from_endpoint(client, endpoint, token, "", date_str)
                    if not data.get("status"):
                        if await refresh_matka_token(group):
                            token = matka_api_tokens[group]
                            data = await fetch_from_endpoint(client, endpoint, token, "", date_str)
                    if data.get("status"):
                        all_api_results += data.get("today_result", []) + data.get("old_result", [])
                except Exception as e:
                    logger.error(f"Matka API [{group}] fetch error: {e}")

            for group, endpoint in [("delhi", "market-data-delhi"), ("general", "market-data")]:
                token = matka_api_tokens.get(group)
                if not token:
                    continue
                try:
                    data = await fetch_from_endpoint(client, endpoint, token, "DISAWER", date_str)
                    if data.get("status"):
                        all_api_results += data.get("today_result", []) + data.get("old_result", [])
                except Exception:
                    pass

        games_dict = await get_games_dict()

        seen_keys = set()
        unique_results = []
        for r in all_api_results:
            key = f"{r.get('market_name','').upper().strip()}|{r.get('aankdo_date','')}"
            if key not in seen_keys:
                seen_keys.add(key)
                unique_results.append(r)

        results_applied = []
        for r in unique_results:
            market_name = r.get("market_name", "").upper().strip()
            jodi = r.get("jodi", "").strip()
            result_date = r.get("aankdo_date", "").strip()

            if not jodi or not result_date or len(jodi) != 2 or not jodi.isdigit():
                continue

            game_id = MARKET_TO_GAME.get(market_name)
            if not game_id or game_id not in games_dict:
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
            logger.info(f"Auto-result: {game_info['name_hi']} = {jodi} ({result_date}), Winners: {len(all_winners)}")

        return {"results_applied": results_applied, "total": len(results_applied)}

    except Exception as e:
        logger.error(f"Matka API fetch error: {e}")
        return {"error": str(e)}


async def auto_fetch_loop():
    import config
    config.auto_fetch_running = True
    logger.info("Auto-result fetch loop started")
    while config.auto_fetch_running:
        try:
            result = await fetch_matka_results()
            if result.get("total", 0) > 0:
                logger.info(f"Auto-fetch: {result['total']} new results declared")
        except Exception as e:
            logger.error(f"Auto-fetch loop error: {e}")
        await asyncio.sleep(300)


async def expire_pending_deposits_loop():
    """Mark pending deposits as failed after 10 minutes"""
    logger.info("Pending deposit expiry loop started")
    while True:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
            result = await db.transactions.update_many(
                {"type": "deposit", "status": "pending", "created_at": {"$lt": cutoff}},
                {"$set": {"status": "failed"}}
            )
            if result.modified_count > 0:
                logger.info(f"Expired {result.modified_count} pending deposits")
        except Exception as e:
            logger.error(f"Deposit expiry loop error: {e}")
        await asyncio.sleep(120)



@router.post("/admin/results/auto-fetch")
async def trigger_auto_fetch(request: Request):
    await get_admin_user(request)
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
