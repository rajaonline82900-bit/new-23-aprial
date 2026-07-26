"""Foolproof standalone runner for the Kalyan games seed script.

Loads backend/.env explicitly using python-dotenv (avoids fragile
`export $(grep ... .env | xargs)` bash tricks that break on URLs with `//`
or values containing `=` / spaces).

Usage on VPS:
    cd /var/www/new-23-aprial/backend
    python3 run_kalyan_seed.py
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env sitting next to this file (backend/.env)
BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / ".env"

if not env_path.exists():
    print(f"[ERROR] .env file not found at {env_path}")
    sys.exit(1)

load_dotenv(dotenv_path=env_path)

# Sanity check the two vars database.py needs
missing = [k for k in ("MONGO_URL", "DB_NAME") if not os.environ.get(k)]
if missing:
    print(f"[ERROR] Missing env vars in {env_path}: {missing}")
    sys.exit(1)

print(f"[OK] Loaded .env from {env_path}")
print(f"[OK] DB_NAME = {os.environ['DB_NAME']}")

# Ensure backend/ is on sys.path so `from database import db` works
sys.path.insert(0, str(BASE_DIR))

from seeds.kalyan_games_seed import seed_kalyan_games  # noqa: E402

if __name__ == "__main__":
    result = asyncio.run(seed_kalyan_games())
    print(f"[DONE] Seed result: {result}")
