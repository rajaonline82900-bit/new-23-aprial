# Satta Matka Betting Application - PRD

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features include deposit/withdrawal, result history, bet history, betting on single numbers (0-9) and jodis (00-99), and a comprehensive Admin Panel.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, React Router
- Backend: FastAPI, Motor (Async MongoDB), PyJWT, Stripe
- Database: MongoDB
- Notifications: Telegram (aiohttp), WhatsApp (Twilio)

## Completed Features
- [x] JWT Authentication (login, register, logout)
- [x] User Wallet (Stripe deposits, UPI withdrawals)
- [x] Result declaration (jodi only, single auto-calculated)
- [x] Admin Panel: User management, wallet management
- [x] Admin Panel: Daily deposit/withdrawal stats
- [x] Admin Panel: Bet distribution report
- [x] Admin Panel: Game management (CRUD) with start_time/end_time
- [x] Jantri Page (result matrix)
- [x] Telegram/WhatsApp notification integration (stub)
- [x] Dynamic Games API
- [x] Game betting time lock (start_time/end_time based, IST)
- [x] Backend time validation for bet placement
- [x] **Jantri Betting Grid** - 00-99 jodi grid with individual amounts, quick amount buttons, batch bet API
- [x] **Batch Bet API** - POST /api/bets/batch for multiple jodi bets at once

## Upcoming Tasks (P1)
- [ ] Bet history filter options
- [ ] Single number betting option (if user wants it back)

## Future Tasks (P2)
- [ ] Transaction history export
- [ ] Profile page settings update
- [ ] Email notifications for transactions
- [ ] JWT token expiry/refresh handling improvement
- [ ] Refactor server.py and AdminPage.js (monolithic)
- [ ] Frontend timezone: use IST consistently instead of browser local time

## Key DB Schema
- users: {_id, name, email, password_hash, role, balance, created_at}
- games: {_id, game_id, name, name_hi, start_time, end_time, display_time, is_active}
- bets: {_id, user_id, game_id, number, type, amount, status, win_amount, created_at}
- transactions: {_id, user_id, amount, type, status, reference_id, created_at}
- results: {_id, game_id, date, jodi_result, single_result, created_at}

## Key API Endpoints
- POST /api/bets/batch - Batch bet placement (Jantri)
- POST /api/bets - Single bet placement
- GET/POST /api/admin/games - Game CRUD with start_time/end_time

## Admin Credentials
- Email: admin@sattamatka.com
- Password: Admin@123
