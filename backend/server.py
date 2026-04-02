from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Body, UploadFile, File
from fastapi.staticfiles import StaticFiles
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

IST = timezone(timedelta(hours=5, minutes=30))
import jwt
from bson import ObjectId
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from notifications import notification_service

import aiohttp

ROOT_DIR = Path(__file__).parent

# IMB Payment Gateway config
IMB_API_TOKEN = os.environ.get("IMB_API_TOKEN", "")
IMB_API_URL = os.environ.get("IMB_API_URL", "https://secure-stage.imb.org.in")

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
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=365), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=365), "type": "refresh"}
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
    phone: str
    password: str

class OTPRequest(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None

class OTPVerify(BaseModel):
    phone: str
    otp: str

class OTPCompleteSignup(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None
    password: str
    referral_code: Optional[str] = None

class PasswordResetRequest(BaseModel):
    phone: str

class PasswordResetComplete(BaseModel):
    phone: str
    otp: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    balance: float
    created_at: datetime

# Game Configuration - Default Games (will be loaded from DB)
DEFAULT_GAMES = {
    "delhi_bazaar": {"name": "Delhi Bazaar", "name_hi": "दिल्ली बाजार", "start_time": "14:00", "end_time": "15:00", "display_time": "3:00 PM", "is_active": True},
    "shri_ganesh": {"name": "Shri Ganesh", "name_hi": "श्री गणेश", "start_time": "17:00", "end_time": "18:00", "display_time": "6:00 PM", "is_active": True},
    "faridabad": {"name": "Faridabad", "name_hi": "फरीदाबाद", "start_time": "17:15", "end_time": "18:15", "display_time": "6:15 PM", "is_active": True},
    "ghaziabad": {"name": "Ghaziabad", "name_hi": "गाजियाबाद", "start_time": "19:30", "end_time": "20:30", "display_time": "8:30 PM", "is_active": True},
    "gali": {"name": "Gali", "name_hi": "गली", "start_time": "22:30", "end_time": "23:30", "display_time": "11:30 PM", "is_active": True},
    "disawar": {"name": "Disawar", "name_hi": "दिसावर", "start_time": "04:00", "end_time": "05:00", "display_time": "5:00 AM", "is_active": True}
}

# This will be populated from DB
GAMES = {}

async def load_games():
    """Load games from database"""
    global GAMES
    games_from_db = await db.games.find({}).to_list(100)
    if games_from_db:
        GAMES = {g["game_id"]: {
            "name": g["name"],
            "name_hi": g["name_hi"],
            "start_time": g.get("start_time", g.get("time", "00:00")),
            "end_time": g.get("end_time", g.get("time", "00:00")),
            "time": g.get("end_time", g.get("time", "00:00")),  # For backward compatibility
            "display_time": g["display_time"],
            "is_active": g.get("is_active", True)
        } for g in games_from_db}
    else:
        GAMES = DEFAULT_GAMES.copy()

async def get_games_dict():
    """Get current games configuration"""
    if not GAMES:
        await load_games()
    return GAMES

# Bet Types
BET_TYPES = {
    "single": {"name": "Single", "name_hi": "एकल अंक", "multiplier": 10},  # 0-9
    "jodi": {"name": "Jodi", "name_hi": "जोड़ी", "multiplier": 100},  # 00-99
    "haruf_andar": {"name": "Haruf Andar", "name_hi": "हरूफ अंदर", "multiplier": 10},  # 0-9 left digit
    "haruf_bahar": {"name": "Haruf Bahar", "name_hi": "हरूफ बाहर", "multiplier": 10}  # 0-9 right digit
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

class BatchBetItem(BaseModel):
    number: str
    amount: float

class BatchBetCreate(BaseModel):
    game_id: str
    bet_type: str  # single or jodi
    bets: List[BatchBetItem]

class WithdrawRequest(BaseModel):
    amount: float
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_holder: Optional[str] = None
    scanner_image: Optional[str] = None
    withdrawal_method: Optional[str] = "upi"

class DepositRequest(BaseModel):
    amount: float
    origin_url: str
    customer_mobile: Optional[str] = None

class ResultDeclare(BaseModel):
    game_id: str
    date: str  # YYYY-MM-DD
    jodi_result: str  # 00-99 (single will be auto-calculated from last digit)

class NotificationSubscribe(BaseModel):
    telegram_chat_id: Optional[str] = None
    whatsapp_number: Optional[str] = None

class GameCreate(BaseModel):
    game_id: str
    name: str
    name_hi: str
    start_time: str  # HH:MM format - betting starts
    end_time: str  # HH:MM format - betting ends/result time
    display_time: str  # Display format like "3:00 PM"
    is_active: bool = True

class GameUpdate(BaseModel):
    name: Optional[str] = None
    name_hi: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    display_time: Optional[str] = None
    is_active: Optional[bool] = None

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
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return resp

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    from starlette.responses import JSONResponse
    
    identifier = user_data.phone.strip()
    
    # Check if identifier is email (for admin) or phone number
    if '@' in identifier:
        user = await db.users.find_one({"email": identifier.lower()})
    else:
        user = await db.users.find_one({"phone": identifier})
    
    if not user:
        raise HTTPException(status_code=401, detail="गलत मोबाइल नंबर या पासवर्ड")
    
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="इस अकाउंट में पासवर्ड नहीं है। पासवर्ड रीसेट करें।")
    
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="गलत मोबाइल नंबर या पासवर्ड")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user.get("email") or user.get("phone", ""))
    refresh_token = create_refresh_token(user_id)
    
    resp = JSONResponse(content={
        "id": user_id,
        "name": user["name"],
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0)
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return resp

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["_id"],
        "name": user["name"],
        "email": user.get("email", ""),
        "phone": user.get("phone"),
        "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0),
        "created_at": user.get("created_at", "").isoformat() if user.get("created_at") else None
    }

@api_router.post("/auth/logout")
async def logout():
    from starlette.responses import JSONResponse
    resp = JSONResponse(content={"message": "Logged out successfully"})
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")
    return resp

# Profile Update
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

@api_router.put("/auth/profile")
async def update_profile(update: ProfileUpdate, request: Request):
    user = await get_current_user(request)
    updates = {}
    
    if update.name and update.name.strip():
        updates["name"] = update.name.strip()
    
    if update.email and update.email.strip():
        email_lower = update.email.strip().lower()
        existing = await db.users.find_one({"email": email_lower, "_id": {"$ne": ObjectId(user["_id"])}})
        if existing:
            raise HTTPException(status_code=400, detail="यह ईमेल पहले से उपयोग में है")
        updates["email"] = email_lower
    
    if not updates:
        raise HTTPException(status_code=400, detail="कोई बदलाव नहीं दिया गया")
    
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": updates})
    
    updated = await db.users.find_one({"_id": ObjectId(user["_id"])})
    return {
        "message": "प्रोफ़ाइल अपडेट हो गई",
        "name": updated["name"],
        "email": updated.get("email", "")
    }

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(data: PasswordChange, request: Request):
    user = await get_current_user(request)
    
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="पासवर्ड सेट नहीं है")
    
    if not verify_password(data.current_password, full_user["password_hash"]):
        raise HTTPException(status_code=400, detail="वर्तमान पासवर्ड गलत है")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="नया पासवर्ड कम से कम 6 अक्षर का होना चाहिए")
    
    new_hash = hash_password(data.new_password)
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"password_hash": new_hash}})
    
    return {"message": "पासवर्ड बदल दिया गया"}

# OTP Auth Routes
import random
import httpx

# In-memory OTP store
otp_store = {}

DVHOSTING_API_KEY = os.environ.get("DVHOSTING_API_KEY")
DVHOSTING_API_URL = os.environ.get("DVHOSTING_API_URL")

async def send_sms_otp(phone: str, otp: str):
    """Send OTP via DVHosting SMS API"""
    try:
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            resp = await client.get(
                DVHOSTING_API_URL,
                params={"api_key": DVHOSTING_API_KEY, "number": phone, "otp": otp}
            )
            logging.info(f"DVHosting SMS response for {phone}: {resp.status_code} - {resp.text}")
            return resp.status_code == 200
    except Exception as e:
        logging.error(f"DVHosting SMS error for {phone}: {e}")
        return False

@api_router.post("/auth/otp/send")
async def send_otp(data: OTPRequest):
    phone = data.phone.strip()
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="कृपया सही मोबाइल नंबर दर्ज करें")
    
    # Generate random 4-digit OTP
    otp = str(random.randint(1000, 9999))
    otp_store[phone] = {"otp": otp, "name": data.name, "expires": datetime.now(timezone.utc) + timedelta(minutes=5)}
    
    # Send OTP via DVHosting
    sent = await send_sms_otp(phone, otp)
    if not sent:
        logging.warning(f"SMS sending failed for {phone}, OTP: {otp}")
    
    logging.info(f"OTP for {phone}: {otp}")
    
    return {"message": "OTP भेज दिया गया है"}

@api_router.post("/auth/otp/verify")
async def verify_otp(data: OTPVerify):
    phone = data.phone.strip()
    stored = otp_store.get(phone)
    
    if not stored:
        raise HTTPException(status_code=400, detail="पहले OTP भेजें")
    
    if stored["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="गलत OTP")
    
    if stored["expires"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Mark phone as verified but don't create account yet
    otp_store[phone]["verified"] = True
    
    return {"message": "OTP सत्यापित हो गया", "phone_verified": True}

@api_router.post("/auth/otp/complete-signup")
async def complete_signup(data: OTPCompleteSignup):
    from starlette.responses import JSONResponse
    
    phone = data.phone.strip()
    stored = otp_store.get(phone)
    
    if not stored or not stored.get("verified"):
        raise HTTPException(status_code=400, detail="पहले OTP सत्यापित करें")
    
    # Remove used OTP
    del otp_store[phone]
    
    # Check if user already exists
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="यह मोबाइल नंबर पहले से रजिस्टर्ड है। कृपया लॉगिन करें।")
    
    # Create user with password
    hashed = hash_password(data.password)
    virtual_email = f"user_{phone}@sattamatka.com"
    user_doc = {
        "name": data.name,
        "phone": phone,
        "email": virtual_email,
        "password_hash": hashed,
        "role": "user",
        "balance": 0.0,
        "auth_type": "otp",
        "created_at": datetime.now(timezone.utc)
    }
    
    # Auto-apply referral code if provided via link
    ref_code = (data.referral_code or "").strip().upper()
    if ref_code:
        ref = await db.referrals.find_one({"code": ref_code})
        if ref:
            user_doc["referred_by"] = ref_code
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, phone)
    refresh_token = create_refresh_token(user_id)
    
    resp = JSONResponse(content={
        "id": user_id,
        "name": data.name,
        "email": virtual_email,
        "phone": phone,
        "role": "user",
        "balance": 0.0
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return resp

# Password Reset Routes
@api_router.post("/auth/password/send-otp")
async def password_reset_send_otp(data: PasswordResetRequest):
    phone = data.phone.strip()
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="कृपया सही मोबाइल नंबर दर्ज करें")
    
    # Check if user exists with this phone
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=400, detail="यह मोबाइल नंबर रजिस्टर्ड नहीं है")
    
    # Generate random 4-digit OTP
    otp = str(random.randint(1000, 9999))
    otp_store[f"reset_{phone}"] = {"otp": otp, "expires": datetime.now(timezone.utc) + timedelta(minutes=5)}
    
    # Send OTP via DVHosting
    sent = await send_sms_otp(phone, otp)
    if not sent:
        logging.warning(f"Password reset SMS failed for {phone}, OTP: {otp}")
    
    logging.info(f"Password Reset OTP for {phone}: {otp}")
    
    return {"message": "OTP भेज दिया गया है"}

@api_router.post("/auth/password/reset")
async def password_reset(data: PasswordResetComplete):
    phone = data.phone.strip()
    stored = otp_store.get(f"reset_{phone}")
    
    if not stored:
        raise HTTPException(status_code=400, detail="पहले OTP भेजें")
    
    if stored["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="गलत OTP")
    
    if stored["expires"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Remove used OTP
    del otp_store[f"reset_{phone}"]
    
    # Update password
    hashed = hash_password(data.new_password)
    result = await db.users.update_one({"phone": phone}, {"$set": {"password_hash": hashed}})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="पासवर्ड अपडेट में समस्या")
    
    return {"message": "पासवर्ड सफलतापूर्वक बदल दिया गया"}

# Google Auth Session Exchange
@api_router.post("/auth/google/session")
async def google_session(request: Request):
    from starlette.responses import JSONResponse
    import aiohttp
    
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Exchange session_id for user data from Emergent Auth
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=401, detail="Invalid session")
                google_data = await resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Google auth failed")
    
    email = google_data["email"].lower()
    name = google_data.get("name", email.split("@")[0])
    
    # Check if user exists by email
    user = await db.users.find_one({"email": email})
    
    if not user:
        # Create new user
        user_doc = {
            "name": name,
            "email": email,
            "password_hash": None,
            "role": "user",
            "balance": 0.0,
            "auth_type": "google",
            "picture": google_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
    else:
        user_id = str(user["_id"])
        # Update name/picture if changed
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"name": name, "picture": google_data.get("picture")}}
        )
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    user_data = await db.users.find_one({"_id": ObjectId(user_id)})
    
    resp = JSONResponse(content={
        "id": user_id,
        "name": user_data["name"],
        "email": email,
        "phone": user_data.get("phone"),
        "role": user_data.get("role", "user"),
        "balance": user_data.get("balance", 0.0)
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return resp

import calendar
from pywebpush import webpush, WebPushException

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")

# Games Routes
@api_router.get("/games")
async def get_games():
    games_list = []
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    today = ist_now.strftime("%Y-%m-%d")
    yesterday = (ist_now - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Check if today is the last date of the month → Holiday
    last_day = calendar.monthrange(ist_now.year, ist_now.month)[1]
    is_holiday = ist_now.day == last_day
    
    games_dict = await get_games_dict()
    
    for game_id, game in games_dict.items():
        if not game.get("is_active", True):
            continue
        
        # Get today's result
        today_result = await db.results.find_one(
            {"game_id": game_id, "date": today},
            {"_id": 0}
        )
        
        # Get yesterday's result
        yesterday_result = await db.results.find_one(
            {"game_id": game_id, "date": yesterday},
            {"_id": 0}
        )
        
        games_list.append({
            "id": game_id,
            "name": game["name"],
            "name_hi": game["name_hi"],
            "start_time": game.get("start_time", game.get("time", "")),
            "end_time": game.get("end_time", game.get("time", "")),
            "time": game.get("end_time", game.get("time", "")),
            "display_time": game["display_time"],
            "is_holiday": is_holiday,
            "today_result": {
                "jodi": today_result["jodi_result"],
                "single": today_result["single_result"]
            } if today_result else None,
            "yesterday_result": {
                "jodi": yesterday_result["jodi_result"],
                "single": yesterday_result["single_result"]
            } if yesterday_result else None
        })
    
    return {"games": games_list, "is_holiday": is_holiday}

@api_router.get("/games/{game_id}")
async def get_game(game_id: str):
    games_dict = await get_games_dict()
    if game_id not in games_dict:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games_dict[game_id]
    
    # Get last 10 results
    results = await db.results.find(
        {"game_id": game_id},
        {"_id": 0}
    ).sort("date", -1).limit(10).to_list(10)
    
    return {
        "id": game_id,
        "name": game["name"],
        "name_hi": game["name_hi"],
        "start_time": game.get("start_time", game.get("time", "")),
        "end_time": game.get("end_time", game.get("time", "")),
        "time": game.get("end_time", game.get("time", "")),
        "display_time": game["display_time"],
        "results": results
    }

# Betting Routes
@api_router.post("/bets")
async def place_bet(bet: BetCreate, request: Request):
    user = await get_current_user(request)
    
    games_dict = await get_games_dict()
    if bet.game_id not in games_dict:
        raise HTTPException(status_code=400, detail="Invalid game")
    
    game = games_dict[bet.game_id]
    
    # Holiday check - last date of month
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    last_day = calendar.monthrange(ist_now.year, ist_now.month)[1]
    if ist_now.day == last_day:
        raise HTTPException(status_code=400, detail="आज छुट्टी है! महीने की आखिरी तारीख पर बेटिंग बंद रहती है।")
    
    # Time-based betting lock
    start_time_str = game.get("start_time", "")
    end_time_str = game.get("end_time", "")
    if start_time_str and end_time_str:
        now = datetime.now(timezone(timedelta(hours=5, minutes=30)))  # IST
        current_minutes = now.hour * 60 + now.minute
        try:
            sh, sm = map(int, start_time_str.split(":"))
            eh, em = map(int, end_time_str.split(":"))
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            if start_min > end_min:
                # Overnight game
                betting_open = current_minutes >= start_min or current_minutes <= end_min
            else:
                betting_open = start_min <= current_minutes <= end_min
            if not betting_open:
                raise HTTPException(status_code=400, detail=f"बेटिंग बंद है! समय: {start_time_str} - {end_time_str}")
        except ValueError:
            pass  # If time format is wrong, allow betting
    
    if bet.bet_type not in BET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid bet type")
    
    # Validate number
    if bet.bet_type in ("single", "haruf_andar", "haruf_bahar"):
        if not bet.number.isdigit() or len(bet.number) != 1:
            raise HTTPException(status_code=400, detail="Single/Haruf bet must be 0-9")
    else:  # jodi
        if not bet.number.isdigit() or len(bet.number) != 2:
            raise HTTPException(status_code=400, detail="Jodi bet must be 00-99")
    
    # Get dynamic min bet from settings
    settings_doc = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    if settings_doc:
        if bet.bet_type == "jodi":
            min_bet = int(settings_doc.get("min_bet_jodi", 10))
        elif bet.bet_type in ("haruf_andar", "haruf_bahar"):
            min_bet = int(settings_doc.get("min_bet_haruf", 10))
        else:
            min_bet = int(settings_doc.get("min_bet_crossing", 10))
    else:
        min_bet = 10
    if bet.amount < min_bet:
        raise HTTPException(status_code=400, detail=f"न्यूनतम बेट ₹{min_bet} है")
    
    if bet.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Deduct balance
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"balance": -bet.amount}}
    )
    
    today = datetime.now(IST).strftime("%Y-%m-%d")
    
    games_dict = await get_games_dict()
    bet_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "game_id": bet.game_id,
        "game_name": games_dict[bet.game_id]["name"],
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

@api_router.post("/bets/batch")
async def place_batch_bets(batch: BatchBetCreate, request: Request):
    user = await get_current_user(request)
    
    games_dict = await get_games_dict()
    if batch.game_id not in games_dict:
        raise HTTPException(status_code=400, detail="Invalid game")
    
    game = games_dict[batch.game_id]
    
    # Holiday check - last date of month
    ist_now_batch = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    last_day_batch = calendar.monthrange(ist_now_batch.year, ist_now_batch.month)[1]
    if ist_now_batch.day == last_day_batch:
        raise HTTPException(status_code=400, detail="आज छुट्टी है! महीने की आखिरी तारीख पर बेटिंग बंद रहती है।")
    
    # Time-based betting lock
    start_time_str = game.get("start_time", "")
    end_time_str = game.get("end_time", "")
    if start_time_str and end_time_str:
        now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        current_minutes = now.hour * 60 + now.minute
        try:
            sh, sm = map(int, start_time_str.split(":"))
            eh, em = map(int, end_time_str.split(":"))
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            if start_min > end_min:
                betting_open = current_minutes >= start_min or current_minutes <= end_min
            else:
                betting_open = start_min <= current_minutes <= end_min
            if not betting_open:
                raise HTTPException(status_code=400, detail=f"बेटिंग बंद है! समय: {start_time_str} - {end_time_str}")
        except ValueError:
            pass
    
    if batch.bet_type not in BET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid bet type")
    
    if not batch.bets or len(batch.bets) == 0:
        raise HTTPException(status_code=400, detail="No bets provided")
    
    # Validate all bets
    total_amount = 0
    for b in batch.bets:
        if batch.bet_type in ("single", "haruf_andar", "haruf_bahar"):
            if not b.number.isdigit() or len(b.number) != 1:
                raise HTTPException(status_code=400, detail=f"Invalid single number: {b.number}")
        else:
            if not b.number.isdigit() or len(b.number) != 2:
                raise HTTPException(status_code=400, detail=f"Invalid jodi number: {b.number}")
        if b.amount < 10:
            raise HTTPException(status_code=400, detail=f"Minimum bet ₹10 (number {b.number})")
        total_amount += b.amount
    
    if total_amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail=f"अपर्याप्त बैलेंस! कुल बेट: ₹{total_amount}, बैलेंस: ₹{user.get('balance', 0)}")
    
    # Deduct total balance
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"balance": -total_amount}}
    )
    
    today = datetime.now(IST).strftime("%Y-%m-%d")
    multiplier = BET_TYPES[batch.bet_type]["multiplier"]
    
    bet_docs = []
    total_potential = 0
    for b in batch.bets:
        bet_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "game_id": batch.game_id,
            "game_name": game["name"],
            "bet_type": batch.bet_type,
            "number": b.number,
            "amount": b.amount,
            "potential_win": b.amount * multiplier,
            "date": today,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        bet_docs.append(bet_doc)
        total_potential += bet_doc["potential_win"]
    
    await db.bets.insert_many(bet_docs)
    
    return {
        "message": f"{len(bet_docs)} बेट्स लगाई गईं!",
        "total_bets": len(bet_docs),
        "total_amount": total_amount,
        "total_potential_win": total_potential
    }

@api_router.get("/bets")
async def get_user_bets(request: Request, limit: int = 100, game_id: str = None, status: str = None, date: str = None):
    user = await get_current_user(request)
    
    query = {"user_id": user["_id"]}
    if game_id:
        query["game_id"] = game_id
    if status and status != "all":
        query["status"] = status
    if date:
        query["date"] = date
    
    bets = await db.bets.find(
        query,
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
    
    # Get dynamic settings
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    min_deposit = int(settings.get("min_deposit", 100)) if settings else 100
    
    if deposit.amount < min_deposit:
        raise HTTPException(status_code=400, detail=f"न्यूनतम जमा ₹{min_deposit} है")
    if deposit.amount > 50000:
        raise HTTPException(status_code=400, detail="Maximum deposit ₹50000")
    
    order_id = f"DEP-{str(uuid.uuid4())[:8].upper()}"
    # Use FRONTEND_URL for external redirect (Kubernetes ingress routes /api to backend)
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if not frontend_url:
        scheme = request.headers.get("x-forwarded-proto", "https")
        host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        frontend_url = f"{scheme}://{host}"
    redirect_url = f"{frontend_url}/api/wallet/imb-callback"
    
    # Create IMB order
    async with aiohttp.ClientSession() as session:
        form_data = aiohttp.FormData()
        form_data.add_field("customer_mobile", deposit.customer_mobile or "9999999999")
        form_data.add_field("user_token", IMB_API_TOKEN)
        form_data.add_field("amount", str(int(deposit.amount)))
        form_data.add_field("order_id", order_id)
        form_data.add_field("redirect_url", redirect_url)
        form_data.add_field("remark1", user["_id"])
        form_data.add_field("remark2", user["email"])
        
        async with session.post(f"{IMB_API_URL}/api/create-order", data=form_data) as resp:
            resp_data = await resp.json()
            logging.info(f"IMB create-order response: {resp_data}")
            
            if not resp_data.get("status") or not resp_data.get("result", {}).get("payment_url"):
                raise HTTPException(status_code=500, detail=resp_data.get("message", "Payment creation failed"))
    
    payment_url = resp_data["result"]["payment_url"]
    
    # Create pending transaction
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "type": "deposit",
        "amount": deposit.amount,
        "status": "pending",
        "order_id": order_id,
        "payment_url": payment_url,
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(transaction_doc)
    
    return {"url": payment_url, "order_id": order_id}

@api_router.get("/wallet/imb-callback")
async def imb_callback(request: Request):
    params = dict(request.query_params)
    logging.info(f"IMB callback params: {params}")
    
    order_id = params.get("order_id", "")
    status = params.get("status", "")
    
    # Get frontend URL from Referer or construct from request
    frontend_url = os.environ.get("FRONTEND_URL", "")
    if not frontend_url:
        # Use the host from the request (works behind Kubernetes ingress)
        scheme = request.headers.get("x-forwarded-proto", "https")
        host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        frontend_url = f"{scheme}://{host}"
    
    if status == "SUCCESS" and order_id:
        # Verify with IMB
        verified = False
        try:
            async with aiohttp.ClientSession() as session:
                form_data = aiohttp.FormData()
                form_data.add_field("user_token", IMB_API_TOKEN)
                form_data.add_field("order_id", order_id)
                
                async with session.post(f"{IMB_API_URL}/api/check-order-status", data=form_data) as resp:
                    resp_text = await resp.text()
                    logging.info(f"IMB verify raw response: {resp_text[:500]}")
                    try:
                        import json as _json
                        verify_data = _json.loads(resp_text)
                        imb_result = verify_data.get("result", {})
                        imb_order_status = imb_result.get("order_status") or imb_result.get("status") or imb_result.get("txnStatus") or ""
                        if imb_order_status.upper() == "SUCCESS":
                            verified = True
                    except Exception:
                        logging.warning(f"IMB verify returned non-JSON, trusting callback status=SUCCESS")
                        verified = True
        except Exception as e:
            logging.error(f"IMB verify error: {e}")
            verified = True  # Trust callback status when verify API is unreachable
        
        if verified:
            transaction = await db.transactions.find_one({"order_id": order_id})
            if transaction and transaction["status"] == "pending":
                await db.users.update_one(
                    {"_id": ObjectId(transaction["user_id"])},
                    {"$inc": {"balance": transaction["amount"]}}
                )
                await db.transactions.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
                )
                logging.info(f"Deposit completed: order={order_id}, amount={transaction['amount']}")
                # Process referral reward on first deposit
                await process_referral_reward(transaction["user_id"], transaction["amount"])
    else:
        await db.transactions.update_one(
            {"order_id": order_id},
            {"$set": {"status": "failed"}}
        )
    
    from starlette.responses import RedirectResponse
    return RedirectResponse(url=f"{frontend_url}/wallet?payment={status.lower()}&order_id={order_id}")

@api_router.post("/wallet/imb-webhook")
async def imb_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = dict(await request.form())
    
    logging.info(f"IMB webhook body: {body}")
    
    order_id = body.get("order_id", "")
    status = body.get("status", "")
    
    if status == "SUCCESS" and order_id:
        transaction = await db.transactions.find_one({"order_id": order_id})
        if transaction and transaction["status"] == "pending":
            await db.users.update_one(
                {"_id": ObjectId(transaction["user_id"])},
                {"$inc": {"balance": transaction["amount"]}}
            )
            await db.transactions.update_one(
                {"order_id": order_id},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
            )
            # Process referral reward on first deposit
            await process_referral_reward(transaction["user_id"], transaction["amount"])
    elif order_id:
        await db.transactions.update_one(
            {"order_id": order_id},
            {"$set": {"status": "failed"}}
        )
    
    return {"status": "ok"}

@api_router.get("/wallet/deposit/status/{order_id}")
async def check_deposit_status(order_id: str, request: Request):
    user = await get_current_user(request)
    
    transaction = await db.transactions.find_one({
        "order_id": order_id,
        "user_id": user["_id"]
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["status"] == "completed":
        return {"status": "completed", "amount": transaction["amount"]}
    
    # Check with IMB
    try:
        async with aiohttp.ClientSession() as session:
            form_data = aiohttp.FormData()
            form_data.add_field("user_token", IMB_API_TOKEN)
            form_data.add_field("order_id", order_id)
            
            async with session.post(f"{IMB_API_URL}/api/check-order-status", data=form_data) as resp:
                resp_text = await resp.text()
                logging.info(f"IMB status check raw: {resp_text[:500]}")
                try:
                    import json as _json
                    verify_data = _json.loads(resp_text)
                except Exception:
                    return {"status": transaction["status"], "amount": transaction["amount"]}
        
        imb_result = verify_data.get("result", {})
        imb_order_status = imb_result.get("order_status") or imb_result.get("status") or imb_result.get("txnStatus") or ""
        
        if imb_order_status.upper() == "SUCCESS":
            if transaction["status"] != "completed":
                await db.users.update_one(
                    {"_id": ObjectId(user["_id"])},
                    {"$inc": {"balance": transaction["amount"]}}
                )
                await db.transactions.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
                )
                # Process referral reward on first deposit
                await process_referral_reward(user["_id"], transaction["amount"])
            return {"status": "completed", "amount": transaction["amount"]}
        
        return {"status": imb_order_status.lower() or "pending", "amount": transaction["amount"]}
    except Exception as e:
        logging.error(f"IMB status check error: {e}")
        return {"status": transaction["status"], "amount": transaction["amount"]}

@api_router.post("/wallet/withdraw")
async def request_withdrawal(withdraw: WithdrawRequest, request: Request):
    user = await get_current_user(request)
    
    # Get dynamic settings
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    min_withdrawal = int(settings.get("min_withdrawal", 100)) if settings else 100
    w_start = settings.get("withdrawal_start_time", "") if settings else ""
    w_end = settings.get("withdrawal_end_time", "") if settings else ""
    
    # Check withdrawal time
    if w_start and w_end:
        ist_now = datetime.now(IST)
        current_minutes = ist_now.hour * 60 + ist_now.minute
        try:
            sh, sm = map(int, w_start.split(":"))
            eh, em = map(int, w_end.split(":"))
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            if start_min > end_min:
                allowed = current_minutes >= start_min or current_minutes <= end_min
            else:
                allowed = start_min <= current_minutes <= end_min
            if not allowed:
                raise HTTPException(status_code=400, detail=f"निकासी का समय {w_start} से {w_end} तक है")
        except ValueError:
            pass
    
    if withdraw.amount < min_withdrawal:
        raise HTTPException(status_code=400, detail=f"न्यूनतम निकासी ₹{min_withdrawal} है")
    
    if withdraw.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if not withdraw.upi_id and not (withdraw.bank_account and withdraw.ifsc_code) and not withdraw.scanner_image:
        raise HTTPException(status_code=400, detail="UPI ID, बैंक डिटेल्स या स्कैनर दें")
    
    # Deduct balance
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"balance": -withdraw.amount}}
    )
    
    # Create withdrawal request
    withdrawal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "user_email": user.get("email", ""),
        "user_name": user["name"],
        "user_phone": user.get("phone", ""),
        "type": "withdrawal",
        "amount": withdraw.amount,
        "withdrawal_method": withdraw.withdrawal_method or "upi",
        "upi_id": withdraw.upi_id,
        "bank_account": withdraw.bank_account,
        "ifsc_code": withdraw.ifsc_code,
        "account_holder": withdraw.account_holder,
        "scanner_image": withdraw.scanner_image,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(withdrawal_doc)
    
    return {"message": "Withdrawal request submitted", "id": withdrawal_doc["id"]}

@api_router.post("/wallet/upload-scanner")
async def upload_scanner(file: UploadFile = File(...), request: Request = None):
    user = await get_current_user(request)
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="केवल इमेज फाइल अपलोड करें")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = f"/app/backend/uploads/{filename}"
    
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="फाइल 5MB से बड़ी नहीं होनी चाहिए")
    
    with open(filepath, "wb") as f:
        f.write(content)
    
    return {"url": f"/api/uploads/{filename}"}

# Results Routes
# Referral reward helper — gives referrer 5% of first deposit
async def process_referral_reward(user_id: str, deposit_amount: float):
    """Check if user was referred and this is their first completed deposit. If yes, give 5% to referrer."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or not user.get("referred_by"):
            return
        
        referral_code = user["referred_by"]
        
        # Check if referral bonus already given (flag on user)
        if user.get("referral_bonus_given"):
            return
        
        # Check this is the first completed deposit
        first_deposit_count = await db.transactions.count_documents({
            "user_id": user_id,
            "type": "deposit",
            "status": "completed"
        })
        # This function is called AFTER the deposit is marked completed, so count should be 1
        if first_deposit_count > 1:
            return
        
        # Find referrer
        ref_doc = await db.referrals.find_one({"code": referral_code})
        if not ref_doc:
            return
        
        referrer_id = ref_doc["user_id"]
        bonus = round(deposit_amount * 0.05, 2)
        
        if bonus <= 0:
            return
        
        # Add bonus to referrer's balance
        await db.users.update_one(
            {"_id": ObjectId(referrer_id)},
            {"$inc": {"balance": bonus}}
        )
        
        # Update referral record
        await db.referrals.update_one(
            {"code": referral_code},
            {
                "$inc": {"total_earned": bonus},
                "$addToSet": {"referred_users": user_id}
            }
        )
        
        # Mark user so bonus isn't given again
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"referral_bonus_given": True}}
        )
        
        # Create a transaction record for the referrer
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": referrer_id,
            "type": "deposit",
            "amount": bonus,
            "status": "completed",
            "reference_id": f"REFERRAL-{user_id[-6:]}",
            "note": f"रेफरल बोनस (5% of ₹{deposit_amount})",
            "created_at": datetime.now(timezone.utc)
        })
        
        logging.info(f"Referral bonus: ₹{bonus} given to referrer {referrer_id} from user {user_id}'s first deposit of ₹{deposit_amount}")
    except Exception as e:
        logging.error(f"Referral reward error: {e}")

# Refer & Earn Routes
@api_router.get("/referral/info")
async def get_referral_info(request: Request):
    user = await get_current_user(request)
    user_id = user["_id"]
    
    ref_data = await db.referrals.find_one({"user_id": user_id}, {"_id": 0})
    if not ref_data:
        code = f"SM{user_id[-6:].upper()}"
        ref_data = {
            "user_id": user_id,
            "code": code,
            "referred_users": [],
            "total_earned": 0.0,
            "created_at": datetime.now(timezone.utc)
        }
        await db.referrals.insert_one(ref_data)
        ref_data.pop("_id", None)
    
    referred_count = len(ref_data.get("referred_users", []))
    return {
        "code": ref_data["code"],
        "referred_count": referred_count,
        "total_earned": ref_data.get("total_earned", 0.0)
    }

@api_router.post("/referral/apply")
async def apply_referral(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    code = body.get("code", "").strip().upper()
    
    if not code:
        raise HTTPException(status_code=400, detail="रेफरल कोड दर्ज करें")
    
    existing = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if existing.get("referred_by"):
        raise HTTPException(status_code=400, detail="आपने पहले ही एक रेफरल कोड इस्तेमाल किया है")
    
    ref = await db.referrals.find_one({"code": code})
    if not ref:
        raise HTTPException(status_code=404, detail="गलत रेफरल कोड")
    
    if ref["user_id"] == user["_id"]:
        raise HTTPException(status_code=400, detail="आप अपना खुद का कोड इस्तेमाल नहीं कर सकते")
    
    # Just store referral code — bonus will be given on first deposit
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"referred_by": code}}
    )
    
    return {"message": "रेफरल कोड लागू हो गया! पहली जमा पर आपके दोस्त को 5% बोनस मिलेगा"}

@api_router.post("/wallet/withdraw/{withdrawal_id}/cancel")
async def cancel_withdrawal(withdrawal_id: str, request: Request):
    user = await get_current_user(request)
    
    withdrawal = await db.transactions.find_one({
        "id": withdrawal_id, "type": "withdrawal", "status": "pending", "user_id": user["_id"]
    })
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="निकासी अनुरोध नहीं मिला")
    
    # Refund amount back to user
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"balance": withdrawal["amount"]}}
    )
    
    # Update withdrawal status
    await db.transactions.update_one(
        {"id": withdrawal_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "निकासी रद्द कर दी गई, राशि वापस आ गई"}

# Transaction Export
@api_router.get("/wallet/export")
async def export_transactions(request: Request):
    from starlette.responses import Response
    user = await get_current_user(request)
    
    transactions = await db.transactions.find(
        {"user_id": user["_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    csv_lines = ["Date,Time,Type,Amount,Status"]
    for tx in transactions:
        dt = tx.get("created_at")
        if dt:
            ist = dt + timedelta(hours=5, minutes=30)
            date_str = ist.strftime("%d/%m/%Y")
            time_str = ist.strftime("%I:%M %p")
        else:
            date_str = time_str = ""
        tx_type = "Deposit" if tx["type"] == "deposit" else "Withdrawal" if tx["type"] == "withdrawal" else "Bonus"
        csv_lines.append(f"{date_str},{time_str},{tx_type},{tx['amount']},{tx['status']}")
    
    csv_content = "\n".join(csv_lines)
    return Response(
        content=csv_content, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"}
    )

# Push Notification Routes
@api_router.get("/push/vapid-key")
async def get_vapid_key():
    return {"key": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def push_subscribe(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    subscription = body.get("subscription")
    if not subscription:
        raise HTTPException(status_code=400, detail="subscription required")
    
    await db.push_subscriptions.update_one(
        {"user_id": user["_id"]},
        {"$set": {"user_id": user["_id"], "subscription": subscription, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"message": "subscribed"}

async def send_push_to_all(title: str, body: str, url: str = "/dashboard"):
    import json as _json
    subs = await db.push_subscriptions.find({}).to_list(5000)
    sent = 0
    for sub in subs:
        try:
            webpush(
                subscription_info=sub["subscription"],
                data=_json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": "mailto:admin@sattamatka.com"}
            )
            sent += 1
        except WebPushException:
            await db.push_subscriptions.delete_one({"_id": sub["_id"]})
        except Exception as e:
            logging.error(f"Push error: {e}")
    logging.info(f"Push notifications sent: {sent}/{len(subs)}")
    return sent

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
import asyncio

# ===== AUTO RESULT FETCH FROM MATKA API =====
MATKA_API_BASE = "https://matkawebhook.matka-api.online"
MATKA_API_USERNAME = os.environ.get("MATKA_API_USERNAME", "")
MATKA_API_PASSWORD = os.environ.get("MATKA_API_PASSWORD", "")

# Mapping: API market name → app game_id
MARKET_TO_GAME = {
    "DISAWER": "disawar",
    "DELHI BAZAR": "delhi_bazar",
    "SHRI GANESH": "shri_ganesh",
    "FARIDABAD": "faridabad",
    "GHAZIABAD": "ghaziabad",
    "GALI": "gali",
}

matka_api_token = {"token": None}

async def refresh_matka_token():
    """Get fresh token from Matka API"""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{MATKA_API_BASE}/get-refresh-token-delhi",
                data={"username": MATKA_API_USERNAME, "password": MATKA_API_PASSWORD}
            )
            data = resp.json()
            if data.get("status"):
                matka_api_token["token"] = data["refresh_token"]
                logging.info(f"Matka API token refreshed: {matka_api_token['token'][:8]}...")
                return True
    except Exception as e:
        logging.error(f"Matka API token refresh failed: {e}")
    return False

async def fetch_matka_results(date_str=None):
    """Fetch results from Matka API and auto-declare"""
    if not MATKA_API_USERNAME or not MATKA_API_PASSWORD:
        return {"error": "Matka API credentials not configured"}
    
    if not matka_api_token["token"]:
        if not await refresh_matka_token():
            return {"error": "Token refresh failed"}
    
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    if not date_str:
        date_str = ist_now.strftime("%Y-%m-%d")
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{MATKA_API_BASE}/market-data-delhi",
                data={
                    "username": MATKA_API_USERNAME,
                    "API_token": matka_api_token["token"],
                    "markte_name": "",
                    "date": date_str
                }
            )
            data = resp.json()
        
        if not data.get("status"):
            # Token expired, refresh and retry
            if await refresh_matka_token():
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{MATKA_API_BASE}/market-data-delhi",
                        data={
                            "username": MATKA_API_USERNAME,
                            "API_token": matka_api_token["token"],
                            "markte_name": "",
                            "date": date_str
                        }
                    )
                    data = resp.json()
            if not data.get("status"):
                return {"error": "API fetch failed"}
        
        results_applied = []
        all_results = data.get("today_result", []) + data.get("old_result", [])
        
        games_dict = await get_games_dict()
        
        for r in all_results:
            market_name = r.get("market_name", "").upper().strip()
            jodi = r.get("jodi", "").strip()
            result_date = r.get("aankdo_date", "").strip()
            
            if not jodi or not result_date or len(jodi) != 2 or not jodi.isdigit():
                continue
            
            game_id = MARKET_TO_GAME.get(market_name)
            if not game_id or game_id not in games_dict:
                continue
            
            # Check if result already exists
            existing = await db.results.find_one({"game_id": game_id, "date": result_date})
            if existing:
                continue
            
            # Auto-declare result
            single_result = jodi[-1]
            result_doc = {
                "id": str(uuid.uuid4()),
                "game_id": game_id,
                "date": result_date,
                "single_result": single_result,
                "jodi_result": jodi,
                "declared_at": datetime.now(timezone.utc),
                "auto_declared": True
            }
            await db.results.insert_one(result_doc)
            
            # Process winning bets (same logic as manual declare)
            andar_digit = jodi[0]
            bahar_digit = jodi[1]
            
            winning_jodi = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "jodi", "number": jodi, "status": "pending"}).to_list(1000)
            winning_andar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_andar", "number": andar_digit, "status": "pending"}).to_list(1000)
            winning_bahar = await db.bets.find({"game_id": game_id, "date": result_date, "bet_type": "haruf_bahar", "number": bahar_digit, "status": "pending"}).to_list(1000)
            
            # Crossing bets
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
            
            # Push notifications
            game_info = games_dict[game_id]
            push_title = f"{game_info['name_hi']} - रिजल्ट आ गया!"
            push_body = f"जोड़ी: {jodi} | सिंगल: {single_result}"
            await send_push_to_all(push_title, push_body, "/dashboard")
            
            results_applied.append({"game": game_id, "jodi": jodi, "date": result_date, "winners": len(all_winners)})
            logging.info(f"Auto-result: {game_info['name_hi']} = {jodi} ({result_date}), Winners: {len(all_winners)}")
        
        return {"results_applied": results_applied, "total": len(results_applied)}
    
    except Exception as e:
        logging.error(f"Matka API fetch error: {e}")
        return {"error": str(e)}

# Background task for auto-fetching results
auto_fetch_running = False

async def auto_fetch_loop():
    global auto_fetch_running
    auto_fetch_running = True
    logging.info("Auto-result fetch loop started")
    while auto_fetch_running:
        try:
            result = await fetch_matka_results()
            if result.get("total", 0) > 0:
                logging.info(f"Auto-fetch: {result['total']} new results declared")
        except Exception as e:
            logging.error(f"Auto-fetch loop error: {e}")
        await asyncio.sleep(300)  # Check every 5 minutes

@app.on_event("startup")
async def start_auto_fetch():
    if MATKA_API_USERNAME and MATKA_API_PASSWORD:
        asyncio.create_task(auto_fetch_loop())
        logging.info("Auto-result fetch scheduled (every 5 min)")

# Admin endpoint to manually trigger fetch
@api_router.post("/admin/results/auto-fetch")
async def trigger_auto_fetch(request: Request):
    await get_admin_user(request)
    result = await fetch_matka_results()
    return result

@api_router.post("/admin/results")
async def declare_result(result: ResultDeclare, request: Request):
    await get_admin_user(request)
    
    games_dict = await get_games_dict()
    if result.game_id not in games_dict:
        raise HTTPException(status_code=400, detail="Invalid game")
    
    # Validate jodi result
    if not result.jodi_result.isdigit() or len(result.jodi_result) != 2:
        raise HTTPException(status_code=400, detail="Jodi result must be 00-99")
    
    # Auto-calculate single result from last digit of jodi
    single_result = result.jodi_result[-1]
    
    # Use IST date if no date provided
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    result_date = result.date if result.date else ist_now.strftime("%Y-%m-%d")
    
    # Check if result already exists
    existing = await db.results.find_one({
        "game_id": result.game_id,
        "date": result_date
    })
    
    if existing:
        raise HTTPException(status_code=400, detail=f"इस दिनांक ({result_date}) का रिजल्ट पहले से घोषित है। पहले रिवर्स करें।")
    
    # Save result
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
        "game_id": result.game_id,
        "date": result_date,
        "bet_type": "single",
        "number": single_result,
        "status": "pending"
    }).to_list(1000)
    
    winning_jodi_bets = await db.bets.find({
        "game_id": result.game_id,
        "date": result_date,
        "bet_type": "jodi",
        "number": result.jodi_result,
        "status": "pending"
    }).to_list(1000)
    
    # Haruf Andar = left/first digit of jodi
    andar_digit = result.jodi_result[0]
    winning_andar_bets = await db.bets.find({
        "game_id": result.game_id,
        "date": result_date,
        "bet_type": "haruf_andar",
        "number": andar_digit,
        "status": "pending"
    }).to_list(1000)
    
    # Haruf Bahar = right/last digit of jodi
    bahar_digit = result.jodi_result[1]
    winning_bahar_bets = await db.bets.find({
        "game_id": result.game_id,
        "date": result_date,
        "bet_type": "haruf_bahar",
        "number": bahar_digit,
        "status": "pending"
    }).to_list(1000)
    
    # Credit winnings for all bet types
    all_winners = winning_single_bets + winning_jodi_bets + winning_andar_bets + winning_bahar_bets
    for bet in all_winners:
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
            "date": result_date,
            "status": "pending"
        },
        {"$set": {"status": "lost"}}
    )
    
    # Send notifications to all subscribers
    subscribers = await db.notification_subscribers.find({}).to_list(1000)
    if subscribers:
        game_info = games_dict[result.game_id]
        notification_result = await notification_service.send_result_notification(
            game_name=game_info["name"],
            game_name_hi=game_info["name_hi"],
            date=result_date,
            single_result=single_result,
            jodi_result=result.jodi_result,
            subscribers=subscribers
        )
        logger.info(f"Notifications sent: {notification_result}")
    
    # Send push notifications to all users
    game_info = games_dict[result.game_id]
    push_title = f"{game_info['name_hi']} - रिजल्ट आ गया!"
    push_body = f"जोड़ी: {result.jodi_result} | सिंगल: {single_result}"
    await send_push_to_all(push_title, push_body, "/dashboard")
    
    return {
        "message": "Result declared successfully",
        "winners": {
            "single": len(winning_single_bets),
            "jodi": len(winning_jodi_bets),
            "haruf_andar": len(winning_andar_bets),
            "haruf_bahar": len(winning_bahar_bets)
        }
    }

# Result Reverse - Undo a declared result
@api_router.get("/admin/results/status")
async def get_results_status(request: Request):
    await get_admin_user(request)
    
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    today = ist_now.strftime("%Y-%m-%d")
    
    games_dict = await get_games_dict()
    game_results = []
    
    for game_id, game in games_dict.items():
        result = await db.results.find_one(
            {"game_id": game_id, "date": today},
            {"_id": 0}
        )
        pending_bets = await db.bets.count_documents({"game_id": game_id, "date": today, "status": "pending"})
        total_bets = await db.bets.count_documents({"game_id": game_id, "date": today})
        
        game_results.append({
            "game_id": game_id,
            "name": game["name"],
            "name_hi": game["name_hi"],
            "start_time": game.get("start_time", ""),
            "end_time": game.get("end_time", ""),
            "declared": result is not None,
            "jodi_result": result["jodi_result"] if result else None,
            "single_result": result["single_result"] if result else None,
            "pending_bets": pending_bets,
            "total_bets": total_bets
        })
    
    return {"date": today, "games": game_results}

# Result Reverse - Undo a declared result
@api_router.post("/admin/results/reverse")
async def reverse_result(request: Request):
    await get_admin_user(request)
    body = await request.json()
    game_id = body.get("game_id")
    date = body.get("date")
    
    if not game_id or not date:
        raise HTTPException(status_code=400, detail="game_id and date required")
    
    # Find the result
    result = await db.results.find_one({"game_id": game_id, "date": date})
    if not result:
        raise HTTPException(status_code=404, detail="इस दिनांक का रिजल्ट नहीं मिला")
    
    # Find all won bets for this game/date and deduct winnings
    won_bets = await db.bets.find({
        "game_id": game_id,
        "date": date,
        "status": "won"
    }).to_list(10000)
    
    deducted_count = 0
    total_deducted = 0
    for bet in won_bets:
        win_amount = bet.get("won_amount", bet.get("potential_win", 0))
        if win_amount > 0:
            await db.users.update_one(
                {"_id": ObjectId(bet["user_id"])},
                {"$inc": {"balance": -win_amount}}
            )
            total_deducted += win_amount
            deducted_count += 1
    
    # Revert all bets (won + lost) back to pending
    await db.bets.update_many(
        {"game_id": game_id, "date": date, "status": {"$in": ["won", "lost"]}},
        {"$set": {"status": "pending", "won_amount": 0}}
    )
    
    # Delete the result
    await db.results.delete_one({"game_id": game_id, "date": date})
    
    total_reverted = await db.bets.count_documents({"game_id": game_id, "date": date, "status": "pending"})
    
    return {
        "message": "रिजल्ट रिवर्स हो गया",
        "winnings_deducted": total_deducted,
        "winners_reversed": deducted_count,
        "bets_reverted_to_pending": total_reverted
    }

# Bet Reverse - Refund specific bets
@api_router.post("/admin/bets/reverse")
async def reverse_bets(request: Request):
    await get_admin_user(request)
    body = await request.json()
    game_id = body.get("game_id")
    date = body.get("date")
    bet_type = body.get("bet_type")  # optional filter
    user_id = body.get("user_id")    # optional filter
    
    if not game_id or not date:
        raise HTTPException(status_code=400, detail="game_id and date required")
    
    # Build filter
    bet_filter = {"game_id": game_id, "date": date}
    if bet_type:
        bet_filter["bet_type"] = bet_type
    if user_id:
        bet_filter["user_id"] = user_id
    
    # Find all bets matching filter
    bets = await db.bets.find(bet_filter).to_list(10000)
    
    if not bets:
        raise HTTPException(status_code=404, detail="कोई बेट नहीं मिली")
    
    refunded_count = 0
    total_refunded = 0
    won_deducted = 0
    
    for bet in bets:
        if bet["status"] == "reversed":
            continue
        
        # If won, deduct winnings first
        if bet["status"] == "won":
            win_amount = bet.get("won_amount", bet.get("potential_win", 0))
            if win_amount > 0:
                await db.users.update_one(
                    {"_id": ObjectId(bet["user_id"])},
                    {"$inc": {"balance": -win_amount}}
                )
                won_deducted += win_amount
        
        # Refund the original bet amount
        await db.users.update_one(
            {"_id": ObjectId(bet["user_id"])},
            {"$inc": {"balance": bet["amount"]}}
        )
        
        # Mark bet as reversed
        await db.bets.update_one(
            {"id": bet["id"]},
            {"$set": {"status": "reversed", "won_amount": 0}}
        )
        
        refunded_count += 1
        total_refunded += bet["amount"]
    
    return {
        "message": f"{refunded_count} बेट्स रिवर्स हो गईं",
        "bets_reversed": refunded_count,
        "amount_refunded": total_refunded,
        "winnings_deducted": won_deducted
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
    
    # Enrich with user phone if missing
    for w in withdrawals:
        if not w.get("user_phone"):
            user = await db.users.find_one({"_id": ObjectId(w["user_id"])}, {"phone": 1})
            w["user_phone"] = user.get("phone", "") if user else ""
    
    return {"withdrawals": withdrawals}

@api_router.get("/admin/deposits")
async def get_admin_deposits(request: Request, skip: int = 0, limit: int = 50):
    await get_admin_user(request)
    
    deposits = await db.transactions.find(
        {"type": "deposit", "status": "completed"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    for d in deposits:
        user = await db.users.find_one({"_id": ObjectId(d["user_id"])}, {"name": 1, "phone": 1, "email": 1})
        if user:
            d["user_name"] = user.get("name", "")
            d["user_phone"] = user.get("phone", "")
            d["user_email"] = user.get("email", "")
    
    total = await db.transactions.count_documents({"type": "deposit", "status": "completed"})
    total_amount = sum(d.get("amount", 0) for d in deposits)
    
    return {"deposits": deposits, "total": total, "total_amount": total_amount}

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

# Bet Distribution API - Shows which jodi has how much bet
@api_router.get("/admin/bet-distribution")
async def get_bet_distribution(request: Request, game_id: Optional[str] = None, date: Optional[str] = None):
    await get_admin_user(request)
    
    # Default to today
    if not date:
        date = datetime.now(IST).strftime("%Y-%m-%d")
    
    # Build query
    query = {"date": date, "status": "pending"}
    if game_id and game_id != "all":
        query["game_id"] = game_id
    
    # Get all pending bets
    bets = await db.bets.find(query, {"_id": 0}).to_list(10000)
    
    # Group by game and number
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
                "single": {},
                "jodi": {},
                "haruf_andar": {},
                "haruf_bahar": {},
                "total_amount": 0,
                "total_potential": 0
            }
        
        if bet_type not in distribution[game]:
            distribution[game][bet_type] = {}
        
        if number not in distribution[game][bet_type]:
            distribution[game][bet_type][number] = {
                "count": 0,
                "amount": 0,
                "potential_payout": 0
            }
        
        distribution[game][bet_type][number]["count"] += 1
        distribution[game][bet_type][number]["amount"] += amount
        distribution[game][bet_type][number]["potential_payout"] += potential_win
        distribution[game]["total_amount"] += amount
        distribution[game]["total_potential"] += potential_win
        total_bet_amount += amount
        total_potential_payout += potential_win
    
    # Sort by amount (descending)
    for game in distribution:
        for bet_type in ["jodi", "single", "haruf_andar", "haruf_bahar"]:
            if bet_type in distribution[game]:
                distribution[game][bet_type] = dict(
                    sorted(distribution[game][bet_type].items(), 
                           key=lambda x: x[1]["amount"], 
                           reverse=True)
                )
    
    return {
        "date": date,
        "distribution": distribution,
        "summary": {
            "total_bet_amount": total_bet_amount,
            "total_potential_payout": total_potential_payout,
            "total_bets": len(bets)
        }
    }

# Jantri Report API
@api_router.get("/admin/jantri")
async def get_jantri_report(request: Request, game_id: Optional[str] = None, days: int = 30):
    await get_admin_user(request)
    
    # Calculate date range
    end_date = datetime.now(IST)
    start_date = end_date - timedelta(days=days)
    start_date_str = start_date.strftime("%Y-%m-%d")
    
    # Build query
    query = {"date": {"$gte": start_date_str}}
    if game_id and game_id != "all":
        query["game_id"] = game_id
    
    # Get results
    results = await db.results.find(
        query,
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    # Group by date
    jantri_data = {}
    for result in results:
        date = result["date"]
        if date not in jantri_data:
            jantri_data[date] = {}
        jantri_data[date][result["game_id"]] = {
            "single": result["single_result"],
            "jodi": result["jodi_result"]
        }
    
    # Convert to list format
    jantri_list = []
    for date in sorted(jantri_data.keys(), reverse=True):
        row = {"date": date, "results": jantri_data[date]}
        jantri_list.append(row)
    
    return {
        "jantri": jantri_list,
        "games": list(GAMES.keys()),
        "game_names": {k: v["name_hi"] for k, v in GAMES.items()}
    }

@api_router.get("/admin/jantri/export")
async def export_jantri(request: Request, game_id: Optional[str] = None, days: int = 30):
    await get_admin_user(request)
    
    # Calculate date range
    end_date = datetime.now(IST)
    start_date = end_date - timedelta(days=days)
    start_date_str = start_date.strftime("%Y-%m-%d")
    
    # Build query
    query = {"date": {"$gte": start_date_str}}
    if game_id and game_id != "all":
        query["game_id"] = game_id
    
    # Get results
    results = await db.results.find(
        query,
        {"_id": 0}
    ).sort([("date", -1), ("game_id", 1)]).to_list(1000)
    
    # Format for export
    export_data = []
    for result in results:
        game_info = GAMES.get(result["game_id"], {})
        export_data.append({
            "date": result["date"],
            "game": game_info.get("name_hi", result["game_id"]),
            "game_english": game_info.get("name", result["game_id"]),
            "time": game_info.get("display_time", ""),
            "single": result["single_result"],
            "jodi": result["jodi_result"]
        })
    
    return {"export_data": export_data}

# Admin User Detail APIs
@api_router.get("/admin/users/{user_id}")
async def get_user_details(user_id: str, request: Request):
    await get_admin_user(request)
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["_id"] = str(user["_id"])
    return {"user": user}

@api_router.get("/admin/users/{user_id}/deposits")
async def get_user_deposits(user_id: str, request: Request):
    await get_admin_user(request)
    
    deposits = await db.transactions.find(
        {"user_id": user_id, "type": "deposit"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_deposited = sum(d["amount"] for d in deposits if d.get("status") == "completed")
    
    return {"deposits": deposits, "total_deposited": total_deposited}

@api_router.get("/admin/users/{user_id}/withdrawals")
async def get_user_withdrawals(user_id: str, request: Request):
    await get_admin_user(request)
    
    withdrawals = await db.transactions.find(
        {"user_id": user_id, "type": "withdrawal"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_withdrawn = sum(w["amount"] for w in withdrawals if w.get("status") in ["completed", "approved"])
    pending_amount = sum(w["amount"] for w in withdrawals if w.get("status") == "pending")
    
    return {"withdrawals": withdrawals, "total_withdrawn": total_withdrawn, "pending_amount": pending_amount}

@api_router.get("/admin/users/{user_id}/bets")
async def get_user_bets(user_id: str, request: Request):
    await get_admin_user(request)
    
    bets = await db.bets.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    stats = {
        "total_bets": len(bets),
        "total_wagered": sum(b["amount"] for b in bets),
        "won": len([b for b in bets if b.get("status") == "won"]),
        "lost": len([b for b in bets if b.get("status") == "lost"]),
        "pending": len([b for b in bets if b.get("status") == "pending"])
    }
    
    return {"bets": bets, "stats": stats}

@api_router.get("/admin/users/{user_id}/winnings")
async def get_user_winnings(user_id: str, request: Request):
    await get_admin_user(request)
    
    winning_bets = await db.bets.find(
        {"user_id": user_id, "status": "won"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_winnings = sum(b.get("won_amount", 0) for b in winning_bets)
    
    return {"winnings": winning_bets, "total_winnings": total_winnings}

class WalletAdjustment(BaseModel):
    amount: float
    type: str  # "add" or "deduct"
    reason: str

@api_router.post("/admin/users/{user_id}/wallet")
async def adjust_user_wallet(user_id: str, adjustment: WalletAdjustment, request: Request):
    admin = await get_admin_user(request)
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
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
    
    # Update user balance
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"balance": change}}
    )
    
    # Create transaction record
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": f"admin_{adjustment.type}",
        "amount": adjustment.amount,
        "reason": adjustment.reason,
        "admin_email": admin["email"],
        "status": "completed",
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(transaction_doc)
    
    # Get new balance
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    return {
        "message": f"Balance {'added' if adjustment.type == 'add' else 'deducted'} successfully",
        "new_balance": updated_user.get("balance", 0)
    }

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    admin = await get_admin_user(request)
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
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

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    await get_admin_user(request)
    
    total_users = await db.users.count_documents({})
    total_bets = await db.bets.count_documents({})
    pending_withdrawals = await db.transactions.count_documents({"type": "withdrawal", "status": "pending"})
    
    # Today's stats
    today = datetime.now(IST).strftime("%Y-%m-%d")
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_bets = await db.bets.count_documents({"date": today})
    
    # Today's new users
    today_new_users = await db.users.count_documents({"created_at": {"$gte": today_start}})
    
    # Today's deposits
    today_deposits = await db.transactions.find({
        "type": "deposit",
        "status": "completed",
        "created_at": {"$gte": today_start}
    }).to_list(1000)
    today_deposit_amount = sum(d.get("amount", 0) for d in today_deposits)
    
    # Today's withdrawals (approved)
    today_withdrawals = await db.transactions.find({
        "type": "withdrawal",
        "status": {"$in": ["approved", "completed"]},
        "created_at": {"$gte": today_start}
    }).to_list(1000)
    today_withdrawal_amount = sum(w.get("amount", 0) for w in today_withdrawals)
    
    # Pending withdrawal amount
    pending_withdrawal_list = await db.transactions.find({
        "type": "withdrawal",
        "status": "pending"
    }).to_list(1000)
    pending_withdrawal_amount = sum(w.get("amount", 0) for w in pending_withdrawal_list)
    
    # Total deposits and withdrawals (all time)
    all_deposits = await db.transactions.find({
        "type": "deposit",
        "status": "completed"
    }).to_list(10000)
    total_deposit_amount = sum(d.get("amount", 0) for d in all_deposits)
    
    all_withdrawals = await db.transactions.find({
        "type": "withdrawal",
        "status": {"$in": ["approved", "completed"]}
    }).to_list(10000)
    total_withdrawal_amount = sum(w.get("amount", 0) for w in all_withdrawals)
    
    # Notification stats
    notification_status = notification_service.get_status()
    total_subscribers = await db.notification_subscribers.count_documents({})
    
    return {
        "total_users": total_users,
        "total_bets": total_bets,
        "pending_withdrawals": pending_withdrawals,
        "today_bets": today_bets,
        "today_new_users": today_new_users,
        "today_deposit_amount": today_deposit_amount,
        "today_withdrawal_amount": today_withdrawal_amount,
        "pending_withdrawal_amount": pending_withdrawal_amount,
        "total_deposit_amount": total_deposit_amount,
        "total_withdrawal_amount": total_withdrawal_amount,
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

# Game Management APIs
@api_router.get("/admin/games")
async def get_all_games_admin(request: Request):
    await get_admin_user(request)
    
    games = await db.games.find({}, {"_id": 0}).to_list(100)
    
    # If no games in DB, return default games
    if not games:
        games = [{"game_id": k, **v} for k, v in DEFAULT_GAMES.items()]
    
    return {"games": games}

@api_router.post("/admin/games")
async def create_game(game: GameCreate, request: Request):
    await get_admin_user(request)
    
    # Check if game_id already exists
    existing = await db.games.find_one({"game_id": game.game_id})
    if existing:
        raise HTTPException(status_code=400, detail="Game ID already exists")
    
    game_doc = {
        "game_id": game.game_id,
        "name": game.name,
        "name_hi": game.name_hi,
        "start_time": game.start_time,
        "end_time": game.end_time,
        "time": game.end_time,  # backward compatibility
        "display_time": game.display_time,
        "is_active": game.is_active,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.games.insert_one(game_doc)
    
    # Reload games
    await load_games()
    
    return {"message": "Game created successfully", "game_id": game.game_id}

@api_router.put("/admin/games/{game_id}")
async def update_game(game_id: str, game: GameUpdate, request: Request):
    await get_admin_user(request)
    
    # Check if game exists
    existing = await db.games.find_one({"game_id": game_id})
    
    if not existing:
        # If not in DB, might be a default game - create it first
        if game_id in DEFAULT_GAMES:
            default_game = DEFAULT_GAMES[game_id]
            await db.games.insert_one({
                "game_id": game_id,
                **default_game,
                "created_at": datetime.now(timezone.utc)
            })
        else:
            raise HTTPException(status_code=404, detail="Game not found")
    
    # Build update dict
    update_data = {}
    if game.name is not None:
        update_data["name"] = game.name
    if game.name_hi is not None:
        update_data["name_hi"] = game.name_hi
    if game.start_time is not None:
        update_data["start_time"] = game.start_time
    if game.end_time is not None:
        update_data["end_time"] = game.end_time
        update_data["time"] = game.end_time  # backward compatibility
    if game.display_time is not None:
        update_data["display_time"] = game.display_time
    if game.is_active is not None:
        update_data["is_active"] = game.is_active
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.games.update_one(
            {"game_id": game_id},
            {"$set": update_data}
        )
    
    # Reload games
    await load_games()
    
    return {"message": "Game updated successfully"}

@api_router.delete("/admin/games/{game_id}")
async def delete_game(game_id: str, request: Request):
    await get_admin_user(request)
    
    result = await db.games.delete_one({"game_id": game_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Reload games
    await load_games()
    
    return {"message": "Game deleted successfully"}

# Include the router in the main app
# Settings API (public - for telegram link etc.)
SETTINGS_DEFAULTS = {
    "telegram_link": "", "whatsapp_link": "", "withdrawal_proof_telegram": "",
    "withdrawal_start_time": "", "withdrawal_end_time": "",
    "min_bet_jodi": 10, "min_bet_haruf": 10, "min_bet_crossing": 10,
    "min_deposit": 100, "min_withdrawal": 100
}

@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    result = {**SETTINGS_DEFAULTS}
    if settings:
        for k in SETTINGS_DEFAULTS:
            if k in settings:
                result[k] = settings[k]
    return result

@api_router.get("/admin/settings")
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

@api_router.put("/admin/settings")
async def update_settings(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    update_doc = {"key": "app_settings", "updated_at": datetime.now(timezone.utc)}
    for k in SETTINGS_DEFAULTS:
        if k in body:
            update_doc[k] = body[k]
    await db.settings.update_one(
        {"key": "app_settings"},
        {"$set": update_doc},
        upsert=True
    )
    return {"message": "Settings updated successfully"}

app.include_router(api_router)
app.mount("/api/uploads", StaticFiles(directory="/app/backend/uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(",") if os.environ.get("CORS_ORIGINS") != "*" else ["*"],
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
    # Create indexes (drop conflicting ones first)
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index("email", unique=True, sparse=True)
    await db.bets.create_index([("user_id", 1), ("created_at", -1)])
    await db.results.create_index([("game_id", 1), ("date", -1)])
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.games.create_index("game_id", unique=True)
    
    # Seed default games if not exists
    games_count = await db.games.count_documents({})
    if games_count == 0:
        for game_id, game_data in DEFAULT_GAMES.items():
            await db.games.insert_one({
                "game_id": game_id,
                **game_data,
                "created_at": datetime.now(timezone.utc)
            })
        logger.info("Default games seeded")
    else:
        # Update existing games with start_time/end_time if missing
        for game_id, game_data in DEFAULT_GAMES.items():
            await db.games.update_one(
                {"game_id": game_id, "start_time": {"$exists": False}},
                {"$set": {"start_time": game_data["start_time"], "end_time": game_data["end_time"]}}
            )
    
    # Load games into memory
    await load_games()
    
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
