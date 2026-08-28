"""Dragon Tiger backend tests.

Covers: config, current round, bet placement (valid + validation errors),
history, recent rounds, live feed, settlement (end-to-end w/ balance credit),
and regression checks on existing games.
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matka-numbers-bet.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def user_session():
    """Register a new user, top-up balance directly in Mongo, return session+token+id."""
    phone = "9" + str(int(time.time()) % 10**9).zfill(9)
    email = f"TEST_dt_{uuid.uuid4().hex[:8]}@example.com"
    password = "Test@1234"
    reg = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "DT Tester", "email": email, "phone": phone, "password": password
    }, timeout=20)
    assert reg.status_code == 200, f"register failed: {reg.status_code} {reg.text}"
    data = reg.json()
    token = data["token"]
    user_id = data["id"]
    # top up ₹10,000 directly
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"balance": 10000.0}})
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    yield {"session": s, "user_id": user_id, "email": email, "phone": phone}
    # cleanup
    db.users.delete_one({"_id": ObjectId(user_id)})
    db.dragon_tiger_bets.delete_many({"user_id": user_id})


def _wait_for_betting_phase(min_remaining=6, timeout=40):
    """Poll /current until we find a round in betting phase with enough remaining time."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = requests.get(f"{BASE_URL}/api/dragon-tiger/current", timeout=10)
        assert r.status_code == 200
        d = r.json()
        if d.get("phase") == "betting" and (d.get("remaining") or 0) >= min_remaining:
            return d
        time.sleep(1)
    raise AssertionError(f"No betting phase found within {timeout}s")


# ---------- config ----------
class TestConfig:
    def test_get_config(self):
        r = requests.get(f"{BASE_URL}/api/dragon-tiger/config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("min_bet") == 50
        assert d.get("enabled") is True
        # confirm persistence
        doc = db.dragon_tiger_config.find_one({"_id": "config"})
        assert doc is not None


# ---------- current round / loop ----------
class TestCurrentRound:
    def test_current_has_valid_shape(self):
        r = requests.get(f"{BASE_URL}/api/dragon-tiger/current", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "round_id" in d and "phase" in d and "remaining" in d and "ends_at" in d
        assert d["phase"] in ("betting", "reveal", "waiting", "ended")

    def test_background_loop_running(self):
        d = _wait_for_betting_phase()
        assert d["round_id"] is not None
        assert isinstance(d["ends_at"], (int, float))
        # rounds collection should have docs
        count = db.dragon_tiger_rounds.count_documents({})
        assert count > 0


# ---------- bet validation ----------
class TestBetValidation:
    def test_bet_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/dragon-tiger/bet",
                          json={"side": "dragon", "amount": 100}, timeout=10)
        assert r.status_code == 401

    def test_bet_invalid_side(self, user_session):
        _wait_for_betting_phase()
        r = user_session["session"].post(f"{BASE_URL}/api/dragon-tiger/bet",
                                         json={"side": "foo", "amount": 100}, timeout=10)
        assert r.status_code == 400
        assert "invalid" in r.text.lower()

    def test_bet_below_min(self, user_session):
        _wait_for_betting_phase()
        r = user_session["session"].post(f"{BASE_URL}/api/dragon-tiger/bet",
                                         json={"side": "dragon", "amount": 10}, timeout=10)
        assert r.status_code == 400
        assert "min bet" in r.text.lower() or "50" in r.text

    def test_bet_insufficient_balance(self, user_session):
        # Temporarily zero balance
        uid = user_session["user_id"]
        db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"balance": 10.0}})
        _wait_for_betting_phase()
        r = user_session["session"].post(f"{BASE_URL}/api/dragon-tiger/bet",
                                         json={"side": "dragon", "amount": 100}, timeout=10)
        assert r.status_code == 400
        assert "insufficient" in r.text.lower()
        # restore
        db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"balance": 10000.0}})


# ---------- place bet & settlement e2e ----------
class TestBetAndSettlement:
    def test_place_bet_success_and_deducts_balance(self, user_session):
        uid = user_session["user_id"]
        db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"balance": 10000.0}})
        d = _wait_for_betting_phase(min_remaining=8)
        r = user_session["session"].post(f"{BASE_URL}/api/dragon-tiger/bet",
                                         json={"side": "dragon", "amount": 100}, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "bet_id" in body
        bet_id = body["bet_id"]
        # Balance deducted
        u = db.users.find_one({"_id": ObjectId(uid)})
        assert u["balance"] == 9900.0
        # bet doc exists and pending
        bet = db.dragon_tiger_bets.find_one({"bet_id": bet_id})
        assert bet is not None
        assert bet["status"] == "pending"
        assert bet["side"] == "dragon"
        assert bet["amount"] == 100
        assert bet["round_id"] == d["round_id"]

    def test_bet_settles_after_round(self, user_session):
        """Place small bet, wait ~35s for settlement, verify status won/lost + payout."""
        uid = user_session["user_id"]
        db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"balance": 10000.0}})
        _wait_for_betting_phase(min_remaining=8)
        r = user_session["session"].post(f"{BASE_URL}/api/dragon-tiger/bet",
                                         json={"side": "tiger", "amount": 50}, timeout=10)
        assert r.status_code == 200, r.text
        bet_id = r.json()["bet_id"]

        # Wait for settlement (round can be up to 30s + reveal + slack)
        settled = None
        deadline = time.time() + 60
        while time.time() < deadline:
            bet = db.dragon_tiger_bets.find_one({"bet_id": bet_id})
            if bet and bet.get("status") in ("won", "lost"):
                settled = bet
                break
            time.sleep(2)
        assert settled is not None, "bet was not settled within 60s"
        assert "dragon_card" in settled and "tiger_card" in settled
        assert settled.get("winner") in ("dragon", "tiger", "tie")
        assert "payout" in settled
        assert "settled_at" in settled

        # If won, balance credited PAYOUT amount (2x for dragon/tiger)
        u = db.users.find_one({"_id": ObjectId(uid)})
        if settled["status"] == "won":
            # 10000 - 50 (deduct) + 100 (2x payout) = 10050
            assert u["balance"] == 10050.0, f"expected 10050, got {u['balance']}"
            assert settled["payout"] == 100.0
        else:
            assert u["balance"] == 9950.0
            assert settled["payout"] == 0

        # Round doc should be in ended phase with settled_at
        rnd = db.dragon_tiger_rounds.find_one({"round_id": settled["round_id"]})
        assert rnd is not None
        assert rnd.get("phase") in ("ended", "reveal")


# ---------- history / feed / rounds ----------
class TestReadEndpoints:
    def test_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/dragon-tiger/history", timeout=10)
        assert r.status_code == 401

    def test_history_returns_user_bets_newest_first(self, user_session):
        r = user_session["session"].get(f"{BASE_URL}/api/dragon-tiger/history", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "bets" in d
        bets = d["bets"]
        assert isinstance(bets, list)
        if len(bets) >= 2:
            assert bets[0]["created_at"] >= bets[1]["created_at"]
        # only this user's bets
        uid = user_session["user_id"]
        for b in bets:
            assert b["user_id"] == uid

    def test_recent_rounds(self):
        r = requests.get(f"{BASE_URL}/api/dragon-tiger/recent-rounds", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "rounds" in d
        assert isinstance(d["rounds"], list)

    def test_live_feed_masks_names(self):
        r = requests.get(f"{BASE_URL}/api/dragon-tiger/live-feed", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "feed" in d
        for item in d["feed"]:
            assert "***" in item["name"]
            assert item["side"] in ("dragon", "tiger", "tie")


# ---------- regression: existing games ----------
class TestExistingGamesRegression:
    def test_games_list(self):
        r = requests.get(f"{BASE_URL}/api/games", timeout=10)
        assert r.status_code == 200

    def test_coin_history(self):
        # Public? Might require auth — accept 200/401 (not 500)
        r = requests.get(f"{BASE_URL}/api/coin/history", timeout=10)
        assert r.status_code in (200, 401, 422), f"unexpected: {r.status_code} {r.text[:200]}"

    def test_results_today(self):
        from datetime import datetime
        today = datetime.utcnow().strftime("%Y-%m-%d")
        r = requests.get(f"{BASE_URL}/api/results", params={"date": today}, timeout=10)
        assert r.status_code == 200
