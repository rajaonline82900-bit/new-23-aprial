"""
Matka 11 - Iteration 12 Backend Tests
Testing: Admin stats, today-new-users, today-deposits, VAPID key, white theme changes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"


class TestPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_vapid_key_endpoint(self):
        """GET /api/push/vapid-key returns valid VAPID public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "key" in data, "Response should contain 'key' field"
        assert len(data["key"]) > 50, "VAPID key should be a long string"
        print(f"✓ VAPID key endpoint working: {data['key'][:20]}...")
    
    def test_games_endpoint(self):
        """GET /api/games returns games list"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert "games" in data
        print(f"✓ Games endpoint working: {len(data['games'])} games")
    
    def test_settings_endpoint(self):
        """GET /api/settings returns app settings"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        # Should have some settings fields
        assert isinstance(data, dict)
        print(f"✓ Settings endpoint working")


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """POST /api/auth/admin/login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data or "user" in data, "Response should contain token or user"
        print(f"✓ Admin login successful")
        return response.cookies
    
    def test_admin_login_invalid_credentials(self):
        """POST /api/auth/admin/login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": "wrong@email.com", "password": "wrongpass"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid admin login correctly rejected")


class TestAdminStats:
    """Test admin stats endpoint - key feature for this iteration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        self.cookies = response.cookies
        self.session = requests.Session()
        self.session.cookies.update(self.cookies)
    
    def test_admin_stats_returns_today_bet_amount(self):
        """GET /api/admin/stats returns today_bet_amount field"""
        response = self.session.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "total_users" in data, "Should have total_users"
        assert "today_bets" in data, "Should have today_bets"
        assert "today_bet_amount" in data, "Should have today_bet_amount (NEW FIELD)"
        assert "today_new_users" in data, "Should have today_new_users"
        assert "pending_withdrawals" in data, "Should have pending_withdrawals"
        assert "today_deposit_amount" in data, "Should have today_deposit_amount"
        assert "today_withdrawal_amount" in data, "Should have today_withdrawal_amount"
        assert "total_deposit_amount" in data, "Should have total_deposit_amount"
        assert "total_withdrawal_amount" in data, "Should have total_withdrawal_amount"
        
        # Verify today_bet_amount is a number
        assert isinstance(data["today_bet_amount"], (int, float)), "today_bet_amount should be numeric"
        
        print(f"✓ Admin stats working with today_bet_amount: ₹{data['today_bet_amount']}")
        print(f"  - Total users: {data['total_users']}")
        print(f"  - Today bets: {data['today_bets']}")
        print(f"  - Today new users: {data['today_new_users']}")
        print(f"  - Today deposit: ₹{data['today_deposit_amount']}")


class TestTodayNewUsers:
    """Test today new users endpoint - NEW for this iteration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        self.cookies = response.cookies
        self.session = requests.Session()
        self.session.cookies.update(self.cookies)
    
    def test_today_new_users_endpoint(self):
        """GET /api/admin/today-new-users returns user list with details"""
        response = self.session.get(f"{BASE_URL}/api/admin/today-new-users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "users" in data, "Response should have 'users' field"
        assert "total" in data, "Response should have 'total' field"
        assert isinstance(data["users"], list), "users should be a list"
        
        # If there are users, check their structure
        if len(data["users"]) > 0:
            user = data["users"][0]
            # Should have user details
            assert "_id" in user or "id" in user, "User should have id"
            print(f"✓ Today new users endpoint working: {data['total']} users")
            print(f"  - Sample user fields: {list(user.keys())[:5]}")
        else:
            print(f"✓ Today new users endpoint working: 0 users today")


class TestTodayDeposits:
    """Test today deposits endpoint - NEW for this iteration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        self.cookies = response.cookies
        self.session = requests.Session()
        self.session.cookies.update(self.cookies)
    
    def test_today_deposits_endpoint(self):
        """GET /api/admin/today-deposits returns deposits with user details"""
        response = self.session.get(f"{BASE_URL}/api/admin/today-deposits")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "deposits" in data, "Response should have 'deposits' field"
        assert "total" in data, "Response should have 'total' field"
        assert "total_amount" in data, "Response should have 'total_amount' field"
        assert isinstance(data["deposits"], list), "deposits should be a list"
        
        # If there are deposits, check they have user details
        if len(data["deposits"]) > 0:
            deposit = data["deposits"][0]
            # Should have user details attached
            assert "user_name" in deposit or "amount" in deposit, "Deposit should have user_name or amount"
            print(f"✓ Today deposits endpoint working: {data['total']} deposits, ₹{data['total_amount']}")
            if "user_name" in deposit:
                print(f"  - User details included: user_name, user_phone, user_balance")
        else:
            print(f"✓ Today deposits endpoint working: 0 deposits today")


class TestAdminTabs:
    """Test all admin tab endpoints are working"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        self.cookies = response.cookies
        self.session = requests.Session()
        self.session.cookies.update(self.cookies)
    
    def test_admin_games(self):
        """GET /api/admin/games returns games list"""
        response = self.session.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code == 200
        data = response.json()
        assert "games" in data
        print(f"✓ Admin games tab: {len(data['games'])} games")
    
    def test_admin_withdrawals(self):
        """GET /api/admin/withdrawals returns withdrawals"""
        response = self.session.get(f"{BASE_URL}/api/admin/withdrawals")
        assert response.status_code == 200
        data = response.json()
        assert "withdrawals" in data
        print(f"✓ Admin withdrawals tab: {len(data['withdrawals'])} pending")
    
    def test_admin_deposits(self):
        """GET /api/admin/deposits returns deposits"""
        response = self.session.get(f"{BASE_URL}/api/admin/deposits")
        assert response.status_code == 200
        data = response.json()
        assert "deposits" in data
        print(f"✓ Admin deposits tab: {len(data['deposits'])} deposits")
    
    def test_admin_users(self):
        """GET /api/admin/users returns users"""
        response = self.session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ Admin users tab: {data.get('total', len(data['users']))} users")
    
    def test_admin_settings(self):
        """GET /api/admin/settings returns settings"""
        response = self.session.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Admin settings tab working")
    
    def test_admin_chat_users(self):
        """GET /api/admin/chat/users returns chat users"""
        response = self.session.get(f"{BASE_URL}/api/admin/chat/users")
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ Admin chat tab: {len(data['users'])} chat users")
    
    def test_admin_results_status(self):
        """GET /api/admin/results/status returns today results status"""
        response = self.session.get(f"{BASE_URL}/api/admin/results/status")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Admin results status working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
