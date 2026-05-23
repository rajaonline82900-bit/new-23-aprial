#!/bin/bash
# MATKA11 — One-Click VPS Setup Script
# Tested on: Ubuntu 22.04 LTS (Hostinger VPS, DigitalOcean, AWS EC2, etc.)
#
# Usage:
#   chmod +x setup.sh
#   sudo ./setup.sh <your-domain.com>
#
# Example:
#   sudo ./setup.sh matka11.online

set -e

DOMAIN=${1:-}
if [ -z "$DOMAIN" ]; then
  echo "❌ Usage: sudo ./setup.sh <your-domain.com>"
  exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "  MATKA11 One-Click VPS Setup"
echo "  Domain: $DOMAIN"
echo "════════════════════════════════════════"
echo ""

# ============================================
# STEP 1: System update + essentials
# ============================================
echo "📦 [1/8] Updating system + installing essentials..."
apt update -qq
apt install -y -qq curl wget git nginx ufw unzip software-properties-common gnupg

# ============================================
# STEP 2: Python 3.11
# ============================================
echo "🐍 [2/8] Installing Python 3.11..."
add-apt-repository ppa:deadsnakes/ppa -y > /dev/null 2>&1
apt update -qq
apt install -y -qq python3.11 python3.11-venv python3-pip

# ============================================
# STEP 3: Node.js 20 + Yarn
# ============================================
echo "📗 [3/8] Installing Node.js 20 + Yarn..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt install -y -qq nodejs
npm install -g yarn > /dev/null 2>&1

# ============================================
# STEP 4: MongoDB 7.0
# ============================================
echo "🍃 [4/8] Installing MongoDB 7.0..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update -qq
apt install -y -qq mongodb-org
systemctl enable --now mongod
sleep 3

# ============================================
# STEP 5: Backend setup
# ============================================
echo "⚙️  [5/8] Setting up backend (FastAPI)..."
cd /var/www/matka11/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
pip install --quiet python-dotenv  # for seed script

# Create .env if not present
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate random secrets
  JWT_SECRET=$(openssl rand -hex 32)
  WEBHOOK_SECRET=$(openssl rand -hex 16)
  sed -i "s|CHANGE_THIS_TO_LONG_RANDOM_STRING|$JWT_SECRET|g" .env
  sed -i "s|CHANGE_THIS_RANDOM_STRING|$WEBHOOK_SECRET|g" .env
  sed -i "s|https://matka11.online|https://$DOMAIN|g" .env
  echo "   ✓ .env created with random secrets"
fi

# Seed database (admin + games + settings)
echo "🌱 Seeding database (admin user + games + settings)..."
python seed_db.py
deactivate

# ============================================
# STEP 6: Frontend build
# ============================================
echo "🎨 [6/8] Building frontend (React)..."
cd /var/www/matka11/frontend
echo "REACT_APP_BACKEND_URL=https://$DOMAIN" > .env
yarn install --silent
yarn build > /dev/null 2>&1

# ============================================
# STEP 7: systemd service for backend
# ============================================
echo "🔧 [7/8] Creating systemd service..."
cat > /etc/systemd/system/matka11.service <<EOF
[Unit]
Description=MATKA11 FastAPI Backend
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/matka11/backend
EnvironmentFile=/var/www/matka11/backend/.env
ExecStart=/var/www/matka11/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now matka11

# ============================================
# STEP 8: Nginx + SSL
# ============================================
echo "🌐 [8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/matka11 <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 50M;

    location / {
        root /var/www/matka11/frontend/build;
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/matka11 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Firewall
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1

# Install certbot for SSL
apt install -y -qq certbot python3-certbot-nginx

echo ""
echo "════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE!"
echo "════════════════════════════════════════"
echo ""
echo "  📍 Your app should be live at: http://$DOMAIN"
echo ""
echo "  Admin Login:"
echo "    URL:      http://$DOMAIN/admin-login"
echo "    Email:    admin@sattamatka.com"
echo "    Password: Admin@123"
echo ""
echo "  Backend service:"
echo "    Status:   systemctl status matka11"
echo "    Logs:     journalctl -u matka11 -f"
echo "    Restart:  systemctl restart matka11"
echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📌 NEXT STEPS:"
echo "  1. Point DNS A-record of $DOMAIN to this server IP"
echo "  2. Enable HTTPS: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Login to admin panel and CHANGE THE PASSWORD"
echo "  4. Edit /var/www/matka11/backend/.env to add:"
echo "     - IMB_API_TOKEN (UPI payments)"
echo "     - DVHOSTING_API_KEY (SMS OTP)"
echo "     - VAPID keys (push notifications)"
echo "  5. Restart backend: systemctl restart matka11"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
