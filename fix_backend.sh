#!/usr/bin/env bash
# Backend-only repair: finds why port 8001 is down, fixes deps/service, restarts, verifies.
set -u
REPO_DIR="${REPO_DIR:-/var/www/new-23-aprial}"
DOMAIN="${DOMAIN:-https://m11cloube.in}"
BE="$REPO_DIR/backend"
LOG=/tmp/backend_fix.log
: > "$LOG"
say(){ echo "$1" | tee -a "$LOG"; }

say "== BACKEND REPAIR =="
[ -d "$BE" ] || { say "❌ $BE nahi mila"; exit 1; }
cd "$BE"

# 1. Which port does nginx send /api to?
PORT=$(grep -rhoE "proxy_pass\s+http://[^;]+" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -oE ":[0-9]+" | head -1 | tr -d ':')
[ -z "$PORT" ] && PORT=8001
say "✅ nginx → backend port $PORT"

# 2. Stop everything that may hold the port / old runners
for s in $(systemctl list-unit-files --type=service 2>/dev/null | awk '/matka|backend/ {print $1}'); do systemctl stop "$s" >/dev/null 2>&1; done
pm2 delete all >/dev/null 2>&1 || true
supervisorctl stop all >/dev/null 2>&1 || true
fuser -k "$PORT"/tcp >/dev/null 2>&1 || true
sleep 1

# 3. venv + deps (loud on failure)
[ -x venv/bin/python ] || python3 -m venv venv
PY="$BE/venv/bin/python"
"$PY" -m pip install -q --upgrade pip >/dev/null 2>&1 || true
if ! "$PY" -m pip install -q -r requirements.txt >>"$LOG" 2>&1; then
  say "⚠️  pip install me kuch fail hua — retry (no version pins)…"
  sed 's/[=<>~!].*//' requirements.txt | grep -v '^\s*$' | grep -v '^#' > /tmp/req_loose.txt
  "$PY" -m pip install -q -r /tmp/req_loose.txt >>"$LOG" 2>&1 || true
fi
"$PY" -m pip install -q uvicorn fastapi motor pymongo python-dotenv >>"$LOG" 2>&1 || true
say "✅ Python deps installed"

# 4. .env sanity
touch .env
# force-set KEY if missing OR empty
force(){ v=$(grep "^$1=" .env | cut -d= -f2- | tr -d '"'"'" ); if [ -z "$v" ]; then sed -i "/^$1=/d" .env; echo "$1=\"$2\"" >> .env; fi; }
DBN=$("$PY" - <<'PYEOF' 2>/dev/null
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
[ -z "$DBN" ] && DBN="matka_prod"
force MONGO_URL "mongodb://localhost:27017"
force DB_NAME "$DBN"
force JWT_SECRET "$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n')"
force CORS_ORIGINS "*"
force FRONTEND_URL "$DOMAIN"
force TRUSTOPE_API_TOKEN "2d7c4102e2be80b8ce3412cd0c7de211"
force TRUSTOPE_API_URL "https://trustope.com"
force IMB_API_URL "https://secure-stage.imb.org.in"
# Sync build version with the frontend bundle → stops WebView reload loop / "update" banner
FEV=$(grep -oE "APP_BUILD_VERSION = '[^']+'" "$REPO_DIR/frontend/src/utils/versionCheck.js" 2>/dev/null | cut -d"'" -f2)
if [ -n "$FEV" ]; then sed -i "/^APP_BUILD_VERSION=/d" .env; echo "APP_BUILD_VERSION=\"$FEV\"" >> .env; say "✅ Build version synced → $FEV"; fi
say "✅ .env OK (DB: $(grep ^DB_NAME= .env | cut -d= -f2))"

# Nginx: never cache index.html (old cached HTML → missing JS chunks → blank app) + allow 50MB uploads (chat photos/voice)
NGX=$(grep -rl "proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null | head -1)
if [ -n "$NGX" ] && ! grep -q "client_max_body_size" "$NGX"; then
  cp "$NGX" "$NGX.bak.$(date +%s)"
  sed -i '0,/server_name/s||client_max_body_size 50M;\n    server_name|' "$NGX"
  if nginx -t >/dev/null 2>&1; then say "✅ Nginx upload limit 50M set"; else cp "$(ls -t $NGX.bak.* | head -1)" "$NGX"; say "⚠️  nginx body-size edit reverted"; fi
fi
if [ -n "$NGX" ] && ! grep -q "no-store" "$NGX"; then
  cp "$NGX" "$NGX.bak.$(date +%s)"
  sed -i '0,/try_files \$uri \/index.html;/s||try_files $uri /index.html;\n        add_header Cache-Control "no-store, no-cache, must-revalidate" always;|' "$NGX"
  if nginx -t >/dev/null 2>&1; then say "✅ Nginx no-cache for HTML added"; else cp "$(ls -t $NGX.bak.* | head -1)" "$NGX"; say "⚠️  nginx edit reverted"; fi
fi

# Nginx: APK direct download block (/shivshakti.apk → forces download with proper type)
if [ -n "$NGX" ] && ! grep -q "shivshakti.apk" "$NGX"; then
  ROOTDIR=$(grep -oE "root\s+[^;]+" "$NGX" | head -1 | awk '{print $2}')
  [ -z "$ROOTDIR" ] && ROOTDIR="$REPO_DIR/frontend/build"
  cp "$NGX" "$NGX.bak.$(date +%s)"
  sed -i "0,/location \/api\//s||location = /shivshakti.apk {\n        root $ROOTDIR;\n        default_type application/vnd.android.package-archive;\n        add_header Content-Disposition 'attachment; filename=\"ShivShakti.apk\"';\n        add_header Cache-Control \"no-store\" always;\n    }\n\n    location /api/|" "$NGX"
  if nginx -t >/dev/null 2>&1; then say "✅ Nginx APK download route added"; else cp "$(ls -t $NGX.bak.* | head -1)" "$NGX"; say "⚠️  nginx apk edit reverted"; fi
fi

# 5. MongoDB running?
if ! systemctl is-active --quiet mongod 2>/dev/null; then
  systemctl start mongod >/dev/null 2>&1 || true
  sleep 2
fi
systemctl is-active --quiet mongod && say "✅ MongoDB running" || say "⚠️  mongod service inactive (agar Mongo alag tarike se chal raha hai to ignore)"

# 6. Import test — real error dikhao
say "🔍 Backend import test…"
if ! "$PY" -c "import server" >/tmp/import_err.txt 2>&1; then
  say "❌ Backend import FAIL — error:"
  tail -25 /tmp/import_err.txt | tee -a "$LOG"
  MISSING=$(grep -oE "No module named '[^']+'" /tmp/import_err.txt | head -1 | sed "s/No module named '//;s/'//" | cut -d. -f1)
  if [ -n "$MISSING" ]; then
    say "📦 Missing module '$MISSING' install kar raha hoon…"
    "$PY" -m pip install -q "$MISSING" >>"$LOG" 2>&1 || true
    "$PY" -c "import server" >/tmp/import_err.txt 2>&1 && say "✅ Import ab OK" || { say "❌ Abhi bhi fail:"; tail -15 /tmp/import_err.txt; exit 1; }
  else
    exit 1
  fi
else
  say "✅ Backend import OK"
fi

# 7. Write clean systemd service on correct port
SVC=matka-backend
cat > /etc/systemd/system/$SVC.service <<EOF
[Unit]
Description=Shiv Shakti Club Backend
After=network.target mongod.service

[Service]
User=root
WorkingDirectory=$BE
EnvironmentFile=$BE/.env
ExecStart=$BE/venv/bin/uvicorn server:app --host 0.0.0.0 --port $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
for s in $(systemctl list-unit-files --type=service 2>/dev/null | awk '/matka|backend/ {print $1}' | grep -v "^$SVC.service"); do systemctl disable "$s" >/dev/null 2>&1; done
systemctl daemon-reload
systemctl enable $SVC >/dev/null 2>&1
systemctl restart $SVC
sleep 6

if systemctl is-active --quiet $SVC; then
  say "✅ Service $SVC running on port $PORT"
else
  say "❌ Service start fail — logs:"
  journalctl -u $SVC -n 40 --no-pager | tee -a "$LOG"
  exit 1
fi

systemctl reload nginx >/dev/null 2>&1 || true
sleep 2
L=$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/games)
W=$(curl -s -m 15 -o /dev/null -w '%{http_code}' $DOMAIN/api/games)
say "=============================================="
say "  Backend local : $L  (200 = OK)"
say "  Backend live  : $W  (200 = OK)"
say "  Admin login   : $DOMAIN/admin-login → admin@sattamatka.com / Admin@123"
say "=============================================="
[ "$L" = "200" ] || { say "Last 30 log lines:"; journalctl -u $SVC -n 30 --no-pager; }
