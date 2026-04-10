from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging
import uuid

from database import db
from auth import get_current_user, get_admin_user
from config import GAMES, IST
from helpers import get_games_dict, send_push_to_all
from models import ResultDeclare
from notifications import notification_service

router = APIRouter()


@router.get("/results")
async def get_all_results(limit: int = 50):
    results = await db.results.find({}, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)

    for result in results:
        if result["game_id"] in GAMES:
            result["game_name"] = GAMES[result["game_id"]]["name"]
            result["game_name_hi"] = GAMES[result["game_id"]]["name_hi"]

    return {"results": results}


@router.get("/results/{game_id}")
async def get_game_results(game_id: str, limit: int = 30):
    if game_id not in GAMES:
        raise HTTPException(status_code=404, detail="Game not found")

    results = await db.results.find(
        {"game_id": game_id}, {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)

    return {"results": results, "game": GAMES[game_id]}


@router.post("/admin/results")
async def declare_result(result: ResultDeclare, request: Request):
    await get_admin_user(request)

    games_dict = await get_games_dict()
    if result.game_id not in games_dict:
        raise HTTPException(status_code=400, detail="Invalid game")

    if not result.jodi_result.isdigit() or len(result.jodi_result) != 2:
        raise HTTPException(status_code=400, detail="Jodi result must be 00-99")

    single_result = result.jodi_result[-1]

    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    result_date = result.date if result.date else ist_now.strftime("%Y-%m-%d")

    existing = await db.results.find_one({"game_id": result.game_id, "date": result_date})

    if existing:
        raise HTTPException(status_code=400, detail=f"इस दिनांक ({result_date}) का रिजल्ट पहले से घोषित है। पहले रिवर्स करें।")

    result_doc = {
        "id": str(uuid.uuid4()),
        "game_id": result.game_id,
        "date": result_date,
        "single_result": single_result,
        "jodi_result": result.jodi_result,
        "declared_at": datetime.now(timezone.utc)
    }
    await db.results.insert_one(result_doc)

    # Process winning bets
    winning_single_bets = await db.bets.find({
        "game_id": result.game_id, "date": result_date,
        "bet_type": "single", "number": single_result, "status": "pending"
    }).to_list(1000)

    winning_jodi_bets = await db.bets.find({
        "game_id": result.game_id, "date": result_date,
        "bet_type": "jodi", "number": result.jodi_result, "status": "pending"
    }).to_list(1000)

    andar_digit = result.jodi_result[0]
    winning_andar_bets = await db.bets.find({
        "game_id": result.game_id, "date": result_date,
        "bet_type": "haruf_andar", "number": andar_digit, "status": "pending"
    }).to_list(1000)

    bahar_digit = result.jodi_result[1]
    winning_bahar_bets = await db.bets.find({
        "game_id": result.game_id, "date": result_date,
        "bet_type": "haruf_bahar", "number": bahar_digit, "status": "pending"
    }).to_list(1000)

    all_winners = winning_single_bets + winning_jodi_bets + winning_andar_bets + winning_bahar_bets
    for bet in all_winners:
        await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": bet["potential_win"]}})
        await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "won", "won_amount": bet["potential_win"]}})

    await db.bets.update_many(
        {"game_id": result.game_id, "date": result_date, "status": "pending"},
        {"$set": {"status": "lost"}}
    )

    subscribers = await db.notification_subscribers.find({}).to_list(1000)
    if subscribers:
        game_info = games_dict[result.game_id]
        notification_result = await notification_service.send_result_notification(
            game_name=game_info["name"], game_name_hi=game_info["name_hi"],
            date=result_date, single_result=single_result,
            jodi_result=result.jodi_result, subscribers=subscribers
        )
        logging.info(f"Notifications sent: {notification_result}")

    game_info = games_dict[result.game_id]
    push_title = f"{game_info['name_hi']} - रिजल्ट आ गया!"
    push_body = f"जोड़ी: {result.jodi_result} | सिंगल: {single_result}"
    await send_push_to_all(push_title, push_body, "/dashboard")

    return {
        "message": "Result declared successfully",
        "winners": {
            "single": len(winning_single_bets), "jodi": len(winning_jodi_bets),
            "haruf_andar": len(winning_andar_bets), "haruf_bahar": len(winning_bahar_bets)
        }
    }


@router.get("/admin/results/status")
async def get_results_status(request: Request):
    await get_admin_user(request)

    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    today = ist_now.strftime("%Y-%m-%d")

    games_dict = await get_games_dict()
    game_results = []

    for game_id, game in games_dict.items():
        result = await db.results.find_one({"game_id": game_id, "date": today}, {"_id": 0})
        pending_bets = await db.bets.count_documents({"game_id": game_id, "date": today, "status": "pending"})
        total_bets = await db.bets.count_documents({"game_id": game_id, "date": today})

        game_results.append({
            "game_id": game_id,
            "name": game["name"], "name_hi": game["name_hi"],
            "start_time": game.get("start_time", ""), "end_time": game.get("end_time", ""),
            "declared": result is not None,
            "jodi_result": result["jodi_result"] if result else None,
            "single_result": result["single_result"] if result else None,
            "pending_bets": pending_bets, "total_bets": total_bets
        })

    return {"date": today, "games": game_results}


@router.post("/admin/results/reverse")
async def reverse_result(request: Request):
    await get_admin_user(request)
    body = await request.json()
    game_id = body.get("game_id")
    date = body.get("date")

    if not game_id or not date:
        raise HTTPException(status_code=400, detail="game_id and date required")

    result = await db.results.find_one({"game_id": game_id, "date": date})
    if not result:
        raise HTTPException(status_code=404, detail="इस दिनांक का रिजल्ट नहीं मिला")

    won_bets = await db.bets.find({"game_id": game_id, "date": date, "status": "won"}).to_list(10000)

    deducted_count = 0
    total_deducted = 0
    for bet in won_bets:
        win_amount = bet.get("won_amount", bet.get("potential_win", 0))
        if win_amount > 0:
            await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": -win_amount}})
            total_deducted += win_amount
            deducted_count += 1

    await db.bets.update_many(
        {"game_id": game_id, "date": date, "status": {"$in": ["won", "lost"]}},
        {"$set": {"status": "pending", "won_amount": 0}}
    )

    await db.results.delete_one({"game_id": game_id, "date": date})

    total_reverted = await db.bets.count_documents({"game_id": game_id, "date": date, "status": "pending"})

    return {
        "message": "रिजल्ट रिवर्स हो गया",
        "winnings_deducted": total_deducted,
        "winners_reversed": deducted_count,
        "bets_reverted_to_pending": total_reverted
    }


@router.post("/admin/bets/reverse")
async def reverse_bets(request: Request):
    await get_admin_user(request)
    body = await request.json()
    game_id = body.get("game_id")
    date = body.get("date")
    bet_type = body.get("bet_type")
    user_id = body.get("user_id")

    if not game_id or not date:
        raise HTTPException(status_code=400, detail="game_id and date required")

    bet_filter = {"game_id": game_id, "date": date}
    if bet_type:
        bet_filter["bet_type"] = bet_type
    if user_id:
        bet_filter["user_id"] = user_id

    bets = await db.bets.find(bet_filter).to_list(10000)

    if not bets:
        raise HTTPException(status_code=404, detail="कोई बेट नहीं मिली")

    refunded_count = 0
    total_refunded = 0
    won_deducted = 0

    for bet in bets:
        if bet["status"] == "reversed":
            continue

        if bet["status"] == "won":
            win_amount = bet.get("won_amount", bet.get("potential_win", 0))
            if win_amount > 0:
                await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": -win_amount}})
                won_deducted += win_amount

        await db.users.update_one({"_id": ObjectId(bet["user_id"])}, {"$inc": {"balance": bet["amount"]}})

        await db.bets.update_one({"id": bet["id"]}, {"$set": {"status": "reversed", "won_amount": 0}})

        refunded_count += 1
        total_refunded += bet["amount"]

    return {
        "message": f"{refunded_count} बेट्स रिवर्स हो गईं",
        "bets_reversed": refunded_count,
        "amount_refunded": total_refunded,
        "winnings_deducted": won_deducted
    }
