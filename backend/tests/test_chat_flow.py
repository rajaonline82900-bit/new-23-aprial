"""Chat feature backend tests: upload, send, admin list/reply, delivery to user."""
import os
import io
import time
import uuid
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matka-numbers-bet.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASS = "Admin@123"


def _tiny_png() -> bytes:
    # 1x1 red PNG
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b"\x00\xff\x00\x00")
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _fake_webm() -> bytes:
    # Not a real webm but backend only checks extension + size
    return b"\x1aE\xdf\xa3" + os.urandom(1024)


@pytest.fixture(scope="module")
def user_token():
    phone = "9" + str(int(time.time()))[-9:]
    name = f"TEST_chat_{phone[-4:]}"
    password = "Test@123"
    r = requests.post(f"{BASE_URL}/api/auth/register-mobile",
                      json={"name": name, "phone": phone, "password": password}, timeout=15)
    if r.status_code not in (200, 201):
        # Try existing
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": "9788355753", "password": "Test@123"}, timeout=15)
        assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
        return r.json().get("token") or r.json().get("access_token")
    tok = r.json().get("token") or r.json().get("access_token")
    if not tok:
        r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": phone, "password": password}, timeout=15)
        assert r2.status_code == 200
        tok = r2.json().get("token") or r2.json().get("access_token")
    assert tok, f"No token in register response: {r.text}"
    return tok


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    # Prefer Bearer if token returned, else use cookies
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def user_id_from_token(user_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {user_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    # user id may be under _id or id
    return data.get("_id") or data.get("id") or data.get("user_id")


class TestChatUpload:
    def test_upload_png(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = requests.post(f"{BASE_URL}/api/chat/upload",
                          files={"file": ("t.png", _tiny_png(), "image/png")}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/uploads/chat_")
        # GET the file
        g = requests.get(f"{BASE_URL}{url}", timeout=15)
        assert g.status_code == 200
        assert g.headers.get("content-type", "").startswith("image/")

    def test_upload_webm_audio(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = requests.post(f"{BASE_URL}/api/chat/upload",
                          files={"file": ("v.webm", _fake_webm(), "audio/webm")}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["url"].endswith(".webm")

    def test_upload_m4a_audio(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = requests.post(f"{BASE_URL}/api/chat/upload",
                          files={"file": ("v.m4a", _fake_webm(), "audio/mp4")}, headers=h, timeout=30)
        assert r.status_code == 200, r.text

    def test_upload_rejects_exe(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = requests.post(f"{BASE_URL}/api/chat/upload",
                          files={"file": ("m.exe", b"MZ" + os.urandom(20), "application/octet-stream")},
                          headers=h, timeout=15)
        assert r.status_code == 400

    def test_upload_rejects_txt(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = requests.post(f"{BASE_URL}/api/chat/upload",
                          files={"file": ("m.txt", b"hello", "text/plain")}, headers=h, timeout=15)
        assert r.status_code == 400

    def test_upload_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/chat/upload",
                          files={"file": ("t.png", _tiny_png(), "image/png")}, timeout=15)
        assert r.status_code in (401, 403)


class TestChatSendAndAdmin:
    def test_send_image_and_verify(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        up = requests.post(f"{BASE_URL}/api/chat/upload",
                           files={"file": ("t.png", _tiny_png(), "image/png")}, headers=h, timeout=30)
        assert up.status_code == 200
        url = up.json()["url"]
        s = requests.post(f"{BASE_URL}/api/chat/send",
                          json={"message": "", "msg_type": "image", "attachment_url": url}, headers=h, timeout=15)
        assert s.status_code == 200, s.text
        mid = s.json()["id"]
        g = requests.get(f"{BASE_URL}/api/chat/messages", headers=h, timeout=15)
        assert g.status_code == 200
        ids = [m["id"] for m in g.json()["messages"]]
        assert mid in ids

    def test_send_voice_and_verify(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        up = requests.post(f"{BASE_URL}/api/chat/upload",
                           files={"file": ("v.webm", _fake_webm(), "audio/webm")}, headers=h, timeout=30)
        url = up.json()["url"]
        s = requests.post(f"{BASE_URL}/api/chat/send",
                          json={"message": "", "msg_type": "voice", "attachment_url": url}, headers=h, timeout=15)
        assert s.status_code == 200
        assert "id" in s.json()

    def test_admin_list_users_shows_photo_voice(self, user_token, admin_session, user_id_from_token):
        # Ensure at least one image and one voice message exists for this user
        h = {"Authorization": f"Bearer {user_token}"}
        # send image last so last_message='Photo'
        up = requests.post(f"{BASE_URL}/api/chat/upload",
                           files={"file": ("t.png", _tiny_png(), "image/png")}, headers=h)
        requests.post(f"{BASE_URL}/api/chat/send",
                      json={"message": "", "msg_type": "image", "attachment_url": up.json()["url"]}, headers=h)
        r = admin_session.get(f"{BASE_URL}/api/admin/chat/users", timeout=15)
        assert r.status_code == 200, r.text
        users = r.json()["users"]
        me = next((u for u in users if u["user_id"] == user_id_from_token), None)
        assert me is not None, f"Test user {user_id_from_token} not in chat users list"
        assert me["last_message"] in ("Photo", "Voice"), f"Unexpected last_message: {me['last_message']}"
        assert me["unread"] >= 1

    def test_admin_reply_image_and_voice(self, admin_session, user_token, user_id_from_token):
        h = {"Authorization": f"Bearer {user_token}"}
        # Admin uploads image via /api/chat/upload (same endpoint)
        # Admin session has admin cookie, but /api/chat/upload requires normal user auth via get_current_user.
        # Frontend uses the same endpoint from admin panel — let's verify.
        up = admin_session.post(f"{BASE_URL}/api/chat/upload",
                                files={"file": ("a.png", _tiny_png(), "image/png")}, timeout=30)
        assert up.status_code == 200, f"Admin upload failed: {up.status_code} {up.text}"
        img_url = up.json()["url"]
        r = admin_session.post(f"{BASE_URL}/api/admin/chat/reply/{user_id_from_token}",
                               json={"message": "", "msg_type": "image", "attachment_url": img_url}, timeout=15)
        assert r.status_code == 200, r.text
        # Voice reply
        upv = admin_session.post(f"{BASE_URL}/api/chat/upload",
                                 files={"file": ("a.webm", _fake_webm(), "audio/webm")}, timeout=30)
        assert upv.status_code == 200
        rv = admin_session.post(f"{BASE_URL}/api/admin/chat/reply/{user_id_from_token}",
                                json={"message": "", "msg_type": "voice", "attachment_url": upv.json()["url"]},
                                timeout=15)
        assert rv.status_code == 200
        # User should see them
        g = requests.get(f"{BASE_URL}/api/chat/messages", headers=h, timeout=15)
        types = [m.get("msg_type") for m in g.json()["messages"] if m.get("sender") == "admin"]
        assert "image" in types and "voice" in types

    def test_read_receipts(self, user_token, admin_session, user_id_from_token):
        h = {"Authorization": f"Bearer {user_token}"}
        # send a user message
        requests.post(f"{BASE_URL}/api/chat/send",
                      json={"message": "ping-read", "msg_type": "text"}, headers=h)
        # admin fetches -> marks read
        admin_session.get(f"{BASE_URL}/api/admin/chat/messages/{user_id_from_token}")
        g = requests.get(f"{BASE_URL}/api/chat/messages", headers=h, timeout=15)
        # find the last user message
        user_msgs = [m for m in g.json()["messages"] if m.get("sender") == "user"]
        assert any(m.get("read") is True for m in user_msgs), "No user message marked as read after admin opened chat"
