# MATKA 11 - Satta Matka Betting Platform

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features include deposit/withdrawal, Jantri betting, Haruf betting, crossing, result history, bet history, PWA support, push notifications, Refer & Earn, real OTP Authentication, and Admin Panel for management.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + PWA (Service Worker)
- **Backend**: FastAPI + Motor (Async MongoDB) + PyJWT + pywebpush
- **Database**: MongoDB
- **3rd Party**: DVHosting SMS API, Bavli Matka API, IMB Payment Gateway

## Code Structure (Post-Refactoring - April 2026)

### Backend (Modular)
```
/app/backend/
├── server.py              # Main app entry (150 lines, was 3109)
├── database.py            # MongoDB connection
├── models.py              # Pydantic models
├── auth.py                # JWT auth utilities
├── config.py              # Constants, game config, env vars
├── helpers.py             # Shared helpers (load_games, send_push)
├── notifications.py       # Telegram/WhatsApp notification service
├── routes/
│   ├── auth_routes.py     # Auth (register, login, OTP, admin login, password reset)
│   ├── game_routes.py     # Games, bets (place bet, batch bets)
│   ├── wallet_routes.py   # Wallet, deposit, withdrawal, referral
│   ├── result_routes.py   # Results declaration, reverse, auto-fetch
│   ├── chat_routes.py     # User-Admin chat system
│   ├── admin_routes.py    # Admin CRUD, stats, settings, game management
│   └── notification_routes.py # Push notifications, VAPID
└── uploads/               # Chat attachments, APK
```

### Frontend (Modular Admin)
```
/app/frontend/src/
├── pages/
│   ├── AdminPage.js       # Slim admin page (166 lines, was 2260)
│   ├── admin/
│   │   ├── AdminResultsTab.js      # Results declaration
│   │   ├── AdminBetsTab.js         # Bet distribution report
│   │   ├── AdminGamesTab.js        # Game CRUD
│   │   ├── AdminWithdrawalsTab.js  # Withdrawal management
│   │   ├── AdminDepositsTab.js     # Deposits list
│   │   ├── AdminUsersTab.js        # User management + wallet modal
│   │   ├── AdminSettingsTab.js     # App settings
│   │   └── AdminChatInbox.js       # Admin chat inbox
│   ├── DashboardPage.js
│   ├── ChatPage.js
│   ├── WalletPage.js
│   ├── SignupPage.js / LoginPage.js
│   └── AdminLoginPage.js
└── components/ (Shadcn/UI + custom)
```

## What's Been Implemented
- [x] Phone + OTP authentication (DVHosting SMS)
- [x] Admin login (separate /admin-login route)
- [x] 6 default games with IST time zones
- [x] Jodi, Single, Haruf Andar/Bahar betting
- [x] Batch betting support
- [x] IMB Payment Gateway for deposits
- [x] Withdrawal system (UPI/Bank/Scanner)
- [x] Auto-result fetching from Bavli API (every 5 min)
- [x] Manual result declaration with reverse options
- [x] Push notifications (VAPID/webpush)
- [x] PWA with service worker (offline support)
- [x] APK download for Android
- [x] User-Admin chat (text, image, voice, read receipts)
- [x] Refer & Earn (5% bonus on first deposit)
- [x] Admin panel with full management
- [x] **Code refactoring** (server.py 3109→150 lines, AdminPage.js 2260→166 lines) ✅

## Refactoring Summary (April 10, 2026)
- **Backend**: Monolithic `server.py` (3109 lines) → 7 route modules + 4 utility modules. Total: ~2784 lines across focused files
- **Frontend**: Monolithic `AdminPage.js` (2260 lines) → 8 tab components + slim parent. Total: ~1505 lines across focused files
- **Testing**: 20/20 backend tests + full frontend verification passed

## Pending/Future Tasks
- P2: Email notifications for transactions
- P2: Referral earnings history section
