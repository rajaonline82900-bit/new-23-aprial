from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from datetime import datetime, timezone
from bson import ObjectId
import uuid

from database import db
from auth import get_current_user, get_admin_user
from models import ChatMessageSend

router = APIRouter()


@router.get("/chat/messages")
async def get_chat_messages(request: Request):
    user = await get_current_user(request)
    messages = await db.chat_messages.find(
        {"user_id": user["_id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    await db.chat_messages.update_many(
        {"user_id": user["_id"], "sender": "admin", "read": {"$ne": True}},
        {"$set": {"read": True}}
    )
    return {"messages": messages}


@router.get("/chat/unread-count")
async def get_unread_count(request: Request):
    user = await get_current_user(request)
    count = await db.chat_messages.count_documents(
        {"user_id": user["_id"], "sender": "admin", "read": {"$ne": True}}
    )
    return {"unread": count}




@router.post("/chat/send")
async def send_chat_message(msg: ChatMessageSend, request: Request):
    user = await get_current_user(request)
    if msg.msg_type == "text" and not msg.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "user_name": user.get("name", "User"),
        "user_phone": user.get("phone", user.get("email", "")),
        "sender": "user",
        "message": msg.message.strip() if msg.message else "",
        "msg_type": msg.msg_type,
        "attachment_url": msg.attachment_url,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_messages.insert_one(doc)
    return {"message": "Sent", "id": doc["id"]}


@router.post("/chat/upload")
async def upload_chat_file(file: UploadFile = File(...), request: Request = None):
    await get_current_user(request)
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    allowed = {"jpg", "jpeg", "png", "gif", "webp", "mp3", "ogg", "webm", "wav", "m4a"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="File type not allowed")
    filename = f"chat_{uuid.uuid4()}.{ext}"
    filepath = f"/app/backend/uploads/{filename}"
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    with open(filepath, "wb") as f:
        f.write(content)
    return {"url": f"/api/uploads/{filename}"}


@router.get("/admin/chat/users")
async def get_chat_users(request: Request):
    await get_admin_user(request)
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "user_phone": {"$first": "$user_phone"},
            "last_message": {"$first": "$message"},
            "last_msg_type": {"$first": {"$ifNull": ["$msg_type", "text"]}},
            "last_time": {"$first": "$created_at"},
            "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$sender", "user"]}, {"$eq": [{"$ifNull": ["$read", False]}, False]}]}, 1, 0]}}
        }},
        {"$sort": {"last_time": -1}}
    ]
    users = await db.chat_messages.aggregate(pipeline).to_list(100)
    result = []
    for u in users:
        last_msg = u["last_message"]
        if u.get("last_msg_type") == "image":
            last_msg = "Photo"
        elif u.get("last_msg_type") == "voice":
            last_msg = "Voice"
        result.append({
            "user_id": u["_id"], "user_name": u["user_name"],
            "user_phone": u["user_phone"], "last_message": last_msg,
            "last_time": u["last_time"], "unread": u["unread"]
        })
    return {"users": result}


@router.get("/admin/chat/messages/{user_id}")
async def get_chat_messages_admin(user_id: str, request: Request):
    await get_admin_user(request)
    messages = await db.chat_messages.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    await db.chat_messages.update_many(
        {"user_id": user_id, "sender": "user", "read": {"$ne": True}},
        {"$set": {"read": True}}
    )
    return {"messages": messages}


@router.post("/admin/chat/reply/{user_id}")
async def admin_reply_chat(user_id: str, msg: ChatMessageSend, request: Request):
    await get_admin_user(request)
    if msg.msg_type == "text" and not msg.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_doc["name"] if user_doc else "User",
        "user_phone": user_doc.get("phone", "") if user_doc else "",
        "sender": "admin",
        "message": msg.message.strip() if msg.message else "",
        "msg_type": msg.msg_type,
        "attachment_url": msg.attachment_url,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_messages.insert_one(doc)
    return {"message": "Reply sent", "id": doc["id"]}
