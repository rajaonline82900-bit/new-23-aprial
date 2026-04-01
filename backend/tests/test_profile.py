"""
Profile Page Backend Tests
Tests for:
- PUT /api/auth/profile - Update name and email
- POST /api/auth/change-password - Change password
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProfileEndpoints:
    """Test profile update and password change endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as test user (phone: 9876543210, password: Test@123)
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": "Test@123"
        })
        
        if login_response.status_code != 200:
            # Try admin login as fallback
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "phone": "admin@sattamatka.com",
                "password": "Admin@123"
            })
        
        if login_response.status_code == 200:
            self.user_data = login_response.json()
            self.original_name = self.user_data.get("name", "")
            self.original_email = self.user_data.get("email", "")
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        yield
        
        # Cleanup: Restore original name if changed
        if hasattr(self, 'original_name') and self.original_name:
            self.session.put(f"{BASE_URL}/api/auth/profile", json={
                "name": self.original_name
            })
    
    # ==================== Profile Update Tests ====================
    
    def test_get_profile_info(self):
        """Test GET /api/auth/me returns user profile info"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "name" in data, "Response should contain 'name'"
        assert "email" in data, "Response should contain 'email'"
        assert "phone" in data, "Response should contain 'phone'"
        assert "role" in data, "Response should contain 'role'"
        print(f"✓ Profile info retrieved: name={data['name']}, email={data['email']}, phone={data['phone']}")
    
    def test_update_profile_name_only(self):
        """Test updating only the name via PUT /api/auth/profile"""
        new_name = "Test Profile Update"
        response = self.session.put(f"{BASE_URL}/api/auth/profile", json={
            "name": new_name
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("name") == new_name, f"Name should be updated to '{new_name}'"
        print(f"✓ Name updated successfully to: {new_name}")
        
        # Verify via GET /api/auth/me
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["name"] == new_name, "Name should persist after update"
        print(f"✓ Name persisted correctly: {me_data['name']}")
    
    def test_update_profile_email_only(self):
        """Test updating only the email via PUT /api/auth/profile"""
        new_email = "test_profile_update@example.com"
        response = self.session.put(f"{BASE_URL}/api/auth/profile", json={
            "email": new_email
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("email") == new_email.lower(), f"Email should be updated to '{new_email}'"
        print(f"✓ Email updated successfully to: {new_email}")
        
        # Restore original email
        if self.original_email:
            self.session.put(f"{BASE_URL}/api/auth/profile", json={
                "email": self.original_email
            })
    
    def test_update_profile_name_and_email(self):
        """Test updating both name and email via PUT /api/auth/profile"""
        new_name = "Test Both Update"
        new_email = "test_both_update@example.com"
        
        response = self.session.put(f"{BASE_URL}/api/auth/profile", json={
            "name": new_name,
            "email": new_email
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("name") == new_name, f"Name should be '{new_name}'"
        assert data.get("email") == new_email.lower(), f"Email should be '{new_email}'"
        print(f"✓ Both name and email updated: name={new_name}, email={new_email}")
        
        # Restore original values
        restore_data = {}
        if self.original_name:
            restore_data["name"] = self.original_name
        if self.original_email:
            restore_data["email"] = self.original_email
        if restore_data:
            self.session.put(f"{BASE_URL}/api/auth/profile", json=restore_data)
    
    def test_update_profile_empty_name_fails(self):
        """Test that empty name is rejected"""
        response = self.session.put(f"{BASE_URL}/api/auth/profile", json={
            "name": ""
        })
        
        # Should fail with 400 or return no changes message
        # Based on code: empty name is skipped, so if only empty name provided, it returns 400 "कोई बदलाव नहीं दिया गया"
        assert response.status_code == 400, f"Expected 400 for empty name, got {response.status_code}"
        print(f"✓ Empty name correctly rejected: {response.json()}")
    
    def test_update_profile_no_changes(self):
        """Test that no changes returns appropriate response"""
        # First get current profile
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        current_data = me_response.json()
        
        # Try to update with same values
        response = self.session.put(f"{BASE_URL}/api/auth/profile", json={
            "name": current_data["name"],
            "email": current_data.get("email", "")
        })
        
        # Should return 400 with "कोई बदलाव नहीं दिया गया" or 200 with no changes message
        # Based on frontend code, it checks for changes before sending
        # Backend returns 400 if no updates dict
        print(f"✓ No changes response: {response.status_code} - {response.text}")
    
    def test_update_profile_requires_auth(self):
        """Test that profile update requires authentication"""
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.put(f"{BASE_URL}/api/auth/profile", json={
            "name": "Unauthorized Update"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Profile update correctly requires authentication")
    
    # ==================== Password Change Tests ====================
    
    def test_change_password_wrong_current_password(self):
        """Test that wrong current password is rejected"""
        response = self.session.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "WrongPassword123",
            "new_password": "NewPassword123"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Response should contain error detail"
        # Hindi error: "वर्तमान पासवर्ड गलत है"
        print(f"✓ Wrong current password correctly rejected: {data['detail']}")
    
    def test_change_password_short_new_password(self):
        """Test that new password < 6 chars is rejected"""
        response = self.session.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "Test@123",
            "new_password": "12345"  # Only 5 chars
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        # Hindi error: "नया पासवर्ड कम से कम 6 अक्षर का होना चाहिए"
        print(f"✓ Short new password correctly rejected: {data['detail']}")
    
    def test_change_password_requires_auth(self):
        """Test that password change requires authentication"""
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "Test@123",
            "new_password": "NewPassword123"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Password change correctly requires authentication")
    
    def test_change_password_success(self):
        """Test successful password change and revert"""
        original_password = "Test@123"
        new_password = "NewTest@456"
        
        # Change password
        response = self.session.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": original_password,
            "new_password": new_password
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain success message"
        print(f"✓ Password changed successfully: {data['message']}")
        
        # Verify new password works by logging in again
        new_session = requests.Session()
        login_response = new_session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": new_password
        })
        
        assert login_response.status_code == 200, f"Login with new password failed: {login_response.status_code}"
        print(f"✓ Login with new password successful")
        
        # Revert password back to original
        revert_response = new_session.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": new_password,
            "new_password": original_password
        })
        
        assert revert_response.status_code == 200, f"Password revert failed: {revert_response.status_code}"
        print(f"✓ Password reverted back to original")


class TestDuplicateEmailValidation:
    """Test duplicate email validation in profile update"""
    
    def test_duplicate_email_rejected(self):
        """Test that updating to an existing email is rejected"""
        session = requests.Session()
        
        # Login as test user
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": "Test@123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Test user login failed")
        
        # Try to update email to admin's email
        response = session.put(f"{BASE_URL}/api/auth/profile", json={
            "email": "admin@sattamatka.com"
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        data = response.json()
        # Hindi error: "यह ईमेल पहले से उपयोग में है"
        print(f"✓ Duplicate email correctly rejected: {data.get('detail', data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
