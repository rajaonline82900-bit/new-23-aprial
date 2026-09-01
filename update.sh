#!/usr/bin/env bash
# Shiv Shakti Club — VPS One-Line Deploy Script
#
# Usage on the Hostinger VPS (run as root or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/YOUR_GH_USER/YOUR_REPO/main/update.sh | bash
#
# Or, once installed:
#   sudo bash /var/www/new-23-aprial/update.sh
#
# Behaviour:
#   1. git pull the latest commit from origin
#   2. rebuild the frontend (yarn install + build) with the CRA CI=false workaround
#   3. reload nginx (serves the built frontend)
#   4. restart the FastAPI backend systemd unit
#   5. show a one-page health summary at the end
#
# Fails loudly on ANY error so you never end up with a half-deployed app.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/new-23-aprial}"
BACKEND_UNIT="${BACKEND_UNIT:-matka-backend}"
BRANCH="${BRANCH:-main}"

log() { printf "\n\033[1;33m▶ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m✖ %s\033[0m\n" "$*" >&2; }

trap 'err "Deploy FAILED on line $LINENO. Fix the error above and re-run: sudo bash $APP_DIR/update.sh"' ERR

# 1. Pull latest code
log "1/5  Pulling latest from git ($BRANCH)"
cd "$APP_DIR"
sudo -u root git fetch --all --prune
sudo -u root git reset --hard "origin/$BRANCH"
COMMIT=$(git rev-parse --short HEAD)
ok "Now on commit $COMMIT"

# 2. Rebuild frontend
log "2/5  Rebuilding frontend (yarn install + build)"
cd "$APP_DIR/frontend"
# Yarn is preferred; fall back to npm if unavailable
if command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile
  CI=false yarn build
else
  npm ci
  CI=false npm run build
fi
ok "Frontend built → $APP_DIR/frontend/build"

# 3. Reload nginx
log "3/5  Reloading nginx"
sudo nginx -t
sudo systemctl reload nginx
ok "Nginx reloaded"

# 4. Restart backend service
log "4/5  Restarting backend service ($BACKEND_UNIT)"
sudo systemctl restart "$BACKEND_UNIT"
sleep 2
sudo systemctl is-active --quiet "$BACKEND_UNIT" || { err "$BACKEND_UNIT failed to start"; sudo journalctl -u "$BACKEND_UNIT" -n 40 --no-pager; exit 1; }
ok "$BACKEND_UNIT is active"

# 5. Health check
log "5/5  Health check"
sleep 1
HEALTH="$(curl -sf http://127.0.0.1:8001/api/online-users || true)"
if [ -z "$HEALTH" ]; then
  err "Backend did not respond on /api/online-users — check journalctl -u $BACKEND_UNIT"
  exit 1
fi
ok "Backend healthy: $HEALTH"

printf "\n\033[1;42;97m  DEPLOY OK  \033[0m  commit=%s  frontend=built  backend=up\n" "$COMMIT"
