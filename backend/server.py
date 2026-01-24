from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from docx import Document
from io import BytesIO
import difflib
import secrets
from email_service import send_verification_email, send_owner_setup_reminder

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'plagifree_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '168'))

# Stripe settings
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Credit packages
CREDIT_PACKAGES = {
    "extra_20": {"amount": 50.0, "currency": "inr", "credits": 20, "description": "20 Extra Rewrites"}
}

# ============= MODELS =============

class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    daily_limit: int
    rewrites_today: int
    credits: int
    reset_date: str
    email_verified: bool
    is_admin: bool = False

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class OwnerSetupRequest(BaseModel):
    business_name: Optional[str] = None
    owner_name: str
    support_email: EmailStr
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_holder_name: Optional[str] = None
    gst_number: Optional[str] = None
    country: str = "India"
    currency: str = "INR"
    terms_url: Optional[str] = None
    refund_policy: Optional[str] = None

class OwnerSetupResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    is_setup_complete: bool
    business_name: Optional[str] = None
    support_email: Optional[str] = None
    payments_enabled: bool

class RewriteRequest(BaseModel):
    text: str
    mode: str
    tone: str

class RewriteResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    rewritten_text: str
    original_word_count: int
    rewritten_word_count: int
    mode: str
    tone: str
    timestamp: str
    plagiarism_percentage: float
    changed_sentences: List[Dict[str, str]]

class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    original_text: str
    rewritten_text: str
    mode: str
    tone: str
    original_word_count: int
    rewritten_word_count: int
    plagiarism_percentage: float
    timestamp: str

class UsageResponse(BaseModel):
    daily_limit: int
    rewrites_today: int
    remaining: int
    credits: int
    reset_date: str

class PurchaseCreditsRequest(BaseModel):
    package_id: str
    origin_url: str

class PurchaseCreditsResponse(BaseModel):
    checkout_url: str
    session_id: str

# ============= AUTH HELPERS =============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("user_id")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    return user

# ============= HELPER FUNCTIONS =============

def calculate_plagiarism_percentage(original: str, rewritten: str) -> float:
    """Calculate similarity percentage (inverse of uniqueness)"""
    original_words = set(original.lower().split())
    rewritten_words = set(rewritten.lower().split())
    
    if not original_words:
        return 0.0
    
    common_words = original_words.intersection(rewritten_words)
    similarity = len(common_words) / len(original_words) * 100
    
    # Return uniqueness percentage (100 - similarity)
    uniqueness = 100 - similarity
    return round(max(0, min(100, uniqueness)), 1)

def get_changed_sentences(original: str, rewritten: str) -> List[Dict[str, str]]:
    """Get sentence-level differences"""
    original_sentences = [s.strip() for s in original.split('.') if s.strip()]
    rewritten_sentences = [s.strip() for s in rewritten.split('.') if s.strip()]
    
    changes = []
    max_len = max(len(original_sentences), len(rewritten_sentences))
    
    for i in range(max_len):
        original_sent = original_sentences[i] if i < len(original_sentences) else ""
        rewritten_sent = rewritten_sentences[i] if i < len(rewritten_sentences) else ""
        
        if original_sent and rewritten_sent and original_sent.lower() != rewritten_sent.lower():
            changes.append({
                "original": original_sent,
                "rewritten": rewritten_sent,
                "type": "changed"
            })
    
    return changes

def create_docx(text: str) -> BytesIO:
    """Create a .docx file from text"""
    doc = Document()
    doc.add_paragraph(text)
    
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer

# ============= AI REWRITING =============

async def rewrite_text_with_ai(text: str, mode: str, tone: str) -> str:
    """Rewrite text using OpenAI GPT-5.2 with specific mode and tone"""
    
    mode_instructions = {
        "light": "Make minimal changes to the text. Focus on rephrasing key sentences while maintaining most of the structure. Ensure the text remains academically safe and grammatically correct.",
        "standard": "Rewrite the text with balanced uniqueness and clarity. Restructure sentences moderately, use intelligent synonyms, and maintain natural readability.",
        "aggressive": "Completely restructure the text for maximum uniqueness. Use advanced vocabulary, reorder clauses extensively, and ensure every sentence has a different structure while preserving the exact meaning.",
        "human-like": "Rewrite in a natural, conversational style. Make it sound like a human wrote it from scratch. Use varied sentence structures, natural transitions, and avoid any robotic patterns."
    }
    
    tone_instructions = {
        "academic": "Use formal academic language, precise terminology, and scholarly tone. Maintain objectivity and use passive voice where appropriate.",
        "professional": "Use business-appropriate language, clear and concise sentences, and professional tone. Be direct and authoritative.",
        "casual": "Use friendly, approachable language. Write as if explaining to a friend. Use contractions and simple vocabulary where appropriate.",
        "creative": "Use expressive, vivid language. Employ creative word choices, varied sentence structures, and engaging descriptions.",
        "formal": "Use highly formal language with sophisticated vocabulary. Maintain strict grammatical correctness and traditional writing conventions."
    }
    
    system_message = f"""You are an expert text rewriting assistant. Your task is to rewrite the provided text to make it 100% plagiarism-free while preserving the original meaning.

Rewriting Mode: {mode.upper()}
{mode_instructions.get(mode, mode_instructions['standard'])}

Tone: {tone.upper()}
{tone_instructions.get(tone, tone_instructions['professional'])}

CRITICAL RULES:
1. NEVER copy sentence structures directly
2. ALWAYS restructure phrasing and syntax
3. Maintain semantic meaning exactly
4. Avoid repetitive or robotic patterns
5. Produce fully human-sounding content
6. Ensure output passes plagiarism detection
7. Fix any grammar mistakes
8. Maintain proper paragraph breaks

Provide ONLY the rewritten text without any explanations, introductions, or meta-commentary."""
    
    try:
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=str(uuid.uuid4()),
            system_message=system_message
        )
        chat.with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=text)
        response = await chat.send_message(user_message)
        
        return response.strip()
    except Exception as e:
        logger.error(f"AI rewriting error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI rewriting failed: {str(e)}")

# ============= ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "PlagiFree AI API"}

@api_router.post("/auth/verify-email")
async def verify_email(token: str):
    """Verify user email with token"""
    user = await db.users.find_one({"verification_token": token}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    # Check if token expired
    expiry = datetime.fromisoformat(user["verification_expiry"])
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Verification token expired")
    
    # Verify email
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "email_verified": True,
            "verification_token": None,
            "verification_expiry": None
        }}
    )
    
    return {"message": "Email verified successfully"}

@api_router.post("/auth/resend-verification")
async def resend_verification(current_user: dict = Depends(get_current_user)):
    """Resend verification email"""
    if current_user.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Email already verified")
    
    # Generate new token
    verification_token = secrets.token_urlsafe(32)
    verification_expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "verification_token": verification_token,
            "verification_expiry": verification_expiry
        }}
    )
    
    # Send email
    send_verification_email(current_user["email"], verification_token)
    
    return {"message": "Verification email sent"}

@api_router.get("/owner/setup-status", response_model=OwnerSetupResponse)
async def get_owner_setup_status():
    """Check if owner has completed payment setup"""
    owner_config = await db.owner_config.find_one({}, {"_id": 0})
    
    if not owner_config:
        return OwnerSetupResponse(
            is_setup_complete=False,
            payments_enabled=False
        )
    
    return OwnerSetupResponse(
        is_setup_complete=owner_config.get("setup_complete", False),
        business_name=owner_config.get("business_name"),
        support_email=owner_config.get("support_email"),
        payments_enabled=owner_config.get("payments_enabled", False)
    )

@api_router.post("/owner/setup")
async def setup_owner_config(
    config: OwnerSetupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Configure owner/admin payment details"""
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate at least one payment method
    has_payment_method = bool(config.upi_id or config.bank_account)
    
    config_doc = {
        "owner_name": config.owner_name,
        "business_name": config.business_name,
        "support_email": config.support_email,
        "upi_id": config.upi_id,
        "bank_account": config.bank_account,
        "ifsc_code": config.ifsc_code,
        "account_holder_name": config.account_holder_name,
        "gst_number": config.gst_number,
        "country": config.country,
        "currency": config.currency,
        "terms_url": config.terms_url,
        "refund_policy": config.refund_policy,
        "setup_complete": has_payment_method,
        "payments_enabled": has_payment_method,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert owner config
    await db.owner_config.update_one(
        {},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"message": "Owner configuration saved successfully", "payments_enabled": has_payment_method}

@api_router.get("/owner/config")
async def get_owner_config(current_user: dict = Depends(get_current_user)):
    """Get owner configuration (admin only)"""
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.owner_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Owner configuration not found")
    
    return config

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    reset_date = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat()
    
    # Generate verification token
    verification_token = secrets.token_urlsafe(32)
    verification_expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    
    # Check if this is the first user (admin)
    user_count = await db.users.count_documents({})
    is_admin = (user_count == 0)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "daily_limit": 10,
        "rewrites_today": 0,
        "credits": 0,
        "reset_date": reset_date,
        "email_verified": False,
        "is_admin": is_admin,
        "verification_token": verification_token,
        "verification_expiry": verification_expiry,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Send verification email
    send_verification_email(user_data.email, verification_token)
    
    token = create_access_token(user_id)
    
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        daily_limit=10,
        rewrites_today=0,
        credits=0,
        reset_date=reset_date,
        email_verified=False,
        is_admin=is_admin
    )
    
    return TokenResponse(token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    reset_date = datetime.fromisoformat(user["reset_date"])
    if datetime.now(timezone.utc) >= reset_date:
        new_reset_date = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat()
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"rewrites_today": 0, "reset_date": new_reset_date}}
        )
        user["rewrites_today"] = 0
        user["reset_date"] = new_reset_date
    
    token = create_access_token(user["id"])
    
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        daily_limit=user["daily_limit"],
        rewrites_today=user["rewrites_today"],
        credits=user.get("credits", 0),
        reset_date=user["reset_date"],
        email_verified=user.get("email_verified", False),
        is_admin=user.get("is_admin", False)
    )
    
    return TokenResponse(token=token, user=user_response)

@api_router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(request: RewriteRequest, current_user: dict = Depends(get_current_user)):
    # Check if user has daily rewrites left or credits
    total_available = (current_user["daily_limit"] - current_user["rewrites_today"]) + current_user.get("credits", 0)
    
    if total_available <= 0:
        raise HTTPException(
            status_code=429, 
            detail="No rewrites remaining. Purchase credits to continue."
        )
    
    # Validate inputs
    valid_modes = ["light", "standard", "aggressive", "human-like"]
    valid_tones = ["academic", "professional", "casual", "creative", "formal"]
    
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Choose from: {', '.join(valid_modes)}")
    if request.tone not in valid_tones:
        raise HTTPException(status_code=400, detail=f"Invalid tone. Choose from: {', '.join(valid_tones)}")
    
    original_word_count = len(request.text.split())
    
    # Rewrite with AI
    rewritten_text = await rewrite_text_with_ai(request.text, request.mode, request.tone)
    rewritten_word_count = len(rewritten_text.split())
    
    # Calculate plagiarism percentage
    plagiarism_pct = calculate_plagiarism_percentage(request.text, rewritten_text)
    
    # Get changed sentences
    changed_sentences = get_changed_sentences(request.text, rewritten_text)
    
    # Save to history
    history_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    
    history_doc = {
        "id": history_id,
        "user_id": current_user["id"],
        "original_text": request.text,
        "rewritten_text": rewritten_text,
        "mode": request.mode,
        "tone": request.tone,
        "original_word_count": original_word_count,
        "rewritten_word_count": rewritten_word_count,
        "plagiarism_percentage": plagiarism_pct,
        "timestamp": timestamp
    }
    
    await db.rewrite_history.insert_one(history_doc)
    
    # Deduct from daily limit first, then credits if needed
    if current_user["rewrites_today"] < current_user["daily_limit"]:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"rewrites_today": 1}}
        )
    else:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"credits": -1}}
        )
    
    return RewriteResponse(
        id=history_id,
        rewritten_text=rewritten_text,
        original_word_count=original_word_count,
        rewritten_word_count=rewritten_word_count,
        mode=request.mode,
        tone=request.tone,
        timestamp=timestamp,
        plagiarism_percentage=plagiarism_pct,
        changed_sentences=changed_sentences
    )

@api_router.get("/history", response_model=List[HistoryItem])
async def get_history(current_user: dict = Depends(get_current_user)):
    history = await db.rewrite_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return history

@api_router.get("/usage", response_model=UsageResponse)
async def get_usage(current_user: dict = Depends(get_current_user)):
    reset_date = datetime.fromisoformat(current_user["reset_date"])
    if datetime.now(timezone.utc) >= reset_date:
        new_reset_date = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat()
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"rewrites_today": 0, "reset_date": new_reset_date}}
        )
        current_user["rewrites_today"] = 0
        current_user["reset_date"] = new_reset_date
    
    return UsageResponse(
        daily_limit=current_user["daily_limit"],
        rewrites_today=current_user["rewrites_today"],
        remaining=current_user["daily_limit"] - current_user["rewrites_today"],
        credits=current_user.get("credits", 0),
        reset_date=current_user["reset_date"]
    )

@api_router.get("/download/{history_id}/docx")
async def download_docx(history_id: str, current_user: dict = Depends(get_current_user)):
    """Download rewritten text as .docx file"""
    history_item = await db.rewrite_history.find_one(
        {"id": history_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not history_item:
        raise HTTPException(status_code=404, detail="History item not found")
    
    docx_buffer = create_docx(history_item["rewritten_text"])
    
    return StreamingResponse(
        docx_buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=rewritten-text-{history_id[:8]}.docx"}
    )

# ============= PAYMENT ROUTES =============

@api_router.post("/payments/purchase-credits", response_model=PurchaseCreditsResponse)
async def purchase_credits(
    request: PurchaseCreditsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session for purchasing credits"""
    
    if request.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = CREDIT_PACKAGES[request.package_id]
    
    # Initialize Stripe
    webhook_url = f"{request.origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    success_url = f"{request.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/editor"
    
    checkout_request = CheckoutSessionRequest(
        amount=package["amount"],
        currency=package["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user["id"],
            "package_id": request.package_id,
            "credits": str(package["credits"])
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Store payment transaction
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": current_user["id"],
        "package_id": request.package_id,
        "amount": package["amount"],
        "currency": package["currency"],
        "credits": package["credits"],
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_doc)
    
    return PurchaseCreditsResponse(
        checkout_url=session.url,
        session_id=session.session_id
    )

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check payment status and update credits if successful"""
    
    # Find transaction
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return status
    if transaction["payment_status"] == "paid":
        return {"status": "completed", "message": "Credits already added"}
    
    # Check with Stripe
    webhook_url = f"http://dummy/webhook"  # Not used for status check
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": checkout_status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment successful and not yet processed, add credits
        if checkout_status.payment_status == "paid" and transaction["payment_status"] != "paid":
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$inc": {"credits": transaction["credits"]}}
            )
            
            return {
                "status": "completed",
                "message": f"{transaction['credits']} credits added successfully",
                "credits_added": transaction["credits"]
            }
        
        return {
            "status": checkout_status.payment_status,
            "message": f"Payment status: {checkout_status.payment_status}"
        }
        
    except Exception as e:
        logger.error(f"Payment status check error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        webhook_url = "http://dummy/webhook"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        logger.info(f"Webhook received: {webhook_response.event_type}")
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
