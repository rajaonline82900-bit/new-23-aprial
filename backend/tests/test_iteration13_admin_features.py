"""
Test suite for Iteration 13 Admin Features:
1. Admin login with Vikram@900 credentials
2. Admin stats endpoint with today_new_users
3. Today new users endpoint
4. User detail endpoints (deposits, withdrawals, bets, winnings)
5. VAPID key endpoint for push notifications
6. All users endpoint (should return all 27 users)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_vikram(self):
        """Test admin login with Vikram@900 credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "Vikram@900",
            "password": "Vikram@900"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert data["role"] == "admin", f"Expected admin role, got {data.get('role')}"
        assert data["email"].lower() == "vikram@900", f"Email mismatch: {data.get('email')}"
        print(f"✓ Admin login successful: {data['name']}")
    
    def test_admin_login_sattamatka(self):
        """Test admin login with admin@sattamatka.com credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["role"] == "admin"
        print(f"✓ Admin login successful: {data['name']}")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials rejected correctly")


class TestAdminStats:
    """Admin stats endpoint tests"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "Vikram@900",
            "password": "Vikram@900"
        })
        assert response.status_code == 200
        return session
    
    def test_admin_stats_endpoint(self, admin_session):
        """Test /api/admin/stats returns all required fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        required_fields = [
            "total_users", "total_bets", "pending_withdrawals",
            "today_bets", "today_new_users", "today_bet_amount",
            "today_deposit_amount", "today_withdrawal_amount",
            "total_deposit_amount", "total_withdrawal_amount"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify total_users is 27
        assert data["total_users"] == 27, f"Expected 27 users, got {data['total_users']}"
        print(f"✓ Admin stats: {data['total_users']} users, {data['today_new_users']} new today")
    
    def test_today_new_users_endpoint(self, admin_session):
        """Test /api/admin/today-new-users returns user list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/today-new-users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "users" in data, "Missing 'users' field"
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["users"], list), "users should be a list"
        
        # If there are users, verify they have required fields
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "_id" in user, "User missing _id"
            assert "name" in user, "User missing name"
            assert "created_at" in user, "User missing created_at"
        
        print(f"✓ Today new users: {data['total']} users")
    
    def test_today_deposits_endpoint(self, admin_session):
        """Test /api/admin/today-deposits returns deposits with user details"""
        response = admin_session.get(f"{BASE_URL}/api/admin/today-deposits")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "deposits" in data, "Missing 'deposits' field"
        assert "total" in data, "Missing 'total' field"
        assert "total_amount" in data, "Missing 'total_amount' field"
        
        print(f"✓ Today deposits: {data['total']} deposits, ₹{data['total_amount']}")


class TestAdminUsers:
    """Admin users management tests"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "Vikram@900",
            "password": "Vikram@900"
        })
        assert response.status_code == 200
        return session
    
    def test_get_all_users(self, admin_session):
        """Test /api/admin/users returns all 27 users"""
        response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=500")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "users" in data, "Missing 'users' field"
        assert "total" in data, "Missing 'total' field"
        assert data["total"] == 27, f"Expected 27 total users, got {data['total']}"
        assert len(data["users"]) == 27, f"Expected 27 users in list, got {len(data['users'])}"
        
        # Verify user structure
        user = data["users"][0]
        assert "_id" in user, "User missing _id"
        assert "name" in user, "User missing name"
        assert "role" in user, "User missing role"
        assert "balance" in user, "User missing balance"
        
        print(f"✓ All users: {len(data['users'])} users returned")
    
    def test_user_deposits_endpoint(self, admin_session):
        """Test /api/admin/users/{user_id}/deposits"""
        # First get a user ID
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=5")
        users = users_response.json()["users"]
        user_id = users[1]["_id"]  # Get second user (not admin)
        
        response = admin_session.get(f"{BASE_URL}/api/admin/users/{user_id}/deposits")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "deposits" in data, "Missing 'deposits' field"
        assert "total_deposited" in data, "Missing 'total_deposited' field"
        
        print(f"✓ User deposits: {len(data['deposits'])} deposits, ₹{data['total_deposited']} total")
    
    def test_user_withdrawals_endpoint(self, admin_session):
        """Test /api/admin/users/{user_id}/withdrawals"""
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=5")
        users = users_response.json()["users"]
        user_id = users[1]["_id"]
        
        response = admin_session.get(f"{BASE_URL}/api/admin/users/{user_id}/withdrawals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "withdrawals" in data, "Missing 'withdrawals' field"
        assert "total_withdrawn" in data, "Missing 'total_withdrawn' field"
        assert "pending_amount" in data, "Missing 'pending_amount' field"
        
        print(f"✓ User withdrawals: {len(data['withdrawals'])} withdrawals, ₹{data['total_withdrawn']} total")
    
    def test_user_bets_endpoint(self, admin_session):
        """Test /api/admin/users/{user_id}/bets"""
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=5")
        users = users_response.json()["users"]
        user_id = users[1]["_id"]
        
        response = admin_session.get(f"{BASE_URL}/api/admin/users/{user_id}/bets")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "bets" in data, "Missing 'bets' field"
        assert "stats" in data, "Missing 'stats' field"
        
        stats = data["stats"]
        assert "total_bets" in stats, "Missing total_bets in stats"
        assert "won" in stats, "Missing won in stats"
        assert "lost" in stats, "Missing lost in stats"
        assert "pending" in stats, "Missing pending in stats"
        
        print(f"✓ User bets: {stats['total_bets']} bets (won: {stats['won']}, lost: {stats['lost']}, pending: {stats['pending']})")
    
    def test_user_winnings_endpoint(self, admin_session):
        """Test /api/admin/users/{user_id}/winnings"""
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=5")
        users = users_response.json()["users"]
        user_id = users[1]["_id"]
        
        response = admin_session.get(f"{BASE_URL}/api/admin/users/{user_id}/winnings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "winnings" in data, "Missing 'winnings' field"
        assert "total_winnings" in data, "Missing 'total_winnings' field"
        
        print(f"✓ User winnings: {len(data['winnings'])} winning bets, ₹{data['total_winnings']} total")


class TestPushNotifications:
    """Push notification endpoint tests"""
    
    def test_vapid_key_endpoint(self):
        """Test /api/push/vapid-key returns valid VAPID key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "key" in data, "Missing 'key' field"
        assert len(data["key"]) > 50, f"VAPID key too short: {len(data['key'])} chars"
        assert data["key"].startswith("B"), f"VAPID key should start with 'B': {data['key'][:10]}"
        
        print(f"✓ VAPID key: {data['key'][:20]}...")


class TestAdminOtherEndpoints:
    """Other admin endpoints tests"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "Vikram@900",
            "password": "Vikram@900"
        })
        assert response.status_code == 200
        return session
    
    def test_admin_games_endpoint(self, admin_session):
        """Test /api/admin/games returns games list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "games" in data, "Missing 'games' field"
        assert len(data["games"]) >= 6, f"Expected at least 6 games, got {len(data['games'])}"
        
        print(f"✓ Admin games: {len(data['games'])} games")
    
    def test_admin_withdrawals_endpoint(self, admin_session):
        """Test /api/admin/withdrawals returns withdrawals"""
        response = admin_session.get(f"{BASE_URL}/api/admin/withdrawals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "withdrawals" in data, "Missing 'withdrawals' field"
        print(f"✓ Admin withdrawals: {len(data['withdrawals'])} pending")
    
    def test_admin_deposits_endpoint(self, admin_session):
        """Test /api/admin/deposits returns deposits"""
        response = admin_session.get(f"{BASE_URL}/api/admin/deposits")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "deposits" in data, "Missing 'deposits' field"
        assert "total" in data, "Missing 'total' field"
        
        print(f"✓ Admin deposits: {data['total']} total deposits")
    
    def test_admin_settings_endpoint(self, admin_session):
        """Test /api/admin/settings returns settings"""
        response = admin_session.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check for some expected settings fields
        assert "min_deposit" in data or "single_rate" in data, "Missing expected settings fields"
        
        print(f"✓ Admin settings loaded")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
