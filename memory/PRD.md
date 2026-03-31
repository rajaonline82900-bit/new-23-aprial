# Satta Matka Betting Application - PRD

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features include deposit/withdrawal, result history, bet history, betting on single numbers (0-9) and jodis (00-99), Haruf Andar/Bahar, and a comprehensive Admin Panel.

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
- [x] Jantri Betting Grid - 00-99 jodi grid with batch bet API (90x)
- [x] **Haruf Andar/Bahar** - 0-9 digit betting for both panels (9x), Andar=first digit, Bahar=second digit
- [x] **Combined Batch Betting** - jodi + haruf_andar + haruf_bahar all placed together
- [x] **Result Settlement** - haruf_andar/bahar winners auto-settled on result declaration

## Bet Types
| Type | Numbers | Multiplier | Description |
|------|---------|-----------|-------------|
| jodi | 00-99 | 90x | Full two-digit number |
| haruf_andar | 0-9 | 9x | First/left digit of jodi |
| haruf_bahar | 0-9 | 9x | Second/right digit of jodi |
| single | 0-9 | 9x | Single digit |

## Upcoming Tasks (P1)
- [ ] Bet history filter options
- [ ] Multiple bet placement improvements

## Future Tasks (P2)
- [ ] Transaction history export
- [ ] Profile page settings update
- [ ] Email notifications for transactions
- [ ] JWT token expiry/refresh handling
- [ ] Refactor server.py and AdminPage.js
- [ ] Frontend timezone IST consistency

## Key DB Schema
- users: {_id, name, email, password_hash, role, balance, created_at}
- games: {_id, game_id, name, name_hi, start_time, end_time, display_time, is_active}
- bets: {_id, user_id, game_id, number, bet_type, amount, potential_win, status, date, created_at}
- transactions: {_id, user_id, amount, type, status, reference_id, created_at}
- results: {_id, game_id, date, jodi_result, single_result, declared_at}

## Admin Credentials
- Email: admin@sattamatka.com
- Password: Admin@123
