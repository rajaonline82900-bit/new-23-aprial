# Satta Matka - MATKA 11 - Product Requirements Document

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features include deposit/withdrawal, Jantri betting, Haruf betting, crossing, result history, bet history, PWA support, push notifications, Refer & Earn, real OTP Authentication, and a full Admin Panel.

## User Personas
- **Players**: Hindi-speaking users who bet on Satta Matka games
- **Admin (Vikram)**: Manages users, declares results, handles withdrawals, sends notifications

## Core Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (Dark Theme)
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Database**: MongoDB
- **Auth**: Phone OTP + Admin email/password + JWT
- **PWA**: Service Worker + Push Notifications (VAPID/pywebpush)

## Code Structure
```
/app/backend/
├── server.py (slim ~150 lines, includes routers)
├── config.py, database.py, models.py, auth.py, helpers.py
├── routes/ (auth, game, wallet, result, chat, admin, notification)
├── uploads/
/app/frontend/src/
├── pages/ (Dashboard, Login, Wallet, Chat, Betting, Admin, etc.)
├── pages/admin/ (AdminUsersTab, AdminBetsTab, AdminResultsTab, etc.)
├── components/ (FooterNav, SidebarMenu, MatkaLogo)
├── context/AuthContext.js
├── public/sw.js (Service Worker)
```

## What's Been Implemented (Complete)

### Phase 1 - Core App
- Phone OTP login/registration
- Game listing with live status
- Jantri betting, Haruf betting, Crossing
- Wallet with Stripe deposits & UPI withdrawals
- Result history & Bet history
- PWA support with service worker
- Refer & Earn system
- Dark theme (user-confirmed preference)

### Phase 2 - Admin Panel
- Admin email/password login at /admin-login
- Dashboard stats: total users, today bets, deposits, withdrawals
- Result declaration (manual + auto-fetch from Matka API)
- Bet distribution reports
- Game management (CRUD)
- User management with full details (deposits/withdrawals/bets/winnings)
- Wallet management (add/deduct balance)
- User deletion
- Withdrawal approve/reject
- Deposit listing with dates
- Settings management (Telegram, WhatsApp, min bets, withdrawal times)
- Admin Chat with voice recording support
- Jantri report & export

### Phase 3 - Refactoring & Enhancements (Latest Session)
- Modularized server.py into FastAPI APIRouters
- Split AdminPage.js into component-based architecture
- Added admin stat cards with clickable modals
- Today New Users modal with clickable user detail view (2026-04-13)
- Push notification token fix: localStorage key corrected to 'matka11_token' (2026-04-13)
- Admin users limit bumped to 500 (2026-04-13)
- Pending deposit auto-expiry after 10 minutes
- Admin voice recording in chat

## Pending / Backlog

### P1 - Push Notifications E2E
- Token key fix deployed (matka11_token) but needs real user to test browser permission flow
- DB currently has 0 push subscriptions - awaiting real user interaction

### P2 - Future Features
- Email notifications for transactions
- Referral earnings history section

## 3rd Party Integrations
- DVHosting SMS API (requires user API key)
- Bavli Matka API (auto-result fetch, requires user API key)
- pywebpush VAPID (system-generated keys)
- Stripe (deposits)

## Key API Endpoints
- Auth: POST /api/auth/send-otp, /api/auth/verify-otp, /api/auth/admin/login
- Games: GET /api/games, /api/games/{id}/results
- Bets: POST /api/bets/place, GET /api/bets/history
- Wallet: POST /api/wallet/deposit, /api/wallet/withdraw
- Admin: GET /api/admin/stats, /api/admin/users, /api/admin/today-new-users
- Push: GET /api/push/vapid-key, POST /api/push/subscribe, POST /api/push/send_all

## DB Schema
- users: {_id, name, phone, password_hash, role, balance, push_subscription, created_at, last_seen}
- games: {game_id, name, name_hi, start_time, end_time, display_time, is_active}
- bets: {id, user_id, game_id, number, bet_type, amount, status, potential_win, date}
- transactions: {id, user_id, type, amount, status, created_at, utr_number, session_id}
- results: {id, game_id, date, single_result, jodi_result, declared_at}
- push_subscriptions: {user_id, subscription, updated_at}
- messages: {sender_id, receiver_id, message, msg_type, attachment_url, read}
