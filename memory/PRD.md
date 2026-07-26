# M11Cloube — Matka Betting Platform (PRD)

## Domain
- Production: **https://m11cloube.in** (Hostinger VPS)
- VPS IP: `200.141.5.42` (Ubuntu 24.04)

## Product
Multi-game betting platform:
- **Kalyan Matka** — 11 authoritative games (Sridevi, Time Bazar, Madhur Day/Night, Milan Day/Night, Rajdhani Day/Night, Sridevi Night, Kalyan Night, Main Bazar) with DP Boss auto-fetch (30s poll), manual bet amounts, Chart page
- **Gali/Disawar** — SattaAPI auto-fetch loop
- **Aviator** — 35% win rate, community fake bet feed
- **Coin Toss** — 35% win rate, 3D flat animation, privacy mode (users see only own bets), ₹50 min bet
- **Ludo** — Zupee-style with bot-fill, turn-timer, match-timer
- **Admin Panel** — Wallet Transactions merged (Matka+Ludo+Aviator+Coin), user drawer, game toggles, fake ticker injection, configurable min bets

## Tech Stack
- Frontend: React + CRA + shadcn/ui (built via `yarn build` → `frontend/build/`)
- Backend: FastAPI + Motor (MongoDB async) + uvicorn (2 workers via systemd)
- DB: MongoDB `matka_prod`
- Reverse Proxy: Nginx + Certbot SSL (Let's Encrypt)

## Deployment (Hostinger VPS Ubuntu 24.04)
- Service: `matka-backend.service` (systemd, `ExecStart=/usr/local/bin/uvicorn server:app`)
- Env: `/var/www/new-23-aprial/backend/.env` (loaded via systemd `EnvironmentFile`)
- Nginx: `/etc/nginx/sites-enabled/m11cloube.in` — SSL on 443, `/api/` proxy → 127.0.0.1:8001, root → `frontend/build/`
- pip install requires `--ignore-installed` flag due to Debian-managed urllib3/typing_extensions

## Completed (26 Jul 2026)
- [x] Kalyan 11 games seeded (`/app/backend/seeds/kalyan_games_seed.py`)
- [x] Foolproof standalone seed runner (`/app/backend/run_kalyan_seed.py`) — auto-loads `.env` via python-dotenv
- [x] Coin Toss: 3D flat animation, 35% win, privacy mode, ₹50 min bet
- [x] Aviator: 35% win, community fake bet feed, wallet-history fixes
- [x] Admin Panel: merged Wallet Transactions in User Details drawer
- [x] Kalyan Chart page with year/month filter
- [x] Manual bet amount input + configurable min bets
- [x] 30s auto-fetch polling
- [x] Race-safe admin seed (workers=2 no longer crashes on duplicate key)
- [x] `/app/memory` path made optional in `server.py` (dev-only credentials write)
- [x] VPS: uvicorn+fastapi+motor+pymongo installed, systemd service running
- [x] DNS A records: `@` and `www` → `200.141.5.42`
- [x] SSL via Certbot, Nginx serving React build, backend proxied via /api/
- [x] **App LIVE at https://m11cloube.in — HTTP 200 OK confirmed**

## Pending / Optional
- [ ] Set `KALYAN_AUTO_FETCH_ENABLED=true` in `/var/www/new-23-aprial/backend/.env` to activate DP Boss polling
- [ ] Add SattaAPI credentials (`SATTA_API_URL`, `SATTA_API_KEY`, `SATTA_DOMAIN_KEY`) for Gali/Disawar auto-fetch
- [ ] IMB payment gateway credentials for auto-verify deposits
- [ ] Admin Panel: "Provider Status" section for SattaAPI/DPBoss health
- [ ] MongoDB backup cron on VPS

## Credentials
- Admin: `admin@sattamatka.com` / `Admin@123`

## Key Files
- Backend routes: `/app/backend/routes/{kalyan_routes,kalyan_auto_results,gali_auto_results,aviator_routes,coin_routes,admin_routes}.py`
- Kalyan seed: `/app/backend/seeds/kalyan_games_seed.py`
- Seed runner: `/app/backend/run_kalyan_seed.py`
- Frontend pages: `/app/frontend/src/pages/{KalyanGamePage,KalyanChartPage,CoinPage,AviatorPage}.js`
- Admin: `/app/frontend/src/pages/admin/{AdminUsersTab,AdminSettingsTab}.js`
