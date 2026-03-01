# Lumentra - System Architecture

---

## High-Level Overview

```
                         Inbound Call
                              |
                      [ SignalWire SIP ]
                              |
                     [ LiveKit SIP Bridge ]
                              |
                       [ LiveKit Room ]
                              |
                [ lumentra-agent (Python) ]
                 /        |        \
      [ Deepgram ]  [ OpenAI LLM ]  [ Cartesia ]
       (STT)       gpt-4.1-mini      (TTS)
                        |
              [ lumentra-api:3100 ]  <-- tool calls + call logging
                        |
              [ Supabase PostgreSQL ]
                        |
           [ lumentra-dashboard:3000 ]
                   (Next.js)
```

---

## Tech Stack

### Backend (lumentra-api)

| Technology     | Version | Purpose                                                  |
| -------------- | ------- | -------------------------------------------------------- |
| Node.js        | 22      | Runtime                                                  |
| TypeScript     | 5.x     | Language                                                 |
| Hono           | 4.6     | HTTP framework (lightweight, fast)                       |
| WebSocket (ws) | 8.19    | Real-time audio streaming                                |
| esbuild        | -       | Build/bundler (single-file output)                       |
| pg             | 8.18    | PostgreSQL client (direct, not Supabase SDK for queries) |
| Zod            | 3.24    | Input validation                                         |
| Pino           | 9.6     | Structured logging                                       |

### Frontend (lumentra-dashboard)

| Technology    | Version | Purpose                      |
| ------------- | ------- | ---------------------------- |
| Next.js       | 16.1    | React framework (App Router) |
| React         | 19.2    | UI library                   |
| TypeScript    | 5.x     | Language                     |
| Tailwind CSS  | 4.x     | Styling                      |
| Radix UI      | various | Accessible UI primitives     |
| Framer Motion | 12.x    | Animations                   |
| Recharts      | 3.6     | Analytics charts             |
| Supabase SSR  | 0.8     | Auth integration             |

### Voice Agent (lumentra-agent -- Python)

| Service    | Role                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| LiveKit    | Real-time media server (rooms, SIP bridge, turn detection)                 |
| SignalWire | Telephony - SIP trunk for inbound calls (+19458001233)                     |
| Deepgram   | Speech-to-Text - nova-3, multi-language, smart_format                      |
| Cartesia   | Text-to-Speech - Sonic-3, speed 0.95, emotion Content                      |
| OpenAI     | LLM for voice conversations (gpt-4.1-mini, temp 0.8)                       |
| Groq       | Tested but unusable on free tier (12k TPM limit kills calls after 2 turns) |
| Gemini     | Powers chat widget only (not used in voice)                                |

### Database

| Service    | Purpose                                                         |
| ---------- | --------------------------------------------------------------- |
| Supabase   | Hosted PostgreSQL + Auth (email/password, OAuth)                |
| PostgreSQL | All application data - tenants, calls, contacts, bookings, etc. |

---

## Voice Agent Structure (lumentra-agent -- Python)

```text
lumentra-agent/
  agent.py           # Entrypoint: LumentraAgent class, session setup, voice pipeline config
  tools.py           # LLM tools: check_availability, create_booking, create_order, transfer_to_human, end_call
  call_logger.py     # Extracts transcript from session history, posts call record to lumentra-api
  tenant_config.py   # Fetches tenant config + system prompt from internal API by phone number
  api_client.py      # Shared httpx client with INTERNAL_API_KEY auth
  Dockerfile         # Builds agent image, bakes in turn detector model via download-files
```

Key design decisions:

- Agent is a thin orchestration layer -- all business logic (booking, availability, CRM) lives in lumentra-api
- Tools call lumentra-api internal endpoints, not the database directly
- Transcript extraction uses `session.history.messages()` (method, not property -- LiveKit Agents v1.4+)
- Call logging is fire-and-forget with 5s timeout to avoid blocking session teardown
- SIP REFER transfer uses LiveKit's `transfer_sip_call()` for human escalation

---

## Backend Service Structure (lumentra-api -- TypeScript)

```text
lumentra-api/src/
  index.ts                    # App entry, route registration, WebSocket upgrade
  routes/
    health.ts                 # Health check endpoint
    internal.ts               # Internal API for Python agent (tenant config, tool calls, call logging)
    signalwire-voice.ts       # Legacy inbound call webhook (not used with LiveKit)
    signalwire-stream.ts      # Legacy WebSocket audio stream (not used with LiveKit)
    vapi.ts                   # Vapi webhook integration (not used with LiveKit)
    chat.ts                   # Embeddable chat widget API
    setup.ts                  # Tenant setup wizard API
    tenants.ts                # Tenant CRUD
    calls.ts                  # Call history
    contacts.ts               # CRM contacts
    bookings.ts               # Booking management
    pending-bookings.ts       # Bookings awaiting confirmation
    availability.ts           # Resource availability
    resources.ts              # Bookable resources (rooms, tables, etc.)
    capabilities.ts           # Tenant feature flags
    integrations.ts           # Third-party integrations (Google Cal, Outlook)
    phone-config.ts           # Phone number and SIP trunk config
    escalation.ts             # Call escalation management
    notifications.ts          # In-app notifications
    voicemails.ts             # Voicemail management
    promotions.ts             # Promotional offers
    training-data.ts          # Conversation logs for training
    dashboard.ts              # Dashboard analytics aggregations
  services/
    voice/
      session-manager.ts      # Manages active call sessions
      turn-manager.ts         # Core conversation turn-taking logic (2300+ lines)
      conversation-state.ts   # Tracks conversation context per call
      audio-pipeline-state.ts # Audio streaming state machine
      sentence-buffer.ts      # Buffers TTS sentences for smooth delivery
      intent-detector.ts      # Detects caller intent from transcript
      voicemail.ts            # Voicemail recording and storage
    llm/
      streaming-provider.ts   # Multi-provider LLM with fallback chain
    deepgram/
      client.ts               # Deepgram STT WebSocket client
    cartesia/
      (TTS client)
    openai/
      (OpenAI chat completions + tool calling)
    groq/
      client.ts, chat.ts, tools.ts, streaming.ts
    gemini/
      client.ts, chat.ts, tools.ts, intent-check.ts, streaming.ts
    signalwire/
      client.ts, phone.ts, sip.ts, media-stream.ts, audio-buffer.ts
    database/
      client.ts               # Connection pool management
      pool.ts                 # Pool config
      tenant-cache.ts         # In-memory tenant config cache
      query-helpers.ts        # Shared query utilities
      queries/                # SQL query modules
    crm/
      (Contact management, phone normalization)
    bookings/
      booking-service.ts
    availability/
      availability-service.ts
    escalation/
      escalation-manager.ts
    contacts/
      (Contact lookup and creation)
    calendar/
      (Google Calendar / Outlook integration)
    connections/
      (OAuth token management)
    notifications/
      notification-service.ts
    resources/
      resource-service.ts
    training/
      conversation-logger.ts
    crypto/
      encryption.ts           # AES encryption for sensitive data
    fallback/
      chain.ts                # LLM provider fallback chain logic
    twilio/
      (SMS sending)
    vapi/
      assistant.ts, client.ts # Vapi integration as alternative voice provider
  middleware/
    index.ts                  # Auth middleware (Supabase JWT), rate limiting
  config/
    (App configuration)
  types/
    (TypeScript type definitions)
  jobs/
    scheduler.ts              # Cron jobs (cleanup, notifications)
```

---

## Frontend Structure

```
lumentra-dashboard/
  app/
    (auth)/                   # Auth pages (login, signup, forgot/reset password)
    auth/callback/            # Supabase OAuth callback handler
    setup/                    # Multi-step tenant setup wizard
    (dashboard)/              # Main dashboard (authenticated)
      dashboard/              # Overview page
      calls/                  # Call history
      contacts/               # CRM contacts
      calendar/               # Calendar/bookings
      pending/                # Pending bookings
      escalations/            # Escalation queue
      notifications/          # Notifications
      analytics/              # Charts and stats
      resources/              # Bookable resources
      workstation/            # Industry-specific workspace
      profile/                # User profile
      settings/               # Settings pages
        assistant/            # Voice agent personality
        business/             # Business info
        capabilities/         # Feature toggles
        escalation/           # Escalation rules
        hours/                # Operating hours
        integrations/         # Third-party connections
        phone/                # Phone number config
        promotions/           # Promotional offers
    (marketing)/              # Public landing page
    api/                      # Next.js API routes
  components/
    auth/                     # Auth UI components
    crm/                      # CRM pages (calls, contacts, calendar, etc.)
    dashboard/                # Dashboard shell (sidebar, topbar, etc.)
    demo/                     # Live demo widget
    escalation/               # Escalation dock and panels
    landing/                  # Marketing landing page
    settings/                 # Settings tab components
    setup/                    # Setup wizard steps
    shell/                    # App shell (sidebar, topbar, command palette)
    workstation/              # Industry workspace components
    ui/                       # Shared UI primitives
    magicui/                  # Animation components
    aceternity/               # Animation components
  context/
    AuthContext.tsx            # Supabase auth state provider
  lib/
    api/client.ts             # API client with auth headers
    supabase/                 # Supabase client configuration
```

---

## Voice Call Flow (How a Call Works)

### Current Architecture (LiveKit Agents)

1. Caller dials +19458001233 (SignalWire phone number)
2. SignalWire routes call via SIP to LiveKit SIP Bridge (port 5060)
3. SIP Bridge creates a LiveKit Room (prefixed `call-`)
4. LiveKit dispatch rule matches room prefix, launches `lumentra-voice-agent`
5. Python agent joins the room, extracts dialed number + caller phone from SIP attributes
6. Agent fetches tenant config + system prompt from lumentra-api (`GET /internal/tenants/by-phone/:phone`)
7. Agent starts voice pipeline: Deepgram STT -> OpenAI gpt-4.1-mini -> Cartesia TTS
8. Turn detection: LiveKit multilingual model + Silero VAD (prewarmed)
9. Agent greets caller using tenant's configured greeting
10. LLM handles conversation with tool calling (check_availability, create_booking, etc.)
11. Tools execute via lumentra-api (`POST /internal/voice-tools/:action`)
12. On call end: transcript extracted from session history, call logged via `POST /internal/calls/log`
13. Call record saved to database with duration, outcome, summary

### Legacy Architecture (removed)

The old pipeline (SignalWire WebSocket -> API -> Deepgram/Cartesia) was removed in favor of LiveKit Agents. The old `signalwire-voice.ts`, `signalwire-stream.ts`, `turn-manager.ts` routes still exist in the API codebase but are not used for voice calls. The voice pipeline now runs entirely in the Python agent.

---

## Database Schema

17 migrations in `lumentra-api/migrations/`. Consolidated schema in `infrastructure/init-scripts/`.

Key tables:

- `tenants` - Business configuration (greetings, hours, voice, features)
- `tenant_members` - User-to-tenant mapping with roles
- `calls` - Call records with transcripts, duration, sentiment
- `contacts` - CRM contacts with engagement scoring
- `bookings` - Appointment/reservation records
- `resources` - Bookable items (rooms, tables, time slots)
- `notifications` - In-app notification queue
- `voicemails` - Voicemail recordings
- `escalation_queue` - Calls requiring human attention
- `promotions` - Active promotional offers
- `conversation_logs` - Raw conversation data for training
- `pending_bookings` - Bookings awaiting human confirmation

---

## Authentication

- Supabase Auth handles user registration and login (email/password + OAuth)
- Dashboard uses `@supabase/ssr` for server-side session management
- API validates Supabase JWTs in auth middleware
- Tenant membership checked via `tenant_members` table
- Setup wizard creates tenant + tenant_member on first login
