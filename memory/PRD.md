# Satta Matka Betting Application - PRD

## Original Problem Statement
Build a Satta Matka betting application with Jantri, Haruf Andar/Bahar, Cross Bet, IMB UPI Payment Gateway deposit, and Admin Panel. App name: MATKA 11.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, React Router
- Backend: FastAPI, Motor (Async MongoDB), PyJWT
- Database: MongoDB
- Payments: IMB UPI Payment Gateway (secure-stage.imb.org.in)

## Completed Features
- [x] JWT Authentication (1 Year expiry)
- [x] Jantri Betting Grid (00-99 jodi, 90x)
- [x] Haruf Andar/Bahar (0-9, 9x)
- [x] Cross Bet (auto-generate jodi combinations)
- [x] IMB UPI Payment Gateway deposit integration
- [x] Withdrawal via UPI, Bank Account, QR Scanner Image (3 methods)
- [x] Game time lock (start_time/end_time)
- [x] Admin Panel (users, games, results, stats, bet distribution, deposit/withdrawal management)
- [x] FooterNav on all pages (Home, Fund, Refer, Bid History, Result Chart)
- [x] Constant bet summary bar with Play/Delete buttons
- [x] Result Reverse & Bet Reverse in Admin Panel
- [x] Daily Result Tracking
- [x] Dynamic Admin Settings (Telegram/WhatsApp links)
- [x] Today/Yesterday dual result boxes on Dashboard game cards
- [x] Play/Time Out button on game cards based on game time
- [x] Game Holiday - last date of month auto holiday
- [x] Sidebar Menu with Language, How to Play, Deposit History, Result History, Refer & Earn, Rate List, Customer Support, Withdrawal Proof
- [x] Date + Time shown in deposit/withdraw transactions (IST)
- [x] PWA Support (manifest.json, service worker, app icons, install button)
- [x] Signup with OTP (mobile + name)
- [x] Login: Phone + Password (admin can use email)
- [x] Password Reset via OTP
- [x] Refer & Earn (5% of first deposit, WhatsApp share, link-based referral)
- [x] Transaction history CSV export
- [x] Push notifications on result declaration (VAPID web push)
- [x] Telegram quick action button on Dashboard
- [x] Profile page: edit name/email + change password
- [x] Account Creation Date/Time in Profile and Admin User List
- [x] User delete option and Mobile Number Search in Admin panel
- [x] "Today New Users" stat in Admin panel
- [x] Disabled app zoom
- [x] External Auto-Result API integration (matkawebhook.matka-api.online)
- [x] Online/Last Seen indicators in Admin User List
- [x] Web Speech API voice for button clicks
- [x] Warning voice removed (was stuttering on blink) [02-Apr-2026]
- [x] MATKA 11 logo branding (golden gradient MatkaLogo component) [02-Apr-2026]
- [x] Responsive app-shell layout (max-width 480px, fits all phone sizes) [02-Apr-2026]

## Payment Integration
- Provider: IMB UPI Payment Gateway
- API URL: https://secure-stage.imb.org.in

## Admin Credentials
- Email: admin@sattamatka.com
- Password: Admin@123

## Architecture
- MatkaLogo component: /app/frontend/src/components/MatkaLogo.js
- app-shell CSS: /app/frontend/src/index.css (max-width: 480px)
- All pages use app-shell class for consistent mobile layout

## Upcoming Tasks
- P1: Refactor server.py (2800+ lines) and AdminPage.js (2000+ lines) into modular files
- P2: Email notifications for transactions
- P2: Referral earnings history section
