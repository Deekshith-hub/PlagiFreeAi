from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio

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

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    reset_date: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class RewriteRequest(BaseModel):
    text: str
    mode: str  # light, standard, aggressive, human-like
    tone: str  # academic, professional, casual, creative, formal

class RewriteResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    rewritten_text: str
    original_word_count: int
    rewritten_word_count: int
    mode: str
    tone: str
    timestamp: str

class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    original_text: str
    rewritten_text: str
    mode: str
    tone: str
    original_word_count: int
    rewritten_word_count: int
    timestamp: str

class UsageResponse(BaseModel):
    daily_limit: int
    rewrites_today: int
    remaining: int
    reset_date: str

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

# ============= AI REWRITING =============

async def rewrite_text_with_ai(text: str, mode: str, tone: str) -> str:
    """Rewrite text using OpenAI GPT-5.2 with specific mode and tone"""
    
    # System prompts based on mode
    mode_instructions = {
        "light": "Make minimal changes to the text. Focus on rephrasing key sentences while maintaining most of the structure. Ensure the text remains academically safe and grammatically correct.",
        "standard": "Rewrite the text with balanced uniqueness and clarity. Restructure sentences moderately, use intelligent synonyms, and maintain natural readability.",
        "aggressive": "Completely restructure the text for maximum uniqueness. Use advanced vocabulary, reorder clauses extensively, and ensure every sentence has a different structure while preserving the exact meaning.",
        "human-like": "Rewrite in a natural, conversational style. Make it sound like a human wrote it from scratch. Use varied sentence structures, natural transitions, and avoid any robotic patterns."
    }
    
    # Tone adjustments
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

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    reset_date = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "daily_limit": 10,
        "rewrites_today": 0,
        "reset_date": reset_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Generate token
    token = create_access_token(user_id)
    
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        daily_limit=10,
        rewrites_today=0,
        reset_date=reset_date
    )
    
    return TokenResponse(token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if reset is needed
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
        reset_date=user["reset_date"]
    )
    
    return TokenResponse(token=token, user=user_response)

@api_router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(request: RewriteRequest, current_user: dict = Depends(get_current_user)):
    # Check usage limits
    if current_user["rewrites_today"] >= current_user["daily_limit"]:
        raise HTTPException(status_code=429, detail="Daily rewrite limit reached")
    
    # Validate inputs
    valid_modes = ["light", "standard", "aggressive", "human-like"]
    valid_tones = ["academic", "professional", "casual", "creative", "formal"]
    
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Choose from: {', '.join(valid_modes)}")
    if request.tone not in valid_tones:
        raise HTTPException(status_code=400, detail=f"Invalid tone. Choose from: {', '.join(valid_tones)}")
    
    # Word count
    original_word_count = len(request.text.split())
    
    # Rewrite with AI
    rewritten_text = await rewrite_text_with_ai(request.text, request.mode, request.tone)
    rewritten_word_count = len(rewritten_text.split())
    
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
        "timestamp": timestamp
    }
    
    await db.rewrite_history.insert_one(history_doc)
    
    # Update user's rewrite count
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"rewrites_today": 1}}
    )
    
    return RewriteResponse(
        id=history_id,
        rewritten_text=rewritten_text,
        original_word_count=original_word_count,
        rewritten_word_count=rewritten_word_count,
        mode=request.mode,
        tone=request.tone,
        timestamp=timestamp
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
    # Check if reset is needed
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
        reset_date=current_user["reset_date"]
    )

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