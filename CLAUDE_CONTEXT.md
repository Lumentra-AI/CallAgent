# Lumentra - Project Context for Claude

## What is Lumentra?

Lumentra is a **white-label SaaS platform for AI voice agents** that handles inbound phone calls for businesses. It's multi-tenant and supports **27 industry types** across 6 categories (hospitality, healthcare, automotive, professional services, personal care, property services).

## Architecture

```
lumentra-api/          # Backend - Hono.js + TypeScript + Supabase
lumentra-dashboard/    # Frontend - Next.js 15 + React + TailwindCSS
docs/                  # LaTeX documents for sales
```

### Tech Stack

- **Backend**: Hono.js, TypeScript, Supabase (Postgres), Node.js
- **Frontend**: Next.js 15 (App Router), React, TailwindCSS, shadcn/ui
- **Voice (Legacy)**: Vapi - managed service ($0.11-0.15/min)
- **Voice (Custom)**: SignalWire + Deepgram + Groq + Cartesia ($0.02-0.04/min)

## Custom Voice Stack (Cost Savings: 70-85%)

Replacing Vapi with our own stack:

```
SignalWire (Telephony/SIP) -> Deepgram (STT) -> Groq (LLM) -> Cartesia (TTS)
```

**Feature flag**: `VOICE_PROVIDER=vapi` or `VOICE_PROVIDER=custom` in `.env`

### Key Files for Voice Stack

- `lumentra-api/src/services/voice/` - Voice provider abstraction
- `lumentra-api/src/services/voice/custom/` - Custom stack implementation
  - `signalwire-handler.ts` - WebSocket telephony
  - `deepgram-stt.ts` - Speech-to-text
  - `groq-llm.ts` - LLM processing
  - `cartesia-tts.ts` - Text-to-speech
  - `pipeline.ts` - Orchestrates the flow

## Frontend Structure

- `app/` - Next.js App Router pages
- `components/dashboard/` - Main dashboard UI (Sidebar, TopBar, SystemHealth, ActivityLog, Waveform)
- `components/settings/` - Settings tabs (General, Agent, Hours, Greetings, Responses, Pricing, Integrations)
- `components/SetupWizard.tsx` - Onboarding wizard
- `context/ConfigContext.tsx` - Global state + API integration
- `lib/industryPresets.ts` - All 27 industry configurations
- `lib/api/` - API client for backend communication
- `types/index.ts` - TypeScript types

## Backend Structure

- `src/index.ts` - Main Hono app entry
- `src/routes/` - API routes (vapi, calls, dashboard)
- `src/services/` - Business logic (supabase, vapi, voice, sessionManager)
- `src/lib/` - Utilities

## Database (Supabase)

Tables: `tenants`, `calls`, `transcripts`, `configurations`, `analytics`

## Environment Variables

Backend `.env`:

```
SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL
VOICE_PROVIDER=vapi|custom
VAPI_API_KEY, VAPI_PHONE_ID, VAPI_WEBHOOK_SECRET
SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL, SIGNALWIRE_PHONE_NUMBER
DEEPGRAM_API_KEY, GROQ_API_KEY, CARTESIA_API_KEY
```

Frontend `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Current State

**Completed:**

- Full frontend dashboard with all settings tabs
- Industry presets for 27 business types
- Vapi integration (working)
- Custom voice stack architecture (needs API keys to test)
- Dashboard API endpoints
- Frontend-backend integration with fallback to mock data

**Pending:**

- SSE for real-time call events
- Live waveform visualization during calls
- Settings persistence to API
- Production deployment

## Running Locally

```bash
# Backend
cd lumentra-api && npm run dev  # Port 3001

# Frontend
cd lumentra-dashboard && npm run dev  # Port 3000

# Expose backend for webhooks
ngrok http 3001
```

## Key Commands

```bash
# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Notes

- Never use emojis in code
- Frontend falls back to mock data if backend unavailable
- Industry terminology is dynamic (Guest/Patient/Client, Booking/Appointment/Session, etc.)
- Each industry has custom metrics, intents, FAQs, and pricing templates
