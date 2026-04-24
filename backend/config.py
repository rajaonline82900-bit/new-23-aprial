import os
from datetime import timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

# IMB Payment Gateway config
IMB_API_TOKEN = os.environ.get("IMB_API_TOKEN", "")
IMB_API_URL = os.environ.get("IMB_API_URL", "https://secure-stage.imb.org.in")

# DVHosting SMS API
DVHOSTING_API_KEY = os.environ.get("DVHOSTING_API_KEY")
DVHOSTING_API_URL = os.environ.get("DVHOSTING_API_URL")

# VAPID Keys
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
# If a PEM private key file exists alongside backend, prefer that and DERIVE matching public key
import os as _os
_pem_path = _os.path.join(_os.path.dirname(__file__), "vapid_private.txt")
if _os.path.exists(_pem_path):
    VAPID_PRIVATE_KEY = _pem_path
    # Derive public key from PEM so it ALWAYS matches
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key, Encoding, PublicFormat
        import base64 as _b64
        with open(_pem_path, "rb") as _f:
            _priv = load_pem_private_key(_f.read(), password=None)
        _pub_bytes = _priv.public_key().public_bytes(encoding=Encoding.X962, format=PublicFormat.UncompressedPoint)
        VAPID_PUBLIC_KEY = _b64.urlsafe_b64encode(_pub_bytes).decode().rstrip("=")
    except Exception as _e:
        pass

# Matka API
MATKA_API_BASE = "https://matkawebhook.matka-api.online"
MATKA_API_USERNAME = os.environ.get("MATKA_API_USERNAME", "")
MATKA_API_PASSWORD = os.environ.get("MATKA_API_PASSWORD", "")

# Market to Game ID mapping
MARKET_TO_GAME = {
    "DISAWER": "disawar",
    "DELHI BAZAR": "delhi_bazaar",
    "SHRI GANESH": "shri_ganesh",
    "FARIDABAD": "faridabad",
    "GHAZIABAD": "ghaziabad",
    "GALI": "gali",
}

# Default Games
DEFAULT_GAMES = {
    # Delhi/Gali-Disawar side
    "delhi_bazaar": {"name": "Delhi Bazaar", "name_hi": "दिल्ली बाजार", "start_time": "14:00", "end_time": "15:00", "display_time": "3:00 PM", "is_active": True, "category": "gali_disawar"},
    "shri_ganesh": {"name": "Shri Ganesh", "name_hi": "श्री गणेश", "start_time": "17:00", "end_time": "18:00", "display_time": "6:00 PM", "is_active": True, "category": "gali_disawar"},
    "faridabad": {"name": "Faridabad", "name_hi": "फरीदाबाद", "start_time": "17:15", "end_time": "18:15", "display_time": "6:15 PM", "is_active": True, "category": "gali_disawar"},
    "ghaziabad": {"name": "Ghaziabad", "name_hi": "गाजियाबाद", "start_time": "19:30", "end_time": "20:30", "display_time": "8:30 PM", "is_active": True, "category": "gali_disawar"},
    "gali": {"name": "Gali", "name_hi": "गली", "start_time": "22:30", "end_time": "23:30", "display_time": "11:30 PM", "is_active": True, "category": "gali_disawar"},
    "disawar": {"name": "Disawar", "name_hi": "दिसावर", "start_time": "04:00", "end_time": "05:00", "display_time": "5:00 AM", "is_active": True, "category": "gali_disawar"},
    # Kalyan/Maharashtra side
    "kalyan_morning": {"name": "Kalyan Morning", "name_hi": "कल्याण मॉर्निंग", "start_time": "10:30", "end_time": "11:30", "display_time": "11:30 AM", "is_active": True, "category": "kalyan"},
    "milan_day": {"name": "Milan Day", "name_hi": "मिलन डे", "start_time": "14:15", "end_time": "15:15", "display_time": "3:15 PM", "is_active": True, "category": "kalyan"},
    "rajdhani_day": {"name": "Rajdhani Day", "name_hi": "राजधानी डे", "start_time": "14:30", "end_time": "15:30", "display_time": "3:30 PM", "is_active": True, "category": "kalyan"},
    "kalyan": {"name": "Kalyan", "name_hi": "कल्याण", "start_time": "15:30", "end_time": "17:30", "display_time": "5:30 PM", "is_active": True, "category": "kalyan"},
    "main_bazar": {"name": "Main Bazar", "name_hi": "मेन बाजार", "start_time": "21:30", "end_time": "00:30", "display_time": "12:30 AM", "is_active": True, "category": "kalyan"},
    "milan_night": {"name": "Milan Night", "name_hi": "मिलन नाइट", "start_time": "21:00", "end_time": "23:00", "display_time": "11:00 PM", "is_active": True, "category": "kalyan"},
    "rajdhani_night": {"name": "Rajdhani Night", "name_hi": "राजधानी नाइट", "start_time": "21:30", "end_time": "23:45", "display_time": "11:45 PM", "is_active": True, "category": "kalyan"}
}

# Bet Types
BET_TYPES = {
    "single": {"name": "Single", "name_hi": "एकल अंक", "multiplier": 10},
    "jodi": {"name": "Jodi", "name_hi": "जोड़ी", "multiplier": 100},
    "haruf_andar": {"name": "Haruf Andar", "name_hi": "हरूफ अंदर", "multiplier": 10},
    "haruf_bahar": {"name": "Haruf Bahar", "name_hi": "हरूफ बाहर", "multiplier": 10}
}

# Deposit packages
DEPOSIT_PACKAGES = {
    "100": 100.0,
    "500": 500.0,
    "1000": 1000.0,
    "2000": 2000.0,
    "5000": 5000.0
}

# Settings defaults
SETTINGS_DEFAULTS = {
    "telegram_link": "", "whatsapp_link": "", "withdrawal_proof_telegram": "",
    "withdrawal_start_time": "", "withdrawal_end_time": "",
    "min_bet_jodi": 10, "min_bet_haruf": 10, "min_bet_crossing": 10,
    "min_deposit": 100, "min_withdrawal": 100
}

# In-memory stores
GAMES = {}
otp_store = {}
matka_api_tokens = {"delhi": None, "general": None}
auto_fetch_running = False
