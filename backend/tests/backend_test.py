"""Backend tests for Aura/Lumi companion API."""
import os
import base64
import time
import pytest
import requests

BASE_URL = "https://mindful-buddy-14.preview.emergentagent.com"
API = f"{BASE_URL}/api"

TEST_EMAIL = "test@aura.dev"
TEST_PASSWORD = "testpass123"
TEST_NAME = "Aura Tester"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(session):
    # Try login first
    r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
    if r.status_code == 401:
        r = session.post(f"{API}/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME}, timeout=30)
    assert r.status_code == 200, f"Auth failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# =============== HEALTH ===============
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# =============== AUTH ===============
class TestAuth:
    def test_register_new_user(self, session):
        unique = f"TEST_user_{int(time.time())}@aura.dev"
        r = session.post(f"{API}/auth/register", json={"email": unique, "password": "abc12345", "name": "TEST Ephemeral"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # backend lowercases emails on save
        assert data["user"]["email"] == unique.lower()
        assert data["user"]["name"] == "TEST Ephemeral"
        assert "id" in data["user"] and "created_at" in data["user"]
        assert len(data["token"]) > 20
        # no _id
        assert "_id" not in data["user"]

    def test_register_duplicate_email(self, session, auth_token):
        r = session.post(f"{API}/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "dup"}, timeout=15)
        assert r.status_code == 400

    def test_login_existing(self, session):
        r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=15)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": "wrongpass"}, timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == TEST_EMAIL
        assert "_id" not in data

    def test_me_without_token(self, session):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)


# =============== MOODS ===============
class TestMoods:
    def test_create_mood_and_latest(self, session, auth_headers):
        r = session.post(f"{API}/moods", headers=auth_headers, json={"mood": "good", "note": "TEST feeling ok"}, timeout=15)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["mood"] == "good"
        assert m["note"] == "TEST feeling ok"
        assert "_id" not in m

        r2 = session.get(f"{API}/moods/latest", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        latest = r2.json()
        assert latest is not None
        assert latest["mood"] == "good"
        assert "_id" not in latest

    def test_invalid_mood_rejected(self, session, auth_headers):
        r = session.post(f"{API}/moods", headers=auth_headers, json={"mood": "ecstatic"}, timeout=15)
        assert r.status_code == 422


# =============== CHAT ===============
class TestChat:
    def test_send_chat_message_returns_emotion(self, session, auth_headers):
        r = session.post(
            f"{API}/chat/message",
            headers=auth_headers,
            json={"message": "Hi Lumi, I'm feeling okay today. How are you?"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data
        assert data["user_message"]["role"] == "user"
        assert data["assistant_message"]["role"] == "assistant"
        emotion = data["assistant_message"].get("emotion")
        assert emotion in {"happy", "calm", "thoughtful", "encouraging", "gentle", "proud", "listening"}
        content = data["assistant_message"]["content"]
        # emotion tag must be stripped from content
        assert not content.startswith("[")
        assert "]" != content[:1]
        # session id persisted
        TestChat.session_id = data["session_id"]

    def test_chat_history_ascending(self, session, auth_headers):
        r = session.get(f"{API}/chat/history", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list) and len(msgs) >= 2
        # ascending order
        times = [m["created_at"] for m in msgs]
        assert times == sorted(times)
        # sanity: user then assistant
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles

    def test_current_session(self, session, auth_headers):
        r = session.get(f"{API}/chat/current_session", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("session_id")

    def test_chat_message_with_voice(self, session, auth_headers):
        r = session.post(
            f"{API}/chat/message",
            headers=auth_headers,
            json={"message": "Say hi in one short sentence please.", "voice": True},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        audio = data.get("audio_base64")
        assert audio and len(audio) > 5000, f"audio_base64 too small or missing: {len(audio) if audio else 0}"


# =============== VOICE ===============
class TestVoice:
    def test_tts(self, session, auth_headers):
        r = session.post(f"{API}/voice/tts", headers=auth_headers, json={"text": "Hello there, this is Lumi speaking."}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mime"] == "audio/mpeg"
        assert len(data["audio_base64"]) > 5000
        # store for STT
        TestVoice.audio_b64 = data["audio_base64"]

    def test_transcribe_roundtrip(self, session, auth_headers, auth_token):
        # need audio from prior test
        b64 = getattr(TestVoice, "audio_b64", None)
        if not b64:
            r = session.post(f"{API}/voice/tts", headers=auth_headers, json={"text": "Hello there, this is Lumi speaking."}, timeout=60)
            assert r.status_code == 200
            b64 = r.json()["audio_base64"]
        audio_bytes = base64.b64decode(b64)
        files = {"file": ("test.mp3", audio_bytes, "audio/mpeg")}
        headers = {"Authorization": f"Bearer {auth_token}"}
        r = requests.post(f"{API}/voice/transcribe", headers=headers, files=files, timeout=90)
        assert r.status_code == 200, r.text
        text = r.json().get("text", "").lower()
        assert len(text) > 0
        # loose sanity: some words from source
        assert any(w in text for w in ["hello", "hi", "lumi", "speaking", "there"]) or len(text) > 3


# =============== ACTIONS ===============
class TestActions:
    def test_daily_actions_three(self, session, auth_headers):
        r = session.get(f"{API}/actions/daily", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) == 3
        for item in items:
            assert {"id", "title", "description", "category", "duration_minutes", "icon", "completed"} <= set(item.keys())

    def test_complete_action_reflects(self, session, auth_headers):
        r = session.get(f"{API}/actions/daily", headers=auth_headers, timeout=15)
        title = r.json()[0]["title"]
        r2 = session.post(f"{API}/actions/complete", headers=auth_headers, json={"title": title}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["completed"] is True
        # verify reflection
        r3 = session.get(f"{API}/actions/daily", headers=auth_headers, timeout=15)
        completed = [a for a in r3.json() if a["title"] == title]
        assert completed and completed[0]["completed"] is True


# =============== SOCIAL ===============
class TestSocial:
    def test_social_suggestions(self, session, auth_headers):
        r = session.get(f"{API}/social/suggestions", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert 2 <= len(items) <= 3
        for it in items:
            assert {"id", "title", "description", "prompt", "icon"} <= set(it.keys())


# =============== EVENTS ===============
class TestEvents:
    def test_events_all(self, session):
        r = session.get(f"{API}/events", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 6
        assert all("_id" not in e for e in items)

    def test_events_filter_mindfulness(self, session):
        r = session.get(f"{API}/events?category=Mindfulness", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert all(e["category"] == "Mindfulness" for e in items)
        assert len(items) >= 1

    def test_categories(self, session):
        r = session.get(f"{API}/events/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert cats[0] == "All"
        for expected in ["Mindfulness", "Social", "Movement", "Wellness"]:
            assert expected in cats
