"""Backend tests for OTP signup/login + Google session + Admin login (iteration 17)."""
import os
import re
import time
import subprocess
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to backend env
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

LOG_FILES = ["/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"]


def fetch_otp_from_logs(pattern_phone: str, prefix: str = "OTP for"):
    """Read backend logs and return latest OTP for phone."""
    pat = re.compile(rf"{prefix} {pattern_phone}: (\d{{4}})")
    latest = None
    for lf in LOG_FILES:
        try:
            out = subprocess.check_output(["tail", "-n", "500", lf], text=True, stderr=subprocess.DEVNULL)
            for m in pat.finditer(out):
                latest = m.group(1)
        except Exception:
            continue
    return latest


# ------------------ Google session endpoint ------------------
class TestGoogleSession:
    def test_google_session_missing(self):
        r = requests.post(f"{BASE_URL}/api/auth/google/session", json={})
        assert r.status_code == 400
        assert "session_id" in r.json().get("detail", "").lower()

    def test_google_session_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/google/session", json={"session_id": "invalid_xxx_zzz"})
        assert r.status_code == 401
        assert "invalid" in r.json().get("detail", "").lower()


# ------------------ OTP signup flow ------------------
SIGNUP_PHONE = f"98765{int(time.time()) % 100000:05d}"


class TestOtpSignup:
    def test_otp_send(self):
        r = requests.post(f"{BASE_URL}/api/auth/otp/send", json={"phone": SIGNUP_PHONE, "name": "TEST_OtpUser"})
        assert r.status_code == 200, r.text
        assert "OTP" in r.json().get("message", "")

    def test_otp_send_short_phone(self):
        r = requests.post(f"{BASE_URL}/api/auth/otp/send", json={"phone": "12345", "name": "X"})
        assert r.status_code == 400

    def test_otp_verify_and_complete_signup(self):
        time.sleep(1)
        otp = fetch_otp_from_logs(SIGNUP_PHONE, "OTP for")
        assert otp, f"No OTP found in logs for {SIGNUP_PHONE}"

        # Verify
        r = requests.post(f"{BASE_URL}/api/auth/otp/verify", json={"phone": SIGNUP_PHONE, "otp": otp})
        assert r.status_code == 200, r.text
        assert r.json().get("phone_verified") is True

        # Complete signup
        r = requests.post(f"{BASE_URL}/api/auth/otp/complete-signup",
                          json={"phone": SIGNUP_PHONE, "name": "TEST_OtpUser"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("token")
        assert data.get("phone") == SIGNUP_PHONE
        assert data.get("role") == "user"

    def test_existing_phone_signup_fails(self):
        # Same phone now exists; try signup again
        r1 = requests.post(f"{BASE_URL}/api/auth/otp/send", json={"phone": SIGNUP_PHONE, "name": "TEST_Dup"})
        assert r1.status_code == 200
        time.sleep(1)
        otp = fetch_otp_from_logs(SIGNUP_PHONE, "OTP for")
        assert otp
        r2 = requests.post(f"{BASE_URL}/api/auth/otp/verify", json={"phone": SIGNUP_PHONE, "otp": otp})
        assert r2.status_code == 200
        r3 = requests.post(f"{BASE_URL}/api/auth/otp/complete-signup",
                           json={"phone": SIGNUP_PHONE, "name": "TEST_Dup"})
        assert r3.status_code == 400
        assert "रजिस्टर्ड" in r3.json().get("detail", "") or "register" in r3.json().get("detail", "").lower()


# ------------------ OTP login flow ------------------
class TestOtpLogin:
    def test_login_otp_send_unregistered(self):
        # Use a definitely-unregistered phone
        unreg = "9000000001"
        r = requests.post(f"{BASE_URL}/api/auth/login-otp/send", json={"phone": unreg})
        assert r.status_code == 400

    def test_login_otp_send_and_verify_registered(self):
        # SIGNUP_PHONE was registered in previous class - rely on test ordering
        r = requests.post(f"{BASE_URL}/api/auth/login-otp/send", json={"phone": SIGNUP_PHONE})
        assert r.status_code == 200, r.text

        time.sleep(1)
        otp = fetch_otp_from_logs(SIGNUP_PHONE, "Login OTP for")
        assert otp, f"No login OTP found for {SIGNUP_PHONE}"

        r = requests.post(f"{BASE_URL}/api/auth/login-otp/verify", json={"phone": SIGNUP_PHONE, "otp": otp})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("token")
        assert data.get("phone") == SIGNUP_PHONE


# ------------------ Admin login regression ------------------
class TestAdminLogin:
    def test_admin_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                          json={"email": "admin@sattamatka.com", "password": "Admin@123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("role") == "admin"
        assert data.get("token")

    def test_admin_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                          json={"email": "admin@sattamatka.com", "password": "wrong"})
        assert r.status_code == 401
