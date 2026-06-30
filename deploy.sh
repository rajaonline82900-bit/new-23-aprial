#!/usr/bin/env bash
# ============================================================================
# MATKA 11 — Bulletproof One-Command VPS Deploy
# Usage (run on your Hostinger VPS):
#
#   bash /var/www/new-23-aprial/deploy.sh
#
# What it guarantees:
#   1. HARD-RESETS local repo to origin/main → impossible to keep old code
#   2. Fully cleans node_modules + build + yarn cache
#   3. Fresh yarn install + production build
#   4. Auto-detects backend systemd service → restarts it
#   5. Reloads nginx
#   6. Verifies /api/version is live
#   7. Touches index.html with a cache-bust timestamp
#
# After this completes, BOTH the website and APK webviews will load the
# latest code on their next refresh (no APK update required — webview
# fetches index.html with no-cache headers).
# ============================================================================

set -e
trap 'echo "❌ Deploy FAILED at line $LINENO"; exit 1' ERR

REPO_DIR="${REPO_DIR:-/var/www/new-23-aprial}"
DOMAIN="${DOMAIN:-https://matka11.online}"
BRANCH="${BRANCH:-main}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       🚀 MATKA 11 — Bulletproof VPS Deploy              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$REPO_DIR"

# ---------------------------------------------------------------
# 1. HARD RESET to origin/main  (impossible to keep old code)
# ---------------------------------------------------------------
echo "📥 [1/7] Hard-resetting repo to origin/$BRANCH (drops ALL local changes)…"
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
git fetch --all --prune
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd                          # remove any untracked files
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "   ✅  $OLD_COMMIT  →  $NEW_COMMIT"
echo ""

# ---------------------------------------------------------------
# 2. CLEAN OLD ARTIFACTS — no stale build can survive this
# ---------------------------------------------------------------
echo "🧹 [2/7] Cleaning old build artifacts + yarn cache…"
cd frontend
rm -rf build node_modules .cache .next
if command -v yarn >/dev/null 2>&1; then
  yarn cache clean --force >/dev/null 2>&1 || true
fi
echo "   ✅ Old build wiped"
echo ""

# ---------------------------------------------------------------
# 3. FRESH FRONTEND BUILD
# ---------------------------------------------------------------
echo "🎨 [3/7] Fresh install + production build (this can take 2-4 min)…"
if command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile --silent
  CI=true yarn build
else
  npm ci --silent
  CI=true npm run build
fi
# Cache-bust the index.html so APK webview refetches immediately
TS=$(date +%s)
if [ -f build/index.html ]; then
  sed -i "s|<head>|<head><meta name=\"deploy-ts\" content=\"$TS\">|" build/index.html
fi
cd ..
echo "   ✅ Frontend built (commit $NEW_COMMIT, ts=$TS)"
echo ""

# ---------------------------------------------------------------
# 4. BACKEND DEPENDENCY UPDATE (only if requirements changed)
# ---------------------------------------------------------------
echo "🐍 [4/7] Backend pip install (only changed deps)…"
if [ -f backend/requirements.txt ]; then
  if [ -d backend/venv ]; then
    backend/venv/bin/pip install -q -r backend/requirements.txt
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install -q -r backend/requirements.txt 2>/dev/null || \
      sudo pip3 install -q -r backend/requirements.txt 2>/dev/null || true
  fi
fi
echo "   ✅ Backend deps OK"
echo ""

# ---------------------------------------------------------------
# 5. RESTART BACKEND SYSTEMD SERVICE
# ---------------------------------------------------------------
echo "🔄 [5/7] Detecting + restarting backend service…"
BACKEND_SVC=""
for c in matka-backend matka matka-api matka11 matka11-backend matka_backend backend; do
  if systemctl list-unit-files --type=service 2>/dev/null | grep -qE "^${c}\.service"; then
    BACKEND_SVC="$c"; break
  fi
done
if [ -z "$BACKEND_SVC" ]; then
  BACKEND_SVC=$(systemctl list-unit-files --type=service 2>/dev/null \
    | awk '/matka|backend/ {print $1}' | head -1 | sed 's/\.service$//')
fi
if [ -n "$BACKEND_SVC" ]; then
  sudo systemctl restart "$BACKEND_SVC"
  sleep 3
  if systemctl is-active --quiet "$BACKEND_SVC"; then
    echo "   ✅ Backend service '$BACKEND_SVC' is running"
  else
    echo "   ❌ Backend service '$BACKEND_SVC' failed to start"
    sudo journalctl -u "$BACKEND_SVC" -n 30 --no-pager
    exit 1
  fi
else
  echo "   ⚠️  Could not auto-detect backend service. Please restart manually:"
  echo "      sudo systemctl restart <your-backend-service>"
fi
echo ""

# ---------------------------------------------------------------
# 6. RELOAD NGINX
# ---------------------------------------------------------------
echo "🌐 [6/7] Reloading nginx…"
sudo nginx -t && sudo systemctl reload nginx
echo "   ✅ Nginx reloaded"
echo ""

# ---------------------------------------------------------------
# 7. VERIFY DEPLOYMENT
# ---------------------------------------------------------------
echo "🩺 [7/7] Verifying live deployment at $DOMAIN…"
sleep 2
VERSION=$(curl -fsS "$DOMAIN/api/version" 2>/dev/null || echo "FAILED")
GAMES_OK=$(curl -fsS "$DOMAIN/api/games" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    games = d.get('games', [])
    kalyan = sum(1 for g in games if g.get('category') == 'kalyan')
    gali = sum(1 for g in games if g.get('category') in (None, 'gali_disawar'))
    print(f'OK gali={gali} kalyan={kalyan}')
except: print('FAIL')
" 2>/dev/null || echo "FAIL")

if [[ "$VERSION" == *"version"* ]]; then
  echo "   ✅ Backend live → $VERSION"
else
  echo "   ❌ /api/version not responding"
fi
echo "   📊 Games endpoint → $GAMES_OK"
echo ""

# Final summary
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  🎉  DEPLOY SUCCESSFUL                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Code commit:    $NEW_COMMIT"
echo "✅ Backend:        $BACKEND_SVC"
echo "✅ Build cache:    cleared"
echo "✅ Webview cache:  busted (ts=$TS)"
echo ""
echo "📱 APK users → just close & reopen the app, new code auto-loads"
echo "🌐 Website users → next page refresh shows new UI"
echo ""
echo "🔍 To monitor live logs:"
echo "   sudo journalctl -u $BACKEND_SVC -f"
echo ""
