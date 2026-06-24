"""
Iteration 20 Backend Tests
Covers:
  - BUG 2: Admin Settings whatsapp_number persistence (PUT /api/admin/settings, GET /api/admin/settings, GET /api/settings)
  - BUG 3: Disawar game record start_time='07:00' / end_time='04:00' via GET /api/games
  - BUG 1/4: GET /api/results/{game_id}?limit=365 returns history for chart + jantri (verify ghaziabad returns results)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matka-numbers-bet.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def admin_token():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token in admin login response: {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- BUG 2: WhatsApp number setting ----------
class TestWhatsappNumberSetting:
    def test_get_admin_settings_has_whatsapp_number_field(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "whatsapp_number" in data, f"whatsapp_number missing in admin settings: {list(data.keys())}"

    def test_put_admin_settings_updates_whatsapp_number(self, admin_headers):
        new_val = "+919999999999"
        # send full settings payload (PUT may expect all keys)
        cur = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15).json()
        cur["whatsapp_number"] = new_val
        r = requests.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json=cur, timeout=20)
        assert r.status_code in (200, 204), f"PUT failed: {r.status_code} {r.text}"
        # GET back to verify persistence
        r2 = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("whatsapp_number") == new_val, f"admin GET did not return saved whatsapp_number: {r2.json()}"

    def test_public_settings_returns_whatsapp_number(self):
        r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "whatsapp_number" in data, f"whatsapp_number missing in public settings: {list(data.keys())}"
        assert data["whatsapp_number"] == "+919999999999", f"public settings whatsapp_number != saved: {data['whatsapp_number']!r}"


# ---------- BUG 3: Disawar timing ----------
class TestDisawarTiming:
    def test_disawar_game_has_correct_timing(self):
        r = requests.get(f"{BASE_URL}/api/games", timeout=15)
        assert r.status_code == 200, r.text
        games_payload = r.json()
        games = games_payload.get("games") if isinstance(games_payload, dict) else games_payload
        assert isinstance(games, list) and len(games) > 0, f"no games returned: {games_payload}"
        disawar = next((g for g in games if g.get("id") == "disawar"), None)
        assert disawar is not None, "disawar game not found in /api/games"
        assert disawar.get("start_time") == "07:00", f"disawar start_time={disawar.get('start_time')} != 07:00"
        assert disawar.get("end_time") == "04:00", f"disawar end_time={disawar.get('end_time')} != 04:00"


# ---------- BUG 1 & 4: Result history endpoint ----------
class TestResultHistory:
    def test_ghaziabad_history_returns_results(self):
        r = requests.get(f"{BASE_URL}/api/results/ghaziabad?limit=365", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        results = data.get("results") if isinstance(data, dict) else data
        assert isinstance(results, list), f"results not a list: {data}"
        # Problem statement says DB has 13 ghaziabad results
        assert len(results) >= 1, f"no ghaziabad results returned. payload: {data}"
        # Each row should have date and a jodi-like field
        first = results[0]
        assert "date" in first, f"row missing date: {first}"
        assert any(k in first for k in ("jodi_result", "jodi")), f"row missing jodi field: {first}"

    def test_disawar_history_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/results/disawar?limit=365", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        results = data.get("results") if isinstance(data, dict) else data
        assert isinstance(results, list)

    def test_delhi_bazaar_history_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/results/delhi_bazaar?limit=365", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        results = data.get("results") if isinstance(data, dict) else data
        assert isinstance(results, list)
