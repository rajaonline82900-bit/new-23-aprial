# Satta Matka Betting Application - PRD

## Original Problem Statement
Build a Satta Matka betting application with Jantri, Haruf Andar/Bahar, Cross Bet, IMB UPI Payment Gateway deposit, and Admin Panel.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, React Router
- Backend: FastAPI, Motor (Async MongoDB), PyJWT
- Database: MongoDB
- Payments: IMB UPI Payment Gateway (secure-stage.imb.org.in)

## Completed Features
- [x] JWT Authentication
- [x] Jantri Betting Grid (00-99 jodi, 90x)
- [x] Haruf Andar/Bahar (0-9, 9x)
- [x] Cross Bet (auto-generate jodi combinations)
- [x] IMB UPI Payment Gateway deposit integration
- [x] Withdrawal via UPI
- [x] Game time lock (start_time/end_time)
- [x] Admin Panel (users, games, results, stats, bet distribution)
- [x] FooterNav on all pages (Home, Fund, Bid History, Result Chart, Refer & Earn)
- [x] Constant bet summary bar with Play/Delete buttons
- [x] Result Reverse & Bet Reverse in Admin Panel
- [x] Daily Result Tracking (duplicate protection + status tracker)
- [x] Dynamic Admin Settings (Telegram/WhatsApp links)
- [x] Today/Yesterday dual result boxes on Dashboard game cards
- [x] Play/Time Out button on game cards based on game time
- [x] Floating Refer button (bottom-right FAB)
- [x] IMB Payment Gateway balance update bug fix
- [x] Payment opens in new tab (no logout issue)
- [x] Game Holiday - last date of month auto holiday, betting blocked
- [x] Sidebar Menu with Language, How to Play, Deposit History, Result History, Refer & Earn, Rate List, Customer Support, Withdrawal Proof
- [x] Date + Time shown in deposit/withdraw transactions
- [x] PWA Support (manifest.json, service worker, app icons, install button)
- [x] Signup with OTP (mobile + name, demo OTP 1234) + Continue with Gmail
- [x] Withdrawal history with IST timezone date+time
- [x] Admin user details date+time in all 4 tabs (IST)
- [x] Bet History filters (status, game, date) with stats bar
- [x] Refer & Earn full logic (referral code, share, apply, 5% of 1st deposit)
- [x] Transaction history CSV export
- [x] Push notifications on result declaration (VAPID web push)
- [x] Signup page as front page
- [x] Telegram quick action button on Dashboard
- [x] Signup: Name → Phone → OTP → Password flow
- [x] Login: Phone + Password (admin can use email)
- [x] Password Reset via OTP
- [x] Admin Panel: Deposit user list tab, withdrawal approved & rejected history
- [x] Withdrawal dialog cross/close button fixed
- [x] Withdrawal cancel button for pending withdrawals
- [x] Profile page: edit name/email + change password
- [x] Refer & Earn: link-based referral, WhatsApp direct share button
- [x] Removed email from signup, virtual email in Profile
- [x] Account Creation Date/Time in Profile and Admin User List
- [x] User delete option and Mobile Number Search in Admin panel
- [x] "Today New Users" stat in Admin panel
- [x] JWT token expiry extended to 1 Year
- [x] 3 Withdrawal Methods (UPI, Bank, QR Scanner Image)
- [x] Disabled app zoom, Refer button in Footer
- [x] External Auto-Result API integration
- [x] Online/Last Seen indicators in Admin User List
- [x] Matka 11 branding & deposit/withdrawal icons
- [x] Web Speech API voice for button clicks
- [x] Warning voice removed (was stuttering on blink) [02-Apr-2026]

## Payment Integration
- Provider: IMB UPI Payment Gateway
- API URL: https://secure-stage.imb.org.in

## Admin Credentials
- Email: admin@sattamatka.com
- Password: Admin@123

## Upcoming Tasks
- P1: Refactor server.py (2800+ lines) and AdminPage.js (2000+ lines) into modular files
- P2: Email notifications for transactions
- P2: Referral earnings history section
