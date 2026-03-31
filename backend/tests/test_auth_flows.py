"""
Test Auth Flows for Satta Matka App
- Signup: Name + Phone → OTP → Password → Account Created
- Login: Phone + Password → Dashboard
- Admin Login: Email + Password → Dashboard
- Password Reset: Phone → OTP → New Password → Success
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOTPSignupFlow:
    """Test OTP-based signup flow (3 steps)"""
    
    def test_send_otp_success(self):
        """Step 1: Send OTP to phone number"""
        phone = f"99{uuid.uuid4().hex[:8]}"  # Random phone
        response = requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": phone,
            "name": "Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data.get("demo_otp") == "1234"  # Demo OTP
    
    def test_send_otp_invalid_phone(self):
        """Step 1: Reject invalid phone number"""
        response = requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": "123",  # Too short
            "name": "Test User"
        })
        assert response.status_code == 400
    
    def test_verify_otp_success(self):
        """Step 2: Verify OTP"""
        phone = f"98{uuid.uuid4().hex[:8]}"
        # First send OTP
        requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": phone,
            "name": "Test User"
        })
        # Then verify
        response = requests.post(f"{BASE_URL}/api/auth/otp/verify", json={
            "phone": phone,
            "otp": "1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("phone_verified") == True
    
    def test_verify_otp_wrong_code(self):
        """Step 2: Reject wrong OTP"""
        phone = f"97{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": phone,
            "name": "Test User"
        })
        response = requests.post(f"{BASE_URL}/api/auth/otp/verify", json={
            "phone": phone,
            "otp": "9999"  # Wrong OTP
        })
        assert response.status_code == 400
    
    def test_complete_signup_success(self):
        """Step 3: Complete signup with password"""
        phone = f"96{uuid.uuid4().hex[:8]}"
        name = "Complete Test User"
        
        # Step 1: Send OTP
        requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": phone,
            "name": name
        })
        
        # Step 2: Verify OTP
        requests.post(f"{BASE_URL}/api/auth/otp/verify", json={
            "phone": phone,
            "otp": "1234"
        })
        
        # Step 3: Complete signup
        response = requests.post(f"{BASE_URL}/api/auth/otp/complete-signup", json={
            "phone": phone,
            "name": name,
            "password": "testpass123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("name") == name
        assert data.get("phone") == phone
        assert data.get("role") == "user"
        assert "id" in data
    
    def test_complete_signup_without_verification(self):
        """Step 3: Reject signup without OTP verification"""
        phone = f"95{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/auth/otp/complete-signup", json={
            "phone": phone,
            "name": "Test User",
            "password": "testpass123"
        })
        assert response.status_code == 400


class TestLoginFlow:
    """Test login with phone + password"""
    
    @pytest.fixture(autouse=True)
    def setup_test_user(self):
        """Create a test user for login tests"""
        self.phone = f"94{uuid.uuid4().hex[:8]}"
        self.password = "logintest123"
        self.name = "Login Test User"
        
        # Create user via OTP flow
        requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": self.phone,
            "name": self.name
        })
        requests.post(f"{BASE_URL}/api/auth/otp/verify", json={
            "phone": self.phone,
            "otp": "1234"
        })
        requests.post(f"{BASE_URL}/api/auth/otp/complete-signup", json={
            "phone": self.phone,
            "name": self.name,
            "password": self.password
        })
    
    def test_login_with_phone_success(self):
        """Login with phone + password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "phone": self.phone,
            "password": self.password
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("phone") == self.phone
        assert data.get("name") == self.name
        assert "id" in data
    
    def test_login_wrong_password(self):
        """Reject wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "phone": self.phone,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self):
        """Reject nonexistent user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "0000000000",
            "password": "anypassword"
        })
        assert response.status_code == 401


class TestAdminLogin:
    """Test admin login with email in phone field"""
    
    def test_admin_login_with_email(self):
        """Admin can login with email in phone field"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") == "admin"
        assert data.get("email") == "admin@sattamatka.com"


class TestPasswordResetFlow:
    """Test password reset flow (3 steps)"""
    
    @pytest.fixture(autouse=True)
    def setup_test_user(self):
        """Create a test user for password reset tests"""
        self.phone = f"93{uuid.uuid4().hex[:8]}"
        self.old_password = "oldpass123"
        self.new_password = "newpass456"
        self.name = "Reset Test User"
        
        # Create user via OTP flow
        requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": self.phone,
            "name": self.name
        })
        requests.post(f"{BASE_URL}/api/auth/otp/verify", json={
            "phone": self.phone,
            "otp": "1234"
        })
        requests.post(f"{BASE_URL}/api/auth/otp/complete-signup", json={
            "phone": self.phone,
            "name": self.name,
            "password": self.old_password
        })
    
    def test_password_reset_send_otp(self):
        """Step 1: Send OTP for password reset"""
        response = requests.post(f"{BASE_URL}/api/auth/password/send-otp", json={
            "phone": self.phone
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("demo_otp") == "1234"
    
    def test_password_reset_unregistered_phone(self):
        """Step 1: Reject unregistered phone"""
        response = requests.post(f"{BASE_URL}/api/auth/password/send-otp", json={
            "phone": "0000000000"
        })
        assert response.status_code == 400
    
    def test_password_reset_complete(self):
        """Full password reset flow"""
        # Step 1: Send OTP
        requests.post(f"{BASE_URL}/api/auth/password/send-otp", json={
            "phone": self.phone
        })
        
        # Step 2 & 3: Reset password
        response = requests.post(f"{BASE_URL}/api/auth/password/reset", json={
            "phone": self.phone,
            "otp": "1234",
            "new_password": self.new_password
        })
        assert response.status_code == 200
        
        # Verify can login with new password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "phone": self.phone,
            "password": self.new_password
        })
        assert login_response.status_code == 200
        
        # Verify old password no longer works
        old_login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "phone": self.phone,
            "password": self.old_password
        })
        assert old_login_response.status_code == 401
    
    def test_password_reset_wrong_otp(self):
        """Reject wrong OTP in password reset"""
        requests.post(f"{BASE_URL}/api/auth/password/send-otp", json={
            "phone": self.phone
        })
        
        response = requests.post(f"{BASE_URL}/api/auth/password/reset", json={
            "phone": self.phone,
            "otp": "9999",  # Wrong OTP
            "new_password": self.new_password
        })
        assert response.status_code == 400


class TestAuthMe:
    """Test /api/auth/me endpoint"""
    
    def test_auth_me_with_cookie(self):
        """Get current user with session cookie"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        assert login_response.status_code == 200
        
        # Get current user
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        assert data.get("email") == "admin@sattamatka.com"
        assert data.get("role") == "admin"
    
    def test_auth_me_without_auth(self):
        """Reject unauthenticated request"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


class TestLogout:
    """Test logout endpoint"""
    
    def test_logout_clears_session(self):
        """Logout clears session cookies"""
        session = requests.Session()
        
        # Login
        session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        
        # Verify session is cleared
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
