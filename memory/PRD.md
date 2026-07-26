# Lucky Bet — Premium Gaming Platform (PRD)

## Domain
- Production: **https://m11cloube.in** (Hostinger VPS)
- VPS IP: `200.141.5.42` (Ubuntu 24.04)

## Brand
- **Name:** Lucky Bet (previously Matka 11)
- **Tagline:** *More Bets. More Wins. More Luck.*
- **Colors:** Gold (#FFD700 / #FFC700) + Emerald Green (#0F9938 / #14A94C) + Rich Black (#0A0A14)
- **Logo:** `/lucky-bet-logo.jpg` — served from `frontend/public/`
- **Font:** Unbounded (headings) + Manrope (body)
- **Vibe:** Vegas casino luxury — animated gold+emerald gradient backdrop, sparkle particles, glass-morphism cards, spinning conic ring border, shimmering CTA

## Product
Multi-game betting platform:
- **Kalyan Matka** — 11 authoritative games with DP Boss auto-fetch (30s poll), manual bet amounts, Chart page
- **Gali/Disawar** — SattaAPI auto-fetch loop
- **Aviator** — 35% win rate, community fake bet feed
- **Coin Toss** — 35% win rate, 3D flat animation, privacy mode, ₹50 min bet
- **Ludo** — Zupee-style with bot-fill, turn-timer, match-timer
- **Admin Panel** — Wallet Transactions merged (user side rebranded, admin UI unchanged)

## Tech Stack
- Frontend: React + CRA + shadcn/ui, custom `lucky-bg-animated` / `lucky-sparkles` / `lucky-glass-card` / `lucky-cta` classes in `index.css`
- Backend: FastAPI + Motor + uvicorn (2 workers via systemd)
- DB: MongoDB `matka_prod`
- Reverse Proxy: Nginx + Certbot SSL

## Rebrand Completed (26 Jul 2026)
- [x] New `MatkaLogo` component uses uploaded logo image with dual gold+emerald glow ring
- [x] `LoginPage`, `SignupPage`, `RegisterPage`, `ForgotPasswordPage`, `AdminLoginPage` — all use `lucky-bg-animated` + `lucky-sparkles` + `lucky-glass-card` + `lucky-cta`
- [x] `LandingPage` — hero rebranded with logo + LUCKY BET wordmark + tagline
- [x] `index.html` title + meta + `apple-touch-icon` → Lucky Bet
- [x] `manifest.json` — full rebrand, uses `lucky-bet-logo.jpg` as icon
- [x] Global text replaced across ReferPage / ChatPage / TelegramWelcomePopup / AdminSettingsTab: "MATKA 11" → "Lucky Bet"
- [x] Custom color CSS variables retained: `.lucky-gold-text`, `.lucky-emerald-text`, `.text-emerald-lucky`
- [x] Preview environment smoke-tested — Signup + Login screens render perfectly

## Previously Completed
- Kalyan 11 games seed, `run_kalyan_seed.py` foolproof runner
- Coin Toss 3D animation + 35% win rate + privacy
- Aviator 35% win + community feed
- Admin merged Wallet Transactions
- Kalyan Chart page + manual bet amount + 30s polling
- Race-safe admin seed + `/app/memory` optional path
- VPS deployment: uvicorn/fastapi/motor installed with `--ignore-installed`, DNS A records, SSL, Nginx serving React build, backend proxied — **HTTP 200 OK live**

## Pending / Optional
- [ ] **Deploy Lucky Bet rebrand to VPS**: `cd /var/www/new-23-aprial && git pull && cd frontend && CI=false yarn build && sudo systemctl reload nginx`
- [ ] Set `KALYAN_AUTO_FETCH_ENABLED=true` in backend/.env
- [ ] Add SattaAPI credentials for Gali/Disawar auto-fetch
- [ ] IMB payment gateway credentials
- [ ] Admin "Provider Status" section
- [ ] MongoDB backup cron

## Credentials
- Admin: `admin@sattamatka.com` / `Admin@123`

## Key Files Changed in Rebrand
- `frontend/public/lucky-bet-logo.jpg` (new)
- `frontend/public/index.html`, `frontend/public/manifest.json`
- `frontend/src/index.css` — added `lucky-*` design system classes
- `frontend/src/components/MatkaLogo.js` — rewritten to use logo image
- `frontend/src/pages/{LoginPage,SignupPage,RegisterPage,ForgotPasswordPage,AdminLoginPage,LandingPage}.js`
- Text-only rebrand: `pages/{ReferPage,ChatPage}.js`, `pages/admin/AdminSettingsTab.js`, `components/TelegramWelcomePopup.js`
