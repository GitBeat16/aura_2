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
import httpx
import secrets as pysecrets

from music import SpotifyProvider


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
SPOTIFY_CLIENT_ID = os.environ.get('SPOTIFY_CLIENT_ID', '')
SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET', '')
SPOTIFY_REDIRECT_URI = os.environ.get('SPOTIFY_REDIRECT_URI', '')
APP_DEEP_LINK = os.environ.get('APP_DEEP_LINK', 'frontend://spotify-connected')

spotify = SpotifyProvider(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)

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


VALID_ICONS = {
    "heart", "compass", "edit-3", "sun", "message-circle", "wind",
    "cloud", "grid", "coffee", "droplet", "check-square", "map",
    "anchor", "mic", "users", "message-square", "book-open", "moon",
    "smile", "star", "feather", "camera", "music", "phone", "gift",
    "sunrise", "sunset", "activity", "aperture",
}


async def _generate_ai_tasks(user: dict, mood_key: str, force: bool = False) -> List[dict]:
    """Generate 5–8 personalized micro-tasks using Claude based on the user's
    latest mood + last few chat exchanges with Lumi. Cached per (user, day).
    Set force=True to regenerate."""
    day_key = _today_key(user["id"])
    cached = await db.daily_task_sets.find_one({"day_key": day_key}, {"_id": 0})
    if cached and not force:
        return cached["tasks"]

    # Gather recent chat context (last 12 msgs) for personalization
    recent_msgs = await db.chat_messages.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(12)
    recent_msgs.reverse()
    chat_snippet = "\n".join(
        f"{'User' if m['role']=='user' else 'Lumi'}: {m['content']}" for m in recent_msgs
    ) or "(no conversation yet)"

    latest_mood_doc = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    mood_note = latest_mood_doc.get("note") if latest_mood_doc else None

    system = (
        "You are Lumi, a gentle AI companion. Generate a personalized set of small, "
        "actionable micro-tasks for the user, based on their current mood and recent "
        "conversation with you. Rules:\n"
        "- Return ONLY a JSON array (no prose, no code fences).\n"
        "- 5 to 8 tasks. Choose the number that feels right for the mood.\n"
        "- Each item MUST have keys: title (max 42 chars), description (1 short warm sentence, max 90 chars), "
        "category (one of: connection, reflection, movement, care, calm, reset, growth), "
        "duration_minutes (integer 1-30), icon (one of: heart, compass, edit-3, sun, message-circle, wind, "
        "cloud, grid, coffee, droplet, check-square, map, anchor, mic, users, message-square, book-open, "
        "moon, smile, star, feather, camera, music, phone, gift, sunrise, sunset, activity, aperture).\n"
        "- Tasks must feel doable in the next few hours. No big commitments.\n"
        "- Vary category and duration across the set.\n"
        "- Tone: warm, human, not clinical. No emojis. No hashtags.\n"
        "- Reference the user's mood and chat context subtly if useful, but keep tasks generalizable."
    )

    user_prompt = (
        f"Current mood: {mood_key}\n"
        f"Mood note: {mood_note or '(none)'}\n\n"
        f"Recent conversation with Lumi:\n{chat_snippet}\n\n"
        "Return the JSON array of tasks now."
    )

    tasks: List[dict] = []
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tasks-{user['id']}-{day_key}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-6")
        raw = await chat.send_message(UserMessage(text=user_prompt))
        # Strip code fences if any
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            # remove language tag on first line
            if "\n" in cleaned:
                cleaned = cleaned.split("\n", 1)[1]
        # Extract first [...] JSON block
        import json
        import re
        m = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if m:
            cleaned = m.group(0)
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()[:60]
                desc = str(item.get("description", "")).strip()[:140]
                cat = str(item.get("category", "reset")).strip().lower()
                dur = item.get("duration_minutes", 5)
                try:
                    dur = max(1, min(30, int(dur)))
                except Exception:
                    dur = 5
                icon = str(item.get("icon", "sun")).strip().lower()
                if icon not in VALID_ICONS:
                    icon = "sun"
                if title and desc:
                    tasks.append({
                        "title": title, "description": desc, "category": cat,
                        "duration_minutes": dur, "icon": icon,
                    })
    except Exception as e:
        logger.warning(f"AI task generation failed: {e}")

    # Fallback to seed list if AI produced nothing usable
    if len(tasks) < 3:
        seeds = DAILY_ACTIONS_BY_MOOD.get(mood_key, DAILY_ACTIONS_BY_MOOD["okay"])
        tasks = list(seeds)

    tasks = tasks[:8]

    await db.daily_task_sets.replace_one(
        {"day_key": day_key},
        {
            "day_key": day_key, "user_id": user["id"], "mood": mood_key,
            "tasks": tasks, "generated_at": datetime.now(timezone.utc),
        },
        upsert=True,
    )
    return tasks


@api_router.get("/actions/daily", response_model=List[DailyAction])
async def daily_actions(user=Depends(get_current_user)):
    latest_mood = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    mood_key = latest_mood["mood"] if latest_mood else "okay"
    tasks = await _generate_ai_tasks(user, mood_key)

    completed_docs = await db.action_completions.find(
        {"day_key": _today_key(user["id"])}, {"_id": 0}
    ).to_list(50)
    completed_titles = {d["action_title"] for d in completed_docs}

    return [
        DailyAction(
            id=f"a{i}",
            title=t["title"],
            description=t["description"],
            category=t["category"],
            duration_minutes=t["duration_minutes"],
            icon=t["icon"],
            completed=t["title"] in completed_titles,
        )
        for i, t in enumerate(tasks)
    ]


@api_router.post("/actions/regenerate", response_model=List[DailyAction])
async def regenerate_actions(user=Depends(get_current_user)):
    latest_mood = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    mood_key = latest_mood["mood"] if latest_mood else "okay"
    tasks = await _generate_ai_tasks(user, mood_key, force=True)

    completed_docs = await db.action_completions.find(
        {"day_key": _today_key(user["id"])}, {"_id": 0}
    ).to_list(50)
    completed_titles = {d["action_title"] for d in completed_docs}

    return [
        DailyAction(
            id=f"a{i}",
            title=t["title"],
            description=t["description"],
            category=t["category"],
            duration_minutes=t["duration_minutes"],
            icon=t["icon"],
            completed=t["title"] in completed_titles,
        )
        for i, t in enumerate(tasks)
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


# =========================== STATS / STREAKS / WEEKLY RECAP ===========================
class TaskStreak(BaseModel):
    title: str
    icon: str
    current_streak: int
    total_completions: int
    last_completed: Optional[datetime] = None
    is_active: bool  # true if completed today or yesterday


class WeeklyRecap(BaseModel):
    week_start: str
    week_end: str
    tasks_completed: int
    days_active: int
    moods_logged: int
    top_mood: Optional[str] = None
    longest_daily_streak: int
    reflection: str  # AI-written warm reflection
    share_text: str  # plain-text share message


def _day_str(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


async def _compute_task_streaks(user_id: str, min_streak: int = 1) -> List[TaskStreak]:
    """For every distinct task title the user has completed, compute the current
    consecutive-day streak ending at the most recent completion day.
    Streak is considered 'active' if last completion was today or yesterday."""
    docs = await db.action_completions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("completed_at", -1).to_list(2000)
    if not docs:
        return []

    # Map task -> ordered set of unique completion day-strings (desc)
    days_by_title: dict[str, list[str]] = {}
    counts_by_title: dict[str, int] = {}
    last_by_title: dict[str, datetime] = {}
    for d in docs:
        title = d["action_title"]
        day = _day_str(d["completed_at"])
        days_by_title.setdefault(title, [])
        if day not in days_by_title[title]:
            days_by_title[title].append(day)
        counts_by_title[title] = counts_by_title.get(title, 0) + 1
        if title not in last_by_title:
            last_by_title[title] = d["completed_at"]

    today = _day_str(datetime.now(timezone.utc))
    yesterday = _day_str(datetime.now(timezone.utc) - timedelta(days=1))

    # Also pull icons from the most recent daily_task_sets for prettier display
    icon_map: dict[str, str] = {}
    latest_sets = await db.daily_task_sets.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("generated_at", -1).to_list(30)
    for s in latest_sets:
        for t in s.get("tasks", []):
            icon_map.setdefault(t["title"], t.get("icon", "check-square"))

    streaks: list[TaskStreak] = []
    for title, days in days_by_title.items():
        if not days:
            continue
        # days are already deduped and roughly descending
        days_sorted = sorted(days, reverse=True)
        # count consecutive daily completions starting from the most recent day
        current = 1
        for i in range(1, len(days_sorted)):
            prev = datetime.strptime(days_sorted[i - 1], "%Y-%m-%d")
            cur = datetime.strptime(days_sorted[i], "%Y-%m-%d")
            if (prev - cur).days == 1:
                current += 1
            else:
                break
        is_active = days_sorted[0] in (today, yesterday)
        if current < min_streak:
            continue
        streaks.append(TaskStreak(
            title=title,
            icon=icon_map.get(title, "check-square"),
            current_streak=current,
            total_completions=counts_by_title[title],
            last_completed=last_by_title[title],
            is_active=is_active,
        ))
    # sort: active streaks first, then by streak length desc
    streaks.sort(key=lambda s: (not s.is_active, -s.current_streak, -s.total_completions))
    return streaks


@api_router.get("/stats/task-streaks", response_model=List[TaskStreak])
async def task_streaks(user=Depends(get_current_user)):
    return await _compute_task_streaks(user["id"], min_streak=1)


@api_router.get("/stats/weekly-recap", response_model=WeeklyRecap)
async def weekly_recap(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    # Rolling 7 days including today
    week_start_dt = now - timedelta(days=6)
    week_start = week_start_dt.strftime("%Y-%m-%d")
    week_end = now.strftime("%Y-%m-%d")
    week_start_full = week_start_dt.replace(hour=0, minute=0, second=0, microsecond=0)

    comp_docs = await db.action_completions.find(
        {"user_id": user["id"], "completed_at": {"$gte": week_start_full}}, {"_id": 0}
    ).to_list(500)

    mood_docs = await db.moods.find(
        {"user_id": user["id"], "created_at": {"$gte": week_start_full}}, {"_id": 0}
    ).to_list(200)

    tasks_completed = len(comp_docs)
    days_active = len({_day_str(d["completed_at"]) for d in comp_docs})
    moods_logged = len(mood_docs)

    # Top mood
    top_mood: Optional[str] = None
    if mood_docs:
        from collections import Counter
        cnt = Counter(m["mood"] for m in mood_docs)
        top_mood = cnt.most_common(1)[0][0]

    # Longest consecutive-day streak across ANY task completion in the week
    day_set = sorted({_day_str(d["completed_at"]) for d in comp_docs}, reverse=True)
    longest = 0
    cur = 0
    prev_day: Optional[datetime] = None
    for d in day_set:
        dt = datetime.strptime(d, "%Y-%m-%d")
        if prev_day is None or (prev_day - dt).days == 1:
            cur += 1
        else:
            cur = 1
        longest = max(longest, cur)
        prev_day = dt

    # Top task titles this week
    from collections import Counter
    title_counts = Counter(d["action_title"] for d in comp_docs)
    top_titles = [t for t, _ in title_counts.most_common(3)]

    # AI reflection
    reflection = ""
    try:
        ctx = (
            f"Rolling 7-day recap for the user:\n"
            f"- Tasks completed: {tasks_completed}\n"
            f"- Active days: {days_active}/7\n"
            f"- Mood check-ins: {moods_logged}\n"
            f"- Most common mood: {top_mood or 'none'}\n"
            f"- Longest daily streak this week: {longest}\n"
            f"- Repeated favorite tasks: {', '.join(top_titles) if top_titles else 'none yet'}\n"
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"recap-{user['id']}-{week_end}",
            system_message=(
                "You are Lumi, a warm AI companion writing a gentle weekly reflection for the user. "
                "Return ONE short paragraph (2-3 sentences, max 260 characters). Second person ('you'). "
                "Warm, human, honest. Celebrate any progress. If numbers are low, be kind and never shame. "
                "No emojis. No hashtags. No bullet lists."
            ),
        ).with_model("anthropic", "claude-sonnet-4-6")
        reflection = (await chat.send_message(UserMessage(text=ctx))).strip()
        if len(reflection) > 320:
            reflection = reflection[:317] + "..."
    except Exception as e:
        logger.warning(f"recap AI failed: {e}")
        reflection = (
            f"This week you showed up on {days_active} day{'s' if days_active != 1 else ''}, "
            f"finished {tasks_completed} small step{'s' if tasks_completed != 1 else ''} "
            f"and checked in {moods_logged} time{'s' if moods_logged != 1 else ''}. "
            "That's real, and it counts."
        )

    share_text = (
        f"My week with Lumi:\n"
        f"• {tasks_completed} small step{'s' if tasks_completed != 1 else ''} completed\n"
        f"• {days_active}/7 days active\n"
        f"• Longest streak: {longest} day{'s' if longest != 1 else ''}\n\n"
        f"\"{reflection}\""
    )

    return WeeklyRecap(
        week_start=week_start,
        week_end=week_end,
        tasks_completed=tasks_completed,
        days_active=days_active,
        moods_logged=moods_logged,
        top_mood=top_mood,
        longest_daily_streak=longest,
        reflection=reflection,
        share_text=share_text,
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


# =========================== WEATHER (Open-Meteo, no key) ===========================
WEATHER_CODES = {
    0: "clear", 1: "mostly-clear", 2: "partly-cloudy", 3: "overcast",
    45: "fog", 48: "fog",
    51: "drizzle", 53: "drizzle", 55: "drizzle",
    61: "rain", 63: "rain", 65: "heavy-rain",
    71: "snow", 73: "snow", 75: "heavy-snow",
    80: "showers", 81: "showers", 82: "heavy-showers",
    95: "thunder", 96: "thunder", 99: "thunder",
}


@api_router.get("/weather")
async def get_weather(lat: float = 37.7749, lon: float = -122.4194, user=Depends(get_current_user)):
    """Fetch current weather from Open-Meteo (no key required)."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": lat, "longitude": lon, "current_weather": "true"},
            )
            r.raise_for_status()
            data = r.json().get("current_weather") or {}
        code = data.get("weathercode", 1)
        return {
            "temperature_c": data.get("temperature"),
            "wind_kph": data.get("windspeed"),
            "code": code,
            "condition": WEATHER_CODES.get(int(code) if code is not None else 1, "clear"),
            "is_day": bool(data.get("is_day", 1)),
        }
    except Exception as e:
        logger.warning(f"weather failed: {e}")
        return {"temperature_c": None, "wind_kph": None, "code": None, "condition": "clear", "is_day": True}


# =========================== SPOTIFY ===========================
class SpotifyStatus(BaseModel):
    connected: bool
    display_name: Optional[str] = None
    product: Optional[str] = None
    image: Optional[str] = None
    provider_configured: bool


async def _spotify_token(user_id: str) -> Optional[str]:
    """Return a valid access token for this user, refreshing if expired."""
    doc = await db.spotify_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return None
    now = datetime.now(timezone.utc)
    expires_at = doc.get("expires_at")
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at > now + timedelta(seconds=30):
        return doc["access_token"]
    # Refresh
    rt = doc.get("refresh_token")
    if not rt or not SPOTIFY_CLIENT_ID:
        # If we can't refresh (manual-token mode) return whatever we have
        return doc.get("access_token")
    try:
        tok = await spotify.refresh(rt)
        access_token = tok["access_token"]
        new_expires = now + timedelta(seconds=int(tok.get("expires_in", 3600)))
        update = {"access_token": access_token, "expires_at": new_expires}
        if tok.get("refresh_token"):
            update["refresh_token"] = tok["refresh_token"]
        await db.spotify_tokens.update_one({"user_id": user_id}, {"$set": update})
        return access_token
    except Exception as e:
        logger.warning(f"spotify refresh failed: {e}")
        return doc.get("access_token")


async def _require_spotify(user: dict) -> str:
    tok = await _spotify_token(user["id"])
    if not tok:
        raise HTTPException(status_code=400, detail="Spotify not connected")
    return tok


@api_router.get("/spotify/status", response_model=SpotifyStatus)
async def spotify_status(user=Depends(get_current_user)):
    configured = bool(SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)
    doc = await db.spotify_tokens.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        return SpotifyStatus(connected=False, provider_configured=configured)
    return SpotifyStatus(
        connected=True,
        display_name=doc.get("display_name"),
        product=doc.get("product"),
        image=doc.get("image"),
        provider_configured=configured,
    )


@api_router.get("/spotify/login")
async def spotify_login(user=Depends(get_current_user)):
    if not (SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET):
        raise HTTPException(status_code=400, detail="Spotify not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.")
    state = pysecrets.token_urlsafe(24)
    await db.spotify_oauth_states.insert_one({
        "state": state, "user_id": user["id"], "created_at": datetime.now(timezone.utc),
    })
    url = spotify.build_authorize_url(state=state, redirect_uri=SPOTIFY_REDIRECT_URI)
    return {"authorize_url": url}


@api_router.get("/spotify/callback")
async def spotify_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """Spotify redirects here after user authorizes. We save tokens and bounce to the app deep-link."""
    if error or not code or not state:
        return {"ok": False, "error": error or "missing_code"}
    row = await db.spotify_oauth_states.find_one({"state": state}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired state")
    try:
        tok = await spotify.exchange_code(code, SPOTIFY_REDIRECT_URI)
    except Exception as e:
        logger.exception("spotify exchange failed")
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {e}")
    access_token = tok["access_token"]
    refresh_token = tok.get("refresh_token")
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=int(tok.get("expires_in", 3600)))
    # profile
    try:
        me = await spotify.me(access_token)
    except Exception:
        me = {}
    await db.spotify_tokens.update_one(
        {"user_id": row["user_id"]},
        {"$set": {
            "user_id": row["user_id"],
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "spotify_user_id": me.get("id"),
            "display_name": me.get("display_name"),
            "product": me.get("product"),
            "image": me.get("image"),
            "updated_at": now,
        }},
        upsert=True,
    )
    await db.spotify_oauth_states.delete_one({"state": state})
    return {"ok": True, "deep_link": APP_DEEP_LINK}


class ManualTokenPayload(BaseModel):
    access_token: str
    expires_in: Optional[int] = 3600
    refresh_token: Optional[str] = None


@api_router.post("/spotify/connect-token", response_model=SpotifyStatus)
async def spotify_connect_token(payload: ManualTokenPayload, user=Depends(get_current_user)):
    """Dev/manual mode: paste a Spotify user access token directly (useful before
    you fill CLIENT_ID/SECRET). We fetch the profile to verify it works."""
    try:
        me = await spotify.me(payload.access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Spotify token: {e}")
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=int(payload.expires_in or 3600))
    await db.spotify_tokens.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "access_token": payload.access_token,
            "refresh_token": payload.refresh_token,
            "expires_at": expires_at,
            "spotify_user_id": me.get("id"),
            "display_name": me.get("display_name"),
            "product": me.get("product"),
            "image": me.get("image"),
            "updated_at": now,
        }},
        upsert=True,
    )
    return SpotifyStatus(
        connected=True,
        display_name=me.get("display_name"), product=me.get("product"), image=me.get("image"),
        provider_configured=bool(SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET),
    )


@api_router.post("/spotify/disconnect")
async def spotify_disconnect(user=Depends(get_current_user)):
    await db.spotify_tokens.delete_one({"user_id": user["id"]})
    return {"ok": True}


@api_router.get("/spotify/playlists")
async def spotify_playlists(user=Depends(get_current_user)):
    tok = await _require_spotify(user)
    try:
        return {"items": await spotify.playlists(tok, limit=25)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text[:200])


@api_router.get("/spotify/top-tracks")
async def spotify_top_tracks(time_range: str = "medium_term", user=Depends(get_current_user)):
    tok = await _require_spotify(user)
    try:
        return {"items": await spotify.top_tracks(tok, limit=10, time_range=time_range)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text[:200])


@api_router.get("/spotify/top-artists")
async def spotify_top_artists(time_range: str = "medium_term", user=Depends(get_current_user)):
    tok = await _require_spotify(user)
    try:
        return {"items": await spotify.top_artists(tok, limit=10, time_range=time_range)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text[:200])


@api_router.get("/spotify/recently-played")
async def spotify_recently_played(user=Depends(get_current_user)):
    tok = await _require_spotify(user)
    try:
        return {"items": await spotify.recently_played(tok, limit=20)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text[:200])


# ---- AI-driven recommendation engine ----
MOOD_TO_AUDIO_TARGETS: dict[str, dict] = {
    "great":   {"valence": 0.85, "energy": 0.75},
    "good":    {"valence": 0.75, "energy": 0.55},
    "okay":    {"valence": 0.55, "energy": 0.45},
    "low":     {"valence": 0.30, "energy": 0.30, "acousticness": 0.5},
    "stuck":   {"valence": 0.45, "energy": 0.35, "instrumentalness": 0.4},
    "anxious": {"valence": 0.40, "energy": 0.25, "acousticness": 0.7},
    "lonely":  {"valence": 0.35, "energy": 0.30, "acousticness": 0.6},
}
MOOD_TO_GENRES: dict[str, list[str]] = {
    "great":   ["pop", "happy", "summer"],
    "good":    ["indie", "pop", "acoustic"],
    "okay":    ["chill", "acoustic", "folk"],
    "low":     ["sad", "acoustic", "piano"],
    "stuck":   ["ambient", "lo-fi", "study"],
    "anxious": ["ambient", "chill", "piano"],
    "lonely":  ["indie", "folk", "sad"],
}
WEATHER_TO_GENRES: dict[str, list[str]] = {
    "rain": ["rainy-day", "lo-fi", "jazz"],
    "heavy-rain": ["rainy-day", "ambient", "piano"],
    "showers": ["rainy-day", "chill"],
    "thunder": ["ambient", "electronic"],
    "clear": ["indie", "pop", "summer"],
    "mostly-clear": ["indie", "pop"],
    "sunset": ["chill", "sunset"],
    "overcast": ["indie", "lo-fi"],
    "fog": ["ambient", "chill"],
    "snow": ["classical", "piano"],
}


def _time_of_day(hour: int) -> str:
    if hour < 5: return "late-night"
    if hour < 11: return "morning"
    if hour < 17: return "afternoon"
    if hour < 21: return "evening"
    return "night"


def _activity_from_signals(hour: int, mood: str, chat_snippet: str) -> str:
    t = chat_snippet.lower()
    if any(k in t for k in ("workout", "run", "gym", "exercise")):
        return "working-out"
    if any(k in t for k in ("sleep", "bed", "tired", "wind down")):
        return "winding-down"
    if any(k in t for k in ("work", "study", "focus", "deadline", "meeting")):
        return "focusing"
    if mood in ("anxious", "stuck", "low", "lonely") or hour >= 21 or hour < 6:
        return "relaxing"
    if hour < 11:
        return "starting-day"
    return "flowing"


class MusicRecoRequest(BaseModel):
    lat: Optional[float] = 37.7749
    lon: Optional[float] = -122.4194


@api_router.post("/music/recommendations")
async def music_recommendations(payload: MusicRecoRequest, user=Depends(get_current_user)):
    """AI-curated recommendations based on mood + weather + time of day + recent chat tone."""
    tok = await _require_spotify(user)
    now = datetime.now(timezone.utc)

    # 1) Mood
    latest_mood_doc = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    mood = (latest_mood_doc or {}).get("mood", "okay")

    # 2) Chat context (last 8 messages)
    msgs = await db.chat_messages.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(8)
    msgs.reverse()
    chat_snippet = " ".join(m["content"] for m in msgs if m["role"] == "user")[-500:]

    # 3) Weather (best-effort)
    weather = {"condition": "clear", "is_day": True, "temperature_c": None}
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": payload.lat, "longitude": payload.lon, "current_weather": "true"},
            )
            data = r.json().get("current_weather") or {}
            code = data.get("weathercode", 1)
            weather = {
                "condition": WEATHER_CODES.get(int(code) if code is not None else 1, "clear"),
                "is_day": bool(data.get("is_day", 1)),
                "temperature_c": data.get("temperature"),
            }
    except Exception:
        pass

    # 4) Time of day & activity
    hour = now.hour
    tod = _time_of_day(hour)
    activity = _activity_from_signals(hour, mood, chat_snippet)

    # 5) Seed selection: prefer user top artists / tracks
    top_tracks_list: list[dict] = []
    top_artists_list: list[dict] = []
    try:
        top_tracks_list = await spotify.top_tracks(tok, limit=5, time_range="short_term")
    except Exception: pass
    try:
        top_artists_list = await spotify.top_artists(tok, limit=5, time_range="short_term")
    except Exception: pass

    # 6) Ask Claude to synthesize the vibe -> Spotify search queries + reasoning
    #    Spotify deprecated /v1/recommendations for new apps in Nov 2024, so we
    #    craft targeted search queries that leverage user's top artists and
    #    match mood / weather / activity, then merge results.
    genre_hints = ", ".join(
        MOOD_TO_GENRES.get(mood, []) + WEATHER_TO_GENRES.get(weather["condition"], [])
    )
    artist_hints = ", ".join(a["name"] for a in top_artists_list[:5] if a.get("name"))
    track_hints = ", ".join(f"{t['name']} — {', '.join(a['name'] for a in t['artists'])}" for t in top_tracks_list[:4] if t.get("name"))

    reasoning = ""
    playlist_title = f"For a {mood} {tod}"
    queries: list[str] = []
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"reco-{user['id']}-{now.strftime('%Y%m%d%H')}",
            system_message=(
                "You are Lumi, a music-savvy AI companion. Given the user's mood, weather, time of day, activity, "
                "recent conversation, and their favorite artists/tracks, craft a warm music prescription.\n\n"
                "Return ONLY a JSON object with these keys (no prose, no code fences):\n"
                '  "title": short poetic playlist title (max 32 chars)\n'
                '  "reasoning": one warm sentence (max 160 chars) explaining why this fits right now\n'
                '  "queries": an array of 10 Spotify search queries. Mix:\n'
                "    - 3-4 queries that reference the USER'S OWN favorite artists (e.g., 'artist:\"Bon Iver\"')\n"
                "    - 3-4 vibe queries (e.g., 'lo-fi rainy afternoon', 'gentle acoustic indie')\n"
                "    - 2-3 discovery queries with genre and mood keywords\n"
                "    Keep queries under 60 characters each. No hashtags. No emojis.\n"
            ),
        ).with_model("anthropic", "claude-sonnet-4-6")
        raw = (await chat.send_message(UserMessage(text=(
            f"Mood: {mood}\nActivity: {activity}\nTime: {tod}\nWeather: {weather['condition']} "
            f"({'day' if weather['is_day'] else 'night'})\n"
            f"Genre hints: {genre_hints}\n"
            f"Favorite artists: {artist_hints or '(none)'}\n"
            f"Recently loved tracks: {track_hints or '(none)'}\n"
            f"Recent user words: {chat_snippet[:220] or '(none)'}"
        )))).strip()
        # extract JSON
        import json as _json
        import re as _re
        m = _re.search(r"\{.*\}", raw, _re.DOTALL)
        if m:
            parsed = _json.loads(m.group(0))
            if isinstance(parsed.get("title"), str):
                playlist_title = parsed["title"][:40]
            if isinstance(parsed.get("reasoning"), str):
                reasoning = parsed["reasoning"][:220]
            if isinstance(parsed.get("queries"), list):
                queries = [str(q)[:80] for q in parsed["queries"] if isinstance(q, str) and q.strip()][:12]
    except Exception as e:
        logger.warning(f"reco AI failed: {e}")

    # Fallback queries
    if not queries:
        genres = MOOD_TO_GENRES.get(mood, ["chill"])[:2] + WEATHER_TO_GENRES.get(weather["condition"], [])[:1]
        queries = [f"{g} {activity.replace('-', ' ')}" for g in genres] + \
                  [f"{mood} {tod}"] + \
                  [f"artist:\"{a['name']}\"" for a in top_artists_list[:3] if a.get("name")]
    if not reasoning:
        reasoning = f"A quiet {tod} soundtrack shaped for feeling {mood}."

    # 7) Fan out searches, dedupe by track id
    seen: set = set()
    tracks: list[dict] = []
    for q in queries:
        try:
            results = await spotify.search_tracks(tok, q, limit=3)
        except Exception as e:
            logger.warning(f"search failed for '{q}': {e}")
            continue
        for t in results:
            tid = t.get("id")
            if not tid or tid in seen:
                continue
            seen.add(tid)
            tracks.append(t)
            if len(tracks) >= 18:
                break
        if len(tracks) >= 18:
            break

    return {
        "context": {
            "mood": mood, "activity": activity, "time_of_day": tod,
            "weather": weather, "hour": hour,
        },
        "playlist_title": playlist_title,
        "reasoning": reasoning,
        "queries": queries,
        "tracks": tracks[:15],
    }


class CreatePlaylistPayload(BaseModel):
    name: str
    description: Optional[str] = "Curated by Lumi"
    track_uris: list[str]


@api_router.post("/spotify/playlists")
async def spotify_create_playlist(payload: CreatePlaylistPayload, user=Depends(get_current_user)):
    tok = await _require_spotify(user)
    try:
        me = await spotify.me(tok)
        pl = await spotify.create_playlist(tok, me["id"], payload.name, payload.description or "")
        if payload.track_uris:
            await spotify.add_tracks(tok, pl["id"], payload.track_uris[:100])
        return pl
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text[:200])


class AddTracksPayload(BaseModel):
    track_uris: list[str]


@api_router.post("/spotify/playlists/{playlist_id}/tracks")
async def spotify_add_tracks(playlist_id: str, payload: AddTracksPayload, user=Depends(get_current_user)):
    tok = await _require_spotify(user)
    try:
        return await spotify.add_tracks(tok, playlist_id, payload.track_uris[:100])
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text[:200])


# =========================== LUMI'S DAILY TAKE ===========================
class DailyTakeRequest(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None


@api_router.post("/lumi/daily-take")
async def lumi_daily_take(payload: DailyTakeRequest, user=Depends(get_current_user)):
    """A warm contextual snippet from Lumi based on weather + time + latest mood.
    Powers the smart Home hero card."""
    lat = payload.lat if payload.lat is not None else 37.7749
    lon = payload.lon if payload.lon is not None else -122.4194

    # Weather
    weather = {"condition": "clear", "is_day": True, "temperature_c": None}
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": lat, "longitude": lon, "current_weather": "true"},
            )
            data = r.json().get("current_weather") or {}
            code = data.get("weathercode", 1)
            weather = {
                "condition": WEATHER_CODES.get(int(code) if code is not None else 1, "clear"),
                "is_day": bool(data.get("is_day", 1)),
                "temperature_c": data.get("temperature"),
            }
    except Exception:
        pass

    # Mood
    latest_mood = await db.moods.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    mood = (latest_mood or {}).get("mood", "okay")
    now = datetime.now(timezone.utc)
    hour = now.hour
    tod = _time_of_day(hour)

    system = (
        "You are Lumi, a warm AI companion. Given the user's current weather, time of day, and mood, "
        "write TWO short lines that feel like a friend noticing the sky.\n\n"
        "Return ONLY a JSON object (no code fences):\n"
        '  "headline": 3-6 word poetic reaction to the weather+time (e.g., "Soft golden afternoon.")\n'
        '  "suggestion": 1 warm sentence proposing ONE small local thing to do (e.g., "The light is perfect for a walk to a garden — want to?"). Max 150 chars.\n'
        '  "icon": one of: sun, cloud, cloud-rain, cloud-snow, cloud-drizzle, wind, moon, sunrise, sunset (choose what fits best)\n'
        "No emojis. No hashtags. Warm tone."
    )
    prompt = (
        f"Weather: {weather['condition']} ({'day' if weather['is_day'] else 'night'})\n"
        f"Temperature: {weather.get('temperature_c')}°C\n"
        f"Time: {tod} ({hour}:00)\n"
        f"User mood: {mood}"
    )

    headline = weather["condition"].replace("-", " ").title() + "."
    suggestion = "A gentle time to check in with yourself."
    icon = "sun"
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"take-{user['id']}-{now.strftime('%Y%m%d%H')}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-6")
        raw = (await chat.send_message(UserMessage(text=prompt))).strip()
        import json as _json
        import re as _re
        m = _re.search(r"\{.*\}", raw, _re.DOTALL)
        if m:
            parsed = _json.loads(m.group(0))
            headline = str(parsed.get("headline") or headline)[:40]
            suggestion = str(parsed.get("suggestion") or suggestion)[:180]
            icon = str(parsed.get("icon") or icon).strip().lower()
    except Exception as e:
        logger.warning(f"daily take failed: {e}")

    return {
        "headline": headline,
        "suggestion": suggestion,
        "icon": icon,
        "weather": weather,
        "time_of_day": tod,
        "mood": mood,
    }


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
