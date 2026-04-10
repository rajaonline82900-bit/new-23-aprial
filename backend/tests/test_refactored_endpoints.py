"""
Test suite for refactored Matka 11 backend endpoints
Tests all routes after modular refactoring from monolithic server.py
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"


class TestPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_get_games_returns_6_games(self):
        """GET /api/games should return 6 games"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "games" in data, "Response should contain 'games' key"
        games = data["games"]
        assert len(games) >= 6, f"Expected at least 6 games, got {len(games)}"
        
        # Verify game structure
        for game in games:
            assert "id" in game, "Game should have 'id'"
            assert "name" in game, "Game should have 'name'"
            assert "name_hi" in game, "Game should have 'name_hi'"
        print(f"✓ GET /api/games returned {len(games)} games")
    
    def test_get_results_returns_array(self):
        """GET /api/results should return results array"""
        response = requests.get(f"{BASE_URL}/api/results")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "results" in data, "Response should contain 'results' key"
        assert isinstance(data["results"], list), "Results should be a list"
        print(f"✓ GET /api/results returned {len(data['results'])} results")
    
    def test_get_settings_returns_valid_object(self):
        """GET /api/settings should return valid settings object"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Settings should have expected keys
        expected_keys = ["min_bet_jodi", "min_bet_haruf", "min_deposit", "min_withdrawal"]
        for key in expected_keys:
            assert key in data, f"Settings should contain '{key}'"
        print(f"✓ GET /api/settings returned valid settings object")
    
    def test_get_vapid_key(self):
        """GET /api/push/vapid-key should return VAPID public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "key" in data, "Response should contain 'key'"
        assert data["key"] is not None, "VAPID key should not be None"
        assert len(data["key"]) > 0, "VAPID key should not be empty"
        print(f"✓ GET /api/push/vapid-key returned valid key")


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """POST /api/auth/admin/login with valid credentials should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain 'token'"
        assert data["role"] == "admin", "User role should be 'admin'"
        assert data["email"] == ADMIN_EMAIL, f"Email should be {ADMIN_EMAIL}"
        print(f"✓ Admin login successful for {ADMIN_EMAIL}")
        return response
    
    def test_admin_login_invalid_credentials(self):
        """POST /api/auth/admin/login with invalid credentials should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": "wrong@email.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Admin login correctly rejected invalid credentials")


class TestAdminEndpoints:
    """Test admin endpoints that require authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session cookies"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        
        # Store token for Authorization header as backup
        self.token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_admin_stats(self):
        """GET /api/admin/stats should return stats object"""
        response = self.session.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        expected_keys = ["total_users", "total_bets", "pending_withdrawals", "today_bets", "today_new_users"]
        for key in expected_keys:
            assert key in data, f"Stats should contain '{key}'"
        print(f"✓ GET /api/admin/stats returned valid stats (users: {data['total_users']}, bets: {data['total_bets']})")
    
    def test_admin_games(self):
        """GET /api/admin/games should return games list"""
        response = self.session.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "games" in data, "Response should contain 'games'"
        assert isinstance(data["games"], list), "Games should be a list"
        assert len(data["games"]) >= 6, f"Expected at least 6 games, got {len(data['games'])}"
        print(f"✓ GET /api/admin/games returned {len(data['games'])} games")
    
    def test_admin_withdrawals(self):
        """GET /api/admin/withdrawals should return withdrawals array"""
        response = self.session.get(f"{BASE_URL}/api/admin/withdrawals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "withdrawals" in data, "Response should contain 'withdrawals'"
        assert isinstance(data["withdrawals"], list), "Withdrawals should be a list"
        print(f"✓ GET /api/admin/withdrawals returned {len(data['withdrawals'])} withdrawals")
    
    def test_admin_deposits(self):
        """GET /api/admin/deposits should return deposits array"""
        response = self.session.get(f"{BASE_URL}/api/admin/deposits")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "deposits" in data, "Response should contain 'deposits'"
        assert isinstance(data["deposits"], list), "Deposits should be a list"
        print(f"✓ GET /api/admin/deposits returned {len(data['deposits'])} deposits")
    
    def test_admin_users(self):
        """GET /api/admin/users should return users array"""
        response = self.session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "users" in data, "Response should contain 'users'"
        assert isinstance(data["users"], list), "Users should be a list"
        assert "total" in data, "Response should contain 'total'"
        print(f"✓ GET /api/admin/users returned {len(data['users'])} users (total: {data['total']})")
    
    def test_admin_settings(self):
        """GET /api/admin/settings should return settings"""
        response = self.session.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        expected_keys = ["min_bet_jodi", "min_bet_haruf", "min_deposit", "min_withdrawal"]
        for key in expected_keys:
            assert key in data, f"Settings should contain '{key}'"
        print(f"✓ GET /api/admin/settings returned valid settings")
    
    def test_admin_results_status(self):
        """GET /api/admin/results/status should return today results status"""
        response = self.session.get(f"{BASE_URL}/api/admin/results/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "date" in data, "Response should contain 'date'"
        assert "games" in data, "Response should contain 'games'"
        assert isinstance(data["games"], list), "Games should be a list"
        print(f"✓ GET /api/admin/results/status returned status for {len(data['games'])} games on {data['date']}")
    
    def test_admin_bet_distribution(self):
        """GET /api/admin/bet-distribution should return distribution data"""
        response = self.session.get(f"{BASE_URL}/api/admin/bet-distribution")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "date" in data, "Response should contain 'date'"
        assert "distribution" in data, "Response should contain 'distribution'"
        assert "summary" in data, "Response should contain 'summary'"
        print(f"✓ GET /api/admin/bet-distribution returned distribution for {data['date']}")
    
    def test_admin_chat_users(self):
        """GET /api/admin/chat/users should return chat users"""
        response = self.session.get(f"{BASE_URL}/api/admin/chat/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "users" in data, "Response should contain 'users'"
        assert isinstance(data["users"], list), "Users should be a list"
        print(f"✓ GET /api/admin/chat/users returned {len(data['users'])} chat users")


class TestGameEndpoints:
    """Test game-related endpoints"""
    
    def test_get_single_game(self):
        """GET /api/games/{game_id} should return game details"""
        # First get list of games
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        games = response.json()["games"]
        
        if games:
            game_id = games[0]["id"]
            response = requests.get(f"{BASE_URL}/api/games/{game_id}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert "id" in data, "Response should contain 'id'"
            assert "name" in data, "Response should contain 'name'"
            assert "results" in data, "Response should contain 'results'"
            print(f"✓ GET /api/games/{game_id} returned game details")
    
    def test_get_game_results(self):
        """GET /api/results/{game_id} should return game-specific results"""
        # First get list of games
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        games = response.json()["games"]
        
        if games:
            game_id = games[0]["id"]
            response = requests.get(f"{BASE_URL}/api/results/{game_id}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert "results" in data, "Response should contain 'results'"
            assert "game" in data, "Response should contain 'game'"
            print(f"✓ GET /api/results/{game_id} returned {len(data['results'])} results")


class TestAdminJantri:
    """Test admin jantri (result history) endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        self.token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_admin_jantri(self):
        """GET /api/admin/jantri should return jantri report"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "jantri" in data, "Response should contain 'jantri'"
        assert "games" in data, "Response should contain 'games'"
        print(f"✓ GET /api/admin/jantri returned {len(data['jantri'])} days of results")
    
    def test_admin_jantri_export(self):
        """GET /api/admin/jantri/export should return export data"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri/export")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "export_data" in data, "Response should contain 'export_data'"
        print(f"✓ GET /api/admin/jantri/export returned {len(data['export_data'])} records")


class TestHelpMessages:
    """Test help messages endpoints"""
    
    def test_get_help_messages(self):
        """GET /api/help/messages should return help messages"""
        response = requests.get(f"{BASE_URL}/api/help/messages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "messages" in data, "Response should contain 'messages'"
        assert isinstance(data["messages"], list), "Messages should be a list"
        print(f"✓ GET /api/help/messages returned {len(data['messages'])} messages")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
