"""Admin-managed fake ticker entries for winners / deposits / withdrawals.

Admin can insert custom-named entries (e.g. "Rohit Sharma won ₹5000 on
Kalyan Day") that appear in the public dashboard ticker mixed with real
transactions. Real users can't distinguish these from real ones.

Storage:
  db.fake_ticker_entries: {
      id, type: 'winner'|'deposit'|'withdrawal',
      name, amount, game_name (winners only), active,
      created_at, admin_id
  }

Public helper `get_fake_entries(type_)` returns active entries in the
shape expected by the ticker endpoints (name/amount, optional game_name).
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from database import db
from auth import get_admin_user

router = APIRouter()

ALLOWED_TYPES = {"winner", "deposit", "withdrawal"}


async def get_fake_entries(type_: str) -> list:
    """Return active fake entries for the given type."""
    if type_ not in ALLOWED_TYPES:
        return []
    cur = db.fake_ticker_entries.find(
        {"type": type_, "active": True},
        {"_id": 0, "name": 1, "amount": 1, "game_name": 1, "created_at": 1, "id": 1}
    ).sort("amount", -1)
    return await cur.to_list(500)


# ---------- Admin CRUD ----------
@router.get("/admin/fake-ticker")
async def admin_list_fake(request: Request, type: Optional[str] = None):
    await get_admin_user(request)
    q = {}
    if type:
        if type not in ALLOWED_TYPES:
            raise HTTPException(400, f"type must be one of {ALLOWED_TYPES}")
        q["type"] = type
    cur = db.fake_ticker_entries.find(q, {"_id": 0}).sort("created_at", -1).limit(500)
    entries = await cur.to_list(500)
    return {"entries": entries, "count": len(entries)}


@router.post("/admin/fake-ticker")
async def admin_add_fake(request: Request):
    admin = await get_admin_user(request)
    body = await request.json()
    try:
        type_ = body["type"]
        name = str(body["name"]).strip()
        amount = float(body["amount"])
    except Exception:
        raise HTTPException(400, "type, name, amount are required")
    if type_ not in ALLOWED_TYPES:
        raise HTTPException(400, f"type must be one of {ALLOWED_TYPES}")
    if not name or len(name) > 80:
        raise HTTPException(400, "name must be 1-80 chars")
    if amount <= 0 or amount > 10_000_000:
        raise HTTPException(400, "amount must be > 0 and ≤ 1cr")
    game_name = str(body.get("game_name", "") or "").strip()[:80] or None

    doc = {
        "id": uuid.uuid4().hex[:12],
        "type": type_,
        "name": name,
        "amount": amount,
        "game_name": game_name,
        "active": True,
        "created_at": datetime.now(timezone.utc),
        "admin_id": str(admin.get("_id")) if admin else None,
    }
    await db.fake_ticker_entries.insert_one(doc)
    doc.pop("_id", None)
    return {"entry": doc}


@router.patch("/admin/fake-ticker/{entry_id}")
async def admin_toggle_fake(entry_id: str, request: Request):
    """Toggle active/inactive without deleting."""
    await get_admin_user(request)
    body = await request.json()
    active = bool(body.get("active", True))
    r = await db.fake_ticker_entries.update_one(
        {"id": entry_id},
        {"$set": {"active": active, "updated_at": datetime.now(timezone.utc)}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Entry not found")
    return {"status": "OK", "active": active}


@router.delete("/admin/fake-ticker/{entry_id}")
async def admin_delete_fake(entry_id: str, request: Request):
    await get_admin_user(request)
    r = await db.fake_ticker_entries.delete_one({"id": entry_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Entry not found")
    return {"status": "OK", "deleted": entry_id}
