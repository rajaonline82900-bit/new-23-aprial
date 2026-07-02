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

## 2026-07 (July) Updates
- **6 unmapped Kalyan games deactivated** (shagun, padmavathi, worli_morning, day_bombay, maharani, sunday_bazar). Only 10 DP-Boss-mapped Kalyan games remain visible.
- **All Kalyan games start_time = 07:00 IST** (betting opens 7 AM daily).
- **Per-game open_time + close_time populated from DP Boss** (Kalyan Morning 10:10/11:10, Milan Night 21:10/23:10, etc.).
- **Session-based bet rules enforced** in `kalyan_routes.py::_validate_kalyan_bet_window`:
  - Open session (7 AM → `open_time`): Single, S/D/T Patti, Jodi, Sangams allowed
  - Close session (7 AM → `close_time`): Single + S/D/T Patti only (NO Jodi, NO Sangam)
  - After respective cutoff → all bets in that session blocked
  - Handles cross-midnight games (e.g. main_bazar 00:10 close)
- **Frontend KalyanGamePage**: Jodi tab now auto-forces OPEN session (matka rule). CLOSE session disabled when Jodi active. Session buttons show cutoff times.
- **NEW admin tab "पूरी हिस्ट्री"** (`AdminHistoryTab.js` + `GET /api/admin/bet-history`):
  - Full unified bet history across Gali + Kalyan + Aviator
  - Filters: category / status / date / phone-search
  - Columns: Date-Time • User (name+phone) • Game • Session • Type • Number • Amount • Win • Status
  - Real-time totals: rows, ₹ total, won count, lost count
- **NEW admin tab "कल्याण जंतरी"** (`AdminKalyanJantriTab.js` + `GET /api/admin/kalyan/jantri`):
  - Per-game per-date number-wise money-on-line report
  - Separated OPEN vs CLOSE session totals
  - Grouped by type: Single (0-9), Single Patti, Double Patti, Triple Patti, Jodi (Open only)
  - Each number shows ₹ + bet count
- **User `/api/bets` enhanced**: Now merges Aviator bets into unified history. Enriched with game_name lookup. BetsPage shows Kalyan (pink icon), Aviator (sky icon with crash multiplier), Gali (gold) with session tags.
- **Aviator round-loop hang FIX (critical)**: Two issues fixed:
  1. `_broadcast` now uses `asyncio.gather` for parallel sends with a 2s
     per-client timeout. A slow/dead WS can no longer block the loop.
  2. `aviator_ws` no longer sends a periodic ping from the receive loop
     (was racing with round-loop broadcasts on the same WS).
- **Aviator watchdog + polling fallback**: Watchdog auto-recovers if any
  phase stuck; HTTP polling on `/api/aviator/state` runs even if WS dies.
- **Admin panel: Kalyan section separation** — new "कल्याण रिजल्ट" tab
  + "गेम सेटिंग्स" split into Gali/Disawar + Kalyan sections.
- **Kalyan result entry — bug fix**: switched `g.id` → `g.game_id`;
  each card now has independent state.
- **Kalyan Panna Quick Picker**: 220 valid pannas organized by Ank 0-9,
  live "Ank preview" as admin types.
- **DP Boss API — Kalyan auto-result integration (NEW)**:
  - New file `/app/backend/routes/kalyan_auto_results.py`.
  - Env vars: `DPBOSS_API_KEY`, `DPBOSS_API_URL`.
  - Background loop `kalyan_auto_fetch_loop()` polls DP Boss every 180s,
    auto-declares Open/Close pannas via extracted helper
    `declare_kalyan_panna_internal()` (same code path as manual admin
    declare — bets settled atomically).
  - Static mapping of 10 mapped Kalyan games → DP Boss market IDs
    (kalyan_morning, main_bazar_morning, sridevi, madhur_morning,
    milan_day, rajdhani_day, kalyan, main_bazar, milan_night,
    rajdhani_night). Remaining 6 games (shagun, padmavathi, worli_morning,
    day_bombay, maharani, sunday_bazar) → manual declare only.
  - Admin endpoints:
    * `POST /api/admin/kalyan/auto-fetch` — one-shot manual trigger
    * `GET  /api/admin/kalyan/auto-fetch/status` — diagnostic (mapping,
      running state, unmapped-games)
  - Idempotency: same panna+session for same date skipped (no re-settle).
  - UI: new ⚡ "Auto-Fetch (DP Boss)" pink button in the Kalyan Results
    admin tab + explanatory banner.
- **Bulletproof `deploy.sh`**: hard-reset git, wipe `node_modules`+build,
  fresh yarn build, cache-bust `index.html`, auto-restart backend
  systemd service, reload nginx, verify `/api/version` + games count.

### Feb 2026
- **"Invalid Date" bug FIX in bet/wallet/admin lists**: `utcDate()` helper
  updated across 9 files (BetsPage, WalletPage, AdminPage,
  AdminReferralsTab, AdminWinnersTab, AdminFundRequestsTab,
  AdminWithdrawalsTab, AdminUsersTab, AdminDepositsTab).
  Root cause: Kalyan/Aviator routes stored `created_at` as ISO string
  with `+00:00` offset; helper was blindly appending `Z` → invalid.
  Fix: detect existing TZ (`Z` or `±HH:MM`) via regex before appending.
  Verified with node against 4 formats (naive, `Z`, `+00:00`, `+05:30`).

- **🎲 LUDO — Zupee Ludo Supreme style (UPGRADED)**:
  Category switcher me 4th tab (purple theme + LIVE badge). Backend now
  runs classic 4-token real Ludo with the full 15x15 cross-board.

  **Backend** (`/app/backend/routes/ludo_routes.py`, ~700 lines):
    * **4 tokens per player**, start in their color yard (Red/Green/
      Yellow/Blue). Roll **6** to release a token onto the main track.
    * **52-square main track** + 6-square home column per color (per-token
      `progress` 0-57; 57 = final home).
    * **8 safe squares**: 4 color-start (0/13/26/39) + 4 stars
      (8/21/34/47). No captures possible on these.
    * **Capture** on non-safe main-track squares sends opponent's token
      back to yard.
    * **Extra turn** on: rolling a 6, capturing, or landing a token home
      (capped at 3 consecutive sixes).
    * **Score** = `home_tokens × 56 + Σ token progress + captures × 20`.
    * **Match end** = all 4 tokens home for one player OR 10-minute timer
      expiry → highest score wins (ties split).
    * **Endpoints**: `POST /roll` returns dice + movable token list;
      `POST /move` (with `token_id`) applies chosen move. Server tracks
      `pending_dice` between roll and move for correctness.
    * Retained: 180s bot autofill, weighted dice (30% user winrate target),
      admin commission (default 10%), MongoDB persistence + reconnect,
      WebSocket real-time updates.

  **Frontend** — `LudoGamePage.js` fully rewritten:
    * **Classic 15x15 cross board rendered** with SVG + absolute-positioned
      cells. 4 colored home yards, 52-square main track with color-tinted
      start squares, per-color home columns (light-tinted paths), center
      home split into 4 triangles.
    * **Star ★ markers** on safe squares.
    * **Tokens** rendered as radial-gradient circles with color-matching
      dark border; movable tokens pulse with white ring + glow.
    * **300ms CSS transitions** on token position → smooth moves.
    * **Turn flow**: user clicks ROLL → dice shown → glowing tokens
      indicate legal moves → click token to move → next turn.
    * Player HUD shows score + home-count out of 4.
    * All flows validated via live screenshots (yard state, released
      tokens on main track, mid-game with mixed positions).

  Verified E2E via curl + Playwright: create → bot fill → 6-roll releases
  token → forward moves → score/home tracking. Live board matches Zupee
  Ludo Supreme layout exactly.

## Backlog
- P0: Tell user to "Save to Github" → on VPS run `bash /var/www/new-23-aprial/deploy.sh`
  to ship Aviator UI + Kalyan + tickers to the live APK.
- P2: Stronger JWT_SECRET
- P2: MongoDB backup cron
- P2: Telegram admin alerts for deposits/withdraws
- P3: Rate limiting on auth
- P3: IMB stage -> production URL
- P3: /api/health endpoint
