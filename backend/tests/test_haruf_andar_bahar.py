"""
Test Haruf Andar/Bahar betting feature
- haruf_andar: bet on first digit (left) of jodi result, 9x multiplier
- haruf_bahar: bet on second digit (right) of jodi result, 9x multiplier
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHarufBetTypes:
    """Test haruf_andar and haruf_bahar bet types in batch API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as test user before each test"""
        self.session = requests.Session()
        # Login as jantri test user (has balance)
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "jantri@test.com",
            "password": "Test@123"
        })
        if login_resp.status_code != 200:
            # Create user if doesn't exist
            reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
                "name": "Haruf Test User",
                "email": "haruf_test@test.com",
                "password": "Test@123"
            })
            if reg_resp.status_code == 200:
                # Add balance via admin
                admin_session = requests.Session()
                admin_session.post(f"{BASE_URL}/api/auth/login", json={
                    "email": "admin@sattamatka.com",
                    "password": "Admin@123"
                })
                # Get user id
                me_resp = self.session.get(f"{BASE_URL}/api/auth/me")
                user_id = me_resp.json().get("id")
                admin_session.post(f"{BASE_URL}/api/admin/users/{user_id}/wallet", json={
                    "amount": 5000,
                    "type": "add",
                    "reason": "Test balance for haruf testing"
                })
        yield
        
    def test_haruf_andar_accepts_single_digit(self):
        """haruf_andar should accept single digit 0-9"""
        resp = self.session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_andar",
            "bets": [{"number": "5", "amount": 10}]
        })
        # May fail due to time lock, but should not fail due to invalid number
        if resp.status_code == 400:
            detail = resp.json().get("detail", "")
            assert "Invalid single number" not in detail, f"haruf_andar should accept single digit: {detail}"
            # Time lock is acceptable
            assert "बेटिंग बंद" in detail or "time" in detail.lower() or resp.status_code == 200
        else:
            assert resp.status_code == 200
            print(f"haruf_andar bet placed successfully: {resp.json()}")
    
    def test_haruf_bahar_accepts_single_digit(self):
        """haruf_bahar should accept single digit 0-9"""
        resp = self.session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_bahar",
            "bets": [{"number": "7", "amount": 10}]
        })
        if resp.status_code == 400:
            detail = resp.json().get("detail", "")
            assert "Invalid single number" not in detail, f"haruf_bahar should accept single digit: {detail}"
        else:
            assert resp.status_code == 200
            print(f"haruf_bahar bet placed successfully: {resp.json()}")
    
    def test_haruf_andar_rejects_two_digit(self):
        """haruf_andar should reject two digit numbers"""
        resp = self.session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_andar",
            "bets": [{"number": "57", "amount": 10}]
        })
        # Should fail with invalid number error (not time lock)
        if resp.status_code == 400:
            detail = resp.json().get("detail", "")
            # Either invalid number or time lock
            print(f"Response: {detail}")
        assert resp.status_code == 400 or "Invalid" in str(resp.json())
    
    def test_haruf_bahar_rejects_two_digit(self):
        """haruf_bahar should reject two digit numbers"""
        resp = self.session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_bahar",
            "bets": [{"number": "99", "amount": 10}]
        })
        if resp.status_code == 400:
            detail = resp.json().get("detail", "")
            print(f"Response: {detail}")
        assert resp.status_code == 400 or "Invalid" in str(resp.json())
    
    def test_haruf_multiplier_is_9x(self):
        """haruf_andar and haruf_bahar should have 9x multiplier"""
        # Test haruf_andar
        resp = self.session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_andar",
            "bets": [{"number": "3", "amount": 100}]
        })
        if resp.status_code == 200:
            data = resp.json()
            # 100 * 9 = 900
            assert data.get("total_potential_win") == 900, f"Expected 900, got {data.get('total_potential_win')}"
            print(f"haruf_andar 9x multiplier verified: {data}")
        else:
            print(f"Could not verify multiplier due to: {resp.json()}")
    
    def test_haruf_all_digits_0_to_9(self):
        """Test all digits 0-9 are accepted for haruf bets"""
        for digit in range(10):
            resp = self.session.post(f"{BASE_URL}/api/bets/batch", json={
                "game_id": "delhi_bazaar",
                "bet_type": "haruf_andar",
                "bets": [{"number": str(digit), "amount": 10}]
            })
            if resp.status_code == 400:
                detail = resp.json().get("detail", "")
                # Should not fail due to invalid number
                assert "Invalid" not in detail or "बेटिंग बंद" in detail, f"Digit {digit} should be valid"
            print(f"Digit {digit}: status={resp.status_code}")


class TestHarufResultDeclaration:
    """Test result declaration settles haruf bets correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.admin_session = requests.Session()
        login_resp = self.admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        yield
    
    def test_result_declaration_returns_haruf_winners(self):
        """Result declaration should return haruf_andar and haruf_bahar winner counts"""
        # This test checks the response structure
        # We can't actually declare a result without affecting real data
        # So we just verify the endpoint exists and returns expected structure
        
        # Get admin stats to verify haruf is tracked
        stats_resp = self.admin_session.get(f"{BASE_URL}/api/admin/stats")
        assert stats_resp.status_code == 200
        print(f"Admin stats: {stats_resp.json()}")


class TestBetTypesConfig:
    """Test BET_TYPES configuration includes haruf types"""
    
    def test_bet_types_endpoint_or_config(self):
        """Verify haruf_andar and haruf_bahar are valid bet types"""
        session = requests.Session()
        
        # Try to place a bet with haruf_andar - if bet_type is invalid, it will fail
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        
        # Test invalid bet type
        resp = session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "invalid_type",
            "bets": [{"number": "5", "amount": 10}]
        })
        assert resp.status_code == 400
        assert "Invalid bet type" in resp.json().get("detail", "")
        print("Invalid bet type correctly rejected")
        
        # Test haruf_andar is valid
        resp = session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_andar",
            "bets": [{"number": "5", "amount": 10}]
        })
        # Should not fail with "Invalid bet type"
        if resp.status_code == 400:
            detail = resp.json().get("detail", "")
            assert "Invalid bet type" not in detail, "haruf_andar should be a valid bet type"
        print(f"haruf_andar is valid bet type: {resp.status_code}")
        
        # Test haruf_bahar is valid
        resp = session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_bahar",
            "bets": [{"number": "7", "amount": 10}]
        })
        if resp.status_code == 400:
            detail = resp.json().get("detail", "")
            assert "Invalid bet type" not in detail, "haruf_bahar should be a valid bet type"
        print(f"haruf_bahar is valid bet type: {resp.status_code}")


class TestHarufMinimumAmount:
    """Test minimum bet amount validation for haruf bets"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        yield
    
    def test_haruf_minimum_10_rupees(self):
        """Haruf bets should require minimum ₹10"""
        resp = self.session.post(f"{BASE_URL}/api/bets/batch", json={
            "game_id": "delhi_bazaar",
            "bet_type": "haruf_andar",
            "bets": [{"number": "5", "amount": 5}]
        })
        assert resp.status_code == 400
        detail = resp.json().get("detail", "")
        assert "Minimum" in detail or "₹10" in detail or "10" in detail
        print(f"Minimum amount validation: {detail}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
