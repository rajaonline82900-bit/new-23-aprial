#!/usr/bin/env python3
"""Push results from Matka API to matka11.online production - runs every 3 minutes"""
import asyncio
import httpx
import logging
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
log = logging.getLogger()

IST = timezone(timedelta(hours=5, minutes=30))
API = "https://matkawebhook.matka-api.online"
PROD = "https://matka11.online"
USER = "9983632440"
PASS = "123"
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASS = "Admin@123"

MAP = {
    "DISAWER": "disawar",
    "DELHI BAZAR": "delhi_bazaar",
    "SHRI GANESH": "shri_ganesh",
    "FARIDABAD": "faridabad",
    "GHAZIABAD": "ghaziabad",
    "GALI": "gali",
}

async def run():
    date = datetime.now(IST).strftime("%Y-%m-%d")
    log.info(f"--- Checking {date} ---")
    
    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as c:
            # 1. Get matka API token
            r = await c.post(f"{API}/get-refresh-token-delhi", data={"username": USER, "password": PASS})
            token = r.json().get("refresh_token", "")
            if not token:
                log.error("No matka token")
                return
            
            # 2. Get today's results from API
            r2 = await c.post(f"{API}/market-data-delhi", data={"username": USER, "API_token": token, "markte_name": "", "date": date})
            api_data = r2.json()
            
            api_results = {}
            for res in api_data.get("today_result", []):
                name = res.get("market_name", "").upper().strip()
                jodi = res.get("jodi", "").strip()
                res_date = res.get("aankdo_date", "").strip()
                if name in MAP and res_date == date and jodi and len(jodi) == 2 and jodi.isdigit():
                    api_results[MAP[name]] = jodi
            
            if not api_results:
                log.info("No matching results from API")
                return
            
            log.info(f"API results: {api_results}")
            
            # 3. Login to production
            lr = await c.post(f"{PROD}/api/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
            admin_token = lr.json().get("token", "")
            if not admin_token:
                log.error("Cannot login to production")
                return
            
            # 4. Check what's pending on production
            sr = await c.get(f"{PROD}/api/admin/results/status", headers={"Authorization": f"Bearer {admin_token}"})
            status = sr.json()
            
            pending = set()
            for g in status.get("games", []):
                if not g.get("declared"):
                    pending.add(g["game_id"])
            
            # 5. Push missing results
            pushed = 0
            for game_id, jodi in api_results.items():
                if game_id not in pending:
                    continue
                
                dr = await c.post(
                    f"{PROD}/api/admin/results",
                    headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
                    json={"game_id": game_id, "date": date, "jodi_result": jodi}
                )
                result = dr.json()
                log.info(f"PUSHED {game_id} = {jodi}: {result.get('message', result)}")
                pushed += 1
            
            log.info(f"Total pushed: {pushed}")
    
    except Exception as e:
        log.error(f"Error: {e}")

async def main():
    log.info("=== CRON STARTED (every 3 min) ===")
    while True:
        await run()
        await asyncio.sleep(180)  # 3 minutes

if __name__ == "__main__":
    asyncio.run(main())
