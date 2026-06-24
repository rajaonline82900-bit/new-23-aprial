"""Tests for the APK/WebView build-version cache-bust mechanism.

Verifies:
- GET /api/version returns 200 + {version: <string>} as JSON
- index.html exposes Cache-Control / Pragma / Expires no-cache meta tags
"""
import os
import re
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matka-numbers-bet.preview.emergentagent.com").rstrip("/")


class TestVersionEndpoint:
    def test_version_endpoint_returns_200_json(self):
        r = requests.get(f"{BASE_URL}/api/version", timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/json")
        data = r.json()
        assert "version" in data
        assert isinstance(data["version"], str)
        assert len(data["version"]) > 0

    def test_version_endpoint_default_value(self):
        # Server default is "2026.02.24.1" — should not regress
        r = requests.get(f"{BASE_URL}/api/version", timeout=15)
        data = r.json()
        # Format-only assertion (flexible if env-overridden)
        assert re.match(r"^\d{4}\.\d{1,2}\.\d{1,2}\.\d+$", data["version"]), (
            f"Unexpected version format: {data['version']}"
        )

    def test_version_endpoint_no_auth_required(self):
        # Should work with no Authorization header
        r = requests.get(f"{BASE_URL}/api/version", timeout=15)
        assert r.status_code == 200


class TestIndexHtmlNoCacheMeta:
    def test_index_html_has_three_no_cache_meta_tags(self):
        r = requests.get(f"{BASE_URL}/", timeout=15)
        assert r.status_code == 200
        body = r.text
        assert 'http-equiv="Cache-Control"' in body
        assert 'no-cache, no-store, must-revalidate' in body
        assert 'http-equiv="Pragma"' in body
        # Pragma value
        assert re.search(r'http-equiv="Pragma"\s+content="no-cache"', body)
        assert 'http-equiv="Expires"' in body
        assert re.search(r'http-equiv="Expires"\s+content="0"', body)
