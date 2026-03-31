"""
Test suite for Satta Matka Jantri Batch Betting Feature
Tests POST /api/bets/batch endpoint and related validations
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://matka-numbers-bet.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"
JANTRI_TEST_USER_EMAIL = "jantri@test.com"
JANTRI_TEST_USER_PASSWORD = "Test@123"
JANTRI_TEST_USER_BALANCE = 4800.0


class TestSetup:
    """Setup test user with balance for Jantri testing"""
    
    def test_setup_jantri_test_user(self):
        """Create jantri test user with ₹4800 balance"""
        admin_session = requests.Session()
        
        # Login as admin
        admin_login = admin_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        print("✓ Admin logged in")
        
        # Try to register test user
        user_session = requests.Session()
        register_response = user_session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "Jantri Test User",
                "email": JANTRI_TEST_USER_EMAIL,
                "password": JANTRI_TEST_USER_PASSWORD
            }
        )
        
        if register_response.status_code == 400:  # User exists
            login_response = user_session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": JANTRI_TEST_USER_EMAIL, "password": JANTRI_TEST_USER_PASSWORD}
            )
            assert login_response.status_code == 200, f"Test user login failed: {login_response.text}"
            print("✓ Jantri test user already exists, logged in")
        else:
            assert register_response.status_code == 200, f"Registration failed: {register_response.text}"
            print("✓ Jantri test user registered")
        
        # Get user info
        me_response = user_session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        user_data = me_response.json()
        user_id = user_data["id"]
        current_balance = user_data.get("balance", 0)
        
        print(f"  User ID: {user_id}, Current balance: ₹{current_balance}")
        
        # Add balance if needed
        if current_balance < JANTRI_TEST_USER_BALANCE:
            amount_to_add = JANTRI_TEST_USER_BALANCE - current_balance
            adjust_response = admin_session.post(
                f"{BASE_URL}/api/admin/users/{user_id}/wallet",
                json={
                    "amount": amount_to_add,
                    "type": "add",
                    "reason": "Test setup for Jantri batch betting"
                }
            )
            assert adjust_response.status_code == 200, f"Balance adjustment failed: {adjust_response.text}"
            print(f"✓ Added ₹{amount_to_add} to user balance")
        
        # Verify final balance
        me_response = user_session.get(f"{BASE_URL}/api/auth/me")
        final_balance = me_response.json().get("balance", 0)
        print(f"✓ Final balance: ₹{final_balance}")
        
        assert final_balance >= JANTRI_TEST_USER_BALANCE, f"Balance should be at least ₹{JANTRI_TEST_USER_BALANCE}"


class TestBatchBetEndpoint:
    """Test POST /api/bets/batch endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as jantri test user"""
        self.session = requests.Session()
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": JANTRI_TEST_USER_EMAIL, "password": JANTRI_TEST_USER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Get user balance
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        self.user_data = me_response.json()
        self.initial_balance = self.user_data.get("balance", 0)
        print(f"✓ Logged in as {JANTRI_TEST_USER_EMAIL}, balance: ₹{self.initial_balance}")
    
    def test_batch_bet_success(self):
        """Test successful batch bet placement"""
        # Find an open game
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()["games"]
        
        # Get current IST time
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        current_minutes = now_ist.hour * 60 + now_ist.minute
        
        open_game = None
        for game in games:
            start_time = game.get("start_time", "")
            end_time = game.get("end_time", "")
            
            if start_time and end_time:
                sh, sm = map(int, start_time.split(":"))
                eh, em = map(int, end_time.split(":"))
                start_min = sh * 60 + sm
                end_min = eh * 60 + em
                
                if start_min > end_min:
                    is_open = current_minutes >= start_min or current_minutes <= end_min
                else:
                    is_open = start_min <= current_minutes <= end_min
                
                if is_open:
                    open_game = game
                    print(f"Found open game: {game['id']} ({start_time} - {end_time})")
                    break
        
        if open_game is None:
            pytest.skip("No open games found at current time")
        
        # Place batch bet with 3 jodis
        batch_bets = [
            {"number": "00", "amount": 10},
            {"number": "55", "amount": 20},
            {"number": "99", "amount": 30}
        ]
        total_amount = sum(b["amount"] for b in batch_bets)
        
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": open_game["id"],
                "bet_type": "jodi",
                "bets": batch_bets
            }
        )
        
        assert response.status_code == 200, f"Batch bet failed: {response.text}"
        
        data = response.json()
        assert "total_bets" in data, "Response should have total_bets"
        assert "total_amount" in data, "Response should have total_amount"
        assert "total_potential_win" in data, "Response should have total_potential_win"
        
        assert data["total_bets"] == 3, f"Expected 3 bets, got {data['total_bets']}"
        assert data["total_amount"] == total_amount, f"Expected ₹{total_amount}, got ₹{data['total_amount']}"
        assert data["total_potential_win"] == total_amount * 90, f"Expected ₹{total_amount * 90} potential win"
        
        print(f"✓ Batch bet placed: {data['total_bets']} bets, ₹{data['total_amount']}, potential: ₹{data['total_potential_win']}")
        
        # Verify balance deduction
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        new_balance = me_response.json().get("balance", 0)
        expected_balance = self.initial_balance - total_amount
        
        assert abs(new_balance - expected_balance) < 0.01, \
            f"Balance should be ₹{expected_balance}, got ₹{new_balance}"
        print(f"✓ Balance deducted: ₹{self.initial_balance} → ₹{new_balance}")
    
    def test_batch_bet_minimum_amount_validation(self):
        """Test that batch bet rejects amounts less than ₹10"""
        games_response = requests.get(f"{BASE_URL}/api/games")
        game_id = games_response.json()["games"][0]["id"]
        
        # Try to place bet with amount < 10
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": game_id,
                "bet_type": "jodi",
                "bets": [
                    {"number": "00", "amount": 5}  # Less than minimum
                ]
            }
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for amount < 10, got {response.status_code}"
        
        detail = response.json().get("detail", "")
        assert "10" in detail or "minimum" in detail.lower() or "₹10" in detail, \
            f"Error should mention minimum ₹10: {detail}"
        
        print(f"✓ Minimum amount validation working: {detail}")
    
    def test_batch_bet_invalid_jodi_number(self):
        """Test that batch bet rejects invalid jodi numbers"""
        games_response = requests.get(f"{BASE_URL}/api/games")
        game_id = games_response.json()["games"][0]["id"]
        
        # Try invalid jodi numbers
        invalid_numbers = ["100", "9", "abc", "-1"]
        
        for invalid_num in invalid_numbers:
            response = self.session.post(
                f"{BASE_URL}/api/bets/batch",
                json={
                    "game_id": game_id,
                    "bet_type": "jodi",
                    "bets": [
                        {"number": invalid_num, "amount": 10}
                    ]
                }
            )
            
            # Should fail with 400
            assert response.status_code == 400, \
                f"Expected 400 for invalid jodi '{invalid_num}', got {response.status_code}"
            
            print(f"✓ Invalid jodi '{invalid_num}' rejected")
    
    def test_batch_bet_insufficient_balance(self):
        """Test that batch bet rejects when total exceeds balance"""
        games_response = requests.get(f"{BASE_URL}/api/games")
        game_id = games_response.json()["games"][0]["id"]
        
        # Get current balance
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        current_balance = me_response.json().get("balance", 0)
        
        # Try to bet more than balance
        excessive_amount = current_balance + 1000
        
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": game_id,
                "bet_type": "jodi",
                "bets": [
                    {"number": "00", "amount": excessive_amount}
                ]
            }
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
        
        detail = response.json().get("detail", "")
        assert "balance" in detail.lower() or "बैलेंस" in detail or "अपर्याप्त" in detail, \
            f"Error should mention insufficient balance: {detail}"
        
        print(f"✓ Insufficient balance validation working: {detail}")
    
    def test_batch_bet_empty_bets_array(self):
        """Test that batch bet rejects empty bets array"""
        games_response = requests.get(f"{BASE_URL}/api/games")
        game_id = games_response.json()["games"][0]["id"]
        
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": game_id,
                "bet_type": "jodi",
                "bets": []
            }
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for empty bets, got {response.status_code}"
        
        print(f"✓ Empty bets array rejected")
    
    def test_batch_bet_invalid_game_id(self):
        """Test that batch bet rejects invalid game_id"""
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": "invalid_game_xyz",
                "bet_type": "jodi",
                "bets": [
                    {"number": "00", "amount": 10}
                ]
            }
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for invalid game, got {response.status_code}"
        
        print(f"✓ Invalid game_id rejected")
    
    def test_batch_bet_time_lock(self):
        """Test that batch bet respects time-based betting lock"""
        # Get current IST time
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        current_minutes = now_ist.hour * 60 + now_ist.minute
        
        # Find a closed game
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()["games"]
        
        closed_game = None
        for game in games:
            start_time = game.get("start_time", "")
            end_time = game.get("end_time", "")
            
            if start_time and end_time:
                sh, sm = map(int, start_time.split(":"))
                eh, em = map(int, end_time.split(":"))
                start_min = sh * 60 + sm
                end_min = eh * 60 + em
                
                if start_min > end_min:
                    is_open = current_minutes >= start_min or current_minutes <= end_min
                else:
                    is_open = start_min <= current_minutes <= end_min
                
                if not is_open:
                    closed_game = game
                    break
        
        if closed_game is None:
            pytest.skip("No closed games found at current time")
        
        # Try to place batch bet on closed game
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": closed_game["id"],
                "bet_type": "jodi",
                "bets": [
                    {"number": "00", "amount": 10}
                ]
            }
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for closed game, got {response.status_code}"
        
        detail = response.json().get("detail", "")
        assert "बेटिंग बंद है" in detail or "closed" in detail.lower(), \
            f"Error should mention betting closed: {detail}"
        
        print(f"✓ Time-based lock working for batch bets: {detail}")


class TestBatchBetResponseFormat:
    """Test batch bet response format and data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as jantri test user"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": JANTRI_TEST_USER_EMAIL, "password": JANTRI_TEST_USER_PASSWORD}
        )
        assert login_response.status_code == 200
    
    def test_batch_bet_response_fields(self):
        """Verify batch bet response has all required fields"""
        # Find an open game
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()["games"]
        
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        current_minutes = now_ist.hour * 60 + now_ist.minute
        
        open_game = None
        for game in games:
            start_time = game.get("start_time", "")
            end_time = game.get("end_time", "")
            
            if start_time and end_time:
                sh, sm = map(int, start_time.split(":"))
                eh, em = map(int, end_time.split(":"))
                start_min = sh * 60 + sm
                end_min = eh * 60 + em
                
                if start_min > end_min:
                    is_open = current_minutes >= start_min or current_minutes <= end_min
                else:
                    is_open = start_min <= current_minutes <= end_min
                
                if is_open:
                    open_game = game
                    break
        
        if open_game is None:
            pytest.skip("No open games found at current time")
        
        # Place batch bet
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": open_game["id"],
                "bet_type": "jodi",
                "bets": [
                    {"number": "12", "amount": 10},
                    {"number": "34", "amount": 15}
                ]
            }
        )
        
        assert response.status_code == 200, f"Batch bet failed: {response.text}"
        
        data = response.json()
        
        # Check required fields
        required_fields = ["message", "total_bets", "total_amount", "total_potential_win"]
        for field in required_fields:
            assert field in data, f"Response missing field: {field}"
        
        # Verify calculations
        assert data["total_bets"] == 2
        assert data["total_amount"] == 25
        assert data["total_potential_win"] == 25 * 90  # 90x multiplier for jodi
        
        print(f"✓ Response format correct: {data}")


class TestBatchBetPersistence:
    """Test that batch bets are properly saved in database"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as jantri test user"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": JANTRI_TEST_USER_EMAIL, "password": JANTRI_TEST_USER_PASSWORD}
        )
        assert login_response.status_code == 200
    
    def test_batch_bets_appear_in_user_bets(self):
        """Verify batch bets appear in GET /api/bets"""
        # Find an open game
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()["games"]
        
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        current_minutes = now_ist.hour * 60 + now_ist.minute
        
        open_game = None
        for game in games:
            start_time = game.get("start_time", "")
            end_time = game.get("end_time", "")
            
            if start_time and end_time:
                sh, sm = map(int, start_time.split(":"))
                eh, em = map(int, end_time.split(":"))
                start_min = sh * 60 + sm
                end_min = eh * 60 + em
                
                if start_min > end_min:
                    is_open = current_minutes >= start_min or current_minutes <= end_min
                else:
                    is_open = start_min <= current_minutes <= end_min
                
                if is_open:
                    open_game = game
                    break
        
        if open_game is None:
            pytest.skip("No open games found at current time")
        
        # Get initial bets count
        initial_bets = self.session.get(f"{BASE_URL}/api/bets").json()["bets"]
        initial_count = len(initial_bets)
        
        # Place batch bet with unique numbers
        unique_numbers = ["77", "88"]
        response = self.session.post(
            f"{BASE_URL}/api/bets/batch",
            json={
                "game_id": open_game["id"],
                "bet_type": "jodi",
                "bets": [
                    {"number": num, "amount": 10} for num in unique_numbers
                ]
            }
        )
        
        assert response.status_code == 200, f"Batch bet failed: {response.text}"
        
        # Get updated bets
        updated_bets = self.session.get(f"{BASE_URL}/api/bets").json()["bets"]
        
        # Verify new bets were added
        assert len(updated_bets) >= initial_count + len(unique_numbers), \
            f"Expected at least {initial_count + len(unique_numbers)} bets, got {len(updated_bets)}"
        
        # Verify the specific bets exist
        recent_bets = updated_bets[:len(unique_numbers)]
        for bet in recent_bets:
            assert bet["bet_type"] == "jodi"
            assert bet["game_id"] == open_game["id"]
            assert bet["status"] == "pending"
        
        print(f"✓ Batch bets persisted: {len(unique_numbers)} new bets found in user's bet history")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
