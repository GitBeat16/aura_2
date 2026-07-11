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
