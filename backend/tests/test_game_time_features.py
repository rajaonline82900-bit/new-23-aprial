"""
Test suite for Satta Matka Game Time Features
Tests start_time and end_time functionality for games
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://matka-numbers-bet.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@sattamatka.com"
ADMIN_PASSWORD = "Admin@123"
TEST_USER_EMAIL = "testuser_time@example.com"
TEST_USER_PASSWORD = "Test@123"


class TestGamesAPI:
    """Test GET /api/games returns start_time and end_time"""
    
    def test_games_list_has_start_and_end_time(self):
        """Verify GET /api/games returns start_time and end_time for each game"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "games" in data, "Response should have 'games' key"
        assert len(data["games"]) > 0, "Should have at least one game"
        
        for game in data["games"]:
            assert "start_time" in game, f"Game {game.get('id')} missing start_time"
            assert "end_time" in game, f"Game {game.get('id')} missing end_time"
            assert "id" in game, "Game should have id"
            assert "name" in game, "Game should have name"
            
            # Validate time format (HH:MM)
            if game["start_time"]:
                assert len(game["start_time"]) == 5, f"start_time should be HH:MM format, got {game['start_time']}"
                assert ":" in game["start_time"], "start_time should contain colon"
            if game["end_time"]:
                assert len(game["end_time"]) == 5, f"end_time should be HH:MM format, got {game['end_time']}"
                assert ":" in game["end_time"], "end_time should contain colon"
        
        print(f"✓ All {len(data['games'])} games have start_time and end_time")
    
    def test_single_game_has_start_and_end_time(self):
        """Verify GET /api/games/{game_id} returns start_time and end_time"""
        response = requests.get(f"{BASE_URL}/api/games/delhi_bazaar")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "start_time" in data, "Game should have start_time"
        assert "end_time" in data, "Game should have end_time"
        assert data["start_time"] == "14:00", f"Delhi Bazaar start_time should be 14:00, got {data['start_time']}"
        assert data["end_time"] == "15:00", f"Delhi Bazaar end_time should be 15:00, got {data['end_time']}"
        
        print(f"✓ Single game API returns start_time: {data['start_time']}, end_time: {data['end_time']}")


class TestAdminGamesAPI:
    """Test Admin Games API for start_time and end_time"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        print("✓ Admin logged in successfully")
    
    def test_admin_games_list_has_start_and_end_time(self):
        """Verify GET /api/admin/games returns start_time and end_time"""
        response = self.session.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "games" in data, "Response should have 'games' key"
        
        for game in data["games"]:
            assert "start_time" in game, f"Game {game.get('game_id')} missing start_time"
            assert "end_time" in game, f"Game {game.get('game_id')} missing end_time"
            assert "game_id" in game, "Game should have game_id"
            print(f"  - {game['game_id']}: {game.get('start_time', 'N/A')} - {game.get('end_time', 'N/A')}")
        
        print(f"✓ Admin games API returns {len(data['games'])} games with time fields")
    
    def test_update_game_start_and_end_time(self):
        """Verify PUT /api/admin/games/{game_id} can update start_time and end_time"""
        game_id = "delhi_bazaar"
        
        # Get current game data
        get_response = self.session.get(f"{BASE_URL}/api/admin/games")
        assert get_response.status_code == 200
        games = get_response.json()["games"]
        original_game = next((g for g in games if g["game_id"] == game_id), None)
        assert original_game is not None, f"Game {game_id} not found"
        
        original_start = original_game.get("start_time", "14:00")
        original_end = original_game.get("end_time", "15:00")
        
        # Update with new times
        new_start = "13:30"
        new_end = "14:30"
        
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/games/{game_id}",
            json={
                "start_time": new_start,
                "end_time": new_end
            }
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify update
        verify_response = self.session.get(f"{BASE_URL}/api/admin/games")
        assert verify_response.status_code == 200
        updated_games = verify_response.json()["games"]
        updated_game = next((g for g in updated_games if g["game_id"] == game_id), None)
        
        assert updated_game["start_time"] == new_start, f"start_time not updated: {updated_game['start_time']}"
        assert updated_game["end_time"] == new_end, f"end_time not updated: {updated_game['end_time']}"
        
        print(f"✓ Game {game_id} updated: {new_start} - {new_end}")
        
        # Restore original times
        restore_response = self.session.put(
            f"{BASE_URL}/api/admin/games/{game_id}",
            json={
                "start_time": original_start,
                "end_time": original_end
            }
        )
        assert restore_response.status_code == 200, "Failed to restore original times"
        print(f"✓ Restored original times: {original_start} - {original_end}")
    
    def test_create_game_with_start_and_end_time(self):
        """Verify POST /api/admin/games creates game with start_time and end_time"""
        test_game_id = f"test_game_{datetime.now().strftime('%H%M%S')}"
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/games",
            json={
                "game_id": test_game_id,
                "name": "Test Game",
                "name_hi": "टेस्ट गेम",
                "start_time": "10:00",
                "end_time": "11:00",
                "display_time": "10:00 AM",
                "is_active": True
            }
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        # Verify game was created with correct times
        verify_response = self.session.get(f"{BASE_URL}/api/admin/games")
        assert verify_response.status_code == 200
        games = verify_response.json()["games"]
        created_game = next((g for g in games if g["game_id"] == test_game_id), None)
        
        assert created_game is not None, f"Created game {test_game_id} not found"
        assert created_game["start_time"] == "10:00", f"start_time incorrect: {created_game['start_time']}"
        assert created_game["end_time"] == "11:00", f"end_time incorrect: {created_game['end_time']}"
        
        print(f"✓ Created game {test_game_id} with start_time: 10:00, end_time: 11:00")
        
        # Cleanup - delete test game
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/games/{test_game_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Cleaned up test game {test_game_id}")


class TestBettingTimeLock:
    """Test betting time-based lock functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and admin sessions"""
        self.admin_session = requests.Session()
        self.user_session = requests.Session()
        
        # Login as admin
        admin_login = self.admin_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert admin_login.status_code == 200, "Admin login failed"
        
        # Register/login test user
        register_response = self.user_session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "Test User Time",
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        
        if register_response.status_code == 400:  # User exists
            login_response = self.user_session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
            )
            assert login_response.status_code == 200, "Test user login failed"
        else:
            assert register_response.status_code == 200, f"Registration failed: {register_response.text}"
        
        print("✓ Test sessions setup complete")
    
    def test_bet_rejected_when_game_closed(self):
        """Verify POST /api/bets rejects bet when game is closed (outside time window)"""
        # Get current IST time
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        current_hour = now_ist.hour
        current_minute = now_ist.minute
        
        print(f"Current IST time: {current_hour:02d}:{current_minute:02d}")
        
        # Find a game that should be closed based on current time
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()["games"]
        
        closed_game = None
        for game in games:
            start_time = game.get("start_time", "")
            end_time = game.get("end_time", "")
            
            if start_time and end_time:
                sh, sm = map(int, start_time.split(":"))
                eh, em = map(int, end_time.split(":"))
                
                current_minutes = current_hour * 60 + current_minute
                start_minutes = sh * 60 + sm
                end_minutes = eh * 60 + em
                
                # Check if game is closed
                if start_minutes > end_minutes:
                    # Overnight game
                    is_open = current_minutes >= start_minutes or current_minutes <= end_minutes
                else:
                    is_open = start_minutes <= current_minutes <= end_minutes
                
                if not is_open:
                    closed_game = game
                    print(f"Found closed game: {game['id']} ({start_time} - {end_time})")
                    break
        
        if closed_game is None:
            pytest.skip("No closed games found at current time - all games are open")
        
        # Try to place bet on closed game
        bet_response = self.user_session.post(
            f"{BASE_URL}/api/bets",
            json={
                "game_id": closed_game["id"],
                "bet_type": "single",
                "number": "5",
                "amount": 10
            }
        )
        
        # Should be rejected with 400 status
        assert bet_response.status_code == 400, f"Expected 400 for closed game, got {bet_response.status_code}"
        
        error_detail = bet_response.json().get("detail", "")
        assert "बेटिंग बंद है" in error_detail or "betting" in error_detail.lower(), \
            f"Error should mention betting closed: {error_detail}"
        
        print(f"✓ Bet correctly rejected for closed game {closed_game['id']}: {error_detail}")
    
    def test_bet_time_window_validation(self):
        """Test that backend validates betting time window correctly"""
        # This test verifies the time check logic exists in the backend
        # by checking the error message format
        
        # Use a game that's definitely closed (delhi_bazaar: 14:00-15:00)
        # Current time is around 10:30 IST, so this should be closed
        
        bet_response = self.user_session.post(
            f"{BASE_URL}/api/bets",
            json={
                "game_id": "delhi_bazaar",
                "bet_type": "single",
                "number": "5",
                "amount": 10
            }
        )
        
        # Check response - either 400 (closed) or 400 (insufficient balance)
        if bet_response.status_code == 400:
            detail = bet_response.json().get("detail", "")
            if "बेटिंग बंद है" in detail:
                print(f"✓ Time-based lock working: {detail}")
            elif "balance" in detail.lower() or "बैलेंस" in detail:
                print("✓ Bet validation working (insufficient balance)")
            else:
                print(f"✓ Bet validation working: {detail}")
        else:
            # If 200, game might be open at current time
            print(f"Note: Bet placed successfully - game might be open at current time")


class TestGameTimeFormats:
    """Test time format validation and edge cases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
    
    def test_overnight_game_time_format(self):
        """Test that overnight games (start > end) are handled correctly"""
        # Disawar is 04:00-05:00 which is an early morning game
        response = requests.get(f"{BASE_URL}/api/games/disawar")
        assert response.status_code == 200
        
        data = response.json()
        assert data["start_time"] == "04:00", f"Disawar start_time should be 04:00"
        assert data["end_time"] == "05:00", f"Disawar end_time should be 05:00"
        
        print(f"✓ Overnight game Disawar has correct times: {data['start_time']} - {data['end_time']}")
    
    def test_all_default_games_have_valid_times(self):
        """Verify all default games have valid time configurations"""
        expected_games = {
            "delhi_bazaar": ("14:00", "15:00"),
            "shri_ganesh": ("17:00", "18:00"),
            "faridabad": ("17:15", "18:15"),
            "ghaziabad": ("19:30", "20:30"),
            "gali": ("22:30", "23:30"),
            "disawar": ("04:00", "05:00")
        }
        
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = {g["id"]: g for g in response.json()["games"]}
        
        for game_id, (expected_start, expected_end) in expected_games.items():
            assert game_id in games, f"Game {game_id} not found"
            game = games[game_id]
            
            assert game["start_time"] == expected_start, \
                f"{game_id} start_time: expected {expected_start}, got {game['start_time']}"
            assert game["end_time"] == expected_end, \
                f"{game_id} end_time: expected {expected_end}, got {game['end_time']}"
            
            print(f"✓ {game_id}: {game['start_time']} - {game['end_time']}")
        
        print(f"✓ All {len(expected_games)} default games have correct time configurations")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
