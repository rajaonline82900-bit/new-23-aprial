"""Backend tests for the new matkaapi.com integration (iteration 18).
Covers:
- /api/admin/auto-fetch-debug (admin auth)
- /api/admin/results/auto-fetch (admin auth)
- /api/admin/results/auto-fetch-public (JWT secret auth)
- Admin login regression (Admin@123)
- Login OTP send regression (just verifies endpoint responds)
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matka-numbers-bet.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"


def _read_jwt_secret():
    path = "/app/backend/.env"
    with open(path) as f:
        for line in f:
            if line.startswith("JWT_SECRET"):
                # JWT_SECRET="..."
                m = re.match(r'JWT_SECRET\s*=\s*"?([^"\n]+)"?', line)
                if m:
                    return m.group(1).strip().strip('"')
    return ""


JWT_SECRET = _read_jwt_secret()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_session(session):
    """Login as admin and return session with cookie + token header."""
    r = session.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    return session


# ---------- Regression: Admin login ----------

class TestAdminLoginRegression:
    def test_admin_login_success(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("role") == "admin"
        assert data.get("email") == ADMIN_EMAIL
        assert isinstance(data.get("token"), str) and len(data["token"]) > 20

    def test_admin_login_wrong_password(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": "Wrong@123"},
            timeout=30,
        )
        assert r.status_code == 401


# ---------- New matkaapi.com integration ----------

class TestAutoFetchDebug:
    def test_requires_admin(self, session):
        # Use fresh session w/o auth
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/admin/auto-fetch-debug", timeout=30)
        assert r.status_code in (401, 403)

    def test_debug_endpoint_returns_expected_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/auto-fetch-debug", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expected keys
        for key in [
            "api_url",
            "api_key_set",
            "domain_key_set",
            "domain",
            "auto_fetch_running",
            "raw_responses",
            "fetch_result",
        ]:
            assert key in data, f"missing key {key}"
        assert data["api_url"] == "https://matkaapi.com/apis/market_api.php"
        assert data["api_key_set"] is True
        assert data["domain_key_set"] is True
        assert data["domain"] == "matka11.online"
        # raw_responses must contain gali_all and market_all
        assert "gali_all" in data["raw_responses"]
        assert "market_all" in data["raw_responses"]


class TestAutoFetchAdmin:
    def test_auto_fetch_does_not_500(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/results/auto-fetch", timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        for key in [
            "results_applied",
            "total",
            "skipped_existing",
            "api_results_count",
            "errors",
        ]:
            assert key in data, f"missing key {key} in {data}"
        assert isinstance(data["results_applied"], list)
        assert isinstance(data["errors"], list)
        # Since IP isn't whitelisted, errors should mention 'Update Your Ip'
        if data["errors"]:
            err_blob = " ".join(str(e) for e in data["errors"]).lower()
            assert "update your ip" in err_blob or "ip" in err_blob

    def test_auto_fetch_requires_admin(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/admin/results/auto-fetch", timeout=30)
        assert r.status_code in (401, 403)


class TestAutoFetchPublic:
    def test_correct_secret_returns_200(self, session):
        assert JWT_SECRET, "JWT_SECRET not loaded from .env"
        r = session.post(
            f"{BASE_URL}/api/admin/results/auto-fetch-public",
            json={"secret": JWT_SECRET},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for key in [
            "results_applied",
            "total",
            "skipped_existing",
            "api_results_count",
            "errors",
        ]:
            assert key in data

    def test_wrong_secret_returns_403(self, session):
        r = session.post(
            f"{BASE_URL}/api/admin/results/auto-fetch-public",
            json={"secret": "definitely-wrong-secret"},
            timeout=30,
        )
        assert r.status_code == 403

    def test_missing_secret_returns_403(self, session):
        r = session.post(
            f"{BASE_URL}/api/admin/results/auto-fetch-public",
            json={},
            timeout=30,
        )
        assert r.status_code == 403


# ---------- Regression: OTP-based signup/login flows respond ----------

class TestOtpFlows:
    def test_login_otp_send_responds(self, session):
        # Use an unregistered phone; endpoint should still return 4xx gracefully (not 500)
        r = session.post(
            f"{BASE_URL}/api/auth/login-otp/send",
            json={"phone": "9999999999"},
            timeout=30,
        )
        assert r.status_code in (200, 400, 404), f"unexpected: {r.status_code} {r.text}"

    def test_signup_register_mobile_validation(self, session):
        # Bad payload should yield 400, not 500
        r = session.post(
            f"{BASE_URL}/api/auth/register-mobile",
            json={"name": "X", "phone": "123", "password": "abc"},
            timeout=30,
        )
        assert r.status_code == 400
