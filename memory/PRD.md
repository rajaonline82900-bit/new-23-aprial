# Satta Matka - MATKA 11 - Product Requirements Document

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features include deposit/withdrawal, Jantri betting, Haruf betting, crossing, result history, bet history, PWA support, push notifications, Refer & Earn, real OTP Authentication, and a full Admin Panel.

## Core Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (Dark Theme)
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Auth**: Phone OTP + Admin email/password + JWT
- **PWA**: Service Worker + Push Notifications (VAPID/pywebpush)

## Code Structure
```
/app/backend/
├── server.py (slim ~150 lines)
├── config.py, database.py, models.py, auth.py, helpers.py
├── routes/ (auth, game, wallet, result, chat, admin, notification)
/app/frontend/src/
├── pages/ (Dashboard, Login, Wallet, Chat, Betting, Admin, etc.)
├── pages/admin/ (AdminUsersTab, AdminBetsTab, AdminResultsTab, AdminSettingsTab, etc.)
├── components/, context/AuthContext.js
├── public/sw.js (Service Worker)
```

## Completed Features

### Core App
- Phone OTP login/registration, Game listing, Jantri/Haruf/Crossing betting
- Wallet (Stripe deposits, UPI withdrawals), Result & Bet history
- PWA, Refer & Earn, Dark theme

### Admin Panel
- Admin login, Stats dashboard, Result declaration (manual + auto-fetch)
- User management (full details, wallet adjust, delete)
- Withdrawal approve/reject, Deposits, Game CRUD, Settings
- Admin Chat with voice recording, Jantri report

### Push Notifications (Completed 2026-04-13)
- **Backend**: VAPID keys, `/api/push/subscribe`, `/api/push/send_all`, `/api/push/test`, `/api/push/stats`
- **Frontend**: Notification Enable banner on Dashboard (user-gesture trigger), subscribePush with proper auth token
- **Admin**: Push Notifications section in Settings - Test Push button, Send All with custom title/message, subscribed users count
- **Fix**: localStorage key corrected to `matka11_token`, requestPermission moved to user click handler

### Refactoring
- server.py → modular APIRouters, AdminPage.js → component-based architecture
- Today New Users clickable modal with full user detail view

## Pending / Backlog
- P1: Push notification real-world testing (needs real user to allow notifications)
- P2: Email notifications for transactions
- P2: Referral earnings history section

## Key API Endpoints
- Push: GET /api/push/vapid-key, POST /api/push/subscribe, POST /api/push/send_all, POST /api/push/test, GET /api/push/stats
- Auth: POST /api/auth/send-otp, /api/auth/verify-otp, /api/auth/admin/login
- Admin: GET /api/admin/stats, /api/admin/users, /api/admin/today-new-users
