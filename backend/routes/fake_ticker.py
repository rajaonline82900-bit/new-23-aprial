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
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from database import db
from auth import get_admin_user

router = APIRouter()

ALLOWED_TYPES = {"winner", "deposit", "withdrawal"}

# Realistic Indian names pool (mix of first + surname combinations)
_FIRST_NAMES = [
    "Rohit", "Amit", "Suresh", "Rajesh", "Vikas", "Arjun", "Rahul", "Sandeep",
    "Manoj", "Deepak", "Prakash", "Ravi", "Vijay", "Ajay", "Sunil", "Anil",
    "Sachin", "Vikram", "Naveen", "Karan", "Yash", "Aakash", "Nitin", "Gaurav",
    "Ankit", "Harsh", "Shivam", "Kunal", "Pankaj", "Mahesh", "Ramesh", "Dinesh",
    "Kishore", "Rakesh", "Mukesh", "Jitendra", "Bhavesh", "Chirag", "Hardik",
    "Priya", "Anjali", "Neha", "Pooja", "Sneha", "Kavita", "Sunita", "Ritu",
    "Meena", "Shruti", "Rekha", "Sonam", "Kajal", "Divya", "Preeti", "Nisha",
    "Arun", "Bhavin", "Chetan", "Dilip", "Ganesh", "Hitesh", "Ishaan", "Jay",
    "Kartik", "Lokesh", "Mohit", "Nikhil", "Om", "Piyush", "Rajat", "Sagar",
    "Tarun", "Uday", "Varun", "Yogesh", "Rohan", "Siddharth", "Tushar", "Aditya",
]
_SURNAMES = [
    "Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Yadav", "Mishra",
    "Pandey", "Tiwari", "Jain", "Agarwal", "Shah", "Mehta", "Chauhan", "Reddy",
    "Rao", "Nair", "Menon", "Iyer", "Joshi", "Bansal", "Malhotra", "Kapoor",
    "Chopra", "Bhatt", "Trivedi", "Desai", "Rana", "Kaur", "Bhardwaj", "Saxena",
    "Shukla", "Dubey", "Chaudhary", "Solanki", "Prajapati", "Thakur", "Bhatia",
]

# Popular Indian game/market names for winner entries
_GAME_NAMES = [
    "Kalyan", "Milan Day", "Milan Night", "Rajdhani Day", "Rajdhani Night",
    "Main Bazar", "Kalyan Night", "Time Bazar", "Madhur Day", "Madhur Night",
    "Sridevi", "Sridevi Night", "Supreme Day", "Supreme Night",
    "Gali", "Disawar", "Faridabad", "Ghaziabad",
    "Aviator", "Ludo",
]


def _random_name() -> str:
    return f"{random.choice(_FIRST_NAMES)} {random.choice(_SURNAMES)}"


def _random_amount(type_: str) -> float:
    """Realistic amount ranges per type; rounded to nice ₹ denominations."""
    if type_ == "winner":
        # ₹500 - ₹50,000 — heavy tail toward smaller wins
        buckets = [(500, 2000, 0.35), (2000, 8000, 0.35), (8000, 20000, 0.20), (20000, 50000, 0.10)]
    elif type_ == "deposit":
        # ₹100 - ₹10,000
        buckets = [(100, 500, 0.35), (500, 2000, 0.35), (2000, 5000, 0.20), (5000, 10000, 0.10)]
    else:  # withdrawal
        # ₹200 - ₹20,000
        buckets = [(200, 1000, 0.30), (1000, 5000, 0.35), (5000, 10000, 0.20), (10000, 20000, 0.15)]

    r = random.random()
    cum = 0.0
    lo, hi = buckets[0][0], buckets[0][1]
    for l, h, p in buckets:
        cum += p
        if r <= cum:
            lo, hi = l, h
            break
    val = random.randint(lo, hi)
    # snap to nearest ₹50/₹100 for realism
    snap = 100 if val >= 1000 else 50
    return float((val // snap) * snap)


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


@router.post("/admin/fake-ticker/bulk")
async def admin_bulk_generate(request: Request):
    """Bulk-generate fake entries with realistic Indian names + amounts.

    Body: {
        count: int (1-200),
        type: 'winner'|'deposit'|'withdrawal'|'mixed',
        game_filter?: str  (only used when type in {winner, mixed} — restricts to that game)
    }
    """
    admin = await get_admin_user(request)
    body = await request.json()
    try:
        count = int(body.get("count", 20))
        type_ = str(body.get("type", "mixed")).lower()
    except Exception:
        raise HTTPException(400, "count and type are required")

    if count < 1 or count > 200:
        raise HTTPException(400, "count must be between 1 and 200")
    if type_ != "mixed" and type_ not in ALLOWED_TYPES:
        raise HTTPException(400, f"type must be mixed or one of {ALLOWED_TYPES}")

    game_filter = str(body.get("game_filter", "") or "").strip()[:80] or None

    now = datetime.now(timezone.utc)
    admin_id = str(admin.get("_id")) if admin else None
    docs = []
    for _ in range(count):
        t = type_ if type_ != "mixed" else random.choice(list(ALLOWED_TYPES))
        game_name = None
        if t == "winner":
            game_name = game_filter or random.choice(_GAME_NAMES)
        docs.append({
            "id": uuid.uuid4().hex[:12],
            "type": t,
            "name": _random_name(),
            "amount": _random_amount(t),
            "game_name": game_name,
            "active": True,
            "created_at": now,
            "admin_id": admin_id,
            "bulk": True,
        })

    await db.fake_ticker_entries.insert_many(docs)

    # count by type for response
    by_type = {"winner": 0, "deposit": 0, "withdrawal": 0}
    for d in docs:
        by_type[d["type"]] += 1

    return {"status": "OK", "inserted": len(docs), "by_type": by_type}


@router.delete("/admin/fake-ticker/bulk/all")
async def admin_bulk_delete(request: Request, type: Optional[str] = None):
    """Delete all fake entries (optionally filtered by type). Handy cleanup."""
    await get_admin_user(request)
    q = {}
    if type:
        if type not in ALLOWED_TYPES:
            raise HTTPException(400, f"type must be one of {ALLOWED_TYPES}")
        q["type"] = type
    r = await db.fake_ticker_entries.delete_many(q)
    return {"status": "OK", "deleted": r.deleted_count}
