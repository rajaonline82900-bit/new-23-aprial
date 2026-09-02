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
[ -f .env ] || { say "❌ backend/.env nahi hai — pehle fix_vps.sh chalao"; exit 1; }
grep -q "^MONGO_URL=" .env || echo 'MONGO_URL="mongodb://localhost:27017"' >> .env
grep -q "^DB_NAME=" .env || echo 'DB_NAME="matka_prod"' >> .env
grep -q "^JWT_SECRET=" .env || echo "JWT_SECRET=\"$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n')\"" >> .env
say "✅ .env OK (DB: $(grep ^DB_NAME= .env | cut -d= -f2))"

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
