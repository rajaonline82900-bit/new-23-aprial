"""Tests for simplified auth: register-mobile, login (mobile+password), forgot-password, admin login.
Iteration 19 - removed OTP/Google from UI; backend endpoints still exist for legacy.
"""
import os
import jwt as pyjwt
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matka-numbers-bet.preview.emergentagent.com").rstrip("/")
TEST_PHONE = "9870012345"
TEST_PASSWORD = "Test@1234"
TEST_NAME = "AuthTest"
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_user():
    """Ensure clean state for test phone before/after"""
    import asyncio
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _del():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        await c.users.delete_many({"phone": TEST_PHONE})

    asyncio.run(_del())
    yield
    # keep user after run for FE testing


# === Register-mobile tests ===
class TestRegisterMobile:
    def test_register_short_name(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register-mobile",
                         json={"name": "A", "phone": TEST_PHONE, "password": TEST_PASSWORD})
        assert r.status_code == 400, r.text

    def test_register_bad_phone(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register-mobile",
                         json={"name": TEST_NAME, "phone": "12345", "password": TEST_PASSWORD})
        assert r.status_code == 400, r.text

    def test_register_short_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register-mobile",
                         json={"name": TEST_NAME, "phone": TEST_PHONE, "password": "abc"})
        assert r.status_code == 400, r.text

    def test_register_success(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register-mobile",
                         json={"name": TEST_NAME, "phone": TEST_PHONE, "password": TEST_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["phone"] == TEST_PHONE
        assert data["name"] == TEST_NAME
        assert data["role"] == "user"

        # Verify JWT exp ~ 365 days
        payload = pyjwt.decode(data["token"], options={"verify_signature": False})
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        delta_days = (exp - datetime.now(timezone.utc)).days
        assert 360 <= delta_days <= 366, f"JWT exp days={delta_days}, expected ~365"

        # Verify /auth/me works with token
        me = session.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {data['token']}"})
        assert me.status_code == 200, me.text
        assert me.json()["phone"] == TEST_PHONE

    def test_register_duplicate(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register-mobile",
                         json={"name": TEST_NAME, "phone": TEST_PHONE, "password": TEST_PASSWORD})
        assert r.status_code == 400, r.text


# === Login (phone+password) ===
class TestLogin:
    def test_login_success(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"phone": TEST_PHONE, "password": TEST_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["phone"] == TEST_PHONE
        # JWT 365 days
        payload = pyjwt.decode(data["token"], options={"verify_signature": False})
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        delta_days = (exp - datetime.now(timezone.utc)).days
        assert 360 <= delta_days <= 366

    def test_login_wrong_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"phone": TEST_PHONE, "password": "WrongPass1"})
        assert r.status_code == 401, r.text

    def test_login_unknown_phone(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"phone": "9999999999", "password": "Whatever1"})
        assert r.status_code == 401, r.text


# === Admin login ===
class TestAdminLogin:
    def test_admin_login_success(self, session):
        r = session.post(f"{BASE_URL}/api/auth/admin/login",
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "admin"
        assert "token" in data

    def test_admin_login_wrong_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/admin/login",
                         json={"email": ADMIN_EMAIL, "password": "WrongPass"})
        assert r.status_code == 401


# === Forgot password flow ===
class TestForgotPassword:
    def test_send_otp_unknown_phone(self, session):
        r = session.post(f"{BASE_URL}/api/auth/password/send-otp",
                         json={"phone": "9999999998"})
        assert r.status_code == 400

    def test_send_otp_success(self, session):
        r = session.post(f"{BASE_URL}/api/auth/password/send-otp",
                         json={"phone": TEST_PHONE})
        assert r.status_code == 200, r.text

    def test_reset_with_wrong_otp(self, session):
        # ensure send first
        session.post(f"{BASE_URL}/api/auth/password/send-otp", json={"phone": TEST_PHONE})
        r = session.post(f"{BASE_URL}/api/auth/password/reset",
                         json={"phone": TEST_PHONE, "otp": "0000", "new_password": "NewPass@123"})
        # 400 for wrong otp (we don't know correct OTP)
        assert r.status_code == 400

    def test_reset_with_correct_otp(self, session):
        # Get OTP from in-memory store via direct import
        import sys
        sys.path.insert(0, "/app/backend")
        from config import otp_store
        # Trigger send so backend stores OTP
        session.post(f"{BASE_URL}/api/auth/password/send-otp", json={"phone": TEST_PHONE})
        # NOTE: otp_store here is local process, server has its own. Skip if not present.
        key = f"reset_{TEST_PHONE}"
        if key not in otp_store:
            pytest.skip("OTP store is in server process; cannot read OTP from test process")
        otp = otp_store[key]["otp"]
        r = session.post(f"{BASE_URL}/api/auth/password/reset",
                         json={"phone": TEST_PHONE, "otp": otp, "new_password": TEST_PASSWORD})
        assert r.status_code == 200
