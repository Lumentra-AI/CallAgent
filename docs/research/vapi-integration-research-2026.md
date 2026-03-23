# Vapi Integration Research -- Synthesis Report

**Date:** 2026-03-22
**Methodology:** Rule of 5 Deep Research (7 parallel agents, 400+ searches, 50+ sources)
**Purpose:** Evaluate Vapi as primary voice provider for Lumentra, with self-hosted LiveKit as fallback

---

## Executive Summary

Vapi is viable as a voice AI orchestration layer but comes with significant trade-offs vs the existing self-hosted stack. Cost is 3-4x higher ($0.08/min BYOK vs $0.02-0.03/min self-hosted). Reliability is concerning (63 incidents in 90 days, intermittent webhook failures). Quality potential is high with proper tuning (backchanneling, filler injection, turn detection). Phone numbers must be BYO (Vapi native capped at 10). The integration is straightforward -- a single webhook endpoint replaces the entire Python agent.

**Recommendation:** Proceed with Vapi integration but with defensive architecture (store all data locally, poll API as webhook fallback, keep LiveKit stack warm).

---

## 1. Architecture: How It Works

### Current Flow (LiveKit)

```
SignalWire SIP -> /sip/forward webhook -> LiveKit SIP -> Python Agent -> Internal API
```

### New Flow (Vapi)

```
Tenant's PBX (missed call) -> forwards to Vapi number -> Vapi sends assistant-request webhook
-> Lumentra API returns tenant config inline -> Vapi runs the call
-> tool-calls webhook for business logic -> end-of-call-report webhook for logging
```

### Key Integration Point: `assistant-request` Webhook

When a call arrives on a Vapi number with no pre-assigned assistant, Vapi sends an `assistant-request` POST to your server URL. You respond with the full assistant config inline (system prompt, voice, tools, etc.). This replaces both the LiveKit agent AND the per-tenant assistant CRUD.

**Timeout:** 7.5 seconds -- tenant config lookup must be fast. Cache in Redis/memory.

**Response format:**

```json
{
  "assistant": {
    "name": "Business Name",
    "firstMessage": "Hello, thanks for calling...",
    "model": {
      "provider": "openai",
      "model": "gpt-4.1-mini",
      "temperature": 0.7,
      "messages": [{ "role": "system", "content": "..." }],
      "tools": [
        /* inline tool definitions */
      ]
    },
    "voice": {
      "provider": "cartesia",
      "voiceId": "694f9389-aac1-45b6-b726-9d9369183238"
    },
    "transcriber": {
      "provider": "deepgram",
      "model": "nova-3",
      "language": "multi",
      "smartFormat": true
    },
    "backchannelingEnabled": true,
    "fillerInjectionEnabled": true,
    "backgroundSound": "office",
    "backgroundDenoisingEnabled": true,
    "maxDurationSeconds": 600,
    "silenceTimeoutSeconds": 30,
    "startSpeakingPlan": {
      /* turn detection config */
    },
    "stopSpeakingPlan": {
      /* interruption config */
    },
    "server": { "url": "https://api.lumentraai.com/webhooks/vapi" },
    "serverMessages": [
      "end-of-call-report",
      "tool-calls",
      "transfer-destination-request",
      "status-update"
    ]
  }
}
```

---

## 2. Phone Numbers: BYO Required

Vapi native numbers are capped at 10 per account, US only, random assignment (no search). Not viable for multi-tenant.

### Recommended: BYO via Twilio

1. Buy numbers through Twilio API (full area code search, number selection)
2. Import into Vapi: `POST /phone-number` with `provider: "twilio"` + Twilio credentials
3. Set `server.url` on the number (no assistantId) for dynamic routing via `assistant-request`
4. Cost: ~$1-2/mo per number (Twilio) + $0.008/min inbound (Twilio transport)

### Alternative: BYO SIP Trunk (keep SignalWire)

1. Keep numbers on SignalWire
2. Import into Vapi: `POST /phone-number` with `provider: "byo-phone-number"` + SIP credential
3. Free transport through Vapi if using SIP
4. Most control, least migration effort

### Provisioning Flow Change

**Old:** SignalWire API -> save to DB -> register with LiveKit SIP trunk
**New:** Twilio/SignalWire API -> save to DB -> import to Vapi via API -> set server URL

---

## 3. Tool Integration: Reuse Existing Logic

Vapi sends `tool-calls` events to your server URL. Your API translates to existing `executeTool()` calls.

### Vapi Tool Call Format (incoming)

```json
{
  "message": {
    "type": "tool-calls",
    "call": { "id": "call-uuid", "customer": { "number": "+1..." } },
    "toolCallList": [
      {
        "id": "toolu_xxx",
        "name": "check_availability",
        "arguments": { "date": "2026-03-25" }
      }
    ]
  }
}
```

### Required Response Format

```json
{
  "results": [
    {
      "toolCallId": "toolu_xxx",
      "result": "Available slots: 9:00 AM, 10:30 AM, 2:00 PM"
    }
  ]
}
```

**Critical rules:**

- `result` must be a single-line string (no line breaks)
- Objects must be `JSON.stringify()`'d
- Must return HTTP 200 (any other status is ignored)
- `toolCallId` must match exactly

### Tool Definition Format (inline in assistant config)

```json
{
  "type": "function",
  "function": {
    "name": "check_availability",
    "description": "Check available appointment slots for a given date",
    "parameters": {
      "type": "object",
      "properties": {
        "date": { "type": "string", "description": "Date in YYYY-MM-DD format" }
      },
      "required": ["date"]
    }
  },
  "messages": [
    {
      "type": "request-start",
      "content": "Let me check availability for you..."
    },
    { "type": "request-complete", "content": "I found some available times." },
    {
      "type": "request-failed",
      "content": "I had trouble checking availability."
    }
  ]
}
```

### Tool Mapping (Lumentra -> Vapi)

| Lumentra Tool        | Vapi Implementation                                          |
| -------------------- | ------------------------------------------------------------ |
| `check_availability` | Custom function tool -> existing executeTool()               |
| `create_booking`     | Custom function tool -> existing executeTool()               |
| `create_order`       | Custom function tool -> existing executeTool()               |
| `transfer_to_human`  | Built-in `transferCall` tool with dynamic destinations       |
| `queue_callback`     | Custom function tool -> existing executeTool()               |
| `log_note`           | Custom function tool (async: true) -> existing executeTool() |
| `end_call`           | Built-in `endCall` tool                                      |

---

## 4. Call Transfers: Rich Built-in Support

Vapi has 8 transfer plan modes. Use `transfer-destination-request` webhook for dynamic routing to escalation contacts.

### Recommended Transfer Setup

**Dynamic destinations** (empty destinations array + webhook):

```json
{
  "type": "transferCall",
  "destinations": [],
  "function": {
    "name": "transferCall",
    "parameters": {
      "type": "object",
      "properties": {
        "reason": { "type": "string" },
        "target_role": { "type": "string" }
      }
    }
  }
}
```

Server receives `transfer-destination-request`, looks up escalation contacts, returns:

```json
{
  "destination": {
    "type": "number",
    "number": "+14155551234",
    "transferPlan": {
      "mode": "warm-transfer-say-summary",
      "summaryPlan": { "enabled": true }
    }
  }
}
```

### Transfer Mode Mapping

| Lumentra Setting | Vapi Mode                                              |
| ---------------- | ------------------------------------------------------ |
| Cold             | `blind-transfer`                                       |
| Warm             | `warm-transfer-say-summary`                            |
| Consultation     | `warm-transfer-experimental` (with transfer assistant) |
| Callback         | Custom tool (no built-in Vapi equivalent)              |

### Limitations

- No built-in multi-contact failover (must return to assistant and re-trigger)
- `warm-transfer-experimental` only works with Twilio, Vapi numbers, and SIP (not Telnyx/Vonage)
- 7.5 second timeout on `transfer-destination-request`
- No native callback tool -- keep existing `queue_callback` as custom function

---

## 5. Call Logging: end-of-call-report

Vapi sends a comprehensive report after each call:

```json
{
  "message": {
    "type": "end-of-call-report",
    "endedReason": "customer-ended-call",
    "durationSeconds": 180,
    "call": {
      "cost": 0.25,
      "costBreakdown": {
        "stt": 0.03,
        "llm": 0.01,
        "tts": 0.06,
        "vapi": 0.15,
        "transport": 0.0
      }
    },
    "artifact": {
      "transcript": "Agent: Hello... User: I need...",
      "messages": [
        /* structured with timestamps */
      ],
      "recording": { "url": "https://...", "stereoUrl": "https://..." }
    },
    "analysis": {
      "summary": "Caller booked an appointment for March 25.",
      "structuredData": {
        /* if configured */
      }
    }
  }
}
```

**Maps to existing call logging:**

- `durationSeconds` -> `duration_seconds`
- `call.customer.number` -> `caller_phone`
- `artifact.transcript` -> `transcript`
- `analysis.summary` -> `summary`
- `call.cost` -> new `vapi_cost` field for spend tracking
- `endedReason` -> `outcome_type` mapping

**IMPORTANT:** Vapi data retention is only 14 days on pay-as-you-go. Always store everything locally.

---

## 6. Human-Like Quality Configuration

### Voice Provider Recommendation

| Priority      | Provider              | Cost/min | Why                                     |
| ------------- | --------------------- | -------- | --------------------------------------- |
| Quality-first | ElevenLabs Flash v2.5 | $0.018   | 75ms TTFB, near-human quality           |
| Balanced      | Cartesia Sonic-3      | $0.022   | 40ms TTFB, good quality, already in use |
| Budget        | Deepgram Aura-2       | $0.011   | Clear and professional                  |

**Note:** Cartesia's `experimentalControls` (speed/emotion) are unreliable through Vapi's integration layer since mid-2025. ElevenLabs gives more reliable quality control.

### Quality Levers (Most Impact First)

1. **Turn Detection Tuning** -- reduces perceived latency by 1+ seconds

```json
{
  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingPlan": { "provider": "deepgram-flux" },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.1,
      "onNoPunctuationSeconds": 0.8,
      "onNumberSeconds": 0.5
    }
  }
}
```

2. **Backchanneling** -- "yeah", "got it", "I see" during caller speech

```json
{ "backchannelingEnabled": true }
```

3. **Filler Injection** -- "um", "so" to mask processing time

```json
{ "fillerInjectionEnabled": true }
```

4. **Background Sound** -- subtle office ambiance, not a void

```json
{ "backgroundSound": "office" }
```

5. **Noise Filtering** -- Krisp-powered denoising for caller audio

```json
{ "backgroundDenoisingEnabled": true }
```

6. **Acknowledgement Phrases** -- prevent AI stopping when caller says "uh-huh"

```json
{
  "stopSpeakingPlan": {
    "acknowledgementPhrases": [
      "yeah",
      "uh-huh",
      "ok",
      "got it",
      "right",
      "sure",
      "mm-hmm"
    ]
  }
}
```

7. **ElevenLabs Voice Tuning** (if using ElevenLabs)

```json
{
  "voice": {
    "provider": "11labs",
    "voiceId": "<id>",
    "model": "eleven_flash_v2_5",
    "stability": 0.45,
    "similarityBoost": 0.75,
    "style": 0,
    "speed": 1.0,
    "optimizeStreamingLatency": 4
  }
}
```

---

## 7. Cost Analysis

### Per-Minute Cost (BYOK, High Quality)

| Component    | Provider                | Cost/min        |
| ------------ | ----------------------- | --------------- |
| Vapi Hosting | --                      | $0.050          |
| Transport    | Vapi Telephony (free)   | $0.000          |
| STT          | Deepgram nova-3 (BYOK)  | $0.010          |
| LLM          | GPT-4.1 Mini (BYOK)     | ~$0.000         |
| TTS          | Cartesia Sonic-3 (BYOK) | $0.022          |
| **Total**    |                         | **~$0.082/min** |

### Monthly Estimates Per Tenant

| Scenario                                       | Minutes    | Cost  | Under $50?       |
| ---------------------------------------------- | ---------- | ----- | ---------------- |
| Low volume (5 missed calls/day, 3 min avg)     | ~450 min   | ~$37  | Yes              |
| Medium volume (10 missed calls/day, 3 min avg) | ~900 min   | ~$74  | No (at ~610 min) |
| High volume (20 missed calls/day)              | ~1,800 min | ~$148 | No               |

**$50 threshold = ~610 minutes/month** before LiveKit fallback kicks in.

### Cost Tracking

- `GET /call` API returns per-call `costBreakdown` (stt, llm, tts, vapi, transport, total)
- Accumulate in `vapi_usage` table per tenant per billing cycle
- Admin dashboard shows spend, never exposed to tenants

---

## 8. Gotchas and Mitigations

### Critical Issues

| Issue                                             | Severity | Mitigation                                              |
| ------------------------------------------------- | -------- | ------------------------------------------------------- |
| 63 incidents in 90 days                           | High     | LiveKit fallback, health monitoring                     |
| Webhooks intermittently fail to fire              | High     | Poll `GET /call` API as fallback for end-of-call data   |
| Breaking changes without warning                  | High     | Pin assistant config versions, test before rollout      |
| 14-day data retention                             | Medium   | Store all call data locally (already planned)           |
| 7.5s timeout on assistant-request                 | Medium   | Cache tenant configs in memory, fast DB lookups         |
| Tool result must be single-line string            | Low      | JSON.stringify() all results, strip newlines            |
| Trustpilot 2.3/5, no self-service cancellation    | Medium   | Use prepaid/virtual card, document cancellation process |
| No native multi-tenant support                    | Low      | Already building all tenant management ourselves        |
| Cartesia emotion controls unreliable through Vapi | Low      | Consider ElevenLabs or accept default Cartesia quality  |

### Defensive Architecture Checklist

- [ ] Store all call data locally (transcripts, recordings, costs) -- do not rely on Vapi retention
- [ ] Build polling fallback for end-of-call data (cron checks `GET /call` for calls without end-of-call webhook)
- [ ] Cache tenant configs for < 7.5s response on assistant-request
- [ ] Implement webhook signature verification (Bearer token or HMAC)
- [ ] Track Vapi spend per tenant in `vapi_usage` table
- [ ] Build provider switch logic (flip tenant from `vapi` to `livekit` based on spend)
- [ ] Keep LiveKit agent code functional and tested
- [ ] Monitor Vapi status page / set up alerts
- [ ] Use virtual/prepaid card for Vapi billing

---

## 9. Database Changes Required

### Tenants Table (add columns)

- `vapi_phone_number_id` -- Vapi's phone number ID
- `vapi_phone_number` -- the actual forwarding number (shown to tenant)
- `provider` -- enum: `vapi` | `livekit` (default: `vapi`)

### New Table: `vapi_usage`

```sql
CREATE TABLE vapi_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  billing_cycle TEXT NOT NULL, -- '2026-03'
  total_cost DECIMAL(10,4) DEFAULT 0,
  total_minutes DECIMAL(10,2) DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, billing_cycle)
);
```

### What Gets Deprecated (dormant, not removed)

- SignalWire phone provisioning (phone-config.ts)
- LiveKit SIP trunk registration
- Python agent (lumentra-agent/)
- Internal API agent routes (/internal/tenants/by-phone, /internal/voice-tools, /internal/calls/log)

---

## 10. New API Endpoint: `/webhooks/vapi`

Single webhook endpoint handling all Vapi events:

```
POST /webhooks/vapi
Authorization: Bearer {VAPI_WEBHOOK_SECRET}
```

**Event routing:**
| Event | Handler | Maps To |
|---|---|---|
| `assistant-request` | Build assistant config from tenant lookup | Replaces agent.py config loading |
| `tool-calls` | Route to executeTool() | Replaces /internal/voice-tools/:action |
| `transfer-destination-request` | Select escalation contact | Replaces agent.py transfer logic |
| `end-of-call-report` | Log call + track Vapi spend | Replaces /internal/calls/log |
| `status-update` | Update call status, emit SSE events | Replaces agent call_logger |
| `transcript` | Real-time transcript to dashboard | New capability |

---

## 11. Implementation Phases

### Phase 1: Webhook Endpoint + Config Builder (Backend)

- New route: `/webhooks/vapi`
- `assistant-request` handler: tenant lookup by Vapi phone number -> build assistant config
- `tool-calls` handler: translate Vapi format -> executeTool() -> translate response
- `end-of-call-report` handler: log call + accumulate Vapi spend
- `transfer-destination-request` handler: select escalation contacts
- Migration: add columns to tenants, create vapi_usage table
- Auth: Bearer token verification

### Phase 2: Phone Number Provisioning (Backend)

- Vapi SDK integration (buy/import numbers)
- Replace or augment phone-config.ts with Vapi number management
- Store vapi_phone_number_id on tenant

### Phase 3: Dashboard Updates

- Setup flow: show Vapi number as "your AI forwarding number"
- Settings: voice/personality/tools sync to Vapi config (no UI changes needed -- same settings, different backend)
- Admin: Vapi spend tracking per tenant
- Admin: provider override toggle (vapi/livekit)

### Phase 4: LiveKit Fallback Logic

- Per-call spend check before routing
- Provider column on tenant controls routing
- Automated flip when spend threshold exceeded
- Manual admin override

---

## Source Reports (Detailed)

1. [Webhook System](vapi-server-url-webhook-system-2026.md) -- Event types, payloads, auth
2. [Assistant API](vapi-assistant-api-2026.md) -- CRUD, config options, BYOK
3. [Call Transfers](vapi-call-transfer-capabilities-2026.md) -- 8 modes, consultation, dynamic routing
4. [Phone Numbers](vapi-phone-number-api-2026.md) -- Providers, limits, multi-tenant patterns
5. [Human-Like Quality](vapi-human-like-voice-quality-2026.md) -- Voice config, turn detection, backchanneling
6. [Gotchas & Limitations](vapi-gotchas-limitations-2026.md) -- 14 critical issues
7. [Pricing Deep Dive](vapi-pricing-deep-dive-2026.md) -- Cost breakdown, BYOK, optimization
