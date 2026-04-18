#!/usr/bin/env python3
"""Cron script: Fetch results from Matka API and push to production (matka11.online)"""
import asyncio
import httpx
import os
import logging
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))
MATKA_BASE = "https://matkawebhook.matka-api.online"
MATKA_USER = "9983632440"
MATKA_PASS = "123"
PROD_URL = "https://matka11.online"
PROD_ADMIN_EMAIL = "admin@sattamatka.com"
PROD_ADMIN_PASS = "Admin@123"

MARKET_TO_GAME = {
    "DISAWER": "disawar",
    "DELHI BAZAR": "delhi_bazaar",
    "SHRI GANESH": "shri_ganesh",
    "FARIDABAD": "faridabad",
    "GHAZIABAD": "ghaziabad",
    "GALI": "gali",
}


async def fetch_and_push():
    date_str = datetime.now(IST).strftime("%Y-%m-%d")
    logger.info(f"Fetching results for {date_str}")

    async with httpx.AsyncClient(timeout=15, verify=False) as client:
        # Get token
        resp = await client.post(f"{MATKA_BASE}/get-refresh-token-delhi", data={"username": MATKA_USER, "password": MATKA_PASS})
        token = resp.json().get("refresh_token", "")
        if not token:
            logger.error("No token from Matka API")
            return

        # Fetch results
        resp2 = await client.post(f"{MATKA_BASE}/market-data-delhi", data={
            "username": MATKA_USER, "API_token": token, "markte_name": "", "date": date_str
        })
        data = resp2.json()
        today_results = [r for r in data.get("today_result", []) if r.get("aankdo_date") == date_str]

        # Get production admin token
        login_resp = await client.post(f"{PROD_URL}/api/auth/admin/login", json={"email": PROD_ADMIN_EMAIL, "password": PROD_ADMIN_PASS})
        admin_token = login_resp.json().get("token", "")
        if not admin_token:
            logger.error("Cannot login to production admin")
            return

        # Check which results are pending on production
        status_resp = await client.get(f"{PROD_URL}/api/admin/results/status", headers={"Authorization": f"Bearer {admin_token}"})
        prod_status = status_resp.json()
        pending_games = {g["game_id"]: g for g in prod_status.get("games", []) if not g.get("declared")}

        # Push missing results
        pushed = 0
        for r in today_results:
            market_name = r.get("market_name", "").upper().strip()
            jodi = r.get("jodi", "").strip()
            game_id = MARKET_TO_GAME.get(market_name)

            if not game_id or game_id not in pending_games or not jodi or len(jodi) != 2:
                continue

            # Declare result on production
            declare_resp = await client.post(
                f"{PROD_URL}/api/admin/results",
                headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
                json={"game_id": game_id, "date": date_str, "jodi_result": jodi}
            )
            result = declare_resp.json()
            logger.info(f"Declared {market_name} ({game_id}) = {jodi} on production: {result.get('message', '')}")
            pushed += 1

        logger.info(f"Done: {pushed} results pushed to production")


async def main():
    logger.info("Starting auto-push cron loop (every 5 min)")
    while True:
        try:
            await fetch_and_push()
        except Exception as e:
            logger.error(f"Cron error: {e}")
        await asyncio.sleep(300)


if __name__ == "__main__":
    asyncio.run(main())
