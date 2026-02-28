# Lumentra - System Architecture

---

## High-Level Overview

```
                         Inbound Call
                              |
                      [ SignalWire SIP ]
                              |
                    [ lumentra-api:3100 ]
                     /        |        \
           [ Deepgram ]  [ LLM Chain ]  [ Cartesia ]
            (STT)      OpenAI/Groq/     (TTS)
                        Gemini
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

### Voice Pipeline

| Service    | Role                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| SignalWire | Telephony - receives inbound calls, provides phone numbers, SIP trunking        |
| Deepgram   | Speech-to-Text - real-time transcription via WebSocket (nova-2-phonecall model) |
| Cartesia   | Text-to-Speech - streaming voice synthesis (Sonic model)                        |
| OpenAI     | Primary LLM for voice conversations (GPT-4.1 mini)                              |
| Groq       | Fallback LLM with low latency                                                   |
| Gemini     | Fallback LLM + powers chat widget                                               |

### Database

| Service    | Purpose                                                         |
| ---------- | --------------------------------------------------------------- |
| Supabase   | Hosted PostgreSQL + Auth (email/password, OAuth)                |
| PostgreSQL | All application data - tenants, calls, contacts, bookings, etc. |

---

## Backend Service Structure

```
lumentra-api/src/
  index.ts                    # App entry, route registration, WebSocket upgrade
  routes/
    health.ts                 # Health check endpoint
    signalwire-voice.ts       # Inbound call webhook handler
    signalwire-stream.ts      # WebSocket audio stream handler
    vapi.ts                   # Vapi webhook integration (alternative to custom voice)
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

1. Caller dials a SignalWire phone number
2. SignalWire sends webhook to `POST /signalwire/voice` with caller info
3. API looks up tenant by phone number, returns TwiML to connect a media stream
4. SignalWire opens WebSocket to `/signalwire/stream?tenantId=xxx`
5. API creates a Deepgram STT WebSocket connection
6. Audio flows: Caller -> SignalWire -> API WebSocket -> Deepgram
7. Deepgram returns real-time transcripts
8. Turn manager accumulates transcript, detects when caller stops speaking
9. Full turn sent to LLM (OpenAI/Groq/Gemini) with conversation history + tools
10. LLM responds (may call tools like check_availability, create_booking)
11. LLM text streamed sentence-by-sentence to Cartesia TTS
12. TTS audio streamed back through WebSocket -> SignalWire -> Caller
13. Call data (transcript, duration, outcome) saved to database

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
