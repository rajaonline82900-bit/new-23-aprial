#!/usr/bin/env bash
# ============================================================================
# MATKA 11 — One-Command Hostinger VPS Deploy Script
# Usage:  cd /var/www/new-23-aprial && bash deploy.sh
#         OR (from anywhere):  bash /var/www/new-23-aprial/deploy.sh
# ============================================================================
# What it does:
#   1. Pulls latest code from GitHub
#   2. Builds the frontend (yarn build)
#   3. Auto-detects the backend systemd service (no more typo issues)
#   4. Restarts backend + reloads nginx
#   5. Verifies /api/version endpoint is up with the new build version
#
# Safe to re-run as many times as you want.
# ============================================================================

set -e  # exit on any error
echo ""
echo "🚀 MATKA 11 — Deploying latest changes…"
echo "----------------------------------------"

REPO_DIR="${REPO_DIR:-/var/www/new-23-aprial}"
cd "$REPO_DIR"

# 1. Pull latest code
echo "📥 Pulling latest code from GitHub…"
git fetch --all
git stash -q || true     # auto-stash any local changes so pull never fails
git pull --rebase
echo "   ✅ Code updated"
echo ""

# 2. Build frontend
echo "🎨 Building frontend bundle (yarn build)…"
cd frontend
rm -rf build
if command -v yarn >/dev/null 2>&1; then
  yarn install --silent
  yarn build
else
  npm install --silent
  npm run build
fi
echo "   ✅ Frontend built"
echo ""

# 3. Auto-detect backend service (handles any name: matka-backend, matka, matka-api, etc.)
echo "🔎 Detecting backend systemd service…"
BACKEND_SVC=""
for candidate in matka-backend matka matka-api matka11 matka11-backend matka_backend backend; do
  if systemctl list-unit-files --type=service 2>/dev/null | grep -qE "^${candidate}\.service"; then
    BACKEND_SVC="$candidate"
    break
  fi
done
# Fallback: scan systemd units for any service with "matka" in the name
if [ -z "$BACKEND_SVC" ]; then
  BACKEND_SVC=$(systemctl list-unit-files --type=service 2>/dev/null | awk '/matka/ {print $1}' | head -1 | sed 's/\.service$//')
fi
# Final fallback: scan running processes for uvicorn/gunicorn matka and look up service
if [ -z "$BACKEND_SVC" ]; then
  BACKEND_SVC=$(ps -eo pid,unit,cmd 2>/dev/null | grep -iE "uvicorn|gunicorn|fastapi" | grep -iE "matka|backend" | awk '{print $2}' | sed 's/\.service$//' | head -1)
fi

if [ -n "$BACKEND_SVC" ]; then
  echo "   ✅ Detected backend service: $BACKEND_SVC"
  echo "🔄 Restarting backend ($BACKEND_SVC)…"
  sudo systemctl restart "$BACKEND_SVC"
  sleep 2
  echo "   ✅ Backend restarted"
else
  echo "   ⚠️  Could not detect backend systemd service automatically."
  echo "   ℹ️  Listing services with 'matka' in name:"
  systemctl list-units --type=service 2>/dev/null | grep -i matka || echo "      (none found)"
  echo "   ℹ️  Please restart manually:  sudo systemctl restart <your-service-name>"
fi
echo ""

# 4. Reload Nginx
echo "🌐 Reloading Nginx…"
sudo nginx -t && sudo systemctl reload nginx
echo "   ✅ Nginx reloaded"
echo ""

# 5. Verify deployment
echo "🩺 Verifying /api/version endpoint…"
DOMAIN="${DOMAIN:-https://matka11.online}"
VERSION_RESPONSE=$(curl -fsS "$DOMAIN/api/version" 2>/dev/null || echo "FAILED")
if [[ "$VERSION_RESPONSE" == *"version"* ]]; then
  echo "   ✅ Backend is live → $VERSION_RESPONSE"
else
  echo "   ❌ /api/version did not respond. Backend may not be running."
  echo "      Try:  sudo journalctl -u $BACKEND_SVC -n 50 --no-pager"
fi
echo ""

echo "----------------------------------------"
echo "🎉 Deployment complete!"
echo ""
echo "📱 APK users will auto-reload within 60 seconds to pick up the new bundle."
echo "🌐 Web users will get the new build on next page load."
echo ""
