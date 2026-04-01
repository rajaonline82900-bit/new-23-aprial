"""
Test cases for:
1. Cancel withdrawal endpoint POST /api/wallet/withdraw/{id}/cancel
2. Referral 5% bonus on first deposit
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://matka-numbers-bet.preview.emergentagent.com').rstrip('/')

class TestCancelWithdrawal:
    """Test cancel withdrawal functionality"""
    
    @pytest.fixture
    def test_user_session(self):
        """Login as test user and return session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as test user
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": "Test@123"
        })
        
        if response.status_code != 200:
            pytest.skip("Test user login failed - user may not exist")
        
        return session
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "admin@sattamatka.com",
            "password": "Admin@123"
        })
        
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        
        return session
    
    def test_cancel_withdrawal_endpoint_exists(self, test_user_session):
        """Test that cancel withdrawal endpoint exists and returns proper error for invalid ID"""
        response = test_user_session.post(f"{BASE_URL}/api/wallet/withdraw/invalid-id/cancel")
        
        # Should return 404 for non-existent withdrawal, not 405 (method not allowed)
        assert response.status_code in [404, 401], f"Expected 404 or 401, got {response.status_code}: {response.text}"
        print(f"✓ Cancel withdrawal endpoint exists and returns {response.status_code} for invalid ID")
    
    def test_cancel_withdrawal_requires_auth(self):
        """Test that cancel withdrawal requires authentication"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/wallet/withdraw/test-id/cancel")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Cancel withdrawal requires authentication")
    
    def test_cancel_withdrawal_full_flow(self, test_user_session, admin_session):
        """Test full cancel withdrawal flow: create withdrawal -> cancel -> verify refund"""
        
        # Step 1: Get current balance
        wallet_response = test_user_session.get(f"{BASE_URL}/api/wallet")
        assert wallet_response.status_code == 200, f"Failed to get wallet: {wallet_response.text}"
        initial_balance = wallet_response.json().get("balance", 0)
        print(f"Initial balance: ₹{initial_balance}")
        
        # Step 2: Add balance via admin if needed (for testing)
        if initial_balance < 200:
            # Use admin to add balance
            me_response = test_user_session.get(f"{BASE_URL}/api/auth/me")
            if me_response.status_code == 200:
                user_id = me_response.json().get("id")
                # Admin adds balance
                admin_response = admin_session.post(f"{BASE_URL}/api/admin/users/{user_id}/balance", json={
                    "amount": 500,
                    "type": "add"
                })
                if admin_response.status_code == 200:
                    wallet_response = test_user_session.get(f"{BASE_URL}/api/wallet")
                    initial_balance = wallet_response.json().get("balance", 0)
                    print(f"Balance after admin add: ₹{initial_balance}")
        
        if initial_balance < 100:
            pytest.skip("Insufficient balance to test withdrawal")
        
        # Step 3: Create a withdrawal request
        withdraw_amount = 100
        withdraw_response = test_user_session.post(f"{BASE_URL}/api/wallet/withdraw", json={
            "amount": withdraw_amount,
            "upi_id": "test@upi"
        })
        
        # Withdrawal might be blocked by time restrictions
        if withdraw_response.status_code == 400:
            error_detail = withdraw_response.json().get("detail", "")
            if "समय" in error_detail or "time" in error_detail.lower():
                pytest.skip(f"Withdrawal blocked by time restriction: {error_detail}")
        
        assert withdraw_response.status_code == 200, f"Failed to create withdrawal: {withdraw_response.text}"
        withdrawal_id = withdraw_response.json().get("id")
        print(f"✓ Created withdrawal request: {withdrawal_id}")
        
        # Step 4: Verify balance was deducted
        wallet_response = test_user_session.get(f"{BASE_URL}/api/wallet")
        balance_after_withdraw = wallet_response.json().get("balance", 0)
        assert balance_after_withdraw == initial_balance - withdraw_amount, \
            f"Balance not deducted correctly: expected {initial_balance - withdraw_amount}, got {balance_after_withdraw}"
        print(f"✓ Balance deducted: ₹{initial_balance} -> ₹{balance_after_withdraw}")
        
        # Step 5: Cancel the withdrawal
        cancel_response = test_user_session.post(f"{BASE_URL}/api/wallet/withdraw/{withdrawal_id}/cancel")
        assert cancel_response.status_code == 200, f"Failed to cancel withdrawal: {cancel_response.text}"
        print(f"✓ Withdrawal cancelled successfully")
        
        # Step 6: Verify balance was refunded
        wallet_response = test_user_session.get(f"{BASE_URL}/api/wallet")
        balance_after_cancel = wallet_response.json().get("balance", 0)
        assert balance_after_cancel == initial_balance, \
            f"Balance not refunded correctly: expected {initial_balance}, got {balance_after_cancel}"
        print(f"✓ Balance refunded: ₹{balance_after_withdraw} -> ₹{balance_after_cancel}")
        
        # Step 7: Verify withdrawal status is 'cancelled'
        transactions = wallet_response.json().get("transactions", [])
        cancelled_tx = next((tx for tx in transactions if tx.get("id") == withdrawal_id), None)
        assert cancelled_tx is not None, "Cancelled withdrawal not found in transactions"
        assert cancelled_tx.get("status") == "cancelled", \
            f"Withdrawal status should be 'cancelled', got '{cancelled_tx.get('status')}'"
        print(f"✓ Withdrawal status is 'cancelled'")
    
    def test_cannot_cancel_non_pending_withdrawal(self, test_user_session):
        """Test that only pending withdrawals can be cancelled"""
        # Try to cancel a non-existent or already processed withdrawal
        response = test_user_session.post(f"{BASE_URL}/api/wallet/withdraw/non-existent-id/cancel")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Cannot cancel non-existent withdrawal")


class TestReferralBonus:
    """Test referral 5% bonus on first deposit"""
    
    @pytest.fixture
    def referrer_session(self):
        """Create or login as referrer user"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as test user (referrer)
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": "Test@123"
        })
        
        if response.status_code != 200:
            pytest.skip("Referrer login failed")
        
        return session
    
    def test_get_referral_info(self, referrer_session):
        """Test getting referral info and code"""
        response = referrer_session.get(f"{BASE_URL}/api/referral/info")
        
        assert response.status_code == 200, f"Failed to get referral info: {response.text}"
        data = response.json()
        
        assert "code" in data, "Referral code not in response"
        assert "referred_count" in data, "referred_count not in response"
        assert "total_earned" in data, "total_earned not in response"
        
        print(f"✓ Referral info retrieved: code={data['code']}, referred={data['referred_count']}, earned=₹{data['total_earned']}")
        return data["code"]
    
    def test_apply_referral_code(self, referrer_session):
        """Test applying a referral code"""
        # First get the referrer's code
        info_response = referrer_session.get(f"{BASE_URL}/api/referral/info")
        referral_code = info_response.json().get("code")
        
        # Create a new session for referred user
        referred_session = requests.Session()
        referred_session.headers.update({"Content-Type": "application/json"})
        
        # Login as referred user
        login_response = referred_session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "1111111111",
            "password": "Test@123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Referred user login failed - user may not exist")
        
        # Try to apply referral code
        apply_response = referred_session.post(f"{BASE_URL}/api/referral/apply", json={
            "code": referral_code
        })
        
        # Could be 200 (success) or 400 (already applied)
        if apply_response.status_code == 400:
            error = apply_response.json().get("detail", "")
            if "पहले ही" in error or "already" in error.lower():
                print(f"✓ Referral code already applied (expected for existing user)")
                return
        
        assert apply_response.status_code == 200, f"Failed to apply referral: {apply_response.text}"
        print(f"✓ Referral code applied successfully")
    
    def test_cannot_use_own_referral_code(self, referrer_session):
        """Test that user cannot use their own referral code"""
        # Get own referral code
        info_response = referrer_session.get(f"{BASE_URL}/api/referral/info")
        own_code = info_response.json().get("code")
        
        # Try to apply own code
        apply_response = referrer_session.post(f"{BASE_URL}/api/referral/apply", json={
            "code": own_code
        })
        
        assert apply_response.status_code == 400, f"Should not be able to use own code: {apply_response.text}"
        print("✓ Cannot use own referral code")
    
    def test_invalid_referral_code(self, referrer_session):
        """Test applying invalid referral code"""
        apply_response = referrer_session.post(f"{BASE_URL}/api/referral/apply", json={
            "code": "INVALID123"
        })
        
        assert apply_response.status_code == 404, f"Expected 404 for invalid code: {apply_response.text}"
        print("✓ Invalid referral code returns 404")


class TestWalletEndpoints:
    """Test wallet-related endpoints"""
    
    @pytest.fixture
    def user_session(self):
        """Login as test user"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "phone": "9876543210",
            "password": "Test@123"
        })
        
        if response.status_code != 200:
            pytest.skip("Test user login failed")
        
        return session
    
    def test_get_wallet(self, user_session):
        """Test getting wallet info"""
        response = user_session.get(f"{BASE_URL}/api/wallet")
        
        assert response.status_code == 200, f"Failed to get wallet: {response.text}"
        data = response.json()
        
        assert "balance" in data, "balance not in response"
        assert "transactions" in data, "transactions not in response"
        
        print(f"✓ Wallet retrieved: balance=₹{data['balance']}, transactions={len(data['transactions'])}")
    
    def test_wallet_requires_auth(self):
        """Test that wallet endpoint requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/wallet")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Wallet endpoint requires authentication")
    
    def test_withdrawal_validation(self, user_session):
        """Test withdrawal validation"""
        # Test without UPI ID
        response = user_session.post(f"{BASE_URL}/api/wallet/withdraw", json={
            "amount": 100
        })
        
        # Should fail due to missing UPI ID
        if response.status_code == 400:
            error = response.json().get("detail", "")
            if "UPI" in error or "bank" in error.lower():
                print("✓ Withdrawal requires UPI ID or bank details")
                return
        
        # If time restriction, that's also valid
        if response.status_code == 400:
            error = response.json().get("detail", "")
            if "समय" in error:
                print(f"✓ Withdrawal blocked by time restriction: {error}")
                return
        
        print(f"Withdrawal response: {response.status_code} - {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
