# 🚀 MATKA11 — Quick Deploy Guide

**One-command deployment for any Ubuntu 22.04 VPS** (Hostinger VPS / DigitalOcean / Linode / AWS EC2).

⚠️ **IMPORTANT:** This app is **Python (FastAPI) + MongoDB**, not Node.js.
- ❌ Hostinger Shared/Cloud/Node.js hosting → **Will NOT work**
- ✅ Hostinger VPS (KVM 2+) → **Will work**
- ✅ Railway.app / Render.com → **Easiest** (recommended)

---

## ⚡ Option A: One-Click VPS Deploy (10 minutes)

**Requirements:** Ubuntu 22.04 LTS VPS with 2 GB RAM minimum.

### Step 1: SSH into your VPS
```bash
ssh root@<your-vps-ip>
```

### Step 2: Clone the code
```bash
cd /var/www
git clone https://github.com/<your-username>/<your-repo-name>.git matka11
cd matka11
```

### Step 3: Run the one-click setup
```bash
chmod +x setup.sh
sudo ./setup.sh yourdomain.com
```

That's it! Script will:
1. ✅ Install Python 3.11, Node.js 20, MongoDB 7.0, Nginx
2. ✅ Install backend dependencies + create venv
3. ✅ Generate random JWT_SECRET + webhook secret
4. ✅ **Create admin user** (email: `admin@sattamatka.com`, password: `Admin@123`)
5. ✅ **Seed 6 games** (Delhi Bazaar, Shri Ganesh, Faridabad, Ghaziabad, Gali, Disawar)
6. ✅ **Create database indexes** for performance
7. ✅ Build React frontend
8. ✅ Setup systemd service (auto-start on reboot)
9. ✅ Configure Nginx + firewall

### Step 4: Point DNS + Enable HTTPS
```bash
# On your domain registrar (GoDaddy, Hostinger, etc.):
# Add A record: yourdomain.com → <vps-ip>

# Then on the VPS:
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 5: Visit your site
- Frontend: `https://yourdomain.com`
- Admin Panel: `https://yourdomain.com/admin-login`
  - Email: `admin@sattamatka.com`
  - Password: `Admin@123` ← **CHANGE THIS IMMEDIATELY**

---

## 🗄️ Database — Auto-Created!

You don't need to manually create the database. The setup script will:

1. **Install MongoDB** locally on your VPS
2. **Create `matka11` database** automatically on first connect
3. **Seed initial data** via `python seed_db.py`:
   - 1 admin user
   - 6 games
   - Default app settings
   - Performance indexes

### Database Schema (auto-created collections):

| Collection | Purpose |
|---|---|
| `users` | All user accounts (admin + regular users) |
| `games` | 6 games configuration |
| `bets` | User bets (jodi, haruf, crossing) |
| `results` | Daily declared results |
| `transactions` | Deposits + withdrawals |
| `referrals` | Referral codes + rewards |
| `chat_messages` | Customer support chat |
| `push_subscriptions` | Web push notification endpoints |
| `settings` | App-wide settings |
| `notification_subscribers` | Telegram/WhatsApp opt-in |
| `help_messages` | Admin help posts |

### Sample MongoDB Schema (users collection):
```json
{
  "_id": ObjectId(),
  "name": "Test User",
  "phone": "9876543210",
  "email": "user@example.com",          // optional for password signups
  "password_hash": "$2b$12$...",
  "role": "user",                        // "user" or "admin"
  "balance": 0.0,
  "referral_code": "M11123456",
  "referred_by": "M11789012",            // optional
  "phone_verified": true,
  "auth_method": "password",             // "password" / "otp" / "google"
  "created_at": ISODate()
}
```

---

## 🔑 Optional: Add Third-Party Service Keys

Edit `/var/www/matka11/backend/.env` to enable:

```bash
sudo nano /var/www/matka11/backend/.env
```

| Variable | Purpose | Where to get |
|---|---|---|
| `IMB_API_TOKEN` | UPI deposits via IMB Gateway | imb.org.in |
| `DVHOSTING_API_KEY` | SMS OTP | dvhosting.in |
| `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Push notifications | `npx web-push generate-vapid-keys` |
| `NEW_MATKA_API_KEY` + `NEW_MATKA_DOMAIN_KEY` | Auto-result fetch | matkaapi.com |

After editing:
```bash
sudo systemctl restart matka11
```

---

## ⚡ Option B: Railway.app Deploy (Easiest, 5 minutes)

**For non-technical users** — Railway handles everything (Python + MongoDB + SSL + scaling).

### Step 1: Push to GitHub
```bash
cd matka11/
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to **https://railway.app** → Sign up with GitHub
2. **New Project** → **Deploy from GitHub repo** → Select your repo
3. Railway auto-detects Python — uses `backend/requirements.txt`
4. Add MongoDB plugin: **+ New** → **Database** → **MongoDB**
5. Set environment variables (Railway UI):
   ```
   MONGO_URL=<auto-injected by Railway MongoDB plugin>
   DB_NAME=matka11
   JWT_SECRET=<random 64-char string>
   ADMIN_EMAIL=admin@sattamatka.com
   ADMIN_PASSWORD=Admin@123
   FRONTEND_URL=https://<your-railway-domain>
   ```
6. Deploy frontend separately on **Vercel** or **Netlify** (point `REACT_APP_BACKEND_URL` to Railway URL)

---

## 🛠️ Troubleshooting

### Backend not starting?
```bash
sudo systemctl status matka11
sudo journalctl -u matka11 -n 50
```

### MongoDB not connecting?
```bash
sudo systemctl status mongod
mongosh   # test connection
```

### Frontend blank screen?
```bash
# Rebuild
cd /var/www/matka11/frontend
yarn build
sudo systemctl reload nginx
```

### Forgot admin password?
Run seed script again with new password:
```bash
cd /var/www/matka11/backend
source venv/bin/activate
ADMIN_PASSWORD="NewSecurePass123" python seed_db.py
```

---

## 📦 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Tailwind CSS + Shadcn UI |
| Backend | FastAPI (Python 3.11) + Motor (async MongoDB) |
| Database | MongoDB 7.0 |
| Web Server | Nginx (reverse proxy) |
| Process Manager | systemd |
| SSL | Let's Encrypt (certbot) |

---

## 🆘 Need Help?

- Detailed deployment: See `DEPLOYMENT.md`
- Project intro: See `README.md`
- Hostinger VPS docs: https://support.hostinger.com/en/categories/4525942-vps-hosting

**Good luck with your deployment! 🚀**
