#!/usr/bin/env bash
# ============================================================================
# Shiv Shakti Club — VPS One-Command Deploy
# ----------------------------------------------------------------------------
# Kya karta hai (ek command me):
#   1. Git pull latest from origin
#   2. Frontend: yarn install (lucide-react latest force) + build
#   3. Backend: pip install -r requirements.txt (skip if venv unavailable)
#   4. Nginx reload
#   5. Backend systemd restart (auto-detect unit name)
#   6. Health-check /api/online-users → agar green, "DEPLOY OK" print
#
# Chalane ka tareeka VPS pe:
#   sudo bash /var/www/new-23-aprial/update.sh
#
# Ya remote se (agar update.sh git me hai):
#   cd /var/www/new-23-aprial && sudo git pull && sudo bash update.sh
# ============================================================================

set -Eeuo pipefail

# --- Auto-detect app dir & backend unit -------------------------------------
find_app_dir() {
  for d in \
    /var/www/new-23-aprial \
    /var/www/shivshakti \
    /var/www/luckybet \
    /var/www/matka11 \
    /root/app \
    /opt/app; do
    [ -d "$d/frontend" ] && [ -d "$d/backend" ] && { echo "$d"; return; }
  done
  # Last resort: current dir
  [ -d "./frontend" ] && [ -d "./backend" ] && { pwd; return; }
  return 1
}

find_backend_unit() {
  for u in matka-backend shivshakti-backend luckybet-backend app-backend backend; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${u}\.service"; then
      echo "$u"; return
    fi
  done
  return 1
}

APP_DIR="${APP_DIR:-$(find_app_dir || true)}"
BACKEND_UNIT="${BACKEND_UNIT:-$(find_backend_unit || echo matka-backend)}"
BRANCH="${BRANCH:-main}"

if [ -z "${APP_DIR:-}" ] || [ ! -d "$APP_DIR" ]; then
  printf "\033[1;31m✖ APP_DIR not found. Set it manually:\033[0m\n  sudo APP_DIR=/path/to/app bash update.sh\n" >&2
  exit 1
fi

log()  { printf "\n\033[1;33m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✖ %s\033[0m\n" "$*" >&2; }

trap 'err "Deploy FAILED on line $LINENO. Scroll up for the exact error. Fix and re-run: sudo bash $APP_DIR/update.sh"' ERR

printf "\n\033[1;44;97m  Shiv Shakti Deploy  \033[0m  APP_DIR=%s  UNIT=%s  BRANCH=%s\n" \
       "$APP_DIR" "$BACKEND_UNIT" "$BRANCH"

# --- 1. Git pull -------------------------------------------------------------
log "1/6  Git pull (origin/$BRANCH)"
cd "$APP_DIR"
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
git fetch --all --prune
git reset --hard "origin/$BRANCH"
COMMIT=$(git rev-parse --short HEAD)
ok "Now on commit $COMMIT"

# --- 2. Frontend build (with lucide-react latest to avoid BookOpen crash) ----
log "2/6  Frontend build (yarn install + build)"
cd "$APP_DIR/frontend"
if command -v yarn >/dev/null 2>&1; then
  # Force lucide-react to latest so newly-used icons (BookOpen, etc.) resolve.
  yarn add lucide-react@latest --silent || true
  yarn install --silent
  CI=false yarn build
else
  npm install lucide-react@latest --silent || true
  npm ci --silent || npm install --silent
  CI=false npm run build
fi
ok "Frontend built → $APP_DIR/frontend/build"

# --- 3. Backend deps (optional, only if venv/requirements present) -----------
log "3/6  Backend deps (pip install)"
cd "$APP_DIR/backend"
if [ -f requirements.txt ]; then
  if [ -x "$APP_DIR/backend/venv/bin/pip" ]; then
    "$APP_DIR/backend/venv/bin/pip" install -q -r requirements.txt || true
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install -q -r requirements.txt || true
  fi
  ok "Backend deps synced"
else
  ok "No requirements.txt — skipped"
fi

# --- 4. Nginx reload ---------------------------------------------------------
log "4/6  Nginx reload"
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
  ok "Nginx reloaded"
else
  ok "Nginx not installed on this host — skipped"
fi

# --- 5. Backend restart ------------------------------------------------------
log "5/6  Backend restart ($BACKEND_UNIT)"
if systemctl list-unit-files 2>/dev/null | grep -q "^${BACKEND_UNIT}\.service"; then
  systemctl restart "$BACKEND_UNIT"
  sleep 3
  if ! systemctl is-active --quiet "$BACKEND_UNIT"; then
    err "$BACKEND_UNIT failed to start — showing last 40 log lines:"
    journalctl -u "$BACKEND_UNIT" -n 40 --no-pager || true
    exit 1
  fi
  ok "$BACKEND_UNIT is active"
else
  err "systemd unit '$BACKEND_UNIT' not found. Set BACKEND_UNIT env var and re-run."
  exit 1
fi

# --- 6. Health check ---------------------------------------------------------
log "6/6  Health check (backend /api/online-users)"
sleep 1
HEALTH=""
for i in 1 2 3 4 5; do
  HEALTH="$(curl -sf --max-time 4 http://127.0.0.1:8001/api/online-users || true)"
  [ -n "$HEALTH" ] && break
  sleep 2
done
if [ -z "$HEALTH" ]; then
  err "Backend did not respond in 15s. Run:  journalctl -u $BACKEND_UNIT -n 60 --no-pager"
  exit 1
fi
ok "Backend healthy → $HEALTH"

printf "\n\033[1;42;97m  ✔ DEPLOY OK  \033[0m  commit=%s  frontend=built  backend=up\n\n" "$COMMIT"
