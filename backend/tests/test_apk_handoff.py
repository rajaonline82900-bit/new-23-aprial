"""Backend tests for APK auto-login handoff endpoints (iteration 23)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://matka-numbers-bet.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASS = "Admin@123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no access_token in admin login response: {data}"
    return tok


class TestApkHandoff:
    def test_create_handoff_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/auth/create-apk-handoff", json={}, timeout=15)
        assert r.status_code == 401, f"expected 401 without auth, got {r.status_code} {r.text}"

    def test_create_handoff_with_auth(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/auth/create-apk-handoff",
            json={},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        data = r.json()
        assert "handoff_token" in data and isinstance(data["handoff_token"], str)
        assert len(data["handoff_token"]) >= 16
        assert data.get("expires_in") == 600

    def test_redeem_handoff_success_then_replay_rejected(self, admin_token):
        # Create
        r = requests.post(
            f"{BASE_URL}/api/auth/create-apk-handoff",
            json={},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        token = r.json()["handoff_token"]

        # Redeem #1 - must succeed
        r2 = requests.post(
            f"{BASE_URL}/api/auth/redeem-apk-handoff",
            json={"handoff_token": token},
            timeout=15,
        )
        assert r2.status_code == 200, f"first redeem failed: {r2.status_code} {r2.text}"
        d2 = r2.json()
        assert "access_token" in d2 and isinstance(d2["access_token"], str)
        assert "id" in d2 and "role" in d2
        # Cookie set
        set_cookie = r2.headers.get("set-cookie", "")
        assert "access_token=" in set_cookie, f"missing access_token cookie: {set_cookie}"

        # Redeem #2 with same token - must fail (one-time)
        r3 = requests.post(
            f"{BASE_URL}/api/auth/redeem-apk-handoff",
            json={"handoff_token": token},
            timeout=15,
        )
        assert r3.status_code == 400, f"replay should be 400, got {r3.status_code} {r3.text}"
        assert "Invalid or expired" in r3.text

    def test_redeem_with_missing_token_returns_400(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/redeem-apk-handoff",
            json={},
            timeout=15,
        )
        assert r.status_code == 400

    def test_redeem_with_bogus_token_returns_400(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/redeem-apk-handoff",
            json={"handoff_token": "not_a_real_token_xxxxxxxxxxxxxxxx"},
            timeout=15,
        )
        assert r.status_code == 400
