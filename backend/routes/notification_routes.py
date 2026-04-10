from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone

from database import db
from auth import get_current_user
from config import VAPID_PUBLIC_KEY
from notifications import notification_service
from models import NotificationSubscribe

router = APIRouter()


@router.get("/push/vapid-key")
async def get_vapid_key():
    return {"key": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def push_subscribe(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    subscription = body.get("subscription")
    if not subscription:
        raise HTTPException(status_code=400, detail="subscription required")

    await db.push_subscriptions.update_one(
        {"user_id": user["_id"]},
        {"$set": {"user_id": user["_id"], "subscription": subscription, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"message": "subscribed"}


@router.post("/notifications/subscribe")
async def subscribe_notifications(data: NotificationSubscribe, request: Request):
    user = await get_current_user(request)

    if not data.telegram_chat_id and not data.whatsapp_number:
        raise HTTPException(status_code=400, detail="Provide Telegram chat ID or WhatsApp number")

    existing = await db.notification_subscribers.find_one({"user_id": user["_id"]})

    subscription_doc = {
        "user_id": user["_id"],
        "email": user["email"],
        "telegram_chat_id": data.telegram_chat_id,
        "whatsapp_number": data.whatsapp_number,
        "subscribed_at": datetime.now(timezone.utc)
    }

    if existing:
        await db.notification_subscribers.update_one({"user_id": user["_id"]}, {"$set": subscription_doc})
    else:
        await db.notification_subscribers.insert_one(subscription_doc)

    return {"message": "Subscribed to notifications successfully"}


@router.delete("/notifications/unsubscribe")
async def unsubscribe_notifications(request: Request):
    user = await get_current_user(request)
    result = await db.notification_subscribers.delete_one({"user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not subscribed")
    return {"message": "Unsubscribed from notifications"}


@router.get("/notifications/status")
async def get_notification_status(request: Request):
    user = await get_current_user(request)
    subscription = await db.notification_subscribers.find_one(
        {"user_id": user["_id"]}, {"_id": 0, "user_id": 0}
    )
    service_status = notification_service.get_status()
    return {"subscribed": subscription is not None, "subscription": subscription, "service_status": service_status}


@router.get("/notifications/telegram-instructions")
async def get_telegram_instructions():
    return {
        "steps": [
            "1. Telegram में @SattaMatkaResultBot खोजें (या admin द्वारा बताया गया bot)",
            "2. Bot को /start भेजें",
            "3. Bot आपको आपका Chat ID देगा",
            "4. वह Chat ID यहाँ दर्ज करें"
        ],
        "note": "रिजल्ट घोषित होते ही आपको Telegram पर notification मिलेगी"
    }
