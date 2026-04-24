from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from database import db, client
from auth import hash_password, verify_password
from config import DEFAULT_GAMES, MATKA_API_USERNAME, MATKA_API_PASSWORD
from helpers import load_games

# Import route modules
from routes.auth_routes import router as auth_router
from routes.game_routes import router as game_router
from routes.wallet_routes import router as wallet_router
from routes.result_routes import router as result_router
from routes.chat_routes import router as chat_router
from routes.admin_routes import router as admin_router, auto_fetch_loop, expire_pending_deposits_loop
from routes.notification_routes import router as notification_router
from routes.kalyan_routes import router as kalyan_router

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(",") if os.environ.get("CORS_ORIGINS") != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create API router and include all sub-routers
from fastapi import APIRouter
api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(game_router)
api_router.include_router(wallet_router)
api_router.include_router(result_router)
api_router.include_router(chat_router)
api_router.include_router(admin_router)
api_router.include_router(notification_router)
api_router.include_router(kalyan_router)

app.include_router(api_router)

# Serve uploaded files
app.mount("/api/uploads", StaticFiles(directory="/app/backend/uploads"), name="uploads")


@app.on_event("startup")
async def startup_event():
    # Create indexes
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index("email", unique=True, sparse=True)
    await db.bets.create_index([("user_id", 1), ("created_at", -1)])
    await db.results.create_index([("game_id", 1), ("date", -1)])
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.games.create_index("game_id", unique=True)

    # Seed default games
    games_count = await db.games.count_documents({})
    if games_count == 0:
        for game_id, game_data in DEFAULT_GAMES.items():
            await db.games.insert_one({"game_id": game_id, **game_data, "created_at": datetime.now(timezone.utc)})
        logger.info("Default games seeded")
    else:
        for game_id, game_data in DEFAULT_GAMES.items():
            await db.games.update_one(
                {"game_id": game_id, "start_time": {"$exists": False}},
                {"$set": {"start_time": game_data["start_time"], "end_time": game_data["end_time"]}}
            )

    await load_games()

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sattamatka.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email, "password_hash": hashed, "name": "Admin",
            "role": "admin", "balance": 0.0, "created_at": datetime.now(timezone.utc)
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
- Login URL: /admin-login
- Role: admin

## Test User (Create via OTP registration)
- Phone: Any 10-digit number (e.g., 8585859186)
- OTP: Check backend logs for OTP

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


@app.on_event("startup")
async def start_auto_fetch():
    if MATKA_API_USERNAME and MATKA_API_PASSWORD:
        asyncio.create_task(auto_fetch_loop())
        logger.info("Auto-result fetch scheduled (every 5 min)")
    # Production push cron - pushes results to matka11.online
    prod_url = os.environ.get("PRODUCTION_URL", "")
    if prod_url:
        asyncio.create_task(production_push_loop(prod_url))
        logger.info(f"Production push cron started -> {prod_url}")
    asyncio.create_task(expire_pending_deposits_loop())
    logger.info("Pending deposit expiry loop started (every 2 min)")
    asyncio.create_task(auto_verify_deposits_loop())
    logger.info("Auto-verify deposits loop started (every 2 min)")
    asyncio.create_task(auto_delete_chat_loop())
    logger.info("Chat auto-delete loop started (every 1 hour)")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


async def auto_verify_deposits_loop():
    """Check pending/expired deposits on IMB every 2 min and auto-credit if COMPLETED"""
    import httpx as _httpx
    imb_url = os.environ.get("IMB_API_URL", "")
    imb_token = os.environ.get("IMB_API_TOKEN", "")
    if not imb_url or not imb_token:
        logger.warning("IMB credentials not set, auto-verify disabled")
        return
    
    await asyncio.sleep(60)
    
    while True:
        try:
            # Find pending + expired + failed deposits from last 24 hours (in case genuinely paid)
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            pending_deposits = await db.transactions.find(
                {"type": "deposit", "status": {"$in": ["pending", "expired", "failed"]}, "created_at": {"$gt": cutoff}},
                {"_id": 0}
            ).to_list(100)
            
            if pending_deposits:
                logger.info(f"Auto-verify: checking {len(pending_deposits)} pending/expired/failed deposits")
                
                async with _httpx.AsyncClient(timeout=15, verify=False) as client:
                    for dep in pending_deposits:
                        order_id = dep.get("order_id", "")
                        if not order_id:
                            continue
                        try:
                            resp = await client.post(
                                f"{imb_url}/api/check-order-status",
                                data={"user_token": imb_token, "order_id": order_id},
                                headers={"Content-Type": "application/x-www-form-urlencoded"}
                            )
                            verify_data = resp.json()
                            txn_status = (verify_data.get("result", {}).get("txnStatus") or "").upper()
                            
                            if txn_status in ("COMPLETED", "SUCCESS"):
                                # Idempotent credit: only if not already completed
                                fresh = await db.transactions.find_one({"order_id": order_id})
                                if fresh and fresh.get("status") != "completed":
                                    await db.users.update_one(
                                        {"_id": ObjectId(dep["user_id"])},
                                        {"$inc": {"balance": dep["amount"]}}
                                    )
                                    await db.transactions.update_one(
                                        {"order_id": order_id},
                                        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc), "auto_verified": True}}
                                    )
                                    logger.info(f"Auto-verify CREDITED: {order_id} ₹{dep['amount']} -> user {dep['user_id']} (prev_status={dep.get('status')})")
                        except Exception as e:
                            logger.error(f"Auto-verify error for {order_id}: {e}")
        except Exception as e:
            logger.error(f"Auto-verify loop error: {e}")
        
        await asyncio.sleep(60)  # Every 1 minute


async def auto_delete_chat_loop():
    """Check settings every hour and delete chat messages older than configured hours."""
    await asyncio.sleep(90)
    while True:
        try:
            setting = await db.settings.find_one({"key": "chat_auto_delete"})
            if setting and setting.get("enabled"):
                hours = int(setting.get("hours", 24))
                cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
                # Gather attachment paths to cleanup
                old_msgs = await db.chat_messages.find(
                    {"created_at": {"$lt": cutoff}, "attachment_url": {"$ne": None}},
                    {"attachment_url": 1}
                ).to_list(5000)
                for m in old_msgs:
                    att = m.get("attachment_url", "")
                    if att and att.startswith("/api/uploads/"):
                        try:
                            fname = att.replace("/api/uploads/", "")
                            fpath = f"/app/backend/uploads/{fname}"
                            if os.path.exists(fpath):
                                os.remove(fpath)
                        except Exception:
                            pass
                result = await db.chat_messages.delete_many({"created_at": {"$lt": cutoff}})
                if result.deleted_count > 0:
                    logger.info(f"Auto-delete chat: removed {result.deleted_count} messages older than {hours}h")
        except Exception as e:
            logger.error(f"Chat auto-delete loop error: {e}")
        await asyncio.sleep(3600)  # Every 1 hour


async def production_push_loop(prod_url):
    """Push auto-fetched results to production via push-external (JWT secret auth, no login needed)"""
    import httpx as _httpx
    from datetime import timedelta
    from config import IST, MATKA_API_USERNAME as MUSER, MATKA_API_PASSWORD as MPASS, MATKA_API_BASE as MBASE, MARKET_TO_GAME

    jwt_secret = os.environ.get("JWT_SECRET", "")
    if not jwt_secret:
        logger.error("Prod push: JWT_SECRET missing, cannot authenticate push-external")
        return

    logger.info("Production push loop waiting 15s for startup...")
    await asyncio.sleep(15)

    def _safe_json(resp):
        try:
            return resp.json()
        except Exception:
            return {}

    while True:
        try:
            date_str = datetime.now(IST).strftime("%Y-%m-%d")
            async with _httpx.AsyncClient(timeout=20, verify=False) as c:
                # Get matka token
                try:
                    r = await c.post(f"{MBASE}/get-refresh-token-delhi", data={"username": MUSER, "password": MPASS})
                    token = _safe_json(r).get("refresh_token", "")
                except Exception as e:
                    logger.error(f"Prod push: matka token err: {e}")
                    await asyncio.sleep(60)
                    continue
                if not token:
                    await asyncio.sleep(60)
                    continue

                # Collect today's results from both endpoints
                api_results = []
                for endpoint in ["market-data-delhi", "market-data"]:
                    try:
                        r2 = await c.post(f"{MBASE}/{endpoint}", data={"username": MUSER, "API_token": token, "markte_name": "", "date": date_str})
                        for res in _safe_json(r2).get("today_result", []):
                            name = res.get("market_name", "").upper().strip()
                            jodi = res.get("jodi", "").strip()
                            if name in MARKET_TO_GAME and res.get("aankdo_date") == date_str and jodi and len(jodi) == 2 and jodi.isdigit():
                                api_results.append({"game_id": MARKET_TO_GAME[name], "jodi": jodi, "date": date_str})
                    except Exception as e:
                        logger.warning(f"Prod push: {endpoint} err: {e}")

                if not api_results:
                    await asyncio.sleep(45)
                    continue

                # Dedupe by game_id (keep first)
                seen = set()
                unique = []
                for r in api_results:
                    if r["game_id"] not in seen:
                        seen.add(r["game_id"])
                        unique.append(r)

                # Push via JWT-secret-authenticated push-external (no admin login needed)
                try:
                    resp = await c.post(
                        f"{prod_url}/api/admin/results/push-external",
                        json={"secret": jwt_secret, "results": unique},
                        headers={"Content-Type": "application/json"}
                    )
                    data = _safe_json(resp)
                    applied = data.get("applied", [])
                    if applied:
                        logger.info(f"Prod push OK: applied={applied}")
                    else:
                        logger.debug(f"Prod push: nothing new (checked {len(unique)} results)")
                except Exception as e:
                    logger.error(f"Prod push-external err: {e}")

        except Exception as e:
            logger.error(f"Prod push loop err: {e}")

        await asyncio.sleep(45)  # Every 45 seconds
