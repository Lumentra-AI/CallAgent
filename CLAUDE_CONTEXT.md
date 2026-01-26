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

---

## Voice AI Research Summary (January 2026)

### Market Updates (January 2026)

- **Nvidia acquired Groq** (Dec 2025, $20B) - GroqCloud continues but no new LPU hardware
- **Cerebras signed $10B deal with OpenAI** (Jan 2026) - Strong backing, IPO Q2 2026
- **Qwen 3 released** (Apr 2025) - Leading open-source tool calling
- **Kimi K2 emerged** - 1T MoE model (32B active) for agentic tasks

### Critical Decisions Made

1. **FunctionGemma/Ollama REMOVED** - Had production reliability issues (20s+ latency spikes)
2. **Direct Groq LLM with native tool calling** - No separate router needed
3. **Hybrid model strategy** - Llama 3.1 8B for simple queries, Qwen3-32B for complex
4. **Vapi deprecated** - Custom stack is 70-85% cheaper

### Architecture: Sub-500ms Voice-to-Voice

```
SignalWire -> Deepgram (streaming) -> Groq (streaming) -> Cartesia (streaming)
Target: ~450ms end-to-end latency
```

### Top 3 LLM Options for Voice AI (8B-70B)

| Rank | Stack                    | Best For     | Cost at 50K min/mo | TTFT   |
| ---- | ------------------------ | ------------ | ------------------ | ------ |
| 1    | Groq + Llama 3.1 8B      | Speed + Cost | $1,500-2,000       | ~150ms |
| 2    | Groq + Qwen3-32B         | Tool Calling | $2,000-2,500       | ~200ms |
| 3    | Cerebras + Llama 3.3 70B | Quality      | $2,500-3,000       | <200ms |

### Provider Pricing (January 2026)

| Provider    | Best Model    | Input $/1M | Output $/1M | Speed       | Risk        |
| ----------- | ------------- | ---------- | ----------- | ----------- | ----------- |
| Groq        | Llama 3.1 8B  | $0.05      | $0.08       | 750+ tok/s  | Medium-High |
| Groq        | Qwen3-32B     | $0.29      | $0.59       | 535 tok/s   | Medium-High |
| Cerebras    | Llama 3.3 70B | $0.60      | $0.60       | 2,100 tok/s | Low         |
| Together AI | Llama 3.3 70B | $0.88      | $0.88       | ~200 tok/s  | Low         |
| SambaNova   | Llama 4       | TBD        | TBD         | 800 tok/s   | Low         |

### Recommended Hybrid Strategy

```
Simple Queries (80%) -> Groq Llama 3.1 8B ($0.05/$0.08)
Complex Queries (20%) -> Groq Qwen3-32B ($0.29/$0.59)
```

This provides 40-60% cost savings vs using Qwen3-32B for everything.

### Risk Mitigation

- **Groq Risk:** Nvidia acquisition creates uncertainty - plan migration to Cerebras/SambaNova
- **Cerebras:** Strong backing from OpenAI deal, upcoming IPO
- **Together AI:** Diversified catalog, easy migration, low vendor lock-in

### Cost Analysis (at 50K min/month)

| Stack                | Cost/min   | Monthly       |
| -------------------- | ---------- | ------------- |
| Vapi                 | $0.15-0.20 | $7,500-10,000 |
| Custom (Groq API)    | $0.037     | $1,850        |
| Custom (Hybrid)      | $0.025     | $1,250        |
| Custom (Self-hosted) | $0.015     | $750          |

### Scaling Path

- **Phase 1 (5 businesses)**: Pure API stack (Groq, Deepgram, Cartesia)
- **Phase 2 (25 businesses)**: Add cloud GPU for LLM (RunPod/Hyperstack H100)
- **Phase 3 (50+ businesses)**: Self-host LLM in parent company data center

### Human Transfer Handling

When human unavailable:

1. **Urgent**: Callback queue with time estimate
2. **Medium**: Schedule appointment
3. **Low**: Voicemail + email follow-up

Context preservation is critical - pass full transcript + AI summary to human agent.

### Multi-Tenant Capacity

- 1 H100 GPU = ~100 concurrent voice calls
- Connection pooling for STT/TTS WebSockets
- Redis for session state, PostgreSQL for tenant config

### Key Research Documents

- `VOICE_AI_RESEARCH_REPORT_2026.md` - Full research with pricing, APIs, architecture
- `ARCHITECTURE_RECOMMENDATIONS.md` - Technical implementation details

### Provider Choices (Current)

| Component     | Provider            | Reason                    |
| ------------- | ------------------- | ------------------------- |
| Telephony     | SignalWire          | 85% cheaper than Twilio   |
| STT           | Deepgram Nova-2     | Best phone optimization   |
| LLM Primary   | Groq (Llama 3.1 8B) | ~150ms TTFT, native tools |
| LLM Complex   | Groq (Qwen3-32B)    | Best agentic/tool calling |
| TTS Primary   | Cartesia Sonic      | 40ms TTFA                 |
| TTS Secondary | Smallest AI         | Better for dates/numbers  |

### Parent Company Context

- ISP/data center services provider
- Can self-host infrastructure in future
- Target: Hotels, clinics, service businesses
- Expected: 5+ businesses in first month, 2-10 concurrent calls each
