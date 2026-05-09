from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from starlette.responses import JSONResponse
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import random
import logging
import httpx
import aiohttp
import uuid

from database import db
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token, get_current_user
)
from models import (
    UserRegister, UserLogin, AdminLogin, OTPRequest, OTPVerify,
    OTPCompleteSignup, OTPLoginRequest, PasswordResetRequest,
    PasswordResetComplete, ProfileUpdate, PasswordChange
)
from config import otp_store, DVHOSTING_API_KEY, DVHOSTING_API_URL

router = APIRouter()


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


@router.post("/auth/register-mobile")
async def register_mobile(request: Request):
    """Mobile + name + password signup (no OTP). Used for new users who pick password mode."""
    body = await request.json()
    name = (body.get("name") or "").strip()
    phone = (body.get("phone") or "").strip()
    password = body.get("password") or ""
    referral_code = (body.get("referral_code") or "").strip().upper()

    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="नाम कम से कम 2 अक्षर का चाहिए")
    if not phone.isdigit() or len(phone) != 10:
        raise HTTPException(status_code=400, detail="10 अंकों का मोबाइल नंबर डालें")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="पासवर्ड कम से कम 6 अक्षर का चाहिए")

    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="यह मोबाइल नंबर पहले से रजिस्टर है। Login करें।")

    user_doc = {
        "name": name,
        "phone": phone,
        "password_hash": hash_password(password),
        "role": "user",
        "balance": 0.0,
        "phone_verified": False,
        "auth_method": "password",
        "created_at": datetime.now(timezone.utc),
    }

    # Handle referral
    if referral_code:
        referrer = await db.users.find_one({"referral_code": referral_code})
        if referrer:
            user_doc["referred_by"] = str(referrer["_id"])

    # Generate own referral code
    user_doc["referral_code"] = f"M11{random.randint(100000, 999999)}"

    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    access_token = create_access_token(user_id, phone)
    refresh_token = create_refresh_token(user_id)

    resp = JSONResponse(content={
        "id": user_id, "name": name, "phone": phone,
        "role": "user", "balance": 0.0, "token": access_token
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp


@router.post("/auth/google-session")
async def google_auth_session(request: Request):
    """Exchange Emergent Google Auth session_id for our JWT token. Creates user if not exists."""
    body = await request.json()
    session_id = body.get("session_id", "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # Call Emergent Auth to get user info
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if r.status_code != 200:
                raise HTTPException(status_code=401, detail="Google session invalid")
            data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Emergent OAuth fetch error: {e}")
        raise HTTPException(status_code=500, detail="Google auth verify failed")

    email = (data.get("email") or "").lower().strip()
    name = data.get("name") or "User"
    picture = data.get("picture") or ""
    if not email:
        raise HTTPException(status_code=400, detail="Email missing in Google session")

    user = await db.users.find_one({"email": email})
    if user:
        user_id = str(user["_id"])
        # Ensure has referral_code
        if not user.get("referral_code"):
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"referral_code": f"M11{random.randint(100000, 999999)}"}}
            )
    else:
        # New user via Google
        user_doc = {
            "name": name,
            "email": email,
            "picture": picture,
            "role": "user",
            "balance": 0.0,
            "auth_method": "google",
            "referral_code": f"M11{random.randint(100000, 999999)}",
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        user = {**user_doc, "_id": result.inserted_id}

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    resp = JSONResponse(content={
        "id": user_id,
        "name": user.get("name", name),
        "email": email,
        "phone": user.get("phone"),
        "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0),
        "token": access_token,
        "is_new": "phone" not in user or not user.get("phone"),
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp


@router.post("/auth/register")
async def register(user_data: UserRegister):
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
        "id": user_id, "name": user_data.name, "email": email,
        "role": "user", "balance": 0.0, "token": access_token
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp


@router.post("/auth/login")
async def login(user_data: UserLogin):
    identifier = user_data.phone.strip()

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
        "id": user_id, "name": user["name"], "email": user.get("email", ""),
        "phone": user.get("phone", ""), "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0), "token": access_token
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp


@router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["_id"], "name": user["name"], "email": user.get("email", ""),
        "phone": user.get("phone"), "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0),
        "created_at": user.get("created_at", "").isoformat() if user.get("created_at") else None
    }


@router.post("/auth/logout")
async def logout():
    resp = JSONResponse(content={"message": "Logged out successfully"})
    resp.delete_cookie("access_token", path="/", samesite="none", secure=True)
    resp.delete_cookie("refresh_token", path="/", samesite="none", secure=True)
    return resp


@router.put("/auth/profile")
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
    return {"message": "प्रोफ़ाइल अपडेट हो गई", "name": updated["name"], "email": updated.get("email", "")}


@router.post("/auth/change-password")
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
@router.post("/auth/otp/send")
async def send_otp(data: OTPRequest):
    phone = data.phone.strip()
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="कृपया सही मोबाइल नंबर दर्ज करें")

    otp = str(random.randint(1000, 9999))
    otp_store[phone] = {"otp": otp, "name": data.name, "expires": datetime.now(timezone.utc) + timedelta(minutes=5)}

    sent = await send_sms_otp(phone, otp)
    if not sent:
        logging.warning(f"SMS sending failed for {phone}, OTP: {otp}")

    logging.info(f"OTP for {phone}: {otp}")
    return {"message": "OTP भेज दिया गया है"}


@router.post("/auth/otp/verify")
async def verify_otp(data: OTPVerify):
    phone = data.phone.strip()
    stored = otp_store.get(phone)

    if not stored:
        raise HTTPException(status_code=400, detail="पहले OTP भेजें")
    if stored["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="गलत OTP")
    if stored["expires"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")

    otp_store[phone]["verified"] = True
    return {"message": "OTP सत्यापित हो गया", "phone_verified": True}


@router.post("/auth/otp/complete-signup")
async def complete_signup(data: OTPCompleteSignup):
    phone = data.phone.strip()
    stored = otp_store.get(phone)

    if not stored or not stored.get("verified"):
        raise HTTPException(status_code=400, detail="पहले OTP सत्यापित करें")

    del otp_store[phone]

    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="यह मोबाइल नंबर पहले से रजिस्टर्ड है। कृपया लॉगिन करें।")

    virtual_email = f"user_{phone}@sattamatka.com"
    user_doc = {
        "name": data.name, "phone": phone, "email": virtual_email,
        "role": "user", "balance": 0.0, "auth_type": "otp",
        "created_at": datetime.now(timezone.utc)
    }

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
        "id": user_id, "name": data.name, "email": virtual_email,
        "phone": phone, "role": "user", "balance": 0.0, "token": access_token
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp


@router.post("/auth/login-otp/send")
async def login_otp_send(data: OTPLoginRequest):
    phone = data.phone.strip()
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="कृपया सही मोबाइल नंबर दर्ज करें")

    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=400, detail="यह मोबाइल नंबर रजिस्टर्ड नहीं है। पहले साइनअप करें।")

    otp = str(random.randint(1000, 9999))
    otp_store[f"login_{phone}"] = {"otp": otp, "expires": datetime.now(timezone.utc) + timedelta(minutes=5)}

    sent = await send_sms_otp(phone, otp)
    if not sent:
        logging.warning(f"Login OTP SMS failed for {phone}, OTP: {otp}")

    logging.info(f"Login OTP for {phone}: {otp}")
    return {"message": "OTP भेज दिया गया है"}


@router.post("/auth/login-otp/verify")
async def login_otp_verify(data: OTPVerify):
    phone = data.phone.strip()
    stored = otp_store.get(f"login_{phone}")

    if not stored:
        raise HTTPException(status_code=400, detail="पहले OTP भेजें")
    if stored["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="गलत OTP")
    if stored["expires"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired। दोबारा भेजें")

    del otp_store[f"login_{phone}"]

    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=400, detail="यह मोबाइल नंबर रजिस्टर्ड नहीं है")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user.get("email") or phone)
    refresh_token = create_refresh_token(user_id)

    resp = JSONResponse(content={
        "id": user_id, "name": user["name"], "email": user.get("email", ""),
        "phone": user.get("phone", ""), "role": user.get("role", "user"),
        "balance": user.get("balance", 0.0), "token": access_token
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp


@router.post("/auth/admin/login")
async def admin_login(data: AdminLogin):
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})

    if not user:
        raise HTTPException(status_code=401, detail="गलत ईमेल या पासवर्ड")
    if user.get("role") != "admin":
        raise HTTPException(status_code=401, detail="सिर्फ एडमिन लॉगिन कर सकता है")
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="पासवर्ड सेट नहीं है")
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="गलत ईमेल या पासवर्ड")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    resp = JSONResponse(content={
        "id": user_id, "name": user["name"], "email": user.get("email", ""),
        "phone": user.get("phone", ""), "role": user.get("role", "admin"),
        "balance": user.get("balance", 0.0), "token": access_token
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp


# Password Reset Routes
@router.post("/auth/password/send-otp")
async def password_reset_send_otp(data: PasswordResetRequest):
    phone = data.phone.strip()
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="कृपया सही मोबाइल नंबर दर्ज करें")

    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=400, detail="यह मोबाइल नंबर रजिस्टर्ड नहीं है")

    otp = str(random.randint(1000, 9999))
    otp_store[f"reset_{phone}"] = {"otp": otp, "expires": datetime.now(timezone.utc) + timedelta(minutes=5)}

    sent = await send_sms_otp(phone, otp)
    if not sent:
        logging.warning(f"Password reset SMS failed for {phone}, OTP: {otp}")

    logging.info(f"Password Reset OTP for {phone}: {otp}")
    return {"message": "OTP भेज दिया गया है"}


@router.post("/auth/password/reset")
async def password_reset(data: PasswordResetComplete):
    phone = data.phone.strip()
    stored = otp_store.get(f"reset_{phone}")

    if not stored:
        raise HTTPException(status_code=400, detail="पहले OTP भेजें")
    if stored["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="गलत OTP")
    if stored["expires"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")

    del otp_store[f"reset_{phone}"]

    hashed = hash_password(data.new_password)
    result = await db.users.update_one({"phone": phone}, {"$set": {"password_hash": hashed}})

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="पासवर्ड अपडेट में समस्या")

    return {"message": "पासवर्ड सफलतापूर्वक बदल दिया गया"}


# Google Auth Session Exchange
@router.post("/auth/google/session")
async def google_session(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

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

    user = await db.users.find_one({"email": email})

    if not user:
        user_doc = {
            "name": name, "email": email, "password_hash": None,
            "role": "user", "balance": 0.0, "auth_type": "google",
            "picture": google_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
    else:
        user_id = str(user["_id"])
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"name": name, "picture": google_data.get("picture")}}
        )

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    user_data = await db.users.find_one({"_id": ObjectId(user_id)})

    resp = JSONResponse(content={
        "id": user_id, "name": user_data["name"], "email": email,
        "phone": user_data.get("phone"), "role": user_data.get("role", "user"),
        "balance": user_data.get("balance", 0.0)
    })
    resp.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    resp.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=31536000, path="/")
    return resp
