# Satta Matka Betting Application - PRD

## Original Problem Statement
Build a Satta Matka betting application with Jantri, Haruf Andar/Bahar, Cross Bet, IMB UPI Payment Gateway deposit, and Admin Panel.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, React Router
- Backend: FastAPI, Motor (Async MongoDB), PyJWT
- Database: MongoDB
- Payments: IMB UPI Payment Gateway (secure-stage.imb.org.in)
- Notifications: Telegram (aiohttp), WhatsApp (Twilio) - stubbed

## Completed Features
- [x] JWT Authentication
- [x] Jantri Betting Grid (00-99 jodi, 90x)
- [x] Haruf Andar/Bahar (0-9, 9x)
- [x] Cross Bet (auto-generate jodi combinations)
- [x] IMB UPI Payment Gateway deposit integration
- [x] Withdrawal via UPI
- [x] Game time lock (start_time/end_time)
- [x] Admin Panel (users, games, results, stats, bet distribution)
- [x] FooterNav on all pages (Home, Fund, Bid History, Result Chart, Refer & Earn)
- [x] Constant bet summary bar with Play/Delete buttons
- [x] Result Reverse & Bet Reverse in Admin Panel
- [x] Daily Result Tracking (duplicate protection + status tracker)
- [x] Dynamic Admin Settings (Telegram/WhatsApp links)
- [x] Today/Yesterday dual result boxes on Dashboard game cards (Red=Yesterday, Green=Today) [31-Mar-2026]
- [x] Play/Time Out button on game cards based on game time [31-Mar-2026]
- [x] Floating Refer button (bottom-right FAB) [31-Mar-2026]
- [x] IMB Payment Gateway balance update bug fix (redirect_url, JSON parsing, verify key mapping) [31-Mar-2026]
- [x] Payment opens in new tab (no logout issue) [31-Mar-2026]
- [x] Game Holiday - last date of month auto holiday, betting blocked [31-Mar-2026]
- [x] Sidebar Menu with Language, How to Play, Deposit History, Result History, Refer & Earn, Rate List, Customer Support, Withdrawal Proof [31-Mar-2026]
- [x] Date + Time shown in deposit/withdraw transactions [31-Mar-2026]
- [x] PWA Support (manifest.json, service worker, app icons, install button) [31-Mar-2026]

## Payment Integration
- Provider: IMB UPI Payment Gateway
- API URL: https://secure-stage.imb.org.in
- Create Order → Redirect to payment page → Callback/Webhook → Balance credit
- Endpoints: POST /api/wallet/deposit, GET /api/wallet/imb-callback, POST /api/wallet/imb-webhook

## Admin Credentials
- Email: admin@sattamatka.com
- Password: Admin@123
