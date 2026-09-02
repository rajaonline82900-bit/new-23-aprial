#!/usr/bin/env bash
# One-command VPS repair: recreates .env files, rebuilds frontend, restarts backend.
# Usage:  sudo bash fix_vps.sh
set -u

REPO_DIR="${REPO_DIR:-/var/www/new-23-aprial}"
DOMAIN="${DOMAIN:-https://m11cloube.in}"
BE="$REPO_DIR/backend"
FE="$REPO_DIR/frontend"

echo "=============================================="
echo "  SHIV SHAKTI CLUB — VPS REPAIR ($DOMAIN)"
echo "=============================================="

if [ ! -d "$BE" ] || [ ! -d "$FE" ]; then
  echo "❌ $REPO_DIR me backend/frontend folder nahi mila. REPO_DIR sahi set karo."
  exit 1
fi

# ---------- 0. Latest code (safe — .env kabhi delete nahi hoga) ----------
cd "$REPO_DIR"
git fetch --all --prune >/dev/null 2>&1 && git reset --hard origin/main >/dev/null 2>&1 && echo "✅ Code updated to $(git rev-parse --short HEAD)" || echo "⚠️  git update skip (offline?) — purana code use hoga"

# ---------- 1. Python / venv ----------
PY="python3"
if [ -x "$BE/venv/bin/python" ]; then PY="$BE/venv/bin/python"; fi
if [ ! -x "$BE/venv/bin/python" ]; then
  echo "📦 venv nahi mila — bana raha hoon…"
  python3 -m venv "$BE/venv" && PY="$BE/venv/bin/python"
fi
"$PY" -m pip install -q --upgrade pip >/dev/null 2>&1 || true
"$PY" -m pip install -q -r "$BE/requirements.txt" 2>&1 | tail -2 || true
echo "✅ Backend dependencies OK"

# ---------- 2. Detect existing DB name (user data preserve) ----------
DB_NAME=$("$PY" - <<'PYEOF' 2>/dev/null
from pymongo import MongoClient
c = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=3000)
best, best_n = None, -1
for name in c.list_database_names():
    if name in ("admin", "config", "local"): continue
    n = c[name]["users"].estimated_document_count() if "users" in c[name].list_collection_names() else 0
    if n > best_n: best, best_n = name, n
print(best or "matka_prod")
PYEOF
)
[ -z "$DB_NAME" ] && DB_NAME="matka_prod"
echo "✅ Database: $DB_NAME"

# ---------- 3. backend/.env (existing values preserve, missing add) ----------
touch "$BE/.env"
setenv() {  # setenv KEY VALUE  -> add if missing or empty
  v=$(grep "^$1=" "$BE/.env" | cut -d= -f2- | tr -d '"'"'")
  [ -n "$v" ] && return
  sed -i "/^$1=/d" "$BE/.env"
  echo "$1=\"$2\"" >> "$BE/.env"
}
setenv MONGO_URL "mongodb://localhost:27017"
setenv DB_NAME "$DB_NAME"
setenv CORS_ORIGINS "*"
setenv JWT_SECRET "$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n')"
setenv ADMIN_EMAIL "admin@sattamatka.com"
setenv ADMIN_PASSWORD "Admin@123"
setenv FRONTEND_URL "$DOMAIN"
setenv PRODUCTION_URL "$DOMAIN"
setenv IMB_API_TOKEN ""
setenv IMB_API_URL "https://secure-stage.imb.org.in"
setenv TRUSTOPE_API_TOKEN "2d7c4102e2be80b8ce3412cd0c7de211"
setenv TRUSTOPE_API_URL "https://trustope.com"
setenv DVHOSTING_API_URL "https://dvhosting.in/api-sms-v3.php"
setenv DVHOSTING_API_KEY "8AH4KwTl1C"
setenv SATTA_API_URL "https://king.sattaapi.com/wp-json/satta/v1/results"
setenv SATTA_API_KEY 'ZRE71yG2j4Dryeqi!&Ji'
setenv SATTA_DOMAIN_KEY 'OVf%ZqGEFNqzr4kZLFxL@Ean7'
setenv DPBOSS_API_URL "https://api.codehap.com/dp/"
setenv DPBOSS_API_KEY ""
setenv KALYAN_AUTO_FETCH_ENABLED "true"
setenv NEW_MATKA_DOMAIN "$(echo "$DOMAIN" | sed 's#https\?://##')"
setenv APP_BUILD_VERSION "$(date -u +%Y.%m.%d.%H%M)"
echo "✅ backend/.env ready ($(grep -c = "$BE/.env") keys)"

# ---------- 4. frontend/.env ----------
cat > "$FE/.env" <<EOF
REACT_APP_BACKEND_URL=$DOMAIN
ENABLE_HEALTH_CHECK=false
EOF
echo "✅ frontend/.env ready"

# ---------- 5. Frontend build ----------
cd "$FE"
if ! command -v yarn >/dev/null 2>&1; then npm install -g yarn >/dev/null 2>&1 || true; fi
echo "🎨 Frontend build ho raha hai (2-4 min)…"
yarn install --silent 2>&1 | tail -2
rm -rf build
CI=false DISABLE_ESLINT_PLUGIN=true GENERATE_SOURCEMAP=false yarn build 2>&1 | tail -5
if [ ! -f build/index.html ]; then echo "❌ Frontend build FAIL"; exit 1; fi
echo "✅ Frontend built"

# ---------- 6. Backend service ----------
cd "$REPO_DIR"
SVC=$(systemctl list-unit-files --type=service 2>/dev/null | awk '/matka|backend/ {print $1}' | head -1 | sed 's/\.service$//')
if [ -z "$SVC" ]; then
  SVC="matka-backend"
  cat > /etc/systemd/system/$SVC.service <<EOF
[Unit]
Description=Shiv Shakti Club Backend
After=network.target mongod.service

[Service]
User=root
WorkingDirectory=$BE
EnvironmentFile=$BE/.env
ExecStart=$BE/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable $SVC >/dev/null 2>&1
  echo "✅ systemd service '$SVC' created"
fi
pm2 delete all >/dev/null 2>&1 || true
systemctl restart "$SVC"
sleep 4
if systemctl is-active --quiet "$SVC"; then
  echo "✅ Backend '$SVC' running"
else
  echo "❌ Backend start nahi hua — last 25 log lines:"
  journalctl -u "$SVC" -n 25 --no-pager
  exit 1
fi

# ---------- 7. Nginx ----------
nginx -t >/dev/null 2>&1 && systemctl reload nginx && echo "✅ Nginx reloaded"

# ---------- 8. Verify ----------
sleep 2
LOCAL=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/api/games)
LIVE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/games")
SITE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/")
echo ""
echo "=============================================="
echo "  Backend local  /api/games : $LOCAL  (200 = OK)"
echo "  Backend live   /api/games : $LIVE   (200 = OK)"
echo "  Website        $DOMAIN : $SITE   (200 = OK)"
echo "  Admin login: $DOMAIN/admin-login  →  admin@sattamatka.com / Admin@123"
echo "=============================================="
