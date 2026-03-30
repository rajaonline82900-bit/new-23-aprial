# Satta Matka App - PRD (Product Requirements Document)

## Original Problem Statement
एक सट्टा मटका ऐप बनाएं जो दिल्ली बाजार, श्री गणेश, फरीदाबाद, गाजियाबाद, गली और दिसावर जैसे गेम खेल सके। इसमें जमा और निकासी के विकल्प होने चाहिए। इसमें परिणाम इतिहास, शर्त इतिहास और जोड़ियों और एकल संख्याओं पर शर्त लगाने का विकल्प होना चाहिए।

## User Choices
- JWT-based custom authentication
- Stripe for deposits/withdrawals
- Fixed time slots for games
- Admin panel required
- Dark luxury theme

## User Personas
1. **Regular Users**: Place bets on numbers, deposit/withdraw funds, view results
2. **Admin**: Declare results, manage withdrawals, view all users

## Core Requirements
- 6 Games: Delhi Bazaar (3:00 PM), Shri Ganesh (6:00 PM), Faridabad (6:15 PM), Ghaziabad (8:30 PM), Gali (11:30 PM), Disawar (5:00 AM)
- Bet Types: Single (0-9) with 9x multiplier, Jodi (00-99) with 90x multiplier
- Wallet: Stripe deposit, UPI withdrawal
- Authentication: JWT with httpOnly cookies

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React with Shadcn UI
- **Payment**: Stripe integration
- **Auth**: JWT tokens in httpOnly cookies

## What's Been Implemented (2026-03-30)
- [x] User authentication (login/register/logout)
- [x] Dashboard with 6 games
- [x] Game page with single (0-9) and jodi (00-99) betting
- [x] Wallet with Stripe deposit integration
- [x] Withdrawal requests with UPI
- [x] Results history page
- [x] Bet history page
- [x] Admin panel - result declaration
- [x] Admin panel - withdrawal management
- [x] Admin panel - user management
- [x] Automatic winner calculation when result declared
- [x] Dark luxury theme with gold/emerald accents

## Deposit Packages
- ₹100, ₹500 (popular), ₹1000, ₹2000, ₹5000

## API Endpoints
### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Games & Betting
- GET /api/games
- GET /api/games/{game_id}
- POST /api/bets
- GET /api/bets

### Wallet
- GET /api/wallet
- POST /api/wallet/deposit
- GET /api/wallet/deposit/status/{session_id}
- POST /api/wallet/withdraw

### Results
- GET /api/results
- GET /api/results/{game_id}

### Admin
- GET /api/admin/stats
- GET /api/admin/users
- GET /api/admin/withdrawals
- POST /api/admin/results
- POST /api/admin/withdrawals/{id}/approve
- POST /api/admin/withdrawals/{id}/reject

## Prioritized Backlog

### P0 (Critical) - Done
- User auth ✅
- Place bets ✅
- View results ✅
- Admin result declaration ✅

### P1 (High)
- Real-time game status (live/closed based on time)
- Notification system for results

### P2 (Medium)
- Mobile responsive improvements
- Bet history export
- Dashboard statistics charts

### P3 (Low)
- Social sharing of wins
- Referral system
- Email notifications

## Next Tasks
1. Add real-time notifications when results are declared
2. Implement time-based game locking (can't bet after game closes)
3. Add bet confirmation dialog
4. Improve mobile responsiveness
5. Add transaction history export
