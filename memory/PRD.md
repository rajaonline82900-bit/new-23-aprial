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
