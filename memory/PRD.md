# Lucky Bet — Coin Toss (only game) — PRD

## Domain
- Production: **https://m11cloube.in** (Hostinger VPS)
- VPS IP: `200.141.5.42`

## Brand
- **Name:** Lucky Bet · **Tagline:** *More Bets. More Wins. More Luck.*
- **Colors:** Gold (#FFD700) + Emerald Green (#14A94C) + Rich Black (#0A0A14)
- **Logo:** `/lucky-bet-logo.jpg` (public asset)

## Product (post-simplification, Feb 2026)
- **Only Coin Toss game** — all other games removed from UI
- 1-minute rounds, 2× payout, ₹50 min bet, provably fair ~35% win rate for the house
- Casino-style ticket-slip bet history rendered INSIDE the Coin page

## Removed / redirected to /coin
- Dashboard, Kalyan (game + chart), Gali/Disawar, Aviator, Ludo
- History (/bets), Result feed (/results), Chart (/jantri), Rate List (/rate-list)
- FooterNav's "History" and "Result Chart" tabs
- SidebarMenu's "Result History" and "Rate List" items

## Kept & rebranded
- Login / Signup / Register / ForgotPassword / AdminLogin — Vegas glass card + gold-emerald animated bg
- Landing page — LUCKY BET wordmark hero
- Coin page — new header with logo + "LUCKY COIN" gradient title, casino bet history
- Wallet, Refer, Profile, Help, Chat, Notifications, HowToPlay, Admin panel (unchanged)

## Casino Bet History (inside CoinPage)
- Endpoint: `GET /api/coin/history?limit=50`
- Rendered as `.ticket-slip-compact` cards with:
  - Serial `LB-XXXXXX`, status badge (LIVE/WON/LOST) colored by result
  - Head/Tail SVG-style side badge with radial gradient
  - Bet chip (gold gradient) with amount
  - Perforation lines between sections
  - Win chip `🏆 +₹...` or red loss line
  - "View All / Show Less" toggle when > 3 tickets

## Nav (post-cleanup)
- **FooterNav** (4 tabs): Play (/coin) · Wallet · Refer · Profile
- **SidebarMenu**: Language · How to Play · Deposit History · Refer & Earn · Support · Install App · Logout

## Tech Stack
- Frontend: React + CRA + shadcn/ui + Tailwind + Lucide + Sonner toasts
- Backend: FastAPI + Motor + uvicorn (2 workers, systemd)
- DB: MongoDB `matka_prod`

## Pending / Optional
- [ ] **Deploy to VPS**: `cd /var/www/new-23-aprial && git pull && cd frontend && CI=false yarn build && sudo systemctl reload nginx`
- [ ] Remove unused old page components (DashboardPage, KalyanGamePage, AviatorPage, LudoLobbyPage, LudoGamePage, BetsPage, ResultsPage, JantriPage, RateListPage, GamePage, KalyanChartPage) — cleanup only, not blocking

## Credentials
- Admin: `admin@sattamatka.com` / `Admin@123`
- Admin URL: `/admin-login`

## Key Files Changed (Coin-only simplification, Feb 2026)
- `frontend/src/App.js` — routes for removed games now redirect to `/coin`, unused imports removed
- `frontend/src/components/FooterNav.js` — 4 tabs (Play/Wallet/Refer/Profile)
- `frontend/src/components/SidebarMenu.js` — removed Result History, Rate List
- `frontend/src/pages/CoinPage.js` — new Lucky Bet header, casino ticket-slip bet history, `fetchBetHistory` API integration
