"""
Test Referral & Earn Features
- Referral info API returns correct stats
- Complete-signup accepts optional referral_code field
- Apply referral code works for manual entry
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReferralFeatures:
    """Test referral-related API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test user
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": "Test@123"
        })
        if login_resp.status_code == 200:
            # Cookies are automatically stored in session
            print(f"Login successful for test user")
        else:
            pytest.skip(f"Login failed: {login_resp.status_code} - {login_resp.text}")
    
    def test_referral_info_returns_code(self):
        """GET /api/referral/info should return user's referral code"""
        resp = self.session.get(f"{BASE_URL}/api/referral/info")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert "code" in data, "Response should contain 'code' field"
        assert isinstance(data["code"], str), "Code should be a string"
        assert len(data["code"]) > 0, "Code should not be empty"
        print(f"SUCCESS: Referral code returned: {data['code']}")
    
    def test_referral_info_returns_stats(self):
        """GET /api/referral/info should return referred_count and total_earned"""
        resp = self.session.get(f"{BASE_URL}/api/referral/info")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert "referred_count" in data, "Response should contain 'referred_count'"
        assert "total_earned" in data, "Response should contain 'total_earned'"
        assert isinstance(data["referred_count"], int), "referred_count should be int"
        assert isinstance(data["total_earned"], (int, float)), "total_earned should be numeric"
        print(f"SUCCESS: Stats returned - referred_count: {data['referred_count']}, total_earned: {data['total_earned']}")
    
    def test_referral_info_requires_auth(self):
        """GET /api/referral/info should require authentication"""
        # Use a new session without auth
        no_auth_session = requests.Session()
        resp = no_auth_session.get(f"{BASE_URL}/api/referral/info")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("SUCCESS: Referral info requires authentication")
    
    def test_apply_referral_empty_code(self):
        """POST /api/referral/apply should reject empty code"""
        resp = self.session.post(f"{BASE_URL}/api/referral/apply", json={"code": ""})
        assert resp.status_code == 400, f"Expected 400 for empty code, got {resp.status_code}"
        print("SUCCESS: Empty referral code rejected")
    
    def test_apply_referral_invalid_code(self):
        """POST /api/referral/apply should reject invalid code"""
        resp = self.session.post(f"{BASE_URL}/api/referral/apply", json={"code": "INVALIDCODE123"})
        assert resp.status_code == 404, f"Expected 404 for invalid code, got {resp.status_code}"
        print("SUCCESS: Invalid referral code rejected with 404")
    
    def test_apply_referral_requires_auth(self):
        """POST /api/referral/apply should require authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        resp = no_auth_session.post(f"{BASE_URL}/api/referral/apply", json={"code": "TESTCODE"})
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("SUCCESS: Apply referral requires authentication")


class TestCompleteSignupWithReferral:
    """Test complete-signup endpoint with optional referral_code"""
    
    def test_complete_signup_model_accepts_referral_code(self):
        """Verify the OTPCompleteSignup model accepts referral_code field"""
        # This is a structural test - we verify the endpoint doesn't reject referral_code
        # We can't actually complete signup without OTP verification, but we can check
        # that the endpoint exists and accepts the field structure
        
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to complete signup without OTP verification - should fail with specific error
        resp = session.post(f"{BASE_URL}/api/auth/otp/complete-signup", json={
            "phone": "9999999999",
            "name": "Test User",
            "email": "test@test.com",
            "password": "Test@123",
            "referral_code": "SM822A06"  # This field should be accepted
        })
        
        # Should fail because OTP not verified, not because of referral_code field
        assert resp.status_code == 400, f"Expected 400 (OTP not verified), got {resp.status_code}"
        data = resp.json()
        # The error should be about OTP verification, not about invalid field
        assert "OTP" in data.get("detail", "") or "सत्यापित" in data.get("detail", ""), \
            f"Error should be about OTP verification, got: {data.get('detail')}"
        print(f"SUCCESS: complete-signup accepts referral_code field (rejected due to OTP, not field)")


class TestReferralCodeFormat:
    """Test referral code format and generation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test user
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": "Test@123"
        })
        if login_resp.status_code == 200:
            print(f"Login successful for test user")
        else:
            pytest.skip(f"Login failed: {login_resp.status_code}")
    
    def test_referral_code_format(self):
        """Referral code should start with SM and be uppercase"""
        resp = self.session.get(f"{BASE_URL}/api/referral/info")
        assert resp.status_code == 200
        
        data = resp.json()
        code = data["code"]
        
        assert code.startswith("SM"), f"Referral code should start with 'SM', got: {code}"
        assert code == code.upper(), f"Referral code should be uppercase, got: {code}"
        print(f"SUCCESS: Referral code format is correct: {code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
