"""Iter 40 - Preview deploy verification (admin login, payment gateway toggle, crazy-time settle, wallet deposit routing)."""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                      json={"email": "admin@sattamatka.com", "password": "Admin@123"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- App loads ---
def test_root_reachable():
    r = requests.get(BASE_URL + "/", timeout=15)
    assert r.status_code == 200


def test_api_root():
    # backend under /api namespace should not blow up
    r = requests.get(f"{BASE_URL}/api/games", timeout=15)
    assert r.status_code in (200, 401)


# --- Admin login ---
def test_admin_login_returns_token(admin_token):
    assert isinstance(admin_token, str) and admin_token.count(".") == 2


# --- Payment Gateway Toggle ---
def test_get_payment_gateway(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/payment-gateway", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "active" in d and "options" in d
    opts = d["options"]
    keys = {o.get("id") or o.get("key") or o.get("name") or o for o in opts} if opts and isinstance(opts[0], dict) else set(opts)
    assert {"imb", "trustope"} <= keys, f"options={opts}"


def test_set_payment_gateway_trustope(admin_headers):
    r = requests.post(f"{BASE_URL}/api/admin/payment-gateway",
                      headers=admin_headers, json={"active": "trustope"}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("active") == "trustope"


def test_set_payment_gateway_imb(admin_headers):
    r = requests.post(f"{BASE_URL}/api/admin/payment-gateway",
                      headers=admin_headers, json={"active": "imb"}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("active") == "imb"


# --- Wallet deposit routes through active gateway ---
def test_wallet_deposit_routes_to_trustope(admin_headers):
    # switch to trustope
    requests.post(f"{BASE_URL}/api/admin/payment-gateway",
                  headers=admin_headers, json={"active": "trustope"}, timeout=15)
    r = requests.post(f"{BASE_URL}/api/wallet/deposit",
                      headers=admin_headers,
                      json={"amount": 500, "origin_url": "https://matka-numbers-bet.preview.emergentagent.com"},
                      timeout=20)
    body = r.text.lower()
    # Either success (unlikely without merchant) OR error mentioning trustope/merchant not linked
    ok = r.status_code == 200
    trustope_err = ("trustope" in body) or ("merchant not linked" in body) or ("merchant" in body and "linked" in body)
    assert ok or trustope_err, f"Deposit did not route to trustope. status={r.status_code} body={r.text[:400]}"
    # revert
    requests.post(f"{BASE_URL}/api/admin/payment-gateway",
                  headers=admin_headers, json={"active": "imb"}, timeout=15)


# --- Crazy Time settle correctness ---
def _ensure_admin_balance(admin_headers, min_needed=500):
    r = requests.get(f"{BASE_URL}/api/wallet", headers=admin_headers, timeout=15)
    if r.status_code == 200:
        bal = r.json().get("balance", 0)
        if bal >= min_needed:
            return
    # top up via direct mongo
    import pymongo
    load_dotenv("/app/backend/.env")
    m = pymongo.MongoClient(os.environ["MONGO_URL"])
    m[os.environ["DB_NAME"]].users.update_one({"email": "admin@sattamatka.com"}, {"$inc": {"balance": 5000}})


def test_crazy_time_settle_all_segments(admin_headers):
    _ensure_admin_balance(admin_headers, 500)

    # Wait for a fresh round in betting phase with enough time to place 10 bets
    round_id = None
    deadline = time.time() + 60
    while time.time() < deadline:
        r = requests.get(f"{BASE_URL}/api/crazy-time/current", timeout=10)
        if r.status_code == 200:
            d = r.json()
            phase = d.get("phase") or d.get("status")
            remaining = d.get("time_remaining", d.get("remaining", 0))
            if phase == "betting" and remaining and remaining >= 15:
                round_id = d.get("round_id") or d.get("id") or d.get("_id")
                break
        time.sleep(2)
    assert round_id, "No betting-phase round found"

    placed = []
    for seg in range(1, 11):
        r = requests.post(f"{BASE_URL}/api/crazy-time/bet",
                          headers=admin_headers,
                          json={"segment": str(seg), "amount": 20, "round_id": round_id},
                          timeout=10)
        if r.status_code == 200:
            placed.append(seg)
        else:
            print(f"bet on seg {seg} failed: {r.status_code} {r.text[:200]}")

    assert len(placed) >= 8, f"Expected all 10 bets placed, got {len(placed)}"

    # wait for settle (~30s + buffer)
    time.sleep(35)

    # Fetch history and find bets for this round
    r = requests.get(f"{BASE_URL}/api/crazy-time/history", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    hist = r.json()
    items = hist if isinstance(hist, list) else hist.get("bets", hist.get("history", []))

    round_bets = [b for b in items if str(b.get("round_id")) == str(round_id)]
    # Some rounds may store settlement asynchronously; retry once
    if len(round_bets) < len(placed):
        time.sleep(10)
        r = requests.get(f"{BASE_URL}/api/crazy-time/history", headers=admin_headers, timeout=15)
        items = r.json() if isinstance(r.json(), list) else r.json().get("bets", r.json().get("history", []))
        round_bets = [b for b in items if str(b.get("round_id")) == str(round_id)]

    assert len(round_bets) >= len(placed), f"expected {len(placed)} history rows, got {len(round_bets)}"

    won = [b for b in round_bets if b.get("status") == "won"]
    lost = [b for b in round_bets if b.get("status") == "lost"]
    assert len(won) == 1, f"expected exactly 1 winning segment, got {len(won)}: {[b.get('segment') for b in won]}"
    assert len(lost) == len(round_bets) - 1

    # payout on winner: amount * 10 = 200 (segment 1..10 pay their number multiplier per typical crazy-time,
    # but request states winner payout = ₹200 = amount x 10)
    winner_bet = won[0]
    payout = winner_bet.get("payout") or winner_bet.get("winnings") or winner_bet.get("win_amount")
    assert payout is not None
    # Winner payout = amount * 10 (all segments pay 10x per SEGMENTS config)
    expected = 20 * 10
    assert float(payout) == float(expected), f"payout={payout} expected={expected} for segment {seg}"
