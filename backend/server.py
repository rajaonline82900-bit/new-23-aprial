from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone

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
    asyncio.create_task(expire_pending_deposits_loop())
    logger.info("Pending deposit expiry loop started (every 2 min)")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
