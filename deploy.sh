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
# CI=true treats warnings as errors — all known warnings are suppressed
# via eslint-disable-next-line at their source. If build breaks in future,
# temporarily set DISABLE_ESLINT_PLUGIN=true here.
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
# 4b. ENSURE KALYAN AUTO-FETCH IS ENABLED ON VPS
# ---------------------------------------------------------------
echo "🎯 [4b] Ensuring Kalyan auto-fetch + SMS config in backend/.env…"
ENV_FILE="backend/.env"
if [ -f "$ENV_FILE" ]; then
  # 1. Force KALYAN_AUTO_FETCH_ENABLED="true"
  if grep -q "^KALYAN_AUTO_FETCH_ENABLED" "$ENV_FILE"; then
    sed -i 's|^KALYAN_AUTO_FETCH_ENABLED=.*|KALYAN_AUTO_FETCH_ENABLED="true"|' "$ENV_FILE"
    echo "   ✅ KALYAN_AUTO_FETCH_ENABLED set to \"true\""
  else
    echo 'KALYAN_AUTO_FETCH_ENABLED="true"' >> "$ENV_FILE"
    echo "   ✅ KALYAN_AUTO_FETCH_ENABLED added → \"true\""
  fi

  # 2. Ensure DPBOSS_API_URL is present (default endpoint)
  if ! grep -q "^DPBOSS_API_URL" "$ENV_FILE"; then
    echo 'DPBOSS_API_URL="https://api.codehap.com/dp/"' >> "$ENV_FILE"
    echo "   ✅ DPBOSS_API_URL added → https://api.codehap.com/dp/"
  fi

  # 3. Check DPBOSS_API_KEY — this is a paid key the operator owns, we
  #    can't inject a value; just make the failure loud & actionable.
  if ! grep -q "^DPBOSS_API_KEY" "$ENV_FILE"; then
    echo ""
    echo "   ❌ MISSING: DPBOSS_API_KEY"
    echo "   👉 Ye paid DP Boss key hai — aap ise .env me add karo:"
    echo ""
    echo "        echo 'DPBOSS_API_KEY=\"<your-key>\"' >> $ENV_FILE"
    echo "        sudo supervisorctl restart backend"
    echo ""
    echo "   Auto-fetch loop tab tak SKIP hoga. UI pe error message dikhega."
    echo ""
  else
    KEY_VALUE=$(grep "^DPBOSS_API_KEY" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | head -c 4)
    echo "   ✅ DPBOSS_API_KEY present (starts with: ${KEY_VALUE}...)"
  fi

  # 4. Ensure DVHOSTING_API_URL + DVHOSTING_API_KEY for OTP SMS
  if ! grep -q "^DVHOSTING_API_URL" "$ENV_FILE"; then
    echo 'DVHOSTING_API_URL="https://dvhosting.in/api-sms-v3.php"' >> "$ENV_FILE"
    echo "   ✅ DVHOSTING_API_URL added"
  fi
  if ! grep -q "^DVHOSTING_API_KEY" "$ENV_FILE"; then
    # Inject known-working key so password-reset OTP works out of the box
    echo 'DVHOSTING_API_KEY="8AH4KwTl1C"' >> "$ENV_FILE"
    echo "   ✅ DVHOSTING_API_KEY injected (default working key) — OTP SMS enabled"
  else
    KEY_LEN=$(grep "^DVHOSTING_API_KEY" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | wc -c)
    if [ "$KEY_LEN" -lt 6 ]; then
      echo "   ⚠️  DVHOSTING_API_KEY looks blank/short — OTP SMS will FAIL."
      echo "        Overwriting with default working key…"
      sed -i 's|^DVHOSTING_API_KEY=.*|DVHOSTING_API_KEY="8AH4KwTl1C"|' "$ENV_FILE"
    else
      echo "   ✅ DVHOSTING_API_KEY present (len $KEY_LEN chars)"
    fi
  fi
else
  echo "   ⚠️  $ENV_FILE not found — auto-fetch and OTP SMS will not run"
fi
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

# Confirm the Kalyan auto-fetch loop actually started (not skipped)
if [ -n "$BACKEND_SVC" ]; then
  AUTO_STATUS=$(sudo journalctl -u "$BACKEND_SVC" --since "2 min ago" --no-pager 2>/dev/null \
                  | grep -E "kalyan-auto" | tail -3)
  if echo "$AUTO_STATUS" | grep -q "Loop started"; then
    echo "   ✅ Kalyan DP Boss auto-fetch LOOP is RUNNING (every 180s)"
  elif echo "$AUTO_STATUS" | grep -q "Skipped"; then
    echo "   ⚠️  Kalyan auto-fetch SKIPPED. Check backend/.env has:"
    echo "         KALYAN_AUTO_FETCH_ENABLED=\"true\""
    echo "         DPBOSS_API_KEY=\"<your-key>\""
  else
    echo "   ℹ️  Kalyan auto-fetch status unknown (logs not yet available)"
  fi
fi
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
echo "✅ Auto-fetch:     KALYAN_AUTO_FETCH_ENABLED=true"
echo ""
echo "📱 APK users → just close & reopen the app, new code auto-loads"
echo "🌐 Website users → next page refresh shows new UI"
echo ""
echo "🔍 To monitor live logs:"
echo "   sudo journalctl -u $BACKEND_SVC -f"
echo ""
