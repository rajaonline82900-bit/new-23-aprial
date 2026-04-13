# MATKA 11 - Satta Matka Betting Platform

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features include deposit/withdrawal, Jantri betting, Haruf betting, crossing, result history, bet history, PWA support, push notifications, Refer & Earn, real OTP Authentication, and Admin Panel for management.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + PWA (Service Worker)
- **Backend**: FastAPI + Motor (Async MongoDB) + PyJWT + pywebpush
- **Database**: MongoDB
- **3rd Party**: DVHosting SMS API, Bavli Matka API, IMB Payment Gateway
- **Theme**: White/Light theme with gold (#D4AF37) accent

## Code Structure

### Backend (Modular)
```
/app/backend/
├── server.py              # Main app entry (~150 lines)
├── database.py            # MongoDB connection
├── models.py              # Pydantic models
├── auth.py                # JWT auth utilities
├── config.py              # Constants, game config, env vars
├── helpers.py             # Shared helpers (load_games, send_push)
├── notifications.py       # Telegram/WhatsApp notification service
├── routes/
│   ├── auth_routes.py     # Auth endpoints
│   ├── game_routes.py     # Games, bets
│   ├── wallet_routes.py   # Wallet, deposit, withdrawal, referral
│   ├── result_routes.py   # Results declaration, reverse, auto-fetch
│   ├── chat_routes.py     # User-Admin chat system
│   ├── admin_routes.py    # Admin CRUD, stats, settings, game mgmt, auto-expire loop
│   └── notification_routes.py # Push notifications, VAPID
└── uploads/               # Chat attachments, APK
```

### Frontend (Modular Admin)
```
/app/frontend/src/
├── pages/
│   ├── AdminPage.js       # Slim admin page with clickable stat cards
│   ├── admin/
│   │   ├── AdminResultsTab.js
│   │   ├── AdminBetsTab.js
│   │   ├── AdminGamesTab.js
│   │   ├── AdminWithdrawalsTab.js
│   │   ├── AdminDepositsTab.js (date+time format)
│   │   ├── AdminUsersTab.js
│   │   ├── AdminSettingsTab.js
│   │   └── AdminChatInbox.js (voice recording added)
│   ├── DashboardPage.js
│   ├── ChatPage.js
│   ├── WalletPage.js (failed status for expired deposits)
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
- [x] Push notifications (VAPID/webpush) - improved service worker
- [x] PWA with service worker (offline support)
- [x] APK download for Android
- [x] User-Admin chat (text, image, voice, read receipts)
- [x] Admin chat voice recording
- [x] Refer & Earn (5% bonus on first deposit)
- [x] Admin panel with full management
- [x] Code refactoring (modular routes + components)
- [x] White theme across entire app (user + admin)
- [x] Clickable admin stat cards (users, new users, deposits)
- [x] Today's bet amount in stats
- [x] Date+time in all payment records
- [x] Auto-expire pending deposits after 10 min (show "failed" not "pending")
- [x] Improved payment callback URL resolution

## April 13, 2026 Changes (11 items)
1. ✅ Total users button clickable → switches to users tab
2. ✅ Total bets card removed
3. ✅ Today's bets shows total amount (₹) + bet count
4. ✅ Today new users clickable → dialog with user details
5. ✅ Today deposits clickable → dialog with user details + balance
6. ✅ All payment records show date + time
7. ✅ Admin chat voice recording added (Mic button)
8. ✅ Payment callback URL improved (uses origin_url)
9. ✅ Scanner payment auto-expires to "failed" after 10 min
10. ✅ White background across entire app (user + admin)
11. ✅ Push notification service worker updated (requireInteraction, better tags)

## Pending/Future Tasks
- P2: Email notifications for transactions
- P2: Referral earnings history section
