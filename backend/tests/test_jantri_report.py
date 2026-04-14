"""
Test Jantri Report (Bid History) API endpoint
Tests GET /api/admin/jantri-report for:
- Returns all 100 jodi numbers (00-99) with amounts
- Returns andar (0-9) and bahar (0-9) with amounts
- Returns summary with jodi_total, andar_total, bahar_total, total, max_loss, profit
- Accepts game_id and date params
- Requires admin auth
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestJantriReportAPI:
    """Tests for GET /api/admin/jantri-report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin (Vikram@900 credentials)
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"email": "Vikram@900", "password": "Vikram@900"}
        )
        if login_response.status_code != 200:
            pytest.skip("Admin login failed - skipping authenticated tests")
        
        yield
        
        # Logout after tests
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except:
            pass
    
    def test_jantri_report_requires_auth(self):
        """Test that jantri-report endpoint requires admin authentication"""
        # Use a new session without auth
        response = requests.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Jantri report requires admin auth (401 without auth)")
    
    def test_jantri_report_returns_200(self):
        """Test that jantri-report returns 200 with admin auth"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Jantri report returns 200 with admin auth")
    
    def test_jantri_report_returns_all_100_jodi_numbers(self):
        """Test that jantri-report returns all 100 jodi numbers (00-99)"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 200
        
        data = response.json()
        assert "jodi" in data, "Response missing 'jodi' field"
        
        jodi = data["jodi"]
        assert len(jodi) == 100, f"Expected 100 jodi numbers, got {len(jodi)}"
        
        # Verify all numbers from 00 to 99 are present
        for i in range(100):
            num = f"{i:02d}"
            assert num in jodi, f"Missing jodi number: {num}"
            assert isinstance(jodi[num], (int, float)), f"Jodi {num} amount should be numeric"
        
        print("✓ Jantri report returns all 100 jodi numbers (00-99)")
    
    def test_jantri_report_returns_andar_0_to_9(self):
        """Test that jantri-report returns andar haruf (0-9)"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 200
        
        data = response.json()
        assert "andar" in data, "Response missing 'andar' field"
        
        andar = data["andar"]
        assert len(andar) == 10, f"Expected 10 andar numbers, got {len(andar)}"
        
        # Verify all numbers from 0 to 9 are present
        for i in range(10):
            num = str(i)
            assert num in andar, f"Missing andar number: {num}"
            assert isinstance(andar[num], (int, float)), f"Andar {num} amount should be numeric"
        
        print("✓ Jantri report returns andar haruf (0-9)")
    
    def test_jantri_report_returns_bahar_0_to_9(self):
        """Test that jantri-report returns bahar haruf (0-9)"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 200
        
        data = response.json()
        assert "bahar" in data, "Response missing 'bahar' field"
        
        bahar = data["bahar"]
        assert len(bahar) == 10, f"Expected 10 bahar numbers, got {len(bahar)}"
        
        # Verify all numbers from 0 to 9 are present
        for i in range(10):
            num = str(i)
            assert num in bahar, f"Missing bahar number: {num}"
            assert isinstance(bahar[num], (int, float)), f"Bahar {num} amount should be numeric"
        
        print("✓ Jantri report returns bahar haruf (0-9)")
    
    def test_jantri_report_returns_summary(self):
        """Test that jantri-report returns summary with all required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data, "Response missing 'summary' field"
        
        summary = data["summary"]
        required_fields = ["jodi_total", "andar_total", "bahar_total", "total", "max_loss", "profit"]
        
        for field in required_fields:
            assert field in summary, f"Summary missing '{field}' field"
            assert isinstance(summary[field], (int, float)), f"Summary {field} should be numeric"
        
        # Verify total calculation
        expected_total = summary["jodi_total"] + summary["andar_total"] + summary["bahar_total"]
        if "crossing_total" in summary:
            expected_total += summary["crossing_total"]
        assert summary["total"] == expected_total, f"Total mismatch: expected {expected_total}, got {summary['total']}"
        
        print("✓ Jantri report returns summary with jodi_total, andar_total, bahar_total, total, max_loss, profit")
    
    def test_jantri_report_accepts_game_id_param(self):
        """Test that jantri-report accepts game_id parameter"""
        # Test with 'all' game_id
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report", params={"game_id": "all"})
        assert response.status_code == 200
        data = response.json()
        assert data["game_id"] == "all", f"Expected game_id 'all', got {data.get('game_id')}"
        
        # Test with specific game_id
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report", params={"game_id": "disawer"})
        assert response.status_code == 200
        data = response.json()
        assert data["game_id"] == "disawer", f"Expected game_id 'disawer', got {data.get('game_id')}"
        
        print("✓ Jantri report accepts game_id parameter")
    
    def test_jantri_report_accepts_date_param(self):
        """Test that jantri-report accepts date parameter"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report", params={"date": today})
        assert response.status_code == 200
        
        data = response.json()
        assert "date" in data, "Response missing 'date' field"
        assert data["date"] == today, f"Expected date {today}, got {data.get('date')}"
        
        print("✓ Jantri report accepts date parameter")
    
    def test_jantri_report_returns_crossing_field(self):
        """Test that jantri-report returns crossing field"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 200
        
        data = response.json()
        assert "crossing" in data, "Response missing 'crossing' field"
        assert isinstance(data["crossing"], dict), "Crossing should be a dictionary"
        
        print("✓ Jantri report returns crossing field")
    
    def test_jantri_report_returns_worst_jodi(self):
        """Test that jantri-report returns worst_jodi in summary"""
        response = self.session.get(f"{BASE_URL}/api/admin/jantri-report")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        assert "worst_jodi" in summary, "Summary missing 'worst_jodi' field"
        worst_jodi = summary["worst_jodi"]
        assert len(worst_jodi) == 2, f"worst_jodi should be 2 digits, got {worst_jodi}"
        assert worst_jodi.isdigit(), f"worst_jodi should be numeric, got {worst_jodi}"
        
        print("✓ Jantri report returns worst_jodi in summary")
    
    def test_jantri_report_with_both_params(self):
        """Test that jantri-report works with both game_id and date params"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/jantri-report",
            params={"game_id": "disawer", "date": today}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["game_id"] == "disawer"
        assert data["date"] == today
        assert "jodi" in data
        assert "andar" in data
        assert "bahar" in data
        assert "summary" in data
        
        print("✓ Jantri report works with both game_id and date params")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
