# Lumentra - Project Handoff

**Date:** 2026-02-27
**Project:** Lumentra Voice Agent Platform
**Status:** Functional, demo-ready with known voice quality limitations

---

## What This Is

Lumentra is a multi-tenant voice AI platform that answers phone calls for businesses 24/7. It handles bookings, FAQs, escalations, and CRM - all through natural voice conversation.

The system consists of two main applications:

1. **lumentra-api** - Node.js/Hono backend with real-time voice pipeline, LLM orchestration, telephony integration, and REST API
2. **lumentra-dashboard** - Next.js 16 frontend with setup wizard, CRM, call management, analytics, and settings

---

## Handoff Documents

| Document                           | Description                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, tech stack, data flow, and service breakdown                   |
| [DEPLOYMENT.md](DEPLOYMENT.md)     | How to run locally, deploy to production, and manage the infrastructure             |
| [ENV-SETUP.md](ENV-SETUP.md)       | Every environment variable, what it does, and which third-party accounts are needed |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | Current bugs, limitations, and what remains to be done                              |
| [WORK-LOG.md](WORK-LOG.md)         | Detailed daily work log with commit history and hour estimates                      |

---

## Quick Start

```bash
# API
cd lumentra-api
cp .env.example .env   # Fill in all values (see ENV-SETUP.md)
npm install
npm run dev             # Runs on port 3100

# Dashboard
cd lumentra-dashboard
cp .env.example .env   # Fill in values
npm install
npm run dev             # Runs on port 3000
```

For voice calls to work, the API must be publicly accessible (ngrok or deployed server) because telephony webhooks need to reach it.

---

## Codebase Stats

- **132 commits** across 17 working days (Jan 9 - Feb 26, 2026)
- **~108 estimated hours** of development work
- **32,634 lines** of API source code (TypeScript)
- **54,557 lines** of dashboard source code (TypeScript/React)
- **104 API source files** across 27 service modules
- **233 dashboard source files** with 150+ React components
- **17 database migrations** for PostgreSQL via Supabase

---

## Third-Party Services Required

| Service       | Purpose                        | Required    |
| ------------- | ------------------------------ | ----------- |
| Supabase      | Database (PostgreSQL) + Auth   | Yes         |
| Deepgram      | Speech-to-text (STT)           | Yes         |
| Cartesia      | Text-to-speech (TTS)           | Yes         |
| SignalWire    | Telephony (inbound calls, SIP) | Yes         |
| OpenAI        | LLM for voice conversations    | Yes         |
| Groq          | LLM fallback provider          | Recommended |
| Google Gemini | LLM fallback + chat widget     | Recommended |
| Twilio        | SMS confirmations              | Optional    |
| Resend        | Email notifications            | Optional    |

---

## What Works

- Full setup wizard that configures a tenant from scratch
- Multi-tenant architecture with tenant isolation
- Inbound call handling via SignalWire with real-time voice streaming
- Custom voice pipeline: Deepgram STT -> LLM -> Cartesia TTS
- Multi-provider LLM fallback (OpenAI -> Groq -> Gemini)
- Tool calling for bookings, availability checks, FAQ lookup
- CRM with contacts, call history, analytics
- Escalation system with live transfer
- Dashboard with settings, call logs, notifications
- CI/CD pipeline via GitHub Actions
- Docker Compose for deployment

## What Does Not Work Perfectly

See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for full details. The main issue is voice quality - specifically audio "chop" where the AI voice gets cut off mid-sentence during longer conversations. This is a real-time streaming latency problem, not a missing feature.
