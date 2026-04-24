from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    phone: str
    password: str

class AdminLogin(BaseModel):
    email: str
    password: str

class OTPRequest(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None

class OTPVerify(BaseModel):
    phone: str
    otp: str

class OTPCompleteSignup(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None
    referral_code: Optional[str] = None

class OTPLoginRequest(BaseModel):
    phone: str

class PasswordResetRequest(BaseModel):
    phone: str

class PasswordResetComplete(BaseModel):
    phone: str
    otp: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    balance: float
    created_at: datetime

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class BetCreate(BaseModel):
    game_id: str
    bet_type: str
    number: str
    amount: float

class BatchBetItem(BaseModel):
    number: str
    amount: float

class BatchBetCreate(BaseModel):
    game_id: str
    bet_type: str
    bets: List[BatchBetItem]

class WithdrawRequest(BaseModel):
    amount: float
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_holder: Optional[str] = None
    scanner_image: Optional[str] = None
    withdrawal_method: Optional[str] = "upi"

class DepositRequest(BaseModel):
    amount: float
    origin_url: str
    customer_mobile: Optional[str] = None

class ResultDeclare(BaseModel):
    game_id: str
    date: str
    jodi_result: str

class NotificationSubscribe(BaseModel):
    telegram_chat_id: Optional[str] = None
    whatsapp_number: Optional[str] = None

class GameCreate(BaseModel):
    game_id: str
    name: str
    name_hi: str
    category: str = "gali_disawar"
    start_time: str
    end_time: str
    display_time: str
    is_active: bool = True

class GameUpdate(BaseModel):
    name: Optional[str] = None
    name_hi: Optional[str] = None
    category: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    display_time: Optional[str] = None
    is_active: Optional[bool] = None

class HelpMessageCreate(BaseModel):
    title: str
    message: str
    is_active: bool = True

class ChatMessageSend(BaseModel):
    message: str
    msg_type: str = "text"
    attachment_url: Optional[str] = None

class WalletAdjustment(BaseModel):
    amount: float
    type: str
    reason: str
