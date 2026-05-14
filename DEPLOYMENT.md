# MATKA11 — Self-Hosted Deployment Guide

Complete React + FastAPI + MongoDB Satta Matka application.

---

## ⚠️ IMPORTANT — Hostinger Plan ki Confirmation

**Aapki app FastAPI (Python) + MongoDB pe chalti hai.**

| Hostinger Plan | Python Support | MongoDB Support | Recommended? |
|---|---|---|---|
| Shared Hosting (Premium/Business) | ❌ Nahi | ❌ Nahi | ❌ NAHI CHALEGA |
| Cloud Hosting | ❌ Nahi (PHP only) | ❌ Nahi | ❌ NAHI CHALEGA |
| **VPS Hosting (KVM 2 ya zyada)** | ✅ Haan (full root) | ✅ Haan (install karna padega) | ✅ **SAHI OPTION** |

**Hostinger pe `VPS` ya `KVM` plan lijiye.** Minimum specs: **2 GB RAM, 2 vCPU, 50 GB disk, Ubuntu 22.04 LTS**.

Agar VPS nahi hai to **Railway.app / Render.com** bahut easy hain — App.zip wahaan bhi deploy ho jayega.

---

## 📦 Folder Structure

```
matka11/
├── backend/                  # FastAPI Python backend
│   ├── server.py             # Main entry
│   ├── routes/               # API endpoints
│   ├── auth.py               # JWT + hashing
│   ├── database.py           # MongoDB connection
│   ├── config.py             # Settings
│   ├── helpers.py
│   ├── models.py
│   ├── notifications.py
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variables template
├── frontend/                 # React frontend
│   ├── public/               # Static files (APK, icons, manifest)
│   ├── src/                  # React source
│   ├── package.json
│   └── .env.example
├── DEPLOYMENT.md             # This file
└── README.md                 # Project intro
```

---

## 🚀 Step-by-Step Deployment on Hostinger VPS

### Prerequisites
- Hostinger **VPS plan** (KVM 2 ya zyada)
- SSH access to VPS
- Domain `matka11.online` ka A-record VPS ki IP pe point kiya hua
- Production database dump (`mongodump` from Emergent support@emergent.sh)

---

### **STEP 1: VPS Login + Basic Setup**

```bash
# SSH login
ssh root@<your-vps-ip>

# Update system
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git nginx ufw certbot python3-certbot-nginx unzip

# Firewall basic config
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

### **STEP 2: Install Python 3.11 + Node.js 20 + Yarn + MongoDB**

```bash
# Python 3.11
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python3.11 python3.11-venv python3-pip

# Node.js 20 (for frontend build)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Yarn
npm install -g yarn

# MongoDB 7.0
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl enable --now mongod

# Verify
mongod --version
python3.11 --version
node --version
```

---

### **STEP 3: Extract Project Code**

```bash
mkdir -p /var/www
cd /var/www
unzip /path/to/matka11.zip -d matka11
cd matka11
```

---

### **STEP 4: Backend Setup**

```bash
cd /var/www/matka11/backend

# Python venv
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install emergentintegrations (for Stripe + LLM if used)
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# Create .env file
cp .env.example .env
nano .env   # Fill in all values from support@emergent.sh
```

**Required env values:**
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="matka11"
CORS_ORIGINS="https://matka11.online"
JWT_SECRET="<get from support>"
ADMIN_EMAIL="admin@sattamatka.com"
ADMIN_PASSWORD="<your secure password>"
FRONTEND_URL="https://matka11.online"
IMB_API_TOKEN="<get from support or your own IMB account>"
IMB_API_URL="https://secure.imb.org.in"
VAPID_PUBLIC_KEY="<get from support>"
VAPID_PRIVATE_KEY="<get from support>"
DVHOSTING_API_KEY="<your DVHosting key>"
DVHOSTING_API_URL="https://dvhosting.in/api-sms-v3.php"
NEW_MATKA_API_URL="https://matkaapi.com/apis/market_api.php"
NEW_MATKA_API_KEY="69ff0e2b3e4f2"
NEW_MATKA_DOMAIN_KEY="55d387a3a33ffee9f05bd6d8e415f636"
NEW_MATKA_DOMAIN="matka11.online"
RESULT_WEBHOOK_SECRET="m11hook_a8c4f2e9b3d1"
PRODUCTION_URL="https://matka11.online"
```

---

### **STEP 5: Restore MongoDB Database**

Support team se aaye dump (`.bson` files) ko restore karein:

```bash
# Assume dump folder is at /tmp/dump/
cd /tmp
mongorestore --db matka11 /tmp/dump/<db_name>/

# Verify
mongo matka11 --eval "db.users.countDocuments()"
mongo matka11 --eval "db.results.countDocuments()"
mongo matka11 --eval "db.games.countDocuments()"
```

---

### **STEP 6: Frontend Build**

```bash
cd /var/www/matka11/frontend

# Install dependencies
yarn install

# Create .env
echo 'REACT_APP_BACKEND_URL=https://matka11.online' > .env

# Build production assets
yarn build

# Build folder will be at /var/www/matka11/frontend/build/
```

---

### **STEP 7: Run Backend with systemd (auto-start on reboot)**

```bash
nano /etc/systemd/system/matka11-backend.service
```

Paste:
```ini
[Unit]
Description=MATKA11 FastAPI Backend
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/matka11/backend
EnvironmentFile=/var/www/matka11/backend/.env
ExecStart=/var/www/matka11/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Save (Ctrl+O, Enter, Ctrl+X), then:
```bash
systemctl daemon-reload
systemctl enable --now matka11-backend
systemctl status matka11-backend
```

---

### **STEP 8: Nginx Reverse Proxy + SSL**

```bash
nano /etc/nginx/sites-available/matka11
```

Paste:
```nginx
server {
    listen 80;
    server_name matka11.online www.matka11.online;

    client_max_body_size 50M;

    # Frontend static files
    location / {
        root /var/www/matka11/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }

    # APK download
    location /matka11.apk {
        root /var/www/matka11/frontend/build;
        add_header Content-Type application/vnd.android.package-archive;
        add_header Content-Disposition 'attachment; filename="Matka11.apk"';
    }
}
```

Enable + SSL:
```bash
ln -s /etc/nginx/sites-available/matka11 /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# SSL via Let's Encrypt
certbot --nginx -d matka11.online -d www.matka11.online
# Email + Y + Y prompts ko follow karein
```

---

### **STEP 9: Verify Everything**

```bash
# Backend running?
curl http://localhost:8001/api/games

# Frontend serving?
curl -I https://matka11.online

# Production live?
# Browser me: https://matka11.online open karein
```

---

## 🔁 Update / Redeploy Process

Code update karne par:
```bash
cd /var/www/matka11

# Backend updates
cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart matka11-backend

# Frontend updates
cd ../frontend
yarn install
yarn build
# Nginx automatic serve karega — restart nahi chahiye
```

---

## 🛠️ Common Issues

### Issue: Backend `502 Bad Gateway`
- `systemctl status matka11-backend` check karein
- Logs: `journalctl -u matka11-backend -n 100`
- Port 8001 busy ho to: `lsof -i :8001`

### Issue: MongoDB connection error
- `systemctl status mongod`
- `mongod` logs: `/var/log/mongodb/mongod.log`

### Issue: Frontend white screen
- `yarn build` re-run karein
- `chrome devtools` console errors check karein
- `REACT_APP_BACKEND_URL` correct hai check karein

### Issue: Auto-result nahi aa raha
- matkaapi.com pe IP whitelist karein VPS ki IP add karke
- OR webhook URL set karein: `https://matka11.online/api/results/webhook/m11hook_a8c4f2e9b3d1`

### Issue: SSL renewal
- Auto-renew enabled by certbot, but manual: `certbot renew`

---

## 📞 Required Third-Party Services (already configured in env vars)

| Service | Purpose | Where to get |
|---|---|---|
| **DVHosting** | SMS OTP | dvhosting.in |
| **IMB Payment** | UPI deposits | secure.imb.org.in |
| **matkaapi.com** | Auto results | matkaapi.com (already setup) |
| **VAPID** | Push notifications | Generated locally (web-push package) |

Sab keys aapke `support@emergent.sh` email response me milengi.

---

## 💾 Backup Strategy (recommended)

Daily MongoDB backup cron:
```bash
nano /etc/cron.daily/matka11-backup
```
```bash
#!/bin/bash
mkdir -p /backups
mongodump --db matka11 --out /backups/$(date +%Y%m%d)
find /backups -mtime +30 -exec rm -rf {} \;
```
```bash
chmod +x /etc/cron.daily/matka11-backup
```

---

## ✅ Final Checklist

- [ ] VPS up and running with Ubuntu 22.04
- [ ] Python 3.11 + Node.js 20 + MongoDB installed
- [ ] Code unzipped at `/var/www/matka11`
- [ ] Backend `.env` filled with values from support
- [ ] Frontend `.env` has correct `REACT_APP_BACKEND_URL`
- [ ] MongoDB dump restored
- [ ] systemd service running (`matka11-backend`)
- [ ] Nginx configured + SSL certificate active
- [ ] Domain DNS pointing to VPS IP
- [ ] Site loads at https://matka11.online
- [ ] Admin login works (admin@sattamatka.com)
- [ ] Test user signup + login works
- [ ] Deposit scanner loads
- [ ] Daily MongoDB backup cron set up

---

## 🆘 Need Help?

- Hostinger VPS docs: https://support.hostinger.com/en/categories/4525942-vps-hosting
- FastAPI deployment: https://fastapi.tiangolo.com/deployment/
- MongoDB Atlas (managed alternative): https://www.mongodb.com/atlas

**Good luck with your migration! 🚀**
