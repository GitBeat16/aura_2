# Aura → Lumi — Product Requirements

## Vision
A mobile-first AI companion for people who feel lonely or stuck. Guides users from emotional state (check-in) to real-world action (chat with Lumi, daily actions, social suggestions, real events).

## v1 – Aura foundations (delivered)
- **Auth**: JWT email/password (register, login, /me). Secure token storage (SecureStore on mobile, AsyncStorage on web).
- **Emotional check-in**: 7 pastel mood chips (great/good/okay/low/stuck/anxious/lonely) + optional note. Powers personalization across the app.
- **Home dashboard**: greeting, latest mood recap, "Talk to Lumi" CTA, mood-personalized Daily Actions, mood-personalized Social Suggestions with copy-ready prompts.
- **Events**: curated wellness/social events with category chip filter (All/Mindfulness/Social/Movement/Wellness). Sticky header + horizontal chip row.
- **Profile**: user stats (check-ins, day streak, member-since), recent moods list, sign-out.

## v2 – Lumi upgrade (delivered)
- **Character**: replaces the plain "Chat" tab. Lumi is a cute pastel-sage sprout drawn in SVG (react-native-svg) with react-native-reanimated animations. States: **idle** (gentle breathing + blinking + subtle leaf sway), **listening** (perked leaves + attentive tilt + pulsing halo), **thinking** (soft head-tilt), **speaking** (rhythmic mouth open/close + bounce).
- **Emotions**: Lumi's face reacts to conversation. Model returns an `[emotion]` tag with every reply → drives cheek color, eye shape (happy → smile arcs), and smile width. Emotions: calm · gentle · happy · thoughtful · encouraging · proud · listening.
- **Voice conversation** (tap-to-toggle):
  1. User taps mic → Lumi enters `listening` state, mic recording begins (`expo-audio`).
  2. User taps mic again → recording stops, file uploaded to `POST /api/voice/transcribe` (OpenAI Whisper via Emergent key).
  3. Transcribed text sent to `POST /api/chat/message` with `voice: true`.
  4. Lumi's reply is generated with Claude Sonnet 4.5 (`claude-sonnet-4-6`), emotion tag stripped, remainder sent to OpenAI TTS (`sage` voice, 0.95x speed) via Emergent key.
  5. Reply audio base64-decoded and played (`expo-audio` player). Lumi enters `speaking` state until playback ends.
- **Text fallback**: mode toggle (Voice / Type) lets users type instead. Same conversation history, same emotion animations, no TTS.
- **Ambient**: soft pastel gradient background + breathing halo that adapts hue per state.

## Backend endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | ❌ | New user |
| POST | /api/auth/login | ❌ | Login |
| GET  | /api/auth/me | ✅ | Current user |
| POST | /api/moods | ✅ | Log mood |
| GET  | /api/moods | ✅ | Mood history |
| GET  | /api/moods/latest | ✅ | Latest mood |
| POST | /api/chat/message | ✅ | Send message → Lumi reply (+ optional TTS audio) |
| GET  | /api/chat/history | ✅ | Retrieve conversation |
| GET  | /api/chat/current_session | ✅ | Get last session id |
| POST | /api/voice/transcribe | ✅ | Whisper STT (multipart audio) |
| POST | /api/voice/tts | ✅ | Standalone TTS (returns base64 mp3) |
| GET  | /api/actions/daily | ✅ | Mood-personalized actions |
| POST | /api/actions/complete | ✅ | Mark action done today |
| GET  | /api/social/suggestions | ✅ | Mood-personalized social prompts |
| GET  | /api/events | ✅ | Curated events (optional category) |
| GET  | /api/events/categories | ✅ | Category list |

## Integrations
- **Claude Sonnet 4.5** (`claude-sonnet-4-6`) — empathetic chat (via emergentintegrations + EMERGENT_LLM_KEY)
- **OpenAI Whisper** (`whisper-1`) — STT
- **OpenAI TTS** (`tts-1`, voice=`sage`, speed=0.95) — Lumi's calm, warm voice
- All three keyed by a single `EMERGENT_LLM_KEY` in `/app/backend/.env`.

## Constraints / Notes
- Voice must run on a real device (mic permission). Expo Web preview shows Lumi's animations but cannot record.
- Events are curated seeds; a real API (e.g., Ticketmaster) can be plugged in later.
