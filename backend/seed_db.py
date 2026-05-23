"""
MATKA11 — Database Seed Script
Run this ONCE after fresh MongoDB install to create:
  1. Admin user (admin@sattamatka.com / Admin@123)
  2. Default 6 games (Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, Disawar)
  3. Default app settings

Usage:
  cd backend
  source venv/bin/activate
  python seed_db.py
"""
import asyncio
import os
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "matka11")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@sattamatka.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")


DEFAULT_GAMES = {
    "delhi_bazaar": {"name": "Delhi Bazaar", "name_hi": "दिल्ली बाजार", "start_time": "14:00", "end_time": "15:00", "display_time": "3:00 PM", "is_active": True, "category": "gali_disawar"},
    "shri_ganesh": {"name": "Shri Ganesh", "name_hi": "श्री गणेश", "start_time": "17:00", "end_time": "18:00", "display_time": "6:00 PM", "is_active": True, "category": "gali_disawar"},
    "faridabad": {"name": "Faridabad", "name_hi": "फरीदाबाद", "start_time": "17:15", "end_time": "18:15", "display_time": "6:15 PM", "is_active": True, "category": "gali_disawar"},
    "ghaziabad": {"name": "Ghaziabad", "name_hi": "गाजियाबाद", "start_time": "19:30", "end_time": "20:30", "display_time": "8:30 PM", "is_active": True, "category": "gali_disawar"},
    "gali": {"name": "Gali", "name_hi": "गली", "start_time": "22:30", "end_time": "23:30", "display_time": "11:30 PM", "is_active": True, "category": "gali_disawar"},
    "disawar": {"name": "Disawar", "name_hi": "दिसावर", "start_time": "04:00", "end_time": "05:00", "display_time": "5:00 AM", "is_active": True, "category": "gali_disawar"},
}

DEFAULT_SETTINGS = {
    "key": "app_settings",
    "telegram_link": "",
    "whatsapp_link": "",
    "withdrawal_proof_telegram": "",
    "withdrawal_start_time": "08:00",
    "withdrawal_end_time": "22:00",
    "min_bet_jodi": 10,
    "min_bet_haruf": 10,
    "min_bet_crossing": 10,
    "min_deposit": 100,
    "min_withdrawal": 100,
}


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"\n📦 Connected to MongoDB: {DB_NAME}\n")

    # 1) Admin user
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing:
        print(f"✓ Admin already exists: {ADMIN_EMAIL}")
    else:
        await db.users.insert_one({
            "name": "Admin",
            "email": ADMIN_EMAIL,
            "password_hash": hash_pw(ADMIN_PASSWORD),
            "role": "admin",
            "balance": 0.0,
            "created_at": datetime.now(timezone.utc),
        })
        print(f"✅ Admin created: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")

    # 2) Games
    games_added = 0
    for gid, gdata in DEFAULT_GAMES.items():
        existing = await db.games.find_one({"id": gid})
        if not existing:
            await db.games.insert_one({
                "id": gid,
                **gdata,
                "created_at": datetime.now(timezone.utc),
            })
            games_added += 1
    print(f"✅ Games seeded: {games_added} new, {6 - games_added} existing")

    # 3) Default settings
    existing = await db.settings.find_one({"key": "app_settings"})
    if not existing:
        await db.settings.insert_one(DEFAULT_SETTINGS)
        print("✅ Default app_settings created")
    else:
        print("✓ Settings already exist")

    # 4) Indexes for performance
    await db.users.create_index("phone")
    await db.users.create_index("email")
    await db.bets.create_index([("user_id", 1), ("date", -1)])
    await db.bets.create_index([("game_id", 1), ("date", -1), ("status", 1)])
    await db.results.create_index([("game_id", 1), ("date", -1)])
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    print("✅ Indexes created")

    print(f"\n🎉 Database seeded successfully!\n")
    print(f"   Admin login URL: https://<your-domain>/admin-login")
    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")
    print(f"\n   ⚠️  IMPORTANT: Change admin password after first login!\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
