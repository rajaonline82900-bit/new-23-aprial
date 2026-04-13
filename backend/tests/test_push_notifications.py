"""
Push Notification API Tests - Iteration 14
Tests for: /api/push/stats, /api/push/test, /api/push/send_all, /api/push/vapid-key, /api/push/subscribe
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPushNotificationEndpoints:
    """Push notification endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Admin login with Vikram@900 credentials
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": "Vikram@900", "password": "Vikram@900"}
        )
        if login_resp.status_code == 200:
            self.admin_token = login_resp.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        else:
            pytest.skip("Admin login failed - skipping push notification tests")
    
    # Test 1: GET /api/push/vapid-key returns valid key (no auth required)
    def test_vapid_key_endpoint_returns_valid_key(self):
        """GET /api/push/vapid-key should return a valid VAPID public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "key" in data, "Response should contain 'key' field"
        assert data["key"] is not None, "VAPID key should not be None"
        assert len(data["key"]) > 50, "VAPID key should be a long base64 string"
        print(f"✓ VAPID key endpoint returns valid key (length: {len(data['key'])})")
    
    # Test 2: GET /api/push/stats returns total_subscriptions (admin auth required)
    def test_push_stats_returns_total_subscriptions(self):
        """GET /api/push/stats should return total_subscriptions count"""
        response = self.session.get(f"{BASE_URL}/api/push/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "total_subscriptions" in data, "Response should contain 'total_subscriptions'"
        assert isinstance(data["total_subscriptions"], int), "total_subscriptions should be an integer"
        print(f"✓ Push stats returns total_subscriptions: {data['total_subscriptions']}")
    
    # Test 3: GET /api/push/stats without auth returns 401
    def test_push_stats_requires_admin_auth(self):
        """GET /api/push/stats without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/push/stats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Push stats requires admin authentication")
    
    # Test 4: POST /api/push/test returns error when admin not subscribed
    def test_push_test_returns_error_when_not_subscribed(self):
        """POST /api/push/test should return 400 when admin has no subscription"""
        response = self.session.post(f"{BASE_URL}/api/push/test", json={})
        # Should return 400 with message about subscribing first
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Response should contain 'detail' field"
        # Check for Hindi message about enabling notifications
        assert "allow" in data["detail"].lower() or "enable" in data["detail"].lower() or "dabayein" in data["detail"].lower() or "pehle" in data["detail"].lower(), \
            f"Error message should mention enabling notifications: {data['detail']}"
        print(f"✓ Test push returns proper error when admin not subscribed: {data['detail']}")
    
    # Test 5: POST /api/push/test without auth returns 401
    def test_push_test_requires_admin_auth(self):
        """POST /api/push/test without auth should return 401"""
        response = requests.post(f"{BASE_URL}/api/push/test", json={})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Test push requires admin authentication")
    
    # Test 6: POST /api/push/send_all without body returns 400
    def test_send_all_without_body_returns_400(self):
        """POST /api/push/send_all without body should return 400"""
        response = self.session.post(f"{BASE_URL}/api/push/send_all", json={"title": "Test"})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Response should contain 'detail' field"
        assert "body" in data["detail"].lower() or "message" in data["detail"].lower(), \
            f"Error should mention body/message required: {data['detail']}"
        print(f"✓ Send all without body returns 400: {data['detail']}")
    
    # Test 7: POST /api/push/send_all with title and body (admin auth required)
    def test_send_all_with_valid_payload(self):
        """POST /api/push/send_all with title and body should succeed"""
        response = self.session.post(
            f"{BASE_URL}/api/push/send_all",
            json={"title": "TEST_PUSH", "body": "This is a test notification"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "sent" in data, "Response should contain 'sent' field"
        assert isinstance(data["sent"], int), "sent should be an integer"
        assert "message" in data, "Response should contain 'message' field"
        print(f"✓ Send all with valid payload returns: sent={data['sent']}, message={data['message']}")
    
    # Test 8: POST /api/push/send_all without auth returns 401
    def test_send_all_requires_admin_auth(self):
        """POST /api/push/send_all without auth should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/push/send_all",
            json={"title": "Test", "body": "Test body"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Send all requires admin authentication")
    
    # Test 9: POST /api/push/subscribe requires auth token
    def test_push_subscribe_requires_auth(self):
        """POST /api/push/subscribe without auth should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={"subscription": {"endpoint": "https://test.com", "keys": {"p256dh": "test", "auth": "test"}}}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Push subscribe requires authentication")
    
    # Test 10: POST /api/push/subscribe with auth but no subscription returns 400
    def test_push_subscribe_requires_subscription_data(self):
        """POST /api/push/subscribe without subscription data should return 400"""
        response = self.session.post(f"{BASE_URL}/api/push/subscribe", json={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Response should contain 'detail' field"
        print(f"✓ Push subscribe requires subscription data: {data['detail']}")


class TestAdminLoginForPush:
    """Verify admin login works for push notification testing"""
    
    def test_admin_login_vikram(self):
        """Admin login with Vikram@900 credentials should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": "Vikram@900", "password": "Vikram@900"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "token" in data, "Response should contain 'token'"
        # User data is returned directly in response (not nested under 'user')
        assert "name" in data or "email" in data, "Response should contain user data"
        print(f"✓ Admin login with Vikram@900 works, user: {data.get('name', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
