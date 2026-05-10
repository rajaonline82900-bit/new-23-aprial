# Satta Matka - MATKA 11 - Product Requirements Document

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features include deposit/withdrawal, Jantri betting, Haruf betting, crossing, result history, bet history, PWA support, push notifications, Refer & Earn, real OTP Authentication, and a full Admin Panel.

## Core Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (Dark Theme)
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Auth**: Phone OTP + Admin email/password + JWT
- **PWA**: Service Worker + Push Notifications (VAPID/pywebpush)

## Completed Features

### Core App
- Phone OTP login/registration, Game listing, Jantri/Haruf/Crossing betting
- Wallet (Stripe deposits, UPI withdrawals), Result & Bet history
- PWA, Refer & Earn, Dark theme

### Admin Panel
- Admin login, Stats dashboard, Result declaration (manual + auto-fetch)
- User management, Wallet adjust/delete, Withdrawal approve/reject
- Deposits, Game CRUD, Settings, Admin Chat with voice
- Jantri results history & export

### Push Notifications (Completed 2026-04-13)
- Backend: VAPID, subscribe, send_all, test, stats endpoints
- Frontend: Enable banner (user-gesture), subscribePush with auth token
- Admin: Test Push, Send All, subscribed users count
- Auto-push on result declaration (manual + auto-fetch)

### Jantri Report / Bid History (Completed 2026-04-14)
- New tab "जंतरी रिपोर्ट" in Admin Panel
- Jodi (00-99): 10x10 grid showing bet amounts on each number
- Andar Haruf (0-9): Row showing amounts per digit
- Bahar Haruf (0-9): Row showing amounts per digit
- Crossing bets display
- Summary: Jantri(Jodi), Andar, Bahar, Loss (Max Payout), Profit, Total
- Date picker + Game selector + Submit/Reset
- Backend: /api/admin/jantri-report endpoint

### Bug Fixes (2026-04-14)
- Crossing bets now handled in manual result declaration (was only in auto-fetch)

### Chat Redesign - WhatsApp Style + Auto-Delete (Completed 2026-04-20)
- Header text updated to 'MATKA11 CASTUMER SUPPORT'
- Single/double tick read receipts, timestamps, date separators (already present, retained)
- User long-press / right-click on own message -> delete modal
- Admin panel 'Chat' tab: Clear All button, per-user Clear Chat, per-message hover delete
- Admin 'Auto-Delete' settings: enable toggle + hours input (default 24h)
- Backend async loop `auto_delete_chat_loop` in server.py runs every 1 hour, removes chat_messages older than configured hours, cleans attachment files
- New endpoints: DELETE /api/chat/message/{id}, DELETE /api/admin/chat/message/{id}, DELETE /api/admin/chat/user/{user_id}, DELETE /api/admin/chat/clear-all, GET/POST /api/admin/chat/auto-delete-setting
- Tested: 17/17 backend + all frontend flows verified by testing agent (iteration_16.json)

### Auth Simplification + Google Login (Completed 2026-05-09)
- Signup: 2 options only — (Continue with Google) + (Name + Mobile + OTP). Password mode removed from UI.
- Login: 2 options only — (Continue with Google) + (Mobile + OTP).
- Backend `/api/auth/google/session` exchanges Emergent session_id for JWT (creates user on first login).
- `/auth/callback` route processes session_id from URL hash and redirects to /dashboard.
- 'Emergent' word does NOT appear anywhere in user-visible UI text.
- Tested: 10/10 backend + all frontend OTP/Google endpoint flows verified (iteration_17.json).

### Result API Migration to matkaapi.com (Completed 2026-05-09)
- Replaced legacy matka-api.online with `https://matkaapi.com/apis/market_api.php`.
- POST body: domain=matka11.online, api_key=*****, domain_key=***** + (gali=all | market=all).
- New env vars: NEW_MATKA_API_URL, NEW_MATKA_API_KEY, NEW_MATKA_DOMAIN_KEY, NEW_MATKA_DOMAIN.
- `fetch_matka_results` rewritten to call both gali and market endpoints, normalize jodi (00–99), apply winners + push notification.
- Auto-fetch loop runs every 2 min (server.py scheduler unchanged).
- MARKET_TO_GAME extended for spelling variations (DISAWAR/DISAWER, GAJIYABAD/GHAZIABAD, SHREE/SHRI GANESH, DELHI BAZAR/BAZAAR).
- /api/admin/auto-fetch-debug now returns matkaapi.com raw responses for debugging.
- IMPORTANT: Production server IP must be whitelisted on matkaapi.com dashboard, otherwise API returns "Update Your Ip".
- Tested: 11/11 backend, all frontend regressions pass (iteration_18.json).

### Refer & Earn — App + Website Links (Completed 2026-05-09)
- Added new card on /refer with App download link `https://matka11.online/matka11.apk` (Android) and iPhone Website `www.matka11.online`.
- Each link has its own copy-to-clipboard button.
- WhatsApp & generic share text now include both links along with referral URL.

### Auth Final Simplification — Password-Only + Auto-Logout Fix (Completed 2026-05-09 v2)
- **Signup**: Name + Mobile + Password ONLY. OTP/Google removed from UI.
- **Login**: Mobile + Password ONLY. OTP/Google removed from UI.
- **Forgot Password**: New /forgot-password page with OTP-based reset (uses existing /auth/password/send-otp + /auth/password/reset).
- **Auto-logout fix**: AuthContext.checkAuth now keeps user logged in on network errors / timeouts. Only explicit 401 from server clears token & logs out. Verified end-to-end.
- **JWT expiry**: 365 days (already configured in auth.py).
- **Attractive design**: Gradient gold buttons, MatkaLogo with glow effect, perks pills (Instant Withdraw / 5% Refer Bonus / 24×7 Live), decorative blur backgrounds, password show/hide toggle, clean card with subtle gradient border.
- Tested: 13/13 backend + all frontend E2E flows pass (iteration_19.json).

### Critical Bug Fixes + PWA Improvements (Completed 2026-05-09 v3)
- **Deposit scanner bug fix**: `wallet/deposit` and `notification_routes` were accessing `user["email"]` which doesn't exist for password-only signups → KeyError → scanner failed to load. Replaced with `user.get("email") or user.get("phone")`.
- **Auto-result Gali matching**: Added robust keyword-based market name matcher (`_match_market_to_game`). Now handles variations like "DELHI GALI", "GALI BAZAR", "NEW DISAWER", "DESAWAR", "GAZIABA" etc. Verified all 6 games match correctly.
- **Debug endpoint upgraded**: `/api/admin/auto-fetch-debug` now returns `all_market_names_from_api` and `skipped_no_match` so admin can see exact names sent by matkaapi.com.
- **Beautiful Offline Page** (`/offline.html`): Gold-themed offline page with logo, Wi-Fi-off icon with ping animation, helpful tips, retry button, auto-reload on `online` event.
- **Service Worker v9**: HTML/navigation never cached (so deploys always serve fresh JS path), API never cached, static assets cache-first, offline.html shown on navigation failure.
- **Auto-update on deploy WITHOUT logout**: SW listens for `updatefound`, posts `SKIP_WAITING`, on `controllerchange` reloads page silently. localStorage token preserved → user stays logged in across deploys.
- **Offline-resilient AuthContext**: User cache stored in localStorage. On network error with stored token, rehydrates user from cache instead of sending to /signup.

## Pending / Backlog
- P1: User must press "Deploy" on Emergent Deploy UI to push preview fixes to matka11.online
- P1: Push notification real-world testing (needs real user to allow)
- P2: Email notifications for transactions
- P2: Referral earnings history section
- P2: Cleanup duplicate /auth/google-session route (only /auth/google/session is wired)
- P2: Split auth_routes.py (~555 lines) into otp/oauth modules if more endpoints land

## Key API Endpoints
- Jantri: GET /api/admin/jantri-report?game_id=&date=
- Push: GET /api/push/stats, POST /api/push/test, POST /api/push/send_all
- Admin: GET /api/admin/stats, /api/admin/users, /api/admin/today-new-users
- Chat Delete: DELETE /api/chat/message/{id}, DELETE /api/admin/chat/clear-all, DELETE /api/admin/chat/user/{user_id}
- Chat Auto-Delete Setting: GET/POST /api/admin/chat/auto-delete-setting
