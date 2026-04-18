from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from starlette.responses import JSONResponse, RedirectResponse, Response
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import logging
import uuid
import aiohttp

from database import db
from auth import get_current_user
from config import IST, IMB_API_TOKEN, IMB_API_URL
from models import DepositRequest, WithdrawRequest

router = APIRouter()


async def process_referral_reward(user_id: str, deposit_amount: float):
    """Check if user was referred and this is their first completed deposit. If yes, give 5% to referrer."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or not user.get("referred_by"):
            return

        referral_code = user["referred_by"]

        if user.get("referral_bonus_given"):
            return

        first_deposit_count = await db.transactions.count_documents({
            "user_id": user_id, "type": "deposit", "status": "completed"
        })
        if first_deposit_count > 1:
            return

        ref_doc = await db.referrals.find_one({"code": referral_code})
        if not ref_doc:
            return

        referrer_id = ref_doc["user_id"]
        bonus = round(deposit_amount * 0.05, 2)

        if bonus <= 0:
            return

        await db.users.update_one({"_id": ObjectId(referrer_id)}, {"$inc": {"balance": bonus}})

        await db.referrals.update_one(
            {"code": referral_code},
            {"$inc": {"total_earned": bonus}, "$addToSet": {"referred_users": user_id}}
        )

        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"referral_bonus_given": True}})

        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": referrer_id,
            "type": "deposit",
            "amount": bonus,
            "status": "completed",
            "reference_id": f"REFERRAL-{user_id[-6:]}",
            "note": f"रेफरल बोनस (5% of ₹{deposit_amount})",
            "created_at": datetime.now(timezone.utc)
        })

        logging.info(f"Referral bonus: ₹{bonus} given to referrer {referrer_id} from user {user_id}'s first deposit of ₹{deposit_amount}")
    except Exception as e:
        logging.error(f"Referral reward error: {e}")


@router.get("/wallet")
async def get_wallet(request: Request):
    user = await get_current_user(request)

    transactions = await db.transactions.find(
        {"user_id": user["_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    return {"balance": user.get("balance", 0.0), "transactions": transactions}


@router.post("/wallet/deposit")
async def create_deposit(deposit: DepositRequest, request: Request):
    user = await get_current_user(request)

    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    min_deposit = int(settings.get("min_deposit", 100)) if settings else 100

    if deposit.amount < min_deposit:
        raise HTTPException(status_code=400, detail=f"न्यूनतम जमा ₹{min_deposit} है")
    if deposit.amount > 50000:
        raise HTTPException(status_code=400, detail="Maximum deposit ₹50000")

    order_id = f"DEP-{str(uuid.uuid4())[:8].upper()}"
    # Use origin_url from the request body as the base for callback
    frontend_url = deposit.origin_url.rstrip("/") if deposit.origin_url else ""
    if not frontend_url:
        frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if not frontend_url:
        scheme = request.headers.get("x-forwarded-proto", "https")
        host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        frontend_url = f"{scheme}://{host}"
    redirect_url = f"{frontend_url}/api/wallet/imb-callback"
    logging.info(f"IMB redirect_url resolved to: {redirect_url}")

    async with aiohttp.ClientSession() as session:
        form_data = aiohttp.FormData()
        form_data.add_field("customer_mobile", deposit.customer_mobile or "9999999999")
        form_data.add_field("user_token", IMB_API_TOKEN)
        form_data.add_field("amount", str(int(deposit.amount)))
        form_data.add_field("order_id", order_id)
        form_data.add_field("redirect_url", redirect_url)
        form_data.add_field("remark1", user["_id"])
        form_data.add_field("remark2", user["email"])

        async with session.post(f"{IMB_API_URL}/api/create-order", data=form_data) as resp:
            resp_data = await resp.json()
            logging.info(f"IMB create-order response: {resp_data}")

            if not resp_data.get("status") or not resp_data.get("result", {}).get("payment_url"):
                raise HTTPException(status_code=500, detail=resp_data.get("message", "Payment creation failed"))

    payment_url = resp_data["result"]["payment_url"]

    transaction_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "type": "deposit",
        "amount": deposit.amount,
        "status": "pending",
        "order_id": order_id,
        "payment_url": payment_url,
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(transaction_doc)

    return {"url": payment_url, "order_id": order_id}


@router.get("/wallet/imb-callback")
async def imb_callback(request: Request):
    params = dict(request.query_params)
    logging.info(f"IMB callback params: {params}")

    order_id = params.get("order_id", "")
    status = params.get("status", "")

    frontend_url = os.environ.get("FRONTEND_URL", "")
    if not frontend_url:
        scheme = request.headers.get("x-forwarded-proto", "https")
        host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        frontend_url = f"{scheme}://{host}"

    if status == "SUCCESS" and order_id:
        verified = False
        try:
            async with aiohttp.ClientSession() as session:
                form_data = aiohttp.FormData()
                form_data.add_field("user_token", IMB_API_TOKEN)
                form_data.add_field("order_id", order_id)

                async with session.post(f"{IMB_API_URL}/api/check-order-status", data=form_data) as resp:
                    resp_text = await resp.text()
                    logging.info(f"IMB verify raw response: {resp_text[:500]}")
                    try:
                        import json as _json
                        verify_data = _json.loads(resp_text)
                        imb_result = verify_data.get("result", {})
                        imb_order_status = imb_result.get("order_status") or imb_result.get("status") or imb_result.get("txnStatus") or ""
                        if imb_order_status.upper() == "SUCCESS":
                            verified = True
                    except Exception:
                        logging.warning("IMB verify returned non-JSON, trusting callback status=SUCCESS")
                        verified = True
        except Exception as e:
            logging.error(f"IMB verify error: {e}")
            verified = True

        if verified:
            transaction = await db.transactions.find_one({"order_id": order_id})
            if transaction and transaction["status"] in ("pending", "failed"):
                if transaction["status"] != "completed":
                    await db.users.update_one(
                        {"_id": ObjectId(transaction["user_id"])},
                        {"$inc": {"balance": transaction["amount"]}}
                    )
                    await db.transactions.update_one(
                        {"order_id": order_id},
                        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
                    )
                    logging.info(f"Deposit completed: order={order_id}, amount={transaction['amount']}")
                    await process_referral_reward(transaction["user_id"], transaction["amount"])
    else:
        await db.transactions.update_one({"order_id": order_id}, {"$set": {"status": "failed"}})

    return RedirectResponse(url=f"{frontend_url}/wallet?payment={status.lower()}&order_id={order_id}")


@router.post("/wallet/imb-webhook")
async def imb_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = dict(await request.form())

    logging.info(f"IMB webhook body: {body}")

    order_id = body.get("order_id", "")
    status = body.get("status", "")

    if status == "SUCCESS" and order_id:
        transaction = await db.transactions.find_one({"order_id": order_id})
        if transaction and transaction["status"] in ("pending", "failed"):
            await db.users.update_one(
                {"_id": ObjectId(transaction["user_id"])},
                {"$inc": {"balance": transaction["amount"]}}
            )
            await db.transactions.update_one(
                {"order_id": order_id},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
            )
            await process_referral_reward(transaction["user_id"], transaction["amount"])
    elif order_id:
        # Only mark as failed if not already completed
        transaction = await db.transactions.find_one({"order_id": order_id})
        if transaction and transaction["status"] == "pending":
            await db.transactions.update_one({"order_id": order_id}, {"$set": {"status": "failed"}})

    return {"status": "ok"}


@router.get("/wallet/deposit/status/{order_id}")
async def check_deposit_status(order_id: str, request: Request):
    user = await get_current_user(request)

    transaction = await db.transactions.find_one({"order_id": order_id, "user_id": user["_id"]})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction["status"] == "completed":
        return {"status": "completed", "amount": transaction["amount"]}

    # Also check IMB for failed transactions (might have been auto-expired)
    try:
        async with aiohttp.ClientSession() as session:
            form_data = aiohttp.FormData()
            form_data.add_field("user_token", IMB_API_TOKEN)
            form_data.add_field("order_id", order_id)

            async with session.post(f"{IMB_API_URL}/api/check-order-status", data=form_data) as resp:
                resp_text = await resp.text()
                logging.info(f"IMB status check raw: {resp_text[:500]}")
                try:
                    import json as _json
                    verify_data = _json.loads(resp_text)
                except Exception:
                    return {"status": transaction["status"], "amount": transaction["amount"]}

        imb_result = verify_data.get("result", {})
        imb_order_status = imb_result.get("order_status") or imb_result.get("status") or imb_result.get("txnStatus") or ""

        if imb_order_status.upper() == "SUCCESS":
            if transaction["status"] != "completed":
                await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": transaction["amount"]}})
                await db.transactions.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
                )
                await process_referral_reward(user["_id"], transaction["amount"])
            return {"status": "completed", "amount": transaction["amount"]}

        # Don't return "failed" from IMB - just return current status or pending
        if imb_order_status.upper() in ("FAILED", "EXPIRED"):
            return {"status": "failed", "amount": transaction["amount"]}

        return {"status": "pending", "amount": transaction["amount"]}
    except Exception as e:
        logging.error(f"IMB status check error: {e}")
        return {"status": transaction["status"], "amount": transaction["amount"]}


@router.post("/wallet/withdraw")
async def request_withdrawal(withdraw: WithdrawRequest, request: Request):
    user = await get_current_user(request)

    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    min_withdrawal = int(settings.get("min_withdrawal", 100)) if settings else 100
    w_start = settings.get("withdrawal_start_time", "") if settings else ""
    w_end = settings.get("withdrawal_end_time", "") if settings else ""

    if w_start and w_end:
        ist_now = datetime.now(IST)
        current_minutes = ist_now.hour * 60 + ist_now.minute
        try:
            sh, sm = map(int, w_start.split(":"))
            eh, em = map(int, w_end.split(":"))
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            if start_min > end_min:
                allowed = current_minutes >= start_min or current_minutes <= end_min
            else:
                allowed = start_min <= current_minutes <= end_min
            if not allowed:
                raise HTTPException(status_code=400, detail=f"निकासी का समय {w_start} से {w_end} तक है")
        except ValueError:
            pass

    if withdraw.amount < min_withdrawal:
        raise HTTPException(status_code=400, detail=f"न्यूनतम निकासी ₹{min_withdrawal} है")

    if withdraw.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")

    if not withdraw.upi_id and not (withdraw.bank_account and withdraw.ifsc_code) and not withdraw.scanner_image:
        raise HTTPException(status_code=400, detail="UPI ID, बैंक डिटेल्स या स्कैनर दें")

    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": -withdraw.amount}})

    withdrawal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "user_email": user.get("email", ""),
        "user_name": user["name"],
        "user_phone": user.get("phone", ""),
        "type": "withdrawal",
        "amount": withdraw.amount,
        "withdrawal_method": withdraw.withdrawal_method or "upi",
        "upi_id": withdraw.upi_id,
        "bank_account": withdraw.bank_account,
        "ifsc_code": withdraw.ifsc_code,
        "account_holder": withdraw.account_holder,
        "scanner_image": withdraw.scanner_image,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(withdrawal_doc)

    return {"message": "Withdrawal request submitted", "id": withdrawal_doc["id"]}


@router.post("/wallet/upload-scanner")
async def upload_scanner(file: UploadFile = File(...), request: Request = None):
    await get_current_user(request)

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="केवल इमेज फाइल अपलोड करें")

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = f"/app/backend/uploads/{filename}"

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="फाइल 5MB से बड़ी नहीं होनी चाहिए")

    with open(filepath, "wb") as f:
        f.write(content)

    return {"url": f"/api/uploads/{filename}"}


# Referral Routes
@router.get("/referral/info")
async def get_referral_info(request: Request):
    user = await get_current_user(request)
    user_id = user["_id"]

    ref_data = await db.referrals.find_one({"user_id": user_id}, {"_id": 0})
    if not ref_data:
        code = f"SM{user_id[-6:].upper()}"
        ref_data = {
            "user_id": user_id, "code": code,
            "referred_users": [], "total_earned": 0.0,
            "created_at": datetime.now(timezone.utc)
        }
        await db.referrals.insert_one(ref_data)
        ref_data.pop("_id", None)

    referred_count = len(ref_data.get("referred_users", []))
    return {"code": ref_data["code"], "referred_count": referred_count, "total_earned": ref_data.get("total_earned", 0.0)}


@router.post("/referral/apply")
async def apply_referral(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    code = body.get("code", "").strip().upper()

    if not code:
        raise HTTPException(status_code=400, detail="रेफरल कोड दर्ज करें")

    existing = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if existing.get("referred_by"):
        raise HTTPException(status_code=400, detail="आपने पहले ही एक रेफरल कोड इस्तेमाल किया है")

    ref = await db.referrals.find_one({"code": code})
    if not ref:
        raise HTTPException(status_code=404, detail="गलत रेफरल कोड")

    if ref["user_id"] == user["_id"]:
        raise HTTPException(status_code=400, detail="आप अपना खुद का कोड इस्तेमाल नहीं कर सकते")

    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"referred_by": code}})

    return {"message": "रेफरल कोड लागू हो गया! पहली जमा पर आपके दोस्त को 5% बोनस मिलेगा"}


@router.post("/wallet/withdraw/{withdrawal_id}/cancel")
async def cancel_withdrawal(withdrawal_id: str, request: Request):
    user = await get_current_user(request)

    withdrawal = await db.transactions.find_one({
        "id": withdrawal_id, "type": "withdrawal", "status": "pending", "user_id": user["_id"]
    })

    if not withdrawal:
        raise HTTPException(status_code=404, detail="निकासी अनुरोध नहीं मिला")

    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"balance": withdrawal["amount"]}})

    await db.transactions.update_one(
        {"id": withdrawal_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )

    return {"message": "निकासी रद्द कर दी गई, राशि वापस आ गई"}


@router.get("/wallet/export")
async def export_transactions(request: Request):
    user = await get_current_user(request)

    transactions = await db.transactions.find(
        {"user_id": user["_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    csv_lines = ["Date,Time,Type,Amount,Status"]
    for tx in transactions:
        dt = tx.get("created_at")
        if dt:
            ist = dt + timedelta(hours=5, minutes=30)
            date_str = ist.strftime("%d/%m/%Y")
            time_str = ist.strftime("%I:%M %p")
        else:
            date_str = time_str = ""
        tx_type = "Deposit" if tx["type"] == "deposit" else "Withdrawal" if tx["type"] == "withdrawal" else "Bonus"
        csv_lines.append(f"{date_str},{time_str},{tx_type},{tx['amount']},{tx['status']}")

    csv_content = "\n".join(csv_lines)
    return Response(content=csv_content, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=transactions.csv"})
