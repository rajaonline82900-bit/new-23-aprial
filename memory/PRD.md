# Satta Matka Betting Application - PRD

## Original Problem Statement
Build a Satta Matka betting application with Jantri, Haruf Andar/Bahar, Cross Bet, IMB UPI Payment Gateway deposit, and Admin Panel. App name: MATKA 11.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, React Router
- Backend: FastAPI, Motor (Async MongoDB), PyJWT
- Database: MongoDB
- Payments: IMB UPI Payment Gateway (secure-stage.imb.org.in)

## Auth Flow
- **User Signup**: Name + Phone + OTP → Account created (no password)
- **User Login**: Phone + OTP (every time)
- **Admin Login**: Separate page `/admin-login` → Email + Password

## Completed Features
- [x] OTP-based Auth (signup + login without password)
- [x] Admin separate login page (/admin-login with email+password)
- [x] Jantri Betting Grid (00-99 jodi, 90x)
- [x] Haruf Andar/Bahar (0-9, 9x)
- [x] Cross Bet (auto-generate jodi combinations)
- [x] IMB UPI Payment Gateway deposit integration
- [x] Withdrawal via UPI, Bank Account, QR Scanner Image (3 methods)
- [x] Game time lock (start_time/end_time)
- [x] Admin Panel (users, games, results, stats, bet distribution, deposit/withdrawal management)
- [x] FooterNav on all pages
- [x] Constant bet summary bar with Play/Delete buttons
- [x] Result Reverse & Bet Reverse in Admin Panel
- [x] Daily Result Tracking
- [x] Dynamic Admin Settings
- [x] Today/Yesterday dual result boxes on Dashboard
- [x] Play/Time Out button on game cards
- [x] Game Holiday
- [x] Sidebar Menu
- [x] PWA Support with MATKA 11 branding
- [x] Refer & Earn (5% of first deposit)
- [x] Push notifications on result declaration
- [x] Profile page
- [x] External Auto-Result API integration
- [x] Online/Last Seen indicators in Admin
- [x] MATKA 11 logo branding + responsive app-shell layout
- [x] JWT 1 Year expiry + Cookie max_age 1 Year

## Admin Credentials
- Email: admin@sattamatka.com
- Password: Admin@123
- Login URL: /admin-login

## Upcoming Tasks
- P1: Refactor server.py (2800+ lines) and AdminPage.js (2000+ lines) into modular files
- P2: Email notifications for transactions
- P2: Referral earnings history section
