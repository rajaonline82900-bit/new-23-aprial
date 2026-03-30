from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Body
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from bson import ObjectId
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from notifications import notification_service

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# Password utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT utilities
def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    balance: float
    created_at: datetime

# Game Configuration - Fixed Time Slots
GAMES = {
    "delhi_bazaar": {"name": "Delhi Bazaar", "name_hi": "दिल्ली बाजार", "time": "15:00", "display_time": "3:00 PM"},
    "shri_ganesh": {"name": "Shri Ganesh", "name_hi": "श्री गणेश", "time": "18:00", "display_time": "6:00 PM"},
    "faridabad": {"name": "Faridabad", "name_hi": "फरीदाबाद", "time": "18:15", "display_time": "6:15 PM"},
    "ghaziabad": {"name": "Ghaziabad", "name_hi": "गाजियाबाद", "time": "20:30", "display_time": "8:30 PM"},
    "gali": {"name": "Gali", "name_hi": "गली", "time": "23:30", "display_time": "11:30 PM"},
    "disawar": {"name": "Disawar", "name_hi": "दिसावर", "time": "05:00", "display_time": "5:00 AM"}
}

# Bet Types
BET_TYPES = {
    "single": {"name": "Single", "name_hi": "एकल अंक", "multiplier": 9},  # 0-9
    "jodi": {"name": "Jodi", "name_hi": "जोड़ी", "multiplier": 90}  # 00-99
}

# Deposit packages (fixed amounts for security)
DEPOSIT_PACKAGES = {
    "100": 100.0,
    "500": 500.0,
    "1000": 1000.0,
    "2000": 2000.0,
    "5000": 5000.0
}

class BetCreate(BaseModel):
    game_id: str
    bet_type: str  # single or jodi
    number: str  # "0-9" for single, "00-99" for jodi
    amount: float

class WithdrawRequest(BaseModel):
    amount: float
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None

class DepositRequest(BaseModel):
    package_id: str
    origin_url: str

class ResultDeclare(BaseModel):
    game_id: str
    date: str  # YYYY-MM-DD
    single_result: str  # 0-9
    jodi_result: str  # 00-99

class NotificationSubscribe(BaseModel):
    telegram_chat_id: Optional[str] = None
    whatsapp_number: Optional[str] = None

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister, response: Request):
    from starlette.responses import JSONResponse
    
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user_data.password)
    user_doc = {
        "name": user_data.name,
        "email": email,
        "phone": user_data.phone,
        "password_hash": hashed,
        "role": "user",
        "balance": 0.0,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    resp = JSONResponse(content={
        "id": user_id,
        "name": user_data.name,
        "email": email,
        "role": "user",
        "balance": 0.0
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return resp

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    from starlette.responses import JSONResponse
    
    email = user_data.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    resp = JSONResponse(content={
        "id": user_id,
        "name": user["name"],
        "email": email,
        "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0)
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return resp

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user.get("phone"),
        "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0)
    }

@api_router.post("/auth/logout")
async def logout():
    from starlette.responses import JSONResponse
    resp = JSONResponse(content={"message": "Logged out successfully"})
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")
    return resp

# Games Routes
@api_router.get("/games")
async def get_games():
    games_list = []
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    for game_id, game in GAMES.items():
        # Get latest result for this game
        latest_result = await db.results.find_one(
            {"game_id": game_id},
            sort=[("date", -1)]
        )
        
        games_list.append({
            "id": game_id,
            "name": game["name"],
            "name_hi": game["name_hi"],
            "time": game["time"],
            "display_time": game["display_time"],
            "latest_result": {
                "single": latest_result["single_result"] if latest_result else "-",
                "jodi": latest_result["jodi_result"] if latest_result else "--",
                "date": latest_result["date"] if latest_result else None
            } if latest_result else None
        })
    
    return {"games": games_list}

@api_router.get("/games/{game_id}")
async def get_game(game_id: str):
    if game_id not in GAMES:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = GAMES[game_id]
    
    # Get last 10 results
    results = await db.results.find(
        {"game_id": game_id},
        {"_id": 0}
    ).sort("date", -1).limit(10).to_list(10)
    
    return {
        "id": game_id,
        "name": game["name"],
        "name_hi": game["name_hi"],
        "time": game["time"],
        "display_time": game["display_time"],
        "results": results
    }

# Betting Routes
@api_router.post("/bets")
async def place_bet(bet: BetCreate, request: Request):
    user = await get_current_user(request)
    
    if bet.game_id not in GAMES:
        raise HTTPException(status_code=400, detail="Invalid game")
    
    if bet.bet_type not in BET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid bet type")
    
    # Validate number
    if bet.bet_type == "single":
        if not bet.number.isdigit() or len(bet.number) != 1:
            raise HTTPException(status_code=400, detail="Single bet must be 0-9")
    else:  # jodi
        if not bet.number.isdigit() or len(bet.number) != 2:
            raise HTTPException(status_code=400, detail="Jodi bet must be 00-99")
    
    if bet.amount < 10:
        raise HTTPException(status_code=400, detail="Minimum bet is ₹10")
    
    if bet.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Deduct balance
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"balance": -bet.amount}}
    )
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    bet_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "game_id": bet.game_id,
        "game_name": GAMES[bet.game_id]["name"],
        "bet_type": bet.bet_type,
        "number": bet.number,
        "amount": bet.amount,
        "potential_win": bet.amount * BET_TYPES[bet.bet_type]["multiplier"],
        "date": today,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.bets.insert_one(bet_doc)
    
    return {
        "message": "Bet placed successfully",
        "bet_id": bet_doc["id"],
        "potential_win": bet_doc["potential_win"]
    }

@api_router.get("/bets")
async def get_user_bets(request: Request, limit: int = 50):
    user = await get_current_user(request)
    
    bets = await db.bets.find(
        {"user_id": user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"bets": bets}

# Wallet Routes
@api_router.get("/wallet")
async def get_wallet(request: Request):
    user = await get_current_user(request)
    
    # Get recent transactions
    transactions = await db.transactions.find(
        {"user_id": user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "balance": user.get("balance", 0.0),
        "transactions": transactions
    }

@api_router.post("/wallet/deposit")
async def create_deposit(deposit: DepositRequest, request: Request):
    user = await get_current_user(request)
    
    if deposit.package_id not in DEPOSIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid deposit package")
    
    amount = DEPOSIT_PACKAGES[deposit.package_id]
    
    # Create Stripe checkout session
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{deposit.origin_url}/wallet?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{deposit.origin_url}/wallet"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(amount),
        currency="inr",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["_id"],
            "package_id": deposit.package_id,
            "type": "deposit"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create pending transaction
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "type": "deposit",
        "amount": amount,
        "status": "pending",
        "session_id": session.session_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(transaction_doc)
    
    # Also add to payment_transactions collection
    payment_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "email": user["email"],
        "amount": amount,
        "currency": "inr",
        "session_id": session.session_id,
        "payment_status": "pending",
        "status": "initiated",
        "metadata": {"package_id": deposit.package_id, "type": "deposit"},
        "created_at": datetime.now(timezone.utc)
    }
    await db.payment_transactions.insert_one(payment_doc)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/wallet/deposit/status/{session_id}")
async def check_deposit_status(session_id: str, request: Request):
    user = await get_current_user(request)
    
    # Get transaction
    transaction = await db.transactions.find_one({
        "session_id": session_id,
        "user_id": user["_id"]
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["status"] == "completed":
        return {"status": "completed", "payment_status": "paid", "amount": transaction["amount"]}
    
    # Check with Stripe
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        
        if status.payment_status == "paid" and transaction["status"] != "completed":
            # Update user balance
            await db.users.update_one(
                {"_id": ObjectId(user["_id"])},
                {"$inc": {"balance": transaction["amount"]}}
            )
            
            # Update transaction
            await db.transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
            )
            
            # Update payment_transactions
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "status": "completed"}}
            )
            
            return {"status": "completed", "payment_status": "paid", "amount": transaction["amount"]}
        
        return {"status": status.status, "payment_status": status.payment_status, "amount": transaction["amount"]}
    except Exception as e:
        logging.error(f"Stripe status check error: {e}")
        return {"status": transaction["status"], "payment_status": "unknown", "amount": transaction["amount"]}

@api_router.post("/wallet/withdraw")
async def request_withdrawal(withdraw: WithdrawRequest, request: Request):
    user = await get_current_user(request)
    
    if withdraw.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is ₹100")
    
    if withdraw.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if not withdraw.upi_id and not (withdraw.bank_account and withdraw.ifsc_code):
        raise HTTPException(status_code=400, detail="Provide UPI ID or bank details")
    
    # Deduct balance
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"balance": -withdraw.amount}}
    )
    
    # Create withdrawal request
    withdrawal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "user_email": user["email"],
        "user_name": user["name"],
        "type": "withdrawal",
        "amount": withdraw.amount,
        "upi_id": withdraw.upi_id,
        "bank_account": withdraw.bank_account,
        "ifsc_code": withdraw.ifsc_code,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(withdrawal_doc)
    
    return {"message": "Withdrawal request submitted", "id": withdrawal_doc["id"]}

# Results Routes
@api_router.get("/results")
async def get_all_results(limit: int = 50):
    results = await db.results.find(
        {},
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    # Add game names
    for result in results:
        if result["game_id"] in GAMES:
            result["game_name"] = GAMES[result["game_id"]]["name"]
            result["game_name_hi"] = GAMES[result["game_id"]]["name_hi"]
    
    return {"results": results}

@api_router.get("/results/{game_id}")
async def get_game_results(game_id: str, limit: int = 30):
    if game_id not in GAMES:
        raise HTTPException(status_code=404, detail="Game not found")
    
    results = await db.results.find(
        {"game_id": game_id},
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    return {"results": results, "game": GAMES[game_id]}

# Stripe Webhook
@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
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
            
            # Find transaction
            transaction = await db.transactions.find_one({"session_id": session_id})
            
            if transaction and transaction["status"] != "completed":
                # Update user balance
                await db.users.update_one(
                    {"_id": ObjectId(transaction["user_id"])},
                    {"$inc": {"balance": transaction["amount"]}}
                )
                
                # Update transaction
                await db.transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
                )
                
                # Update payment_transactions
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "status": "completed"}}
                )
        
        return {"received": True}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"received": True}

# Admin Routes
@api_router.post("/admin/results")
async def declare_result(result: ResultDeclare, request: Request):
    await get_admin_user(request)
    
    if result.game_id not in GAMES:
        raise HTTPException(status_code=400, detail="Invalid game")
    
    # Validate results
    if not result.single_result.isdigit() or len(result.single_result) != 1:
        raise HTTPException(status_code=400, detail="Single result must be 0-9")
    
    if not result.jodi_result.isdigit() or len(result.jodi_result) != 2:
        raise HTTPException(status_code=400, detail="Jodi result must be 00-99")
    
    # Check if result already exists
    existing = await db.results.find_one({
        "game_id": result.game_id,
        "date": result.date
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Result already declared for this date")
    
    # Save result
    result_doc = {
        "id": str(uuid.uuid4()),
        "game_id": result.game_id,
        "date": result.date,
        "single_result": result.single_result,
        "jodi_result": result.jodi_result,
        "declared_at": datetime.now(timezone.utc)
    }
    await db.results.insert_one(result_doc)
    
    # Process winning bets
    winning_single_bets = await db.bets.find({
        "game_id": result.game_id,
        "date": result.date,
        "bet_type": "single",
        "number": result.single_result,
        "status": "pending"
    }).to_list(1000)
    
    winning_jodi_bets = await db.bets.find({
        "game_id": result.game_id,
        "date": result.date,
        "bet_type": "jodi",
        "number": result.jodi_result,
        "status": "pending"
    }).to_list(1000)
    
    # Credit winnings
    for bet in winning_single_bets:
        await db.users.update_one(
            {"_id": ObjectId(bet["user_id"])},
            {"$inc": {"balance": bet["potential_win"]}}
        )
        await db.bets.update_one(
            {"id": bet["id"]},
            {"$set": {"status": "won", "won_amount": bet["potential_win"]}}
        )
    
    for bet in winning_jodi_bets:
        await db.users.update_one(
            {"_id": ObjectId(bet["user_id"])},
            {"$inc": {"balance": bet["potential_win"]}}
        )
        await db.bets.update_one(
            {"id": bet["id"]},
            {"$set": {"status": "won", "won_amount": bet["potential_win"]}}
        )
    
    # Mark losing bets
    await db.bets.update_many(
        {
            "game_id": result.game_id,
            "date": result.date,
            "status": "pending"
        },
        {"$set": {"status": "lost"}}
    )
    
    # Send notifications to all subscribers
    subscribers = await db.notification_subscribers.find({}).to_list(1000)
    if subscribers:
        game_info = GAMES[result.game_id]
        notification_result = await notification_service.send_result_notification(
            game_name=game_info["name"],
            game_name_hi=game_info["name_hi"],
            date=result.date,
            single_result=result.single_result,
            jodi_result=result.jodi_result,
            subscribers=subscribers
        )
        logger.info(f"Notifications sent: {notification_result}")
    
    return {
        "message": "Result declared successfully",
        "winners": {
            "single": len(winning_single_bets),
            "jodi": len(winning_jodi_bets)
        }
    }

@api_router.get("/admin/users")
async def get_all_users(request: Request, skip: int = 0, limit: int = 50):
    await get_admin_user(request)
    
    users = await db.users.find(
        {},
        {"password_hash": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    for user in users:
        user["_id"] = str(user["_id"])
    
    total = await db.users.count_documents({})
    
    return {"users": users, "total": total}

@api_router.get("/admin/withdrawals")
async def get_withdrawals(request: Request, status: str = "pending"):
    await get_admin_user(request)
    
    withdrawals = await db.transactions.find(
        {"type": "withdrawal", "status": status},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"withdrawals": withdrawals}

@api_router.post("/admin/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, request: Request):
    await get_admin_user(request)
    
    result = await db.transactions.update_one(
        {"id": withdrawal_id, "type": "withdrawal", "status": "pending"},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Withdrawal not found or already processed")
    
    return {"message": "Withdrawal approved"}

@api_router.post("/admin/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str, request: Request):
    await get_admin_user(request)
    
    # Get withdrawal
    withdrawal = await db.transactions.find_one({"id": withdrawal_id, "type": "withdrawal", "status": "pending"})
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found or already processed")
    
    # Refund balance
    await db.users.update_one(
        {"_id": ObjectId(withdrawal["user_id"])},
        {"$inc": {"balance": withdrawal["amount"]}}
    )
    
    # Update status
    await db.transactions.update_one(
        {"id": withdrawal_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Withdrawal rejected and amount refunded"}

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    await get_admin_user(request)
    
    total_users = await db.users.count_documents({})
    total_bets = await db.bets.count_documents({})
    pending_withdrawals = await db.transactions.count_documents({"type": "withdrawal", "status": "pending"})
    
    # Today's stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_bets = await db.bets.count_documents({"date": today})
    
    # Notification stats
    notification_status = notification_service.get_status()
    total_subscribers = await db.notification_subscribers.count_documents({})
    
    return {
        "total_users": total_users,
        "total_bets": total_bets,
        "pending_withdrawals": pending_withdrawals,
        "today_bets": today_bets,
        "notifications": {
            **notification_status,
            "total_subscribers": total_subscribers
        }
    }

# Notification Routes
@api_router.post("/notifications/subscribe")
async def subscribe_notifications(data: NotificationSubscribe, request: Request):
    user = await get_current_user(request)
    
    if not data.telegram_chat_id and not data.whatsapp_number:
        raise HTTPException(status_code=400, detail="Provide Telegram chat ID or WhatsApp number")
    
    # Check if already subscribed
    existing = await db.notification_subscribers.find_one({"user_id": user["_id"]})
    
    subscription_doc = {
        "user_id": user["_id"],
        "email": user["email"],
        "telegram_chat_id": data.telegram_chat_id,
        "whatsapp_number": data.whatsapp_number,
        "subscribed_at": datetime.now(timezone.utc)
    }
    
    if existing:
        await db.notification_subscribers.update_one(
            {"user_id": user["_id"]},
            {"$set": subscription_doc}
        )
    else:
        await db.notification_subscribers.insert_one(subscription_doc)
    
    return {"message": "Subscribed to notifications successfully"}

@api_router.delete("/notifications/unsubscribe")
async def unsubscribe_notifications(request: Request):
    user = await get_current_user(request)
    
    result = await db.notification_subscribers.delete_one({"user_id": user["_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not subscribed")
    
    return {"message": "Unsubscribed from notifications"}

@api_router.get("/notifications/status")
async def get_notification_status(request: Request):
    user = await get_current_user(request)
    
    subscription = await db.notification_subscribers.find_one(
        {"user_id": user["_id"]},
        {"_id": 0, "user_id": 0}
    )
    
    service_status = notification_service.get_status()
    
    return {
        "subscribed": subscription is not None,
        "subscription": subscription,
        "service_status": service_status
    }

@api_router.get("/notifications/telegram-instructions")
async def get_telegram_instructions():
    """Get instructions for setting up Telegram notifications"""
    return {
        "steps": [
            "1. Telegram में @SattaMatkaResultBot खोजें (या admin द्वारा बताया गया bot)",
            "2. Bot को /start भेजें",
            "3. Bot आपको आपका Chat ID देगा",
            "4. वह Chat ID यहाँ दर्ज करें"
        ],
        "note": "रिजल्ट घोषित होते ही आपको Telegram पर notification मिलेगी"
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Seed admin on startup
@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.bets.create_index([("user_id", 1), ("created_at", -1)])
    await db.results.create_index([("game_id", 1), ("date", -1)])
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sattamatka.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "balance": 0.0,
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info("Admin password updated")
    
    # Write test credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Test User (Create via registration)
- Email: test@example.com
- Password: Test@123
- Role: user

## API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- GET /api/games
- POST /api/bets
- GET /api/bets
- GET /api/wallet
- POST /api/wallet/deposit
- POST /api/wallet/withdraw
- GET /api/results
- POST /api/admin/results
- GET /api/admin/users
- GET /api/admin/withdrawals
""")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
