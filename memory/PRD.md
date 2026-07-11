# Lumi — Product Requirements

## Vision
A mobile-first AI companion for people who feel lonely or stuck. Guides users from emotional state (check-in) to real-world action (chat with Lumi, daily actions, social suggestions, real events).

## v4 – UI System Overhaul (delivered)
Full visual redesign inspired by **Apple Health**, **Headspace**, **Finch**, and **Notion Calendar** — functionality unchanged.

- **Design system tokens** in `/app/frontend/src/theme.ts`:
  - Color: semantic (`bg`, `card`, `ink`, `inkMuted`) + brand (`lumi`, `lumiSoft`) + mood pastels (joy, calm, neutral, sad, anxious, blue, rose) + category accents.
  - Typography: `display / h1 / h2 / h3 / bodyLarge / body / caption / overline / number`, Georgia (serif) display + system body.
  - Spacing 8pt scale (xs 4 → xxxxl 64), radius scale (sm 8 → pill), elevation tiers (`sm`, `md`).
- **Reusable UI kit** in `/app/frontend/src/ui/`:
  - `Card` (default / flat / tinted / outlined) — Apple-Health-style rounded 24 card with subtle shadow.
  - `MetricCard` — colored dot + label + large number + hint.
  - `SectionHeader` — title + caption + right slot.
  - `PillTag` — pastel category chip.
  - `StreakBadge` — flame + count.
  - `EmptyState` — centered icon + title + subtitle.
  - `PrimaryButton` (black pill), `SecondaryButton` (bordered), `IconButton` (circular), `TextButton`.
  - `ChipRow` — horizontal filter row (never wraps, sticky-header friendly).
  - `GlassBar` — sticky top bar backed by `expo-blur`, used on Lumi + Events + tab bar per design constraint.
- **Screens redesigned** (no behaviour change):
  - Onboarding: full-bleed pastel gradient hero + "Lumi · your companion" pill + serif display headline.
  - Auth (login/signup): Notion-Calendar-crisp, tinted labels, monochrome inputs, big black pill CTA.
  - Mood check-in: 2-column soft pastel chips, optional note in outlined textarea.
  - Home: greeting eyebrow + serif name, mood recap card in mood's pastel color, "Talk to Lumi" tinted CTA, actions rendered as clean rows with category-accent icon dots + duration pill, social suggestions as tinted cards.
  - Lumi chat: glass sticky header ("Here with you · Lumi") + ambient/mode icon buttons + animated character centered + editorial bubbles + monochrome pill mic (black idle, rose listening) with pulsing ring.
  - Events: glass sticky header with "Discover" eyebrow + serif title + `ChipRow` categories; cards with tall image, dark scrim, floating date badge, category tag, meta row, Join pill.
  - Profile: user header with avatar + logout icon button, 2× `MetricCard` stats, **NEW Weekly Recap** with 3-column mini-stats + AI reflection quote (`lumiSoft` background) + Share button (uses native `Share.share`), **NEW Habit Streaks** list with flame badge per repeated task (auto-fades when streak is paused), Recent Moods list, primary "New check-in" CTA at bottom.
- **Tab bar** now uses `BlurView` glass, custom active-tab pill background, and 4 tabs renamed to `Today · Lumi · Events · You` to match the new voice.
- **Responsive**: tokens scale down at ≤360 via type styles; safe-area handled on all screens.

## v5 – Spotify integration (delivered)
Full modular music-provider architecture with Spotify as the first implementation.

- **Modular provider abstraction** at `/app/backend/music/` — `MusicProvider` ABC (base.py) + `SpotifyProvider` (spotify.py). Adding Apple Music / YouTube Music later is a matter of implementing the same 11-method interface.
- **OAuth 2.0 Authorization Code flow**:
  - `GET /api/spotify/login` returns Spotify's authorize URL (state stored in Mongo).
  - `GET /api/spotify/callback` exchanges the code, stores per-user access/refresh tokens + profile in `spotify_tokens`.
  - Access token auto-refreshed on demand via `_spotify_token` helper.
  - Scopes: `user-read-private`, `user-read-email`, `user-top-read`, `user-read-recently-played`, `playlist-read-private`, `playlist-read-collaborative`, `playlist-modify-private`, `playlist-modify-public`.
- **Dev/manual mode**: `POST /api/spotify/connect-token` accepts a user access token directly (no client keys needed) — this is how we tested with the token you shared. Once `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` are set in `/app/backend/.env`, the OAuth button on the Music tab lights up.
- **Endpoints (all under `/api`)**: `spotify/status`, `spotify/login`, `spotify/callback`, `spotify/connect-token`, `spotify/disconnect`, `spotify/playlists`, `spotify/top-tracks`, `spotify/top-artists`, `spotify/recently-played`, `spotify/playlists` (create), `spotify/playlists/{id}/tracks` (add), `music/recommendations`, `weather`.
- **Weather (Open-Meteo, no key)**: `GET /api/weather?lat&lon` — condition, temperature, wind, is_day.
- **AI-driven recommendation engine**: `POST /api/music/recommendations` combines
  1. Latest mood (7-way palette → valence/energy targets)
  2. Last 8 chat messages (activity heuristic + tone)
  3. Weather (condition-appropriate genre biases)
  4. Time of day + inferred activity (focusing / relaxing / winding-down / working-out / starting-day / flowing)
  5. User's top artists and top tracks (personalized seeding)
  Then asks Claude Sonnet 4.5 to return a **JSON prescription**: `title` (poetic playlist name), `reasoning` (one-sentence why), and 10 targeted Spotify **search queries** blending user's favorites with mood/genre hints. The backend fans out those searches, de-duplicates, and returns up to 15 tracks. (Spotify deprecated `/v1/recommendations` for new apps in Nov 2024, so this search-based approach is both compliant and more personalized.)
- **Frontend**: new **Music tab** with three sub-tabs — For you · Playlists · Top & Recent. Connect screen supports the Spotify OAuth button (when configured) and a "paste an access token" fallback for dev/testing. For-you tab shows a hero card with playlist title, warm reasoning line, contextual chips (weather / time / activity), a **Save as playlist** button (creates a private Spotify playlist named "Lumi · <title>" and adds the tracks), and a scrollable list of tracks — tap any to open the Spotify app (deep-link via `spotify:track:xxx` with web fallback).
- **Home** now shows a **"Music for how you feel"** card that jumps into the Music tab.

## Constraints / Notes
- Weather: currently seeded to San Francisco (37.77, -122.42). Once we ship user-location capture, `POST /music/recommendations` accepts `{lat, lon}`.
- Spotify user access tokens are ~1 hour. With `SPOTIFY_CLIENT_ID` / `SECRET` in `.env`, refresh tokens keep the connection alive indefinitely. The dev "paste token" path won't auto-refresh.
- Provider architecture is designed for expansion; second provider only needs a class implementing `MusicProvider`.

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
| GET  | /api/actions/daily | ✅ | 5–8 AI-personalized tasks (cached per day) |
| POST | /api/actions/regenerate | ✅ | Force new AI-generated task set |
| POST | /api/actions/complete | ✅ | Mark action done today |
| GET  | /api/stats/task-streaks | ✅ | Per-task streaks with active flag |
| GET  | /api/stats/weekly-recap | ✅ | Rolling 7-day metrics + AI-written reflection + shareable text |
| GET  | /api/social/suggestions | ✅ | Mood-personalized social prompts |
| GET  | /api/events | ✅ | Curated events (optional category) |
| GET  | /api/events/categories | ✅ | Category list |

## Integrations
- Claude Sonnet 4.5 for empathetic Lumi chat, daily task generation, and weekly recap reflection.
- OpenAI Whisper for STT, OpenAI TTS (`sage` voice, 0.95× speed) for Lumi's voice.
- All routed through the Emergent Universal LLM key in `/app/backend/.env`.

## Constraints / Notes
- Voice requires a real device build (mic permission). Web preview shows character + all animations, plays TTS if the browser allows autoplay.
- Events currently served from a curated seed; a real API (e.g., Ticketmaster) can be plugged in later.
