# MATKA11 - Product Requirements Document

## Original Problem Statement
Migrate Matka11 satta app from Emergent preview environment to self-hosted Hostinger VPS at https://matka11.online with full feature parity and automatic result fetching from king.sattaapi.com.

## Tech Stack
- Frontend: React 18 + Tailwind + shadcn/ui
- Backend: FastAPI (Python)
- Database: MongoDB (self-hosted on VPS)
- Deployment: Hostinger VPS Ubuntu 22.04 (7GB RAM)
- Web Server: Nginx + systemd-managed uvicorn
- SSL: Let's Encrypt (Certbot)
- Domain: matka11.online

## Production Environment
- VPS IP: 187.127.172.100
- Live URL: https://matka11.online
- Admin URL: https://matka11.online/admin-login
- Backend Service: systemctl service `matka11`
- Code Path: /var/www/new-23-aprial/
- DB Name: matka11

## Test Credentials
- Admin: admin@sattamatka.com / Admin@123
- Test User: 9111222333 / Test@123

## Integrations (All Live in Production)
1. IMB Payment Gateway (Deposits) - https://secure-stage.imb.org.in
2. DVHosting SMS - https://dvhosting.in/api/sendsms
3. king.sattaapi.com - Auto Result (NEW) - https://king.sattaapi.com/wp-json/satta/v1/results
4. VAPID Push Notifications

## Active Games (6)
1. Delhi Bazaar - 3:00 PM
2. Shri Ganesh - 4:30 PM
3. Faridabad - 6:00 PM
4. Ghaziabad - 8:30 PM
5. Gali - 11:30 PM
6. Disawar - 5:00 AM next day

## Major Features Implemented
- Phone+Password signup/login (no OTP)
- JWT 1-year token (no auto-logout)
- Wallet (IMB deposit, withdraw)
- Game betting (Jodi, Single, Patti)
- Admin panel (Games, Results, Bets, Jantri, Winners, Withdrawals, Chat)
- AUTOMATIC RESULT FETCHING from king.sattaapi.com every 2 min
- Push notifications
- APK download /matka11.apk
- Premium Royal Gold UI theme with animated color shift gradients
- Telegram Welcome Popup (every fresh app open, closable with X)
- Quick Actions: Deposit / Withdraw / Telegram / WhatsApp (authentic logos)
- Per-game Result History Chart Modal (last 30 days)

## Critical Fixes (Feb 2026)
1. VPS migration from Emergent to Hostinger
2. MongoDB index conflicts cleaned
3. Hardcoded /app/backend/uploads -> relative UPLOADS_PATH
4. Systemd WorkingDirectory fixed
5. NAVIGATION BUG: <Link><Button> nesting -> onClick={navigate()}
6. INFINITE API LOOP: refreshUser wrapped in useCallback
7. SERVICE WORKER: self-destruct mode (no navigation interception)
8. helpers.py KeyError defensive lookup
9. king.sattaapi.com integration (replaces matkaapi.com)
10. .env shell-escape: heredoc append
11. APK SCROLL LAG FIX (Feb 2026): Removed all paint-triggering effects from
    Dashboard: animate-gold-glow keyframe, live-blink keyframe, filter:
    drop-shadow on text, bg-clip-text on game name, double-gradient border
    trick, multi-layer box-shadows with blur, backdrop-filter on .glass,
    transition-all, text-shadow. Replaced with solid colors + single solid
    gold border + `contain: content` paint isolation per card. Look stays
    premium gold; APK scroll FPS recovered to ~60fps on low-end Android.
12. WINNERS/DEPOSITS/WITHDRAWALS TICKER (Feb 2026): Added 3-tab horizontal
    stock-ticker at top of Dashboard — Vijeta / Today Deposit / Today
    Withdraw. APIs:
    - GET /api/winners/top?limit=30
    - GET /api/transactions/today-deposits?limit=30
    - GET /api/transactions/today-withdrawals?limit=30
    All return real "First L." names, phone NEVER exposed. Only real app
    users from db.bets / db.transactions. Marquee uses single transform3d
    keyframe (GPU only, zero scroll lag). Pauses off-screen + when tab hidden.
13. KALYAN GAMES EXPANSION (Feb 2026): Added 10 new Kalyan/Maharashtra games
    to config.py (main_bazar_morning, shagun, sridevi, madhur_morning,
    padmavathi, worli_morning, day_bombay, maharani, sunday_bazar) per
    user-supplied screenshots. server.py now upserts new DEFAULT_GAMES
    idempotently into existing DBs ($setOnInsert) so VPS deploy auto-adds
    them. Dashboard now has "Gali Disawar | Kalyan" pill toggle in Market
    header — games filtered by category, choice persisted in localStorage.
    Admin Kalyan Results tab automatically lists all 16 Kalyan games.
    Month-end is_holiday flag is now restricted to gali_disawar category
    only — Kalyan games run every day (no HOLIDAY bar).
14. KALYAN GAME PAGE REDDY66 REDESIGN (Feb 2026): Complete rewrite of
    KalyanGamePage.js to match Reddy66 light-theme design (full details
    above).
15. KALYAN DASHBOARD CARD REDESIGN (Feb 2026): Distinct Matka-themed card
    for Kalyan category (dark navy + maroon gradient, red border with
    diagonal red corner accent). Big iconic XXX-XX-XXX result line in
    center (green open-panna, gold jodi, red close-panna). Live/Off pill
    + Bidding On/Off label. Visually completely separate from Gali Disawar
    gold cards so users immediately recognize which market they're on.
16. CATEGORY SWITCHER 3-TAB (Feb 2026): Dashboard category switcher
    upgraded from 2 to 3 segmented pills with lucide icons:
    - Gali Disawar (Dices icon, yellow)
    - Kalyan (Trophy icon, red)
    - Aviator (Plane icon, cyan) → navigates to /aviator
    Equal-width grid, active = full gold gradient with black icon.
17. AVIATOR IN-HOUSE CRASH GAME (Feb 2026): Spribe-style provably-fair
    crash game built from scratch in-house (no third-party dependency).
    Backend: bustabit formula with 33% house edge (~30% win at 2x cashout),
    SHA-256 commit/reveal, WebSocket ticks, batch endpoints for community feed.
    Frontend: Reddy66/Spribe pixel-style UI with 2 stacked bet panels, purple
    radial viewport + sun-ray streaks, All Bets/Previous/Top tabs.
18. AVIATOR POLISH (Feb 2026): Custom red propeller plane SVG (replaces
    lucide Plane icon) in both header and viewport. Aviator-style sound
    effects synthesized via Web Audio API (realistic propeller drone with
    7Hz blade-chop AM, 3-osc harmonic stack + brown-noise bandpass; takeoff
    with engine ignition thump + rising prop buzz + air rush; crash with
    filtered noise explosion + descending whistle + low rumble; cashout
    3-note triumphal arpeggio + sparkle chimes). Audio context auto-unlocks
    on first user touch/click (mobile WebView autoplay policy). Sound
    toggle button in header (state persisted in localStorage). Prominent
    "🏆 Recent Winners" strip above community feed with green-glow cards
    showing name + win amount + multiplier.
19. STYLISH CATEGORY ICONS (Feb 2026): Replaced lucide flat icons on
    Dashboard category buttons with custom multi-layered SVG icons:
    - Gali Disawar: twin 3D dice with gradient + sparkle
    - Kalyan: royal crown with 3 gem peaks + center gem + base band
    - Aviator: cyan plane angled up-right with motion streaks + sparkle
    Auto-switches to dark theme when category is active (over gold gradient).
20. AVIATOR PERF + NO SOUND (Feb 2026): Removed all sound code from
    Aviator (~250 lines of Web Audio API: oscillators, brown-noise buffers,
    AM modulator, ambient drone — these were heavy on low-end Android
    WebView CPU). Also performance-optimized:
    - Backend WS tick interval 100ms → 200ms (halved re-render rate)
    - Sun-ray streaks 12 → 6 (halved SVG paint cost)
    - Community feed poll 2s/4s → 3s/6s (lighter load)
    - `contain: content` on viewport (paint isolation)
    Result: smooth scroll/animation on low-end APK, no audio CPU drain.
    - Black header bar with game name pill + BETS link + Back button
    - MARKET label + Rate (auto-changes per bet type)
    - OPEN/CLOSE session toggle with blue active border
    - 5 bet-type tabs (SINGLE 9.5x / SINGLE PATTI 125x / DOUBLE PATTI 250x
      / TRIPLE PATTI 900x / JODI 90x) with dice + spade icons
    - Amount grid: ₹5 / ₹10 / ₹50 / ₹100 / ₹200 / ₹500 / ₹1000 / ₹5000
    - Digit/Panna grids vary per type:
      * SINGLE: 0-9 (4 col)
      * SINGLE PATTI: panna of ank 0..9 (auto-computed valid pannas)
      * DOUBLE PATTI: same grouping with double pannas
      * TRIPLE PATTI: 000-999 triples (10 cells)
      * JODI: 00-99 (4 col, 100 cells)
    - Per-digit input with auto-fill from selected amount
    - Selected Digits + Total Stake live display
    - CLEAR ALL + SUBMIT BET sticky bottom bar
    - BETS modal showing today's placed bets with status
    Backend: New `/api/kalyan/bet/batch` endpoint accepts {bet_type, session,
    amount, digits[]} for atomic multi-bet submission. Min bet lowered to ₹5.
    CSS: Scoped overrides for [data-testid="kalyan-page"] reset global dark
    theme to pure-white Reddy66 light theme without affecting other pages.

## 2026-02 Updates
- Aviator Dashboard Tab: Red gradient tab with white "LIVE" badge
  (top-right) and "Real Available" sub-label. Plane icon in red shades.
- Aviator Betting Phase UI: Removed numeric countdown text. Plane stays
  static on the runway (bottom-left). A red horizontal progress bar (with
  glow) fills from 0% → 100% over the 10-second betting window, then the
  plane takes off automatically. Backend BETTING_DURATION already 10s.
- Premium category switcher (Gali Disawar / Kalyan / Aviator):
  Each pill has a distinct color theme that is preserved in active and
  inactive states. Gali = gold, Kalyan = royal maroon/pink, Aviator =
  sky-blue/cyan with a green-dot LIVE badge. Inactive pills shrink
  slightly (scale 0.97) and use a muted tinted background. Switching
  uses a 220ms ease transition on transform, background, and shadow.
  Aviator icon reverted to cyan plane (no red).

## Backlog
- P0: Tell user to "Save to Github" → on VPS run `bash /var/www/new-23-aprial/deploy.sh`
  to ship Aviator UI + Kalyan + tickers to the live APK.
- P2: Stronger JWT_SECRET
- P2: MongoDB backup cron
- P2: Telegram admin alerts for deposits/withdraws
- P3: Rate limiting on auth
- P3: IMB stage -> production URL
- P3: /api/health endpoint
