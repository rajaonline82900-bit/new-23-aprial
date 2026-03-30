import requests
import sys
import json
from datetime import datetime, timedelta

class SattaMatkaAPITester:
    def __init__(self, base_url="https://matka-numbers-bet.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_cookies = None
        self.user_cookies = None

    def run_test(self, name, method, endpoint, expected_status, data=None, cookies=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, cookies=cookies)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")

            return success, response

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, None

    def test_admin_login(self):
        """Test admin login and store cookies"""
        print("\n" + "="*50)
        print("TESTING ADMIN AUTHENTICATION")
        print("="*50)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@sattamatka.com", "password": "Admin@123"}
        )
        
        if success and response:
            self.admin_cookies = response.cookies
            print(f"   Admin cookies stored: {dict(self.admin_cookies)}")
            return True
        return False

    def test_user_registration_and_login(self):
        """Test user registration and login"""
        print("\n" + "="*50)
        print("TESTING USER REGISTRATION & LOGIN")
        print("="*50)
        
        # Test user registration
        timestamp = datetime.now().strftime("%H%M%S")
        test_user = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@example.com",
            "password": "Test@123",
            "phone": "9876543210"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "api/auth/register",
            200,
            data=test_user
        )
        
        if success and response:
            self.user_cookies = response.cookies
            print(f"   User cookies stored: {dict(self.user_cookies)}")
            
            # Test user login
            login_success, login_response = self.run_test(
                "User Login",
                "POST",
                "api/auth/login",
                200,
                data={"email": test_user["email"], "password": test_user["password"]}
            )
            
            if login_success and login_response:
                self.user_cookies = login_response.cookies
                return True
        
        return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTH ENDPOINTS")
        print("="*50)
        
        # Test /me endpoint with admin
        self.run_test(
            "Admin Profile (/me)",
            "GET",
            "api/auth/me",
            200,
            cookies=self.admin_cookies
        )
        
        # Test /me endpoint with user
        self.run_test(
            "User Profile (/me)",
            "GET",
            "api/auth/me",
            200,
            cookies=self.user_cookies
        )
        
        # Test logout
        self.run_test(
            "Logout",
            "POST",
            "api/auth/logout",
            200,
            cookies=self.user_cookies
        )

    def test_games_endpoints(self):
        """Test games endpoints"""
        print("\n" + "="*50)
        print("TESTING GAMES ENDPOINTS")
        print("="*50)
        
        # Test get all games
        success, response = self.run_test(
            "Get All Games",
            "GET",
            "api/games",
            200,
            cookies=self.admin_cookies
        )
        
        if success and response:
            try:
                games_data = response.json()
                games = games_data.get('games', [])
                print(f"   Found {len(games)} games")
                
                # Test individual game endpoint
                if games:
                    game_id = games[0]['id']
                    self.run_test(
                        f"Get Game Details ({game_id})",
                        "GET",
                        f"api/games/{game_id}",
                        200,
                        cookies=self.admin_cookies
                    )
            except Exception as e:
                print(f"   Error parsing games response: {e}")

    def test_betting_endpoints(self):
        """Test betting endpoints"""
        print("\n" + "="*50)
        print("TESTING BETTING ENDPOINTS")
        print("="*50)
        
        # Test place bet - single
        self.run_test(
            "Place Single Bet",
            "POST",
            "api/bets",
            400,  # Expecting 400 due to insufficient balance
            data={
                "game_id": "delhi_bazaar",
                "bet_type": "single",
                "number": "5",
                "amount": 10
            },
            cookies=self.user_cookies
        )
        
        # Test place bet - jodi
        self.run_test(
            "Place Jodi Bet",
            "POST",
            "api/bets",
            400,  # Expecting 400 due to insufficient balance
            data={
                "game_id": "delhi_bazaar",
                "bet_type": "jodi",
                "number": "55",
                "amount": 10
            },
            cookies=self.user_cookies
        )
        
        # Test get user bets
        self.run_test(
            "Get User Bets",
            "GET",
            "api/bets",
            200,
            cookies=self.user_cookies
        )

    def test_wallet_endpoints(self):
        """Test wallet endpoints"""
        print("\n" + "="*50)
        print("TESTING WALLET ENDPOINTS")
        print("="*50)
        
        # Test get wallet
        self.run_test(
            "Get Wallet",
            "GET",
            "api/wallet",
            200,
            cookies=self.user_cookies
        )
        
        # Test deposit request (will fail due to Stripe key)
        self.run_test(
            "Create Deposit Request",
            "POST",
            "api/wallet/deposit",
            500,  # Expecting error due to Stripe
            data={
                "package_id": "100",
                "origin_url": "https://matka-numbers-bet.preview.emergentagent.com"
            },
            cookies=self.user_cookies
        )
        
        # Test withdrawal request (will fail due to insufficient balance)
        self.run_test(
            "Create Withdrawal Request",
            "POST",
            "api/wallet/withdraw",
            400,  # Expecting 400 due to insufficient balance
            data={
                "amount": 100,
                "upi_id": "test@upi"
            },
            cookies=self.user_cookies
        )

    def test_results_endpoints(self):
        """Test results endpoints"""
        print("\n" + "="*50)
        print("TESTING RESULTS ENDPOINTS")
        print("="*50)
        
        # Test get all results
        self.run_test(
            "Get All Results",
            "GET",
            "api/results",
            200
        )
        
        # Test get game results
        self.run_test(
            "Get Delhi Bazaar Results",
            "GET",
            "api/results/delhi_bazaar",
            200
        )

    def test_admin_endpoints(self):
        """Test admin endpoints"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        # Test admin stats
        self.run_test(
            "Get Admin Stats",
            "GET",
            "api/admin/stats",
            200,
            cookies=self.admin_cookies
        )
        
        # Test get all users
        self.run_test(
            "Get All Users",
            "GET",
            "api/admin/users",
            200,
            cookies=self.admin_cookies
        )
        
        # Test get withdrawals
        self.run_test(
            "Get Withdrawals",
            "GET",
            "api/admin/withdrawals",
            200,
            cookies=self.admin_cookies
        )
        
        # Test declare result
        today = datetime.now().strftime("%Y-%m-%d")
        self.run_test(
            "Declare Result",
            "POST",
            "api/admin/results",
            200,
            data={
                "game_id": "delhi_bazaar",
                "date": today,
                "single_result": "7",
                "jodi_result": "77"
            },
            cookies=self.admin_cookies
        )

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        print("\n" + "="*50)
        print("TESTING UNAUTHORIZED ACCESS")
        print("="*50)
        
        # Test accessing protected endpoint without auth
        self.run_test(
            "Unauthorized Wallet Access",
            "GET",
            "api/wallet",
            401
        )
        
        # Test accessing admin endpoint without admin role
        self.run_test(
            "Non-Admin Stats Access",
            "GET",
            "api/admin/stats",
            401,
            cookies=self.user_cookies
        )

def main():
    print("🎰 Starting Satta Matka API Testing")
    print("="*60)
    
    tester = SattaMatkaAPITester()
    
    # Test admin authentication first
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    # Test user registration and login
    if not tester.test_user_registration_and_login():
        print("❌ User registration/login failed, continuing with admin tests only")
    
    # Run all test suites
    tester.test_auth_endpoints()
    tester.test_games_endpoints()
    tester.test_betting_endpoints()
    tester.test_wallet_endpoints()
    tester.test_results_endpoints()
    tester.test_admin_endpoints()
    tester.test_unauthorized_access()
    
    # Print final results
    print("\n" + "="*60)
    print("🏁 FINAL TEST RESULTS")
    print("="*60)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"📈 Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed - check logs above")
        return 1

if __name__ == "__main__":
    sys.exit(main())