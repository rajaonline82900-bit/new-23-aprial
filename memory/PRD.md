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
- [ ] **Deploy to VPS**: `cd /var/www/new-23-aprial && git pull && cd frontend && CI=false yarn build && sudo systemctl reload nginx && sudo systemctl restart matka-backend`
- [ ] Remove unused old page components (DashboardPage, KalyanGamePage, AviatorPage, LudoLobbyPage, LudoGamePage, BetsPage, ResultsPage, JantriPage, RateListPage, GamePage, KalyanChartPage) — cleanup only, not blocking

## ✅ Feb 2026 — Dragon Tiger Game Added (5th game)
- **Backend**: `/app/backend/routes/dragon_tiger_routes.py` — 25s betting + 5s reveal = 30s round loop, `_pick_result` with 35% house-edge bias against majority side, D/T pays 2x, Tie pays 50x, min bet ₹50
- **Endpoints**: `GET /api/dragon-tiger/{config,current,history,recent-rounds,live-feed}`, `POST /api/dragon-tiger/bet`
- **Frontend**: `/app/frontend/src/pages/DragonTigerPage.js` — 3D card flip animation, chip selector, live timer, casino ticket history
- **Dealer**: Animated SVG casino dealer girl (idle sway + blinking eyes + arms reaching to cards, faster during reveal) — no external asset
- **Registered**: `dt_router` in `server.py:68`, `dragon_tiger_round_loop` started at line 240, route `/dragon-tiger` in `App.js:143`, card in `DashboardPage.js` line ~824
- **Bugfixes applied in this session**:
  - Fixed `ImportError: cannot import name 'require_auth'` → use `get_current_user`
  - Refactored `place_bet` and `my_history` from `Depends(require_auth)` to `Request` + `await get_current_user(request)`
  - Cast `user['_id']` and `b['user_id']` to `ObjectId` in `db.users` queries/updates
- **Testing**: Backend testing agent — **16/16 pytest tests passed** (config, round loop, bet validation, e2e settlement with balance credit, history, live feed, regression on games/coin/results). Test file: `/app/backend/tests/test_dragon_tiger.py`

## ✅ Feb 2026 — Color Prediction Game Added (6th game)
- **Backend**: `/app/backend/routes/color_game_routes.py` — 25s betting + 5s reveal = 30s round loop, `_pick_result` draws number 0-9, biases away from majority-bet color with 35% probability
- **Number → Color mapping**: 0 = Red+Violet, 5 = Green+Violet, odd (1,3,7,9) = Red, even (2,4,6,8) = Green
- **Payouts**: Red 2x, Green 2x, Violet 4.5x, min bet ₹50
- **Endpoints**: `GET /api/color-game/{config,current,history,recent-rounds,live-feed}`, `POST /api/color-game/bet`
- **Frontend**: `/app/frontend/src/pages/ColorGamePage.js` — spinning tricolor ring reveal ball, glossy 3D color buttons, rainbow chip selector, casino ticket history
- **Icon**: `ColorGameIcon` in DashboardPage — three overlapping RGB gradient balls with sparkles
- **Registered**: `color_game_router` in `server.py`, `color_game_round_loop` background task, route `/color-game` in `App.js`, card in dashboard

## ✅ Feb 2026 — Chicken Road Game Added (7th game)
- **Backend**: `/app/backend/routes/chicken_road_routes.py` — provably-fair crash game with per-user active session
- **Mechanics**: User places bet → chicken on lane 0 (1.00x) → click STEP to advance (25 lanes max, multipliers 1.10x → 20.67x) → CASHOUT any time to lock in multiplier × bet, OR crash if step_num == hidden crash_step
- **Crash distribution** (~35% house edge): 40% crash within steps 1-3, 30% within 4-7, 20% within 8-15, 10% within 16-25
- **Endpoints**: `GET /api/chicken-road/{config,active,history,live-feed}`, `POST /api/chicken-road/{start,step,cashout}`
- **Frontend**: `/app/frontend/src/pages/ChickenRoadPage.js` — animated road scene (sky, 7-lane preview, finish line), hopping chicken, crashing car + death animation on bust, live multiplier ticker, cashout + step controls
- **Icon**: `ChickenRoadIcon` — SVG of chicken next to red car on dashed road with 2x badge
- **Registered**: `chicken_road_router` in `server.py`, route `/chicken-road` in `App.js`, card in dashboard
- **Verified**: E2E flow via curl — balance 4900 → START -100 → STEP 1.10x → CASHOUT +110 → balance 4910 ✓; also crash scenario at step 6 correctly settles

## ✅ Feb 2026 — Wheel Fix + Big Win Popup + Sound Toggle (Session 42)
- **Wheel Alignment Bug Fixed**: `spins = 5 + Math.random() * 2` (fractional) tha → residual offset ke wajah se wheel exact winner segment pe nahi rukta tha. Fix: `spins = 5 + Math.floor(Math.random() * 3)` (integer full turns) → pointer bilkul winning number pe rukega ab.
- **Bet Aggregation Display**: Har ticket pe yellow "**N× BETS**" badge + "Total Bet (N combined)" label added — Crazy Time, Color Game, Dragon Tiger. Bettor ko clearly dikhta hai ki multiple bets 1 ticket me merge huye.
- **Big Win Popup**: New `<BigWinPopup>` component (`/app/frontend/src/components/BigWinPopup.js`) — full-screen amber overlay with slot-machine count-up reel + 24 falling gold coins + Trophy icon. Fires for wins ≥ ₹1000 in Crazy Time, Color Game, Dragon Tiger. Auto-dismiss after 5.5s or tap.
- **Sound Toggle**: New `<SoundToggle>` component (`/app/frontend/src/components/SoundToggle.js`) — speaker icon in every game header. Persists mute state in localStorage. `casinoFx.js` respects the mute flag globally, so card-flip, coin-clink, lock-click all silent when muted.

## ✅ Feb 2026 — Live Counts + Wheel Timing + Latest Results (Session 41)
- **Per-Game Live Players Counter**: New `GET /api/live-players` returns `{dragon_tiger, crazy_time, color_game, coin_toss, aviator, kalyan, gali_disawar}` — each = per-game baseline + real distinct bettors in last 3 min + jitter. Rendered as green pulsing pill on every game card on Dashboard AND in each game page header ("X playing now").
- **Wheel Reveal Timing Fix**: Crazy Time & Color Game — winner banner + confetti + coin-clink now trigger ONLY after 4-second wheel spin completes (was firing simultaneously with spin start).
- **Color Game Wheel**: Replaced RevealBall with Crazy-Time-style 6-segment wheel (R-W-O-R-W-O), top pointer, exact rotation math (`-((idx + 0.5) * 60°)`). Two segments per colour = each spin picks a random valid segment for variety.
- **Latest Results Moved Up**: Dragon Tiger, Crazy Time, Color Game — "Latest Results" strip now appears right below the game arena (before chips/bets), with the newest result on the LEFT and highlighted in gold border + glow.

## ✅ Feb 2026 — Casino FX + VPS Deploy (Session 40)
- **Dragon Tiger — Bets Locked Flash**: When timer hits 00 (betting → reveal transition), full-screen red overlay with Lock icon + "BETS LOCKED" text pulses for 900 ms. Playing a synthesized "click" via Web Audio API. Card flips also fire a whoosh sound in sequence.
- **Winner Confetti + Coin-Clink**: Crazy Time 10x wins and Dragon Tiger Tie 50x wins trigger gold + red confetti burst (canvas-confetti) plus a three-note "cha-ching" bell via Web Audio API. Once-per-round via `winCelebratedRef`.
- **Shared FX helper**: `/app/frontend/src/utils/casinoFx.js` exposes `playCardFlip`, `playLockClick`, `playCoinClink`, `fireWinnerConfetti`. All sounds are synthesised — no external mp3 files.
- **VPS One-Line Deploy**: `/app/update.sh` — bash script that git-pulls, yarn-builds frontend, reloads nginx, restarts systemd backend, then health-checks `/api/online-users`. Fails loudly on any error. Usage: `sudo bash /var/www/new-23-aprial/update.sh`.

## ✅ Feb 2026 — P0 Refinements (Session 39)
- **Bet Aggregation (Atomic)**: All 4 casino games — Dragon Tiger, Crazy Time, Color Game, Coin Toss — now aggregate bets. Same user + same round + same option → single MongoDB document with `$inc: {amount, bet_count}` via atomic `update_one({...}, upsert=True, $setOnInsert:{...})`. Verified with 3 concurrent bets → 1 ticket, amount summed, bet_count=3.
- **Live Bets Feed with Fake Indian Names**: Dragon Tiger, Crazy Time, Color Game `/live-feed` endpoints now return a mix of real (name masked as `Abc***`) and 20-30 fake Indian names (Rohit, Priya, Vikram, Sneha…) with `fake: bool` flag on each item.
- **Global Online Users Counter**: New `GET /api/online-users` returns `{count, real}`. Count = real users active last 5 min + randomized baseline ~1130-1470. Rendered as green pulsing pill next to logo on `DashboardPage`.
- **Crazy Time Wheel**: Fixed stale-winner spin on mount. `initializedRef` marks the latest completed round as already-revealed on first fetch so the wheel does NOT auto-spin for historical rounds. Rotation math (`-((idx + 0.5) * 36°) + 5 full spins`) confirmed correct.
- **Update Banner Removed**: `UpdateAvailableBanner` no longer rendered inside `App.js`.

## Games currently in codebase (7 total)
1. Gali/Disawar
2. Kalyan Matka
3. Aviator
4. Coin Toss
5. Dragon Tiger (30s cards)
6. Color Prediction (30s wheel — Red/White/Orange, all 3x)
7. Crazy Time (30s money wheel, 10 numbers, all 10x)

## Credentials
- Admin: `admin@sattamatka.com` / `Admin@123`
- Admin URL: `/admin-login`


## Key Files Changed (Coin-only simplification, Feb 2026)
- `frontend/src/App.js` — routes for removed games now redirect to `/coin`, unused imports removed
- `frontend/src/components/FooterNav.js` — 4 tabs (Play/Wallet/Refer/Profile)
- `frontend/src/components/SidebarMenu.js` — removed Result History, Rate List
- `frontend/src/pages/CoinPage.js` — new Lucky Bet header, casino ticket-slip bet history, `fetchBetHistory` API integration

## 2026-06 — VPS Recovery
- Added `/app/fix_vps.sh`: one-command VPS repair (recreates backend/.env + frontend/.env without overwriting existing keys, auto-detects DB name to preserve user data, builds frontend, creates/restarts systemd backend, verifies /api/games).
- `deploy.sh` default DOMAIN changed to https://m11cloube.in.
- RULE: NEVER run `git clean -fdx` on VPS (wipes .env). `git clean -fd` is safe (.env is gitignored).
- Pending: user must run fix_vps.sh on VPS; then Casino Unified History (P1), Auto-Refill Prompt (P1), Gateway Health Monitor + Streak Bonus (P2), SattaAPI 403 on VPS.
- 2026-06: VPS RESTORED. Root cause of 2nd failure: stale `DB_NAME=""` in backend/.env; scripts now override empty values. Added `/app/fix_backend.sh`; both scripts served at `GET /api/fix-vps.sh` and `GET /api/fix-backend.sh` (preview) for one-line `curl | bash` on VPS. Verified live: /api/games 200, /api/version 200, admin login OK (data preserved, DB matka_prod).
- 2026-06: CHAT FIX + WhatsApp UX. Root cause of image/voice not sending on VPS: storage_utils.put_object required EMERGENT_LLM_KEY (absent on VPS) → 500. Now falls back to local backend/uploads. Added hold-to-record VoiceRecordButton (pointer events, slide-left cancel, mime auto-pick webm/m4a/ogg), VoiceBubble player, toasts on failure; AdminChatInbox rewritten WhatsApp-style (list+search+menu, conversation bubbles, hold mic, dbl-click delete). fix_backend.sh also sets nginx client_max_body_size 50M. Tested: iteration_41 (backend 11/11, frontend pass; voice MediaRecorder needs manual test).
- 2026-06: ADMIN USER DETAIL → "सभी बेट्स" tab now shows unified all-games bet history (Matka/Gali, Kalyan, Aviator, Coin, Dragon Tiger, Color, Crazy Time, Chicken Road, Ludo) with WIN/LOSS/PENDING, game chips + status filter, totals (wagered/won/lost/pending/Net P/L). Backend game-history endpoint fixed (aviator won_amount, kalyan digit picks, by_game stats, added chicken_road_games + ludo_games). Removed duplicate hidden "Game History" tab (grid overflow bug). Default tab = bets.
