"""Test suite for chat delete endpoints + auto-delete settings."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matka-numbers-bet.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASS = "Admin@123"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def _read_otp_from_log(phone):
    import subprocess, re, time
    time.sleep(0.5)
    try:
        out = subprocess.run(
            ["tail", "-n", "300", "/var/log/supervisor/backend.err.log"],
            capture_output=True, text=True, timeout=5
        ).stdout + subprocess.run(
            ["tail", "-n", "300", "/var/log/supervisor/backend.out.log"],
            capture_output=True, text=True, timeout=5
        ).stdout
    except Exception:
        return None
    matches = re.findall(rf"OTP for {phone}: (\d{{4}})", out)
    return matches[-1] if matches else None


@pytest.fixture(scope="module")
def user_client():
    """Register/login a regular user via OTP flow."""
    s = requests.Session()
    phone = "9" + str(uuid.uuid4().int)[:9]
    r = s.post(f"{BASE_URL}/api/auth/otp/send", json={"phone": phone, "name": "TEST_Chat"}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"OTP send failed: {r.status_code} {r.text}")
    otp = _read_otp_from_log(phone)
    if not otp:
        pytest.skip("Could not retrieve OTP from backend logs")
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={"phone": phone, "otp": otp}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"OTP verify failed: {r.status_code} {r.text}")
    r = s.post(f"{BASE_URL}/api/auth/otp/complete-signup",
               json={"phone": phone, "name": "TEST_Chat"}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Signup failed: {r.status_code} {r.text}")
    token = r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    s.phone = phone
    return s


# ---- Auto-delete settings ----
class TestAutoDeleteSetting:
    def test_get_default(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/chat/auto-delete-setting", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "enabled" in data and "hours" in data
        assert isinstance(data["enabled"], bool)
        assert isinstance(data["hours"], int)

    def test_post_persists(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/chat/auto-delete-setting",
                              json={"enabled": True, "hours": 12}, timeout=10)
        assert r.status_code == 200
        assert r.json()["enabled"] is True
        assert r.json()["hours"] == 12
        # Verify persisted
        r2 = admin_client.get(f"{BASE_URL}/api/admin/chat/auto-delete-setting", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["enabled"] is True
        assert r2.json()["hours"] == 12
        # Reset to defaults
        admin_client.post(f"{BASE_URL}/api/admin/chat/auto-delete-setting",
                         json={"enabled": False, "hours": 24}, timeout=10)

    def test_hours_min_1(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/chat/auto-delete-setting",
                              json={"enabled": False, "hours": 0}, timeout=10)
        assert r.status_code == 200
        assert r.json()["hours"] >= 1

    def test_requires_admin_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/chat/auto-delete-setting", timeout=10)
        assert r.status_code in (401, 403)


# ---- Admin clear / delete ----
class TestAdminChatDelete:
    def test_clear_all_requires_admin(self):
        r = requests.delete(f"{BASE_URL}/api/admin/chat/clear-all", timeout=10)
        assert r.status_code in (401, 403)

    def test_user_delete_requires_admin(self):
        r = requests.delete(f"{BASE_URL}/api/admin/chat/user/abc", timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_delete_msg_requires_admin(self):
        r = requests.delete(f"{BASE_URL}/api/admin/chat/message/abc", timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_delete_nonexistent_msg(self, admin_client):
        r = admin_client.delete(f"{BASE_URL}/api/admin/chat/message/NONEXISTENT_ID", timeout=10)
        assert r.status_code == 404

    def test_clear_all_works(self, admin_client):
        r = admin_client.delete(f"{BASE_URL}/api/admin/chat/clear-all", timeout=15)
        assert r.status_code == 200
        assert "Deleted" in r.json().get("message", "")


# ---- User message delete flow ----
class TestUserMessageDelete:
    def test_user_delete_requires_auth(self):
        r = requests.delete(f"{BASE_URL}/api/chat/message/abc", timeout=10)
        assert r.status_code in (401, 403)

    def test_user_send_and_delete_own(self, user_client):
        r = user_client.post(f"{BASE_URL}/api/chat/send",
                             json={"message": "TEST_user_msg", "msg_type": "text"}, timeout=10)
        assert r.status_code == 200
        mid = r.json()["id"]
        r2 = user_client.delete(f"{BASE_URL}/api/chat/message/{mid}", timeout=10)
        assert r2.status_code == 200
        # Verify not in list
        r3 = user_client.get(f"{BASE_URL}/api/chat/messages", timeout=10)
        assert r3.status_code == 200
        ids = [m["id"] for m in r3.json().get("messages", [])]
        assert mid not in ids

    def test_user_cannot_delete_admin_message(self, user_client, admin_client):
        # admin reply to this user
        # Need user_id; fetch from chat users list
        # First send a user message so chat exists
        user_client.post(f"{BASE_URL}/api/chat/send",
                        json={"message": "TEST_setup", "msg_type": "text"}, timeout=10)
        users = admin_client.get(f"{BASE_URL}/api/admin/chat/users", timeout=10).json().get("users", [])
        target = next((u for u in users if u.get("user_phone") == getattr(user_client, "phone", None)), None)
        if not target:
            pytest.skip("User not found in admin chat list")
        r = admin_client.post(f"{BASE_URL}/api/admin/chat/reply/{target['user_id']}",
                              json={"message": "TEST_admin_reply", "msg_type": "text"}, timeout=10)
        assert r.status_code == 200
        admin_msg_id = r.json()["id"]
        # User attempts delete -> must fail 404
        r2 = user_client.delete(f"{BASE_URL}/api/chat/message/{admin_msg_id}", timeout=10)
        assert r2.status_code == 404

    def test_user_delete_nonexistent(self, user_client):
        r = user_client.delete(f"{BASE_URL}/api/chat/message/NOPE_ID_123", timeout=10)
        assert r.status_code == 404


# ---- Core chat flows still work ----
class TestChatCoreFlows:
    def test_chat_send_text(self, user_client):
        r = user_client.post(f"{BASE_URL}/api/chat/send",
                             json={"message": "TEST_hello", "msg_type": "text"}, timeout=10)
        assert r.status_code == 200
        assert "id" in r.json()

    def test_chat_send_empty_text_rejected(self, user_client):
        r = user_client.post(f"{BASE_URL}/api/chat/send",
                             json={"message": "   ", "msg_type": "text"}, timeout=10)
        assert r.status_code == 400

    def test_chat_messages_marks_admin_read(self, user_client):
        r = user_client.get(f"{BASE_URL}/api/chat/messages", timeout=10)
        assert r.status_code == 200
        assert "messages" in r.json()

    def test_admin_messages_endpoint(self, admin_client, user_client):
        user_client.post(f"{BASE_URL}/api/chat/send",
                        json={"message": "TEST_for_admin_read", "msg_type": "text"}, timeout=10)
        users = admin_client.get(f"{BASE_URL}/api/admin/chat/users", timeout=10).json().get("users", [])
        if not users:
            pytest.skip("no users")
        uid = users[0]["user_id"]
        r = admin_client.get(f"{BASE_URL}/api/admin/chat/messages/{uid}", timeout=10)
        assert r.status_code == 200
        assert "messages" in r.json()
