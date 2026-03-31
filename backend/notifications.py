"""
Notification Service for Satta Matka App
Handles Telegram and WhatsApp notifications
"""
import os
import logging
import httpx
from typing import Optional, List
from twilio.rest import Client as TwilioClient

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        # Telegram Config
        self.telegram_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        self.telegram_enabled = bool(self.telegram_token)
        
        # Twilio WhatsApp Config
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
        self.twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
        self.twilio_whatsapp = os.environ.get("TWILIO_WHATSAPP_NUMBER", "")
        self.whatsapp_enabled = bool(self.twilio_sid and self.twilio_token and self.twilio_whatsapp)
        
        if self.whatsapp_enabled:
            self.twilio_client = TwilioClient(self.twilio_sid, self.twilio_token)
        else:
            self.twilio_client = None
    
    async def send_telegram_message(self, chat_id: str, message: str) -> bool:
        """Send message via Telegram Bot"""
        if not self.telegram_enabled:
            logger.warning("Telegram not configured")
            return False
        
        try:
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "HTML"
                })
                
                if response.status_code == 200:
                    logger.info(f"Telegram message sent to {chat_id}")
                    return True
                else:
                    logger.error(f"Telegram error: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Telegram send error: {e}")
            return False
    
    def send_whatsapp_message(self, phone_number: str, message: str) -> bool:
        """Send message via WhatsApp (Twilio)"""
        if not self.whatsapp_enabled:
            logger.warning("WhatsApp not configured")
            return False
        
        try:
            # Format phone number
            if not phone_number.startswith("+"):
                phone_number = f"+91{phone_number}"  # Default to India
            
            msg = self.twilio_client.messages.create(
                body=message,
                from_=f"whatsapp:{self.twilio_whatsapp}",
                to=f"whatsapp:{phone_number}"
            )
            logger.info(f"WhatsApp message sent: {msg.sid}")
            return True
        except Exception as e:
            logger.error(f"WhatsApp send error: {e}")
            return False
    
    async def send_result_notification(
        self, 
        game_name: str, 
        game_name_hi: str,
        date: str,
        single_result: str, 
        jodi_result: str,
        subscribers: List[dict]
    ) -> dict:
        """Send result notification to all subscribers"""
        
        # Format message
        message_telegram = f"""
🎰 <b>सट्टा मटका रिजल्ट</b> 🎰

<b>गेम:</b> {game_name_hi} ({game_name})
<b>तारीख:</b> {date}

🔢 <b>एकल रिजल्ट:</b> {single_result}
🎯 <b>जोड़ी रिजल्ट:</b> {jodi_result}

अगले गेम में भाग लें!
🔗 {os.environ.get('FRONTEND_URL', 'https://matka-numbers-bet.preview.emergentagent.com')}
"""
        
        message_whatsapp = f"""
🎰 *सट्टा मटका रिजल्ट* 🎰

*गेम:* {game_name_hi} ({game_name})
*तारीख:* {date}

🔢 *एकल रिजल्ट:* {single_result}
🎯 *जोड़ी रिजल्ट:* {jodi_result}

अगले गेम में भाग लें!
"""
        
        sent_count = {"telegram": 0, "whatsapp": 0, "failed": 0}
        
        for subscriber in subscribers:
            # Send Telegram
            if subscriber.get("telegram_chat_id"):
                success = await self.send_telegram_message(
                    subscriber["telegram_chat_id"], 
                    message_telegram
                )
                if success:
                    sent_count["telegram"] += 1
                else:
                    sent_count["failed"] += 1
            
            # Send WhatsApp
            if subscriber.get("whatsapp_number"):
                success = self.send_whatsapp_message(
                    subscriber["whatsapp_number"],
                    message_whatsapp
                )
                if success:
                    sent_count["whatsapp"] += 1
                else:
                    sent_count["failed"] += 1
        
        return sent_count
    
    def get_status(self) -> dict:
        """Get notification service status"""
        return {
            "telegram_enabled": self.telegram_enabled,
            "whatsapp_enabled": self.whatsapp_enabled
        }


# Singleton instance
notification_service = NotificationService()
