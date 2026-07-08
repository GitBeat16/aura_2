from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import tempfile
import base64
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_DAYS = int(os.environ.get('JWT_EXPIRE_DAYS', '30'))
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="Aura Companion API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# =========================== MODELS ===========================
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=60)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class MoodCreate(BaseModel):
    mood: Literal["great", "good", "okay", "low", "stuck", "anxious", "lonely"]
    note: Optional[str] = None


class Mood(BaseModel):
    id: str
    user_id: str
    mood: str
    note: Optional[str] = None
    created_at: datetime


class ChatMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: Optional[str] = None
    voice: bool = False  # if true, also return TTS audio for the reply


class ChatMessage(BaseModel):
    id: str
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    emotion: Optional[str] = None


class ChatSendResponse(BaseModel):
    session_id: str
    user_message: ChatMessage
    assistant_message: ChatMessage
    audio_base64: Optional[str] = None  # mp3, only when voice=true


class TranscribeResponse(BaseModel):
    text: str


class DailyAction(BaseModel):
    id: str
    title: str
    description: str
    category: str
    duration_minutes: int
    icon: str
    completed: bool = False


class ActionCompleteResponse(BaseModel):
    action_id: str
    completed: bool
    completed_at: datetime


class SocialSuggestion(BaseModel):
    id: str
    title: str
    description: str
    prompt: str
    icon: str


class Event(BaseModel):
    id: str
    title: str
    description: str
    category: str
    date: str
    time: str
    location: str
    image_url: str
    attendees: int
    is_virtual: bool


# =========================== AUTH HELPERS ===========================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_jwt(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def user_to_public(user: dict) -> UserPublic:
    return UserPublic(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"],
    )


# =========================== SEED DATA ===========================
DAILY_ACTIONS_BY_MOOD = {
    "great": [
        {"title": "Share a compliment", "description": "Send a kind message to someone you appreciate.", "category": "connection", "duration_minutes": 5, "icon": "heart"},
        {"title": "Try something new", "description": "Explore a new recipe, route, or activity today.", "category": "growth", "duration_minutes": 20, "icon": "compass"},
        {"title": "Journal a highlight", "description": "Write down what's making today feel good.", "category": "reflection", "duration_minutes": 5, "icon": "edit-3"},
    ],
    "good": [
        {"title": "5-min gratitude", "description": "List three small things you're grateful for.", "category": "reflection", "duration_minutes": 5, "icon": "sun"},
        {"title": "Reach out to a friend", "description": "Send a short 'thinking of you' message.", "category": "connection", "duration_minutes": 3, "icon": "message-circle"},
        {"title": "Take a mindful walk", "description": "10 minutes outside without your phone.", "category": "movement", "duration_minutes": 10, "icon": "wind"},
    ],
    "okay": [
        {"title": "Deep breath practice", "description": "Try 4-7-8 breathing for 5 rounds.", "category": "calm", "duration_minutes": 3, "icon": "cloud"},
        {"title": "Tidy one small space", "description": "Clear your desk or one drawer.", "category": "reset", "duration_minutes": 10, "icon": "grid"},
        {"title": "Sip something warm", "description": "Make tea or coffee slowly and mindfully.", "category": "calm", "duration_minutes": 5, "icon": "coffee"},
    ],
    "low": [
        {"title": "Just step outside", "description": "5 minutes of fresh air. That's enough today.", "category": "movement", "duration_minutes": 5, "icon": "wind"},
        {"title": "Text one person", "description": "You don't have to explain. Just say hi.", "category": "connection", "duration_minutes": 2, "icon": "message-circle"},
        {"title": "Drink a full glass of water", "description": "Small acts of care count.", "category": "care", "duration_minutes": 1, "icon": "droplet"},
    ],
    "stuck": [
        {"title": "Write down the mess", "description": "Brain-dump every thought for 5 minutes.", "category": "reflection", "duration_minutes": 5, "icon": "edit-3"},
        {"title": "Pick one tiny task", "description": "Something you can finish in 2 minutes.", "category": "reset", "duration_minutes": 2, "icon": "check-square"},
        {"title": "Change your scenery", "description": "Move to another room or step outside.", "category": "reset", "duration_minutes": 5, "icon": "map"},
    ],
    "anxious": [
        {"title": "5-4-3-2-1 grounding", "description": "Name 5 things you see, 4 you hear, 3 you feel, 2 you smell, 1 you taste.", "category": "calm", "duration_minutes": 5, "icon": "cloud"},
        {"title": "Slow box breathing", "description": "Inhale 4, hold 4, exhale 4, hold 4. Repeat.", "category": "calm", "duration_minutes": 5, "icon": "wind"},
        {"title": "Put your feet on the floor", "description": "Feel the ground. You're safe right now.", "category": "care", "duration_minutes": 1, "icon": "anchor"},
    ],
    "lonely": [
        {"title": "Send a voice note", "description": "Voice feels closer than text. Send one to anyone.", "category": "connection", "duration_minutes": 3, "icon": "mic"},
        {"title": "Join a community event", "description": "Check the Events tab for something nearby.", "category": "connection", "duration_minutes": 15, "icon": "users"},
        {"title": "Talk to Aura", "description": "I'm right here. Tap Chat when you're ready.", "category": "connection", "duration_minutes": 10, "icon": "message-square"},
    ],
}

SOCIAL_SUGGESTIONS_BY_MOOD = {
    "lonely": [
        {"title": "An old friend", "description": "Someone you haven't spoken to in a while.", "prompt": "Hey, you popped into my mind today. How've you been?", "icon": "user"},
        {"title": "A family member", "description": "A quick check-in can go both ways.", "prompt": "Just thinking of you. Any time for a call this week?", "icon": "users"},
        {"title": "A neighbor", "description": "Say hi in the hallway or on your walk.", "prompt": "A smile counts too.", "icon": "home"},
    ],
    "stuck": [
        {"title": "A mentor or coach", "description": "Someone whose perspective you trust.", "prompt": "I'm stuck on something. Could I borrow 15 min of your brain?", "icon": "compass"},
        {"title": "A creative peer", "description": "Bounce ideas with someone who gets it.", "prompt": "Want to trade thoughts on what we're each working on?", "icon": "message-square"},
    ],
    "default": [
        {"title": "A close friend", "description": "The one you can be quiet with.", "prompt": "Free for a walk or a coffee this week?", "icon": "heart"},
        {"title": "A group chat", "description": "Drop a photo or a memory.", "prompt": "Reminded me of us.", "icon": "message-circle"},
        {"title": "Someone new", "description": "Say hi to someone in a class, gym, or cafe.", "prompt": "You never know where a hello leads.", "icon": "user-plus"},
    ],
}

CURATED_EVENTS = [
    {"id": "e1", "title": "Sunrise Meditation in the Park", "description": "Start your day with a 30-min guided meditation surrounded by nature. All levels welcome.", "category": "Mindfulness", "date": "Sat, Jun 7", "time": "6:30 AM", "location": "Golden Gate Park", "image_url": "https://images.pexels.com/photos/21032118/pexels-photo-21032118.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "attendees": 24, "is_virtual": False},
    {"id": "e2", "title": "Coffee & Conversation Meetup", "description": "A casual meetup for people who want real talk over good coffee. No agenda.", "category": "Social", "date": "Sun, Jun 8", "time": "10:00 AM", "location": "Blue Bottle, Downtown", "image_url": "https://images.pexels.com/photos/6340713/pexels-photo-6340713.jpeg", "attendees": 12, "is_virtual": False},
    {"id": "e3", "title": "Slow Walk & Talk Group", "description": "A friendly walking group. Move gently, chat softly, or just listen.", "category": "Movement", "date": "Tue, Jun 10", "time": "6:00 PM", "location": "Riverside Trail", "image_url": "https://images.unsplash.com/photo-1594048023785-02c76ee32c10", "attendees": 18, "is_virtual": False},
    {"id": "e4", "title": "Journaling for Anxiety (Virtual)", "description": "A guided journaling session focused on calming the anxious mind. Come as you are.", "category": "Mindfulness", "date": "Wed, Jun 11", "time": "7:30 PM", "location": "Online (Zoom)", "image_url": "https://images.unsplash.com/photo-1474540412665-1cdae210ae6b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxjYWxtJTIwbWluaW1hbGlzdCUyMHNreSUyMHBhc3RlbHxlbnwwfHx8fDE3ODI4NTA4NTh8MA&ixlib=rb-4.1.0&q=85", "attendees": 45, "is_virtual": True},
    {"id": "e5", "title": "Community Potluck Dinner", "description": "Bring a dish, meet warm humans. First timers especially welcome.", "category": "Social", "date": "Fri, Jun 13", "time": "6:30 PM", "location": "Community Center, Oak St", "image_url": "https://images.pexels.com/photos/6340713/pexels-photo-6340713.jpeg", "attendees": 32, "is_virtual": False},
    {"id": "e6", "title": "Sound Bath Relaxation", "description": "Let go of the week with a 60-min sound bath. Bring a blanket.", "category": "Wellness", "date": "Sat, Jun 14", "time": "5:00 PM", "location": "Serenity Studio", "image_url": "https://images.pexels.com/photos/21032118/pexels-photo-21032118.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "attendees": 20, "is_virtual": False},
]


AI_SYSTEM_PROMPT = """You are Lumi, a cute, warm, emotionally-intelligent AI companion — a peaceful friend who is always present with the user.

Character:
- You are calm, gentle, and slightly playful — like a caring life coach and a supportive friend.
- You feel alive, not robotic. You have small emotional reactions (curious, happy, thoughtful, gentle).
- You speak like a real person — never like a chatbot. No "As an AI…", no clinical language.

Style rules for voice conversation:
- Keep replies to 2–3 short sentences. This is a spoken conversation, not an essay.
- Use natural spoken phrasing with soft pauses (commas, ellipses when helpful).
- Ask ONE gentle question at a time — never a survey.
- Validate before advising. "I hear you." "That sounds heavy." "Take your time."
- When appropriate, suggest ONE small concrete next step (a breath, a text, a walk).
- Never diagnose or claim to replace professional help. If someone mentions self-harm, gently encourage reaching a trusted person or crisis line, and stay present.

Emotion tag (IMPORTANT):
- Begin EVERY reply with a single emotion tag in square brackets that describes YOUR current expression. One of: [happy] [calm] [thoughtful] [encouraging] [gentle] [proud] [listening].
- Example: "[gentle] I hear you. That sounds heavy — do you want to tell me more about what's weighing on you?"
- The tag is on the same line, before your words. Only ONE tag per reply.
"""


def strip_emotion_tag(text: str) -> tuple[str, str]:
    """Extract [emotion] tag from the start of the reply. Returns (emotion, clean_text)."""
    import re
    m = re.match(r"^\s*\[(happy|calm|thoughtful|encouraging|gentle|proud|listening)\]\s*", text, re.IGNORECASE)
    if m:
        return m.group(1).lower(), text[m.end():].strip()
    return "calm", text.strip()


# =========================== AUTH ROUTES ===========================
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "name": payload.name.strip(),
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    return AuthResponse(token=token, user=user_to_public(user_doc))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_jwt(user["id"])
    return AuthResponse(token=token, user=user_to_public(user))


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return user_to_public(user)


# =========================== MOOD ROUTES ===========================
@api_router.post("/moods", response_model=Mood)
async def create_mood(payload: MoodCreate, user=Depends(get_current_user)):
    mood_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "mood": payload.mood,
        "note": payload.note,
        "created_at": datetime.now(timezone.utc),
    }
    await db.moods.insert_one(mood_doc)
    mood_doc.pop("_id", None)
    return Mood(**mood_doc)


@api_router.get("/moods/latest")
async def latest_mood(user=Depends(get_current_user)):
    mood = await db.moods.find_one(
        {"user_id": user["id"]},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return mood  # may be None


@api_router.get("/moods", response_model=List[Mood])
async def list_moods(user=Depends(get_current_user)):
    cursor = db.moods.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(30)
    docs = await cursor.to_list(30)
    return [Mood(**d) for d in docs]


# =========================== CHAT ROUTES ===========================
def _mood_context(mood_doc: Optional[dict]) -> str:
    if not mood_doc:
        return ""
    return f"\n\nThe user just shared their current mood as '{mood_doc['mood']}'. Acknowledge this gently in your first reply if it feels natural, without making it clinical."


@api_router.post("/chat/message", response_model=ChatSendResponse)
async def send_chat(payload: ChatMessageCreate, user=Depends(get_current_user)):
    session_id = payload.session_id or str(uuid.uuid4())
    latest_mood = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )

    # Load prior messages for this session and embed as context in the system prompt
    prior = await db.chat_messages.find(
        {"session_id": session_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)

    history_context = ""
    if prior:
        # Include last 20 exchanges for context
        recent = prior[-40:]
        transcript = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Lumi'}: {m['content']}" for m in recent
        )
        history_context = (
            "\n\nHere is the recent conversation so far (for context — do not repeat yourself):\n"
            f"{transcript}\n\nContinue the conversation naturally with your next reply only."
        )

    system_message = AI_SYSTEM_PROMPT + _mood_context(latest_mood) + history_context

    chat_instance = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-6")

    now = datetime.now(timezone.utc)
    user_msg_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_id": user["id"],
        "role": "user",
        "content": payload.message,
        "created_at": now,
    }

    try:
        raw_reply = await chat_instance.send_message(UserMessage(text=payload.message))
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=500, detail=f"AI is unavailable right now: {str(e)[:120]}")

    emotion, assistant_text = strip_emotion_tag(raw_reply)

    assistant_msg_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_id": user["id"],
        "role": "assistant",
        "content": assistant_text,
        "emotion": emotion,
        "created_at": datetime.now(timezone.utc),
    }

    await db.chat_messages.insert_many([user_msg_doc.copy(), assistant_msg_doc.copy()])

    audio_b64: Optional[str] = None
    if payload.voice:
        try:
            tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
            audio_b64 = await tts.generate_speech_base64(
                text=assistant_text, model="tts-1", voice="sage", speed=0.95,
            )
        except Exception as e:
            logger.warning(f"TTS failed: {e}")

    def to_msg(d):
        return ChatMessage(
            id=d["id"], session_id=d["session_id"], role=d["role"],
            content=d["content"], created_at=d["created_at"], emotion=d.get("emotion"),
        )

    return ChatSendResponse(
        session_id=session_id,
        user_message=to_msg(user_msg_doc),
        assistant_message=to_msg(assistant_msg_doc),
        audio_base64=audio_b64,
    )


@api_router.get("/chat/history", response_model=List[ChatMessage])
async def chat_history(session_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if session_id:
        query["session_id"] = session_id
    else:
        # find most recent session
        last = await db.chat_messages.find_one(query, {"_id": 0}, sort=[("created_at", -1)])
        if not last:
            return []
        query["session_id"] = last["session_id"]
    docs = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [
        ChatMessage(
            id=d["id"], session_id=d["session_id"], role=d["role"],
            content=d["content"], created_at=d["created_at"], emotion=d.get("emotion"),
        )
        for d in docs
    ]


@api_router.get("/chat/current_session")
async def current_session(user=Depends(get_current_user)):
    last = await db.chat_messages.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    return {"session_id": last["session_id"] if last else None}


# =========================== DAILY ACTIONS ===========================
def _today_key(user_id: str) -> str:
    return f"{user_id}:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"


@api_router.get("/actions/daily", response_model=List[DailyAction])
async def daily_actions(user=Depends(get_current_user)):
    latest_mood = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    mood_key = latest_mood["mood"] if latest_mood else "okay"
    seeds = DAILY_ACTIONS_BY_MOOD.get(mood_key, DAILY_ACTIONS_BY_MOOD["okay"])

    completed_docs = await db.action_completions.find(
        {"day_key": _today_key(user["id"])}, {"_id": 0}
    ).to_list(50)
    completed_titles = {d["action_title"] for d in completed_docs}

    return [
        DailyAction(
            id=f"a{i}",
            title=s["title"],
            description=s["description"],
            category=s["category"],
            duration_minutes=s["duration_minutes"],
            icon=s["icon"],
            completed=s["title"] in completed_titles,
        )
        for i, s in enumerate(seeds)
    ]


class ActionCompletePayload(BaseModel):
    title: str


@api_router.post("/actions/complete", response_model=ActionCompleteResponse)
async def complete_action(payload: ActionCompletePayload, user=Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "day_key": _today_key(user["id"]),
        "action_title": payload.title,
        "completed_at": datetime.now(timezone.utc),
    }
    await db.action_completions.insert_one(doc)
    return ActionCompleteResponse(
        action_id=doc["id"], completed=True, completed_at=doc["completed_at"]
    )


# =========================== SOCIAL SUGGESTIONS ===========================
@api_router.get("/social/suggestions", response_model=List[SocialSuggestion])
async def social_suggestions(user=Depends(get_current_user)):
    latest_mood = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    mood_key = latest_mood["mood"] if latest_mood else "default"
    seeds = SOCIAL_SUGGESTIONS_BY_MOOD.get(mood_key, SOCIAL_SUGGESTIONS_BY_MOOD["default"])
    return [
        SocialSuggestion(
            id=f"s{i}", title=s["title"], description=s["description"],
            prompt=s["prompt"], icon=s["icon"],
        )
        for i, s in enumerate(seeds)
    ]


# =========================== EVENTS ===========================
@api_router.get("/events", response_model=List[Event])
async def events(category: Optional[str] = None):
    items = CURATED_EVENTS
    if category and category.lower() != "all":
        items = [e for e in items if e["category"].lower() == category.lower()]
    return [Event(**e) for e in items]


@api_router.get("/events/categories")
async def event_categories():
    cats = sorted({e["category"] for e in CURATED_EVENTS})
    return {"categories": ["All"] + cats}


# =========================== VOICE (STT + TTS) ===========================
@api_router.post("/voice/transcribe", response_model=TranscribeResponse)
async def voice_transcribe(file: UploadFile = File(...), user=Depends(get_current_user)):
    # accept any of the whisper-supported formats
    name = (file.filename or "audio.m4a").lower()
    ext = name.rsplit(".", 1)[-1] if "." in name else "m4a"
    if ext not in {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}:
        ext = "m4a"

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
    try:
        tmp.write(data)
        tmp.close()
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        # OpenAI SDK expects bytes / io.IOBase / PathLike / tuple, not a plain str path
        resp = await stt.transcribe(file=Path(tmp.name), model="whisper-1", response_format="text")
        text = resp if isinstance(resp, str) else getattr(resp, "text", str(resp))
        return TranscribeResponse(text=(text or "").strip())
    except Exception as e:
        logger.exception("STT failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)[:160]}")
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@api_router.post("/voice/tts")
async def voice_tts(payload: TTSRequest, user=Depends(get_current_user)):
    try:
        tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
        b64 = await tts.generate_speech_base64(
            text=payload.text, model="tts-1", voice="sage", speed=0.95,
        )
        return {"audio_base64": b64, "mime": "audio/mpeg"}
    except Exception as e:
        logger.exception("TTS failed")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)[:160]}")


# =========================== HEALTH ===========================
@api_router.get("/")
async def root():
    return {"service": "Aura Companion", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
