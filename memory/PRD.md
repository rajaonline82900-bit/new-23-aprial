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
- [x] Quick Bet UI (single 0-9, jodi 00-99)
- [x] Result declaration (jodi only, single auto-calculated)
- [x] Admin Panel: User management, wallet management
- [x] Admin Panel: Daily deposit/withdrawal stats
- [x] Admin Panel: Bet distribution report
- [x] Admin Panel: Game management (CRUD) with start_time/end_time
- [x] Jantri Page (result matrix)
- [x] Telegram/WhatsApp notification integration (stub)
- [x] Dynamic Games API
- [x] Game betting time lock (start_time/end_time based)
- [x] Backend time validation for bet placement (IST)

## Upcoming Tasks (P1)
- [ ] Multiple bets at once (multi-bet placement)
- [ ] Bet history filter options

## Future Tasks (P2)
- [ ] Transaction history export
- [ ] Profile page settings update
- [ ] Email notifications for transactions
- [ ] JWT token expiry/refresh handling improvement
- [ ] Refactor server.py and AdminPage.js (monolithic)

## Key DB Schema
- users: {_id, name, email, password_hash, role, balance, created_at}
- games: {_id, game_id, name, name_hi, start_time, end_time, display_time, is_active}
- bets: {_id, user_id, game_id, number, type, amount, status, win_amount, created_at}
- transactions: {_id, user_id, amount, type, status, reference_id, created_at}
- results: {_id, game_id, date, jodi_result, single_result, created_at}

## Admin Credentials
- Email: admin@sattamatka.com
- Password: Admin@123
