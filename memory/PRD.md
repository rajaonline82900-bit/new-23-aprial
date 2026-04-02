# MATKA 11 - Satta Matka Betting Application

## Original Problem Statement
Build a Satta Matka betting application supporting games like Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, and Disawar. Features: deposit/withdrawal, Jantri/Haruf betting, crossing, result/bet history, PWA, push notifications, Refer & Earn, real OTP Authentication. Admin Panel for management, result declaration, auto-result API, user stats, dynamic settings.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, PWA (Service Workers)
- Backend: FastAPI, Motor (Async MongoDB), PyJWT
- Database: MongoDB
- Integrations: DVHosting SMS API, Bavli Matka Auto-Result API

## Core Features Implemented
1. Phone + OTP Authentication (Users) - No passwords
2. Admin Login (Email/Password) at /admin-login
3. MATKA 11 Branding with custom PWA icons
4. Game Cards with sorted active/closed, AM/PM times, Yesterday/Today results, LIVE blink
5. Auto-logout fix (1-year cookies + localStorage fallback + Network-first SW)
6. Bavli Auto Result API integration (Delhi + General markets)
7. Admin Panel with deposit/withdrawal management, user tracking, dynamic settings
8. Sidebar Menu with Profile (top), menu items, and Logout (bottom)
9. Header with hamburger menu, logo, Download App button, admin shield

## Completed Tasks (Latest: April 2, 2026)
- [Apr 2] Moved Profile to sidebar TOP, Logout to sidebar BOTTOM
- [Apr 2] Replaced Download icon with "Download App" text button in header
- [Apr 2] Removed Profile/Logout from header
- [Previous] Fixed auto-logout, PWA icons, game cards redesign, Bavli API, admin credentials

## Architecture
```
/app/backend/server.py - Monolithic FastAPI (~2940 lines)
/app/frontend/src/components/SidebarMenu.js - Sidebar with Profile/Logout
/app/frontend/src/pages/DashboardPage.js - Main dashboard
/app/frontend/src/context/AuthContext.js - Auth with cookie+localStorage
```

## Backlog
- P1: Refactor server.py into modular routers
- P1: Refactor AdminPage.js into smaller components
- P2: Email notifications for transactions
- P2: Referral earnings history section
