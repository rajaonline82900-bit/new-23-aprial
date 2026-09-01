"""Tests for bet aggregation, live-feed shape, and /api/online-users.

Iteration 39 — validates P0 refinements:
1. Aggregation: same user+round+option → single DB ticket with amount summed and bet_count incremented
2. Live feed: mix of real (masked) + fake (Indian names) items, each with 'fake' bool
3. Online users endpoint returns {count, real}, count within 1100-1500
"""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, f"no token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _topup_admin(min_needed=2000):
    """Directly top up admin balance in Mongo if low. Uses MONGO_URL and DB_NAME from backend/.env."""
    try:
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        from pymongo import MongoClient
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]
        client = MongoClient(mongo_url)
        db = client[db_name]
        u = db.users.find_one({"email": ADMIN_EMAIL})
        if u and u.get("balance", 0) < min_needed:
            db.users.update_one({"_id": u["_id"]}, {"$inc": {"balance": 10000}})
        client.close()
    except Exception as e:
        print(f"topup skipped: {e}")


@pytest.fixture(scope="module", autouse=True)
def ensure_balance():
    _topup_admin(min_needed=2000)
    yield


# ---------- Helpers ----------
def _wait_for_betting_phase(current_url, min_remaining=15, timeout=45):
    """Poll /current until phase=='betting' and remaining>=min_remaining."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = requests.get(current_url, timeout=10)
        if r.status_code == 200:
            d = r.json()
            if d.get("phase") == "betting" and (d.get("remaining") or 0) >= min_remaining:
                return d
        time.sleep(1)
    pytest.skip(f"No suitable betting window in {timeout}s at {current_url}")


# ---------- 1) Dragon Tiger aggregation ----------
class TestDragonTigerAggregation:
    def test_three_bets_aggregate_to_single_ticket(self, auth_headers):
        cur = _wait_for_betting_phase(f"{BASE_URL}/api/dragon-tiger/current", 15)
        round_id = cur["round_id"]

        bet_ids = []
        for _ in range(3):
            r = requests.post(
                f"{BASE_URL}/api/dragon-tiger/bet",
                headers=auth_headers, json={"side": "dragon", "amount": 50}, timeout=10,
            )
            assert r.status_code == 200, f"bet failed: {r.status_code} {r.text}"
            bet_ids.append(r.json().get("bet_id"))

        # Same bet_id across all 3
        assert len(set(bet_ids)) == 1, f"bet_ids should all match: {bet_ids}"

        # History should have exactly 1 ticket for this round with amount=150, bet_count=3
        h = requests.get(f"{BASE_URL}/api/dragon-tiger/history?limit=20", headers=auth_headers, timeout=10)
        assert h.status_code == 200
        bets = h.json().get("bets", [])
        round_bets = [b for b in bets if b.get("round_id") == round_id and b.get("side") == "dragon"]
        assert len(round_bets) == 1, f"expected 1 aggregated dragon ticket, got {len(round_bets)}"
        assert round_bets[0]["amount"] == 150.0, f"amount mismatch: {round_bets[0]}"
        assert round_bets[0]["bet_count"] == 3, f"bet_count mismatch: {round_bets[0]}"

    def test_different_sides_create_separate_tickets(self, auth_headers):
        cur = _wait_for_betting_phase(f"{BASE_URL}/api/dragon-tiger/current", 12)
        round_id = cur["round_id"]

        r1 = requests.post(f"{BASE_URL}/api/dragon-tiger/bet", headers=auth_headers,
                           json={"side": "dragon", "amount": 50}, timeout=10)
        r2 = requests.post(f"{BASE_URL}/api/dragon-tiger/bet", headers=auth_headers,
                           json={"side": "tiger", "amount": 50}, timeout=10)
        assert r1.status_code == 200 and r2.status_code == 200, f"{r1.text} | {r2.text}"

        h = requests.get(f"{BASE_URL}/api/dragon-tiger/history?limit=20", headers=auth_headers, timeout=10)
        round_bets = [b for b in h.json().get("bets", []) if b.get("round_id") == round_id]
        sides = sorted([b["side"] for b in round_bets])
        assert "dragon" in sides and "tiger" in sides, f"missing sides: {sides}"
        # 2 different-side tickets minimum
        assert len([s for s in sides if s in ("dragon", "tiger")]) >= 2


# ---------- 2) Crazy Time aggregation ----------
class TestCrazyTimeAggregation:
    def test_three_bets_aggregate(self, auth_headers):
        cur = _wait_for_betting_phase(f"{BASE_URL}/api/crazy-time/current", 15)
        round_id = cur["round_id"]

        bet_ids = []
        for _ in range(3):
            r = requests.post(f"{BASE_URL}/api/crazy-time/bet",
                              headers=auth_headers, json={"segment": "5", "amount": 20}, timeout=10)
            assert r.status_code == 200, f"CT bet failed: {r.status_code} {r.text}"
            bet_ids.append(r.json().get("bet_id"))
        assert len(set(bet_ids)) == 1, f"bet_ids: {bet_ids}"

        h = requests.get(f"{BASE_URL}/api/crazy-time/history?limit=20", headers=auth_headers, timeout=10)
        round_bets = [b for b in h.json().get("bets", []) if b.get("round_id") == round_id and b.get("segment") == "5"]
        assert len(round_bets) == 1, f"expected 1 aggregated ticket, got {len(round_bets)}"
        assert round_bets[0]["amount"] == 60.0
        assert round_bets[0]["bet_count"] == 3


# ---------- 3) Color Game aggregation ----------
class TestColorGameAggregation:
    def test_three_bets_aggregate(self, auth_headers):
        cur = _wait_for_betting_phase(f"{BASE_URL}/api/color-game/current", 15)
        round_id = cur["round_id"]

        bet_ids = []
        for _ in range(3):
            r = requests.post(f"{BASE_URL}/api/color-game/bet",
                              headers=auth_headers, json={"side": "red", "amount": 50}, timeout=10)
            assert r.status_code == 200, f"CG bet failed: {r.status_code} {r.text}"
            bet_ids.append(r.json().get("bet_id"))
        assert len(set(bet_ids)) == 1

        h = requests.get(f"{BASE_URL}/api/color-game/history?limit=20", headers=auth_headers, timeout=10)
        round_bets = [b for b in h.json().get("bets", []) if b.get("round_id") == round_id and b.get("side") == "red"]
        assert len(round_bets) == 1
        assert round_bets[0]["amount"] == 150.0
        assert round_bets[0]["bet_count"] == 3


# ---------- 4) Coin Toss aggregation ----------
class TestCoinAggregation:
    def test_three_bets_aggregate(self, auth_headers):
        # Coin uses a different round format — wait for open round with time to spare
        deadline = time.time() + 45
        cur = None
        while time.time() < deadline:
            r = requests.get(f"{BASE_URL}/api/coin/current", timeout=10)
            if r.status_code == 200:
                d = r.json()
                # Look for open + enough remaining (>10s if we can infer)
                if d.get("status") == "open" and (d.get("lock_in") or d.get("lock_at_in") or 15) >= 10:
                    cur = d
                    break
                # fallback: just accept 'open'
                if d.get("status") == "open":
                    cur = d
                    break
            time.sleep(1)
        if not cur:
            pytest.skip("No open coin round available")

        round_id = cur.get("round_id") or cur.get("_id")

        bet_ids = []
        for i in range(3):
            r = requests.post(f"{BASE_URL}/api/coin/bet",
                              headers=auth_headers, json={"side": "head", "amount": 100}, timeout=10)
            if r.status_code != 200:
                pytest.skip(f"Coin bet failed (round may have locked): {r.status_code} {r.text}")
            bet_ids.append(r.json().get("bet_id"))
        assert len(set(bet_ids)) == 1, f"coin bet_ids should match: {bet_ids}"

        mc = requests.get(f"{BASE_URL}/api/coin/my-current", headers=auth_headers, timeout=10)
        assert mc.status_code == 200
        body = mc.json()
        bets = body.get("bets", [])
        head_bets = [b for b in bets if b.get("side") == "head"]
        assert len(head_bets) == 1, f"expected 1 head ticket, got {len(head_bets)}: {bets}"
        assert head_bets[0]["amount"] == 300.0
        assert head_bets[0]["bet_count"] == 3


# ---------- 5) Live feed shape ----------
class TestLiveFeeds:
    @pytest.mark.parametrize("path,side_key", [
        ("/api/dragon-tiger/live-feed", "side"),
        ("/api/crazy-time/live-feed", "segment"),
        ("/api/color-game/live-feed", "side"),
    ])
    def test_live_feed_shape(self, path, side_key):
        r = requests.get(f"{BASE_URL}{path}?limit=10", timeout=10)
        assert r.status_code == 200, f"{path} → {r.status_code} {r.text}"
        body = r.json()
        assert "feed" in body, f"missing feed in {path}: {body}"
        feed = body["feed"]
        assert isinstance(feed, list) and len(feed) > 0, f"empty feed at {path}"

        for item in feed:
            assert "name" in item and "amount" in item and "fake" in item, f"missing keys: {item}"
            assert side_key in item, f"missing {side_key} in {item}"
            assert isinstance(item["fake"], bool)
            if item["fake"] is False:
                assert item["name"].endswith("***") or len(item["name"]) <= 3, \
                    f"real item must be masked: {item}"


# ---------- 6) Online users endpoint ----------
class TestOnlineUsers:
    def test_online_users_range_twice(self):
        for i in range(2):
            r = requests.get(f"{BASE_URL}/api/online-users", timeout=10)
            assert r.status_code == 200, f"attempt {i}: {r.status_code} {r.text}"
            d = r.json()
            assert "count" in d and "real" in d, f"missing keys: {d}"
            assert isinstance(d["count"], int) and isinstance(d["real"], int)
            assert 1100 <= d["count"] <= 1500, f"count out of range: {d}"
