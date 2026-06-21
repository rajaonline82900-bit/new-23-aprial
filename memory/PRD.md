# MATKA11 - Product Requirements Document

## Original Problem Statement
Migrate Matka11 satta app from Emergent preview environment to self-hosted Hostinger VPS at https://matka11.online with full feature parity and automatic result fetching from king.sattaapi.com.

## Tech Stack
- Frontend: React 18 + Tailwind + shadcn/ui
- Backend: FastAPI (Python)
- Database: MongoDB (self-hosted on VPS)
- Deployment: Hostinger VPS Ubuntu 22.04 (7GB RAM)
- Web Server: Nginx + systemd-managed uvicorn
- SSL: Let's Encrypt (Certbot)
- Domain: matka11.online

## Production Environment
- VPS IP: 187.127.172.100
- Live URL: https://matka11.online
- Admin URL: https://matka11.online/admin-login
- Backend Service: systemctl service `matka11`
- Code Path: /var/www/new-23-aprial/
- DB Name: matka11

## Test Credentials
- Admin: admin@sattamatka.com / Admin@123
- Test User: 9111222333 / Test@123

## Integrations (All Live in Production)
1. IMB Payment Gateway (Deposits) - https://secure-stage.imb.org.in
2. DVHosting SMS - https://dvhosting.in/api/sendsms
3. king.sattaapi.com - Auto Result (NEW) - https://king.sattaapi.com/wp-json/satta/v1/results
4. VAPID Push Notifications

## Active Games (6)
1. Delhi Bazaar - 3:00 PM
2. Shri Ganesh - 4:30 PM
3. Faridabad - 6:00 PM
4. Ghaziabad - 8:30 PM
5. Gali - 11:30 PM
6. Disawar - 5:00 AM next day

## Major Features Implemented
- Phone+Password signup/login (no OTP)
- JWT 1-year token (no auto-logout)
- Wallet (IMB deposit, withdraw)
- Game betting (Jodi, Single, Patti)
- Admin panel (Games, Results, Bets, Jantri, Winners, Withdrawals, Chat)
- AUTOMATIC RESULT FETCHING from king.sattaapi.com every 2 min
- Push notifications
- APK download /matka11.apk

## Critical Fixes (Feb 2026)
1. VPS migration from Emergent to Hostinger
2. MongoDB index conflicts cleaned
3. Hardcoded /app/backend/uploads -> relative UPLOADS_PATH
4. Systemd WorkingDirectory fixed
5. NAVIGATION BUG: <Link><Button> nesting -> onClick={navigate()}
6. INFINITE API LOOP: refreshUser wrapped in useCallback
7. SERVICE WORKER: self-destruct mode (no navigation interception)
8. helpers.py KeyError defensive lookup
9. king.sattaapi.com integration (replaces matkaapi.com)
10. .env shell-escape: heredoc append

## Backlog
- P2: Stronger JWT_SECRET
- P2: MongoDB backup cron
- P2: Telegram admin alerts for deposits/withdraws
- P3: Rate limiting on auth
- P3: IMB stage -> production URL
- P3: /api/health endpoint
