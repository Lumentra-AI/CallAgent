# Vapi Call Transfer Capabilities -- Deep Research (2026-03-22)

## Sources

- https://docs.vapi.ai/call-forwarding (transferCall tool overview)
- https://docs.vapi.ai/calls/assistant-based-warm-transfer (warm transfer with AI assistant)
- https://docs.vapi.ai/calls/call-dynamic-transfers (dynamic routing via server)
- https://docs.vapi.ai/tools/default-tools (default tool configs)
- https://docs.vapi.ai/squads/handoff (squad-based handoff)
- https://docs.vapi.ai/server-url/events (webhook events)
- https://docs.vapi.ai/api-reference/tools/create (full transferCall schema)
- https://docs.vapi.ai/calls/call-features (live call control API)
- https://docs.vapi.ai/phone-calling/in-call-control/transfer-calls/debug-forwarding-drops
- https://docs.vapi.ai/assistants/assistant-hooks (transfer hooks)
- https://docs.vapi.ai/phone-numbers/phone-number-hooks (phone-level transfer hooks)
- https://docs.vapi.ai/assistants/examples/support-escalation (multi-tier escalation example)
- https://docs.vapi.ai/calls/call-ended-reason (transfer end reasons)
- https://docs.vapi.ai/advanced/sip/sip-trunk (SIP transfer config)
- https://docs.vapi.ai/tools/voicemail-tool (voicemail/callback)
- https://docs.vapi.ai/calls/voicemail-detection (voicemail during transfers)
- https://docs.vapi.ai/squads/silent-handoffs (silent vs warm handoffs)

---

## 1. How Vapi Transfers Calls to Human Agents

Vapi uses the `transferCall` default tool. It is added to the assistant's `tools` array and the LLM decides when to invoke it based on conversation context and system prompt instructions.

### Tool Configuration (JSON)

```json
{
  "type": "transferCall",
  "destinations": [
    {
      "type": "number",
      "number": "+16054440129",
      "extension": "4603",
      "message": "Forwarding your call. Please stay on the line.",
      "transferPlan": {
        "mode": "blind-transfer"
      }
    }
  ],
  "function": {
    "name": "transferCall",
    "parameters": {
      "type": "object",
      "properties": {
        "destination": {
          "type": "string",
          "enum": ["+16054440129"]
        }
      }
    }
  },
  "messages": [
    { "type": "request-start", "content": "Transferring you now..." },
    { "type": "request-complete", "content": "You are now connected." },
    { "type": "request-failed", "content": "Transfer was unsuccessful." }
  ]
}
```

### Three Destination Types

| Type         | Config Key            | Format                   | Notes                                |
| ------------ | --------------------- | ------------------------ | ------------------------------------ |
| Phone number | `"type": "number"`    | E.164 (`+1234567890`)    | Supports `extension`, `callerId`     |
| SIP endpoint | `"type": "sip"`       | `sip:user@domain.com`    | Supports `sipHeaders`, `callerId`    |
| Assistant    | `"type": "assistant"` | `assistantName: "Sales"` | Squad handoff, not external transfer |

### Transfer Invocation Methods

1. **LLM-initiated**: Model calls `transferCall` function with destination parameter
2. **Dynamic (server-controlled)**: Empty `destinations` array + server responds to `transfer-destination-request` webhook
3. **Live Call Control API**: POST to `controlUrl` with `{"type": "transfer", "destination": {...}}`
4. **Phone number hook**: Auto-transfer on `call.ringing` event
5. **Assistant hook**: Auto-transfer on `call.ending` event (e.g., pipeline error fallback)

---

## 2. Transfer Plan Modes -- Warm vs Cold vs Everything In Between

Vapi supports **8 transfer plan modes** via the `transferPlan.mode` field:

### All 8 Modes

| Mode                                                                  | Type      | Behavior                                                                                                                   |
| --------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `blind-transfer`                                                      | Cold      | Immediate handoff, no context to recipient. **Default.**                                                                   |
| `blind-transfer-add-summary-to-sip-header`                            | Cold      | Immediate handoff, AI summary injected into SIP header                                                                     |
| `warm-transfer-say-message`                                           | Warm      | Dials destination, plays a fixed message to operator, then connects caller                                                 |
| `warm-transfer-say-summary`                                           | Warm      | Dials destination, plays AI-generated conversation summary to operator, then connects                                      |
| `warm-transfer-wait-for-operator-to-speak-first-and-then-say-message` | Warm      | Dials destination, waits for operator to speak, then plays fixed message, then connects                                    |
| `warm-transfer-wait-for-operator-to-speak-first-and-then-say-summary` | Warm      | Dials destination, waits for operator to speak, then plays AI summary, then connects                                       |
| `warm-transfer-twiml`                                                 | Warm      | Executes TwiML instructions (Play, Say, Gather, Pause) on destination side before connecting. Max 4096 chars, Twilio-only. |
| `warm-transfer-experimental`                                          | Warm (AI) | Full AI-driven consultation transfer with a dedicated transfer assistant. Most advanced.                                   |

### Comparison: Lumentra vs Vapi Transfer Types

| Feature                           | Lumentra (LiveKit)         | Vapi                                       |
| --------------------------------- | -------------------------- | ------------------------------------------ |
| Cold transfer                     | SIP REFER                  | `blind-transfer`                           |
| Warm transfer (message)           | N/A                        | `warm-transfer-say-message`                |
| Warm transfer (summary)           | N/A                        | `warm-transfer-say-summary`                |
| Warm transfer (wait for operator) | N/A                        | `warm-transfer-wait-for-operator-*`        |
| Consultation transfer             | Custom SIP + DTMF          | `warm-transfer-experimental` (AI-driven)   |
| Callback                          | Custom queue_callback tool | Custom tool (not built-in)                 |
| Hold music                        | BackgroundAudioPlayer      | `holdAudioUrl` on transferPlan             |
| SIP header context                | N/A                        | `blind-transfer-add-summary-to-sip-header` |
| TwiML execution                   | N/A                        | `warm-transfer-twiml`                      |

---

## 3. Transfer to Phone Number vs SIP Endpoint

### Phone Number Destination

```json
{
  "type": "number",
  "number": "+14155551234",
  "extension": "4603",
  "callerId": "+19876543210",
  "numberE164CheckEnabled": true,
  "message": "Connecting you to sales.",
  "transferPlan": {
    "mode": "warm-transfer-say-summary",
    "summaryPlan": {
      "enabled": true,
      "timeoutSeconds": 5,
      "messages": [
        { "role": "system", "content": "Summarize in 2-3 sentences" },
        { "role": "user", "content": "Transcript: {{transcript}}" }
      ]
    }
  }
}
```

### SIP Destination

```json
{
  "type": "sip",
  "sipUri": "sip:14039932200@sip.telnyx.com",
  "callerId": "+19876543210",
  "sipHeaders": {
    "X-Custom-Header": "value"
  },
  "transferPlan": {
    "mode": "blind-transfer-add-summary-to-sip-header",
    "sipVerb": "refer"
  }
}
```

### SIP Verb Options

- `refer` -- Uses SIP REFER (default). Standard transfer signaling.
- `bye` -- Ends current call with SIP BYE.
- `dial` -- Uses SIP DIAL to place a new call to destination. Supports `dialTimeout`.

### Supported Transfer Matrix

| From  | To Phone                   | To SIP | To Web |
| ----- | -------------------------- | ------ | ------ |
| Phone | Yes                        | Yes    | N/A    |
| SIP   | Yes                        | Yes    | N/A    |
| Web   | **NO -- will always drop** | **NO** | N/A    |

**Critical limitation: Web-to-phone and PSTN-to-SIP transfers are unsupported and will drop.**

---

## 4. What Happens During Transfer

### Hold Music / Announcements

The `messages` array on the transferCall tool controls what the **caller** hears:

- `request-start`: Spoken to caller when transfer initiates ("I'm transferring you now...")
- `request-complete`: In `warm-transfer-experimental` mode, this can be an **audio URL** played as hold music to the caller while the transfer assistant talks to the operator. If omitted, Vapi's default ringtone plays.
- `request-failed`: Spoken to caller if transfer fails ("I wasn't able to reach anyone...")
- `request-response-delayed`: Spoken if server takes too long to respond

### Custom Hold Audio (warm-transfer-experimental)

```json
{
  "transferPlan": {
    "mode": "warm-transfer-experimental",
    "holdAudioUrl": "https://example.com/hold-music.mp3"
  }
}
```

Supported formats: MP3, WAV.

### Timing

- `timeout`: Ring timeout in seconds (default 60). Used for `warm-transfer-wait-for-operator-*` modes.
- `dialTimeout`: SIP DIAL timeout (default 60). Only applies when `sipVerb: "dial"`.

---

## 5. Transfer Failure Handling

### FallbackPlan (warm-transfer-experimental only)

```json
{
  "transferPlan": {
    "mode": "warm-transfer-experimental",
    "fallbackPlan": {
      "message": "I'm sorry, I wasn't able to connect you with a representative. Can I help you with anything else?",
      "endCallEnabled": false
    }
  }
}
```

- `message`: Spoken to caller if transfer fails
- `endCallEnabled`: If `true` (default), call ends after failure message. If `false`, assistant resumes conversation with caller.

### Transfer Failure Indicators (endedReason values)

| endedReason                                                            | Meaning                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `assistant-forwarded-call`                                             | Transfer succeeded (call ended normally after forward) |
| `assistant-request-returned-forwarding-phone-number`                   | Forwarding action triggered                            |
| `call.forwarding.operator-busy`                                        | Operator was busy during forwarding                    |
| `call.ringing.hook-executed-transfer`                                  | Transfer hook executed during ringing                  |
| `call.in-progress.error-sip-telephony-provider-failed-to-connect-call` | SIP provider failed to connect                         |

### Failure Detection in Non-Experimental Modes

For modes other than `warm-transfer-experimental`, there is **no built-in fallback mechanism**. The `request-failed` message plays, and the call typically ends. There is no automatic retry to a secondary destination.

### Debug Workflow for Transfer Drops

1. Check `endedReason` field -- `assistant-forwarded-call` means Vapi initiated successfully
2. Verify no `phone-call-control` in `serverMessages` (overrides default behavior)
3. Check `phoneCallProviderBypassEnabled` is `false`
4. Review telephony provider logs using `phoneCallProviderId`
5. Analyze SIP REFER packets via Wireshark (SIP calls only)

---

## 6. Consultation Transfer (AI Briefing the Human)

### warm-transfer-experimental: Full AI-Driven Consultation

This is Vapi's most advanced transfer mode. A **dedicated AI transfer assistant** calls the destination, briefs the operator, and decides whether to complete or cancel the transfer.

#### Flow

1. Caller requests transfer -> main assistant invokes transferCall
2. Caller hears hold music (from `holdAudioUrl` or default ringtone)
3. Transfer assistant dials the destination number
4. Transfer assistant speaks `firstMessage` to operator ("Hello, I have a customer on the line...")
5. Transfer assistant follows its system prompt -- briefs operator on caller's issue
6. Operator confirms availability
7. Transfer assistant calls `transferSuccessful` tool -> parties connected, AI removed
8. OR: Operator declines / voicemail / timeout -> `transferCancel` tool -> caller returned to main assistant

#### Configuration

```json
{
  "type": "transferCall",
  "destinations": [
    {
      "type": "number",
      "number": "+14155551234",
      "transferPlan": {
        "mode": "warm-transfer-experimental",
        "holdAudioUrl": "https://example.com/hold-music.mp3",
        "transferAssistant": {
          "firstMessage": "Hello, I have a customer on the line who needs help with a billing issue. Are you available?",
          "firstMessageMode": "assistant-speaks-first",
          "maxDurationSeconds": 120,
          "silenceTimeoutSeconds": 30,
          "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [
              {
                "role": "system",
                "content": "You are a transfer coordinator. Brief the operator about the customer's issue. Use transferSuccessful if operator is available and human. Use transferCancel if voicemail, busy, or declined."
              }
            ]
          }
        }
      }
    }
  ],
  "messages": [
    {
      "type": "request-start",
      "content": "Let me connect you with a specialist. One moment please."
    },
    {
      "type": "request-failed",
      "content": "I wasn't able to reach anyone. Can I help you with anything else?"
    }
  ]
}
```

#### Transfer Assistant Built-in Tools

- `transferSuccessful`: Merges calls, removes AI, connects caller to operator directly
- `transferCancel`: Disconnects from operator, returns caller to original assistant

#### Limitations

- `warm-transfer-experimental` does NOT support Telnyx or Vonage. Works only with Twilio, Vapi phone numbers, and SIP trunks.
- Bounded by `maxDurationSeconds` -- cannot ring indefinitely
- Built-in tools (`transferSuccessful`, `transferCancel`) are immutable
- Transfer assistant has automatic access to conversation history

### Simpler Warm Transfer Options (No AI Consultation)

For briefing without a full AI assistant:

**warm-transfer-say-summary**: AI generates a conversation summary and plays it via TTS to the operator before connecting the caller. No interactive consultation.

**warm-transfer-say-message**: A fixed message is played to the operator before connecting. E.g., "This caller has a billing question about their March invoice."

**warm-transfer-wait-for-operator-to-speak-first-and-then-say-summary**: Same as above, but waits for operator to speak first (e.g., "Hello?") before playing the summary. More natural.

---

## 7. Configuring Transfer Destinations Per Assistant

### Static Destinations (Pre-configured)

```json
{
  "tools": [
    {
      "type": "transferCall",
      "destinations": [
        {
          "type": "number",
          "number": "+15551234567",
          "message": "Sales department"
        },
        {
          "type": "number",
          "number": "+15559876543",
          "message": "Support team"
        },
        {
          "type": "sip",
          "sipUri": "sip:billing@company.com",
          "message": "Billing"
        }
      ],
      "function": {
        "name": "transferCall",
        "parameters": {
          "type": "object",
          "properties": {
            "destination": {
              "type": "string",
              "enum": [
                "+15551234567",
                "+15559876543",
                "sip:billing@company.com"
              ]
            }
          }
        }
      }
    }
  ]
}
```

### Dynamic Destinations (Server-Controlled)

Leave `destinations` array empty. The LLM triggers the transfer, Vapi sends a `transfer-destination-request` webhook to your server, and your server returns the destination.

```json
{
  "tools": [
    {
      "type": "transferCall",
      "destinations": [],
      "function": {
        "name": "escalateToSupport",
        "parameters": {
          "type": "object",
          "properties": {
            "issue_category": {
              "type": "string",
              "enum": ["technical", "billing", "account"]
            },
            "complexity_level": {
              "type": "string",
              "enum": ["basic", "intermediate", "advanced", "critical"]
            }
          }
        }
      }
    }
  ]
}
```

Server receives `transfer-destination-request` and responds:

```json
{
  "destination": {
    "type": "number",
    "number": "+15551234567",
    "message": "Connecting you to our technical specialist.",
    "transferPlan": {
      "mode": "warm-transfer-say-summary",
      "summaryPlan": {
        "enabled": true,
        "timeoutSeconds": 5
      }
    }
  }
}
```

### Per-Department Transfer Plans (Support Escalation Example)

Different departments can have different transfer modes:

- Enterprise/critical -> `warm-transfer-say-summary` (operator gets full AI summary)
- Standard technical -> `warm-transfer-say-message` (operator gets brief context)
- Billing -> `blind-transfer` (direct handoff)
- General fallback -> `blind-transfer` with generic greeting

---

## 8. Transfer Events / Webhooks

### Events Requiring Server Response

#### transfer-destination-request

Fired when assistant triggers transfer without specifying destination (empty destinations array).

**Must respond within 7.5 seconds.**

```json
// Incoming webhook
{
  "message": {
    "type": "transfer-destination-request",
    "call": { /* full Call object */ }
  }
}

// Required response
{
  "destination": {
    "type": "number",
    "number": "+11234567890"
  },
  "message": {
    "type": "request-start",
    "message": "Transferring you now"
  }
}
```

### Informational Events (No Response Required)

#### transfer-update

Fires when a transfer actually executes.

```json
{
  "message": {
    "type": "transfer-update",
    "destination": {
      "type": "number",
      "number": "+14155551234"
    }
  }
}
```

#### status-update

Status values include `forwarding` as a transfer-specific state:

```json
{
  "message": {
    "type": "status-update",
    "status": "forwarding",
    "call": {
      /* Call object */
    }
  }
}
```

Status flow during transfer: `in-progress` -> `forwarding` -> `ended`

#### end-of-call-report

Includes `endedReason` indicating transfer outcome:

```json
{
  "message": {
    "type": "end-of-call-report",
    "endedReason": "assistant-forwarded-call",
    "call": { /* Call object */ },
    "artifact": {
      "transcript": "...",
      "messages": [...],
      "recording": { /* URLs */ }
    }
  }
}
```

### Notable Absence

There is **no dedicated `transfer-failed` or `transfer-completed` webhook event**. Transfer outcomes are inferred from:

- `endedReason` in `end-of-call-report`
- `status-update` transitions
- `transfer-update` fires only on execution, not on failure

---

## 9. Multiple Destinations / Ring Groups / Failover

### Built-in Multi-Destination: Limited

Vapi does NOT have native ring group or automatic failover support. The `destinations` array defines **options the LLM can choose from**, not a failover chain.

### Achieving Failover

**Option A: warm-transfer-experimental with fallbackPlan**
If the first destination fails, the `transferCancel` tool returns the caller to the main assistant. The main assistant can then attempt transfer to the next destination. This requires prompt engineering to instruct retry behavior.

**Option B: Dynamic routing via server**
Use empty destinations + `transfer-destination-request` webhook. Server-side logic implements:

- Agent availability checking
- Round-robin or priority-based routing
- CRM-based tier routing (enterprise -> priority line)
- Time-of-day routing

**Option C: Twilio queue management**
For high-volume: Route transfers to Twilio queues with hold music and sequential agent distribution.

**Option D: Squad handoff**
Transfer between AI assistants (not human agents). Supports multiple destinations with the handoff tool.

### No Native Ring Group

There is no "ring all" or "ring in sequence" feature. Each transfer attempt goes to one destination. Multiple attempts require returning to the assistant and re-triggering.

---

## 10. forwardingPhoneNumber Config

### On the Phone Number Object

When creating/updating a Vapi phone number, `forwardingPhoneNumber` can be set to automatically forward all inbound calls to a specific number, bypassing the AI assistant entirely.

### On assistant-request Webhook Response

When responding to `assistant-request`, returning a `destination` instead of an `assistant` causes immediate transfer without AI interaction:

```json
// Response to assistant-request
{
  "destination": {
    "type": "number",
    "number": "+11234567890"
  }
}
```

### On Phone Number Hooks

Phone-level hooks can auto-transfer on ring:

```json
{
  "hooks": [
    {
      "on": "call.ringing",
      "do": [
        {
          "type": "transfer",
          "destination": {
            "type": "number",
            "number": "+1234567890",
            "callerId": "+1987654321"
          }
        }
      ]
    }
  ]
}
```

### On Assistant Hooks (Fallback Transfer)

Auto-transfer when call is ending due to error:

```json
{
  "hooks": [
    {
      "on": "call.ending",
      "filters": [
        {
          "type": "oneOf",
          "key": "call.endedReason",
          "oneOf": ["pipeline-error"]
        }
      ],
      "do": [
        { "type": "say", "exact": "Let me transfer you to our team." },
        {
          "type": "tool",
          "tool": {
            "type": "transferCall",
            "destinations": [
              {
                "type": "number",
                "number": "+1234567890"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## 11. Callback Support

Vapi does NOT have a built-in callback tool. Options:

### Custom Tool Approach

Create a custom tool that the LLM calls to collect callback information and POST to your server:

```json
{
  "type": "function",
  "function": {
    "name": "request_callback",
    "description": "Schedule a callback when no agent is available",
    "parameters": {
      "type": "object",
      "properties": {
        "caller_name": { "type": "string" },
        "phone_number": { "type": "string" },
        "preferred_time": { "type": "string" },
        "reason": { "type": "string" }
      },
      "required": ["phone_number", "reason"]
    }
  },
  "server": {
    "url": "https://your-server.com/api/callbacks"
  }
}
```

### Voicemail Tool

Vapi has a built-in voicemail tool for outbound calls that detects voicemail systems and leaves messages. Not directly usable for inbound callback scheduling.

---

## 12. Squad Handoffs (AI-to-AI Transfer)

Separate from human agent transfers, Vapi Squads enable multi-assistant workflows:

### Handoff Tool

```json
{
  "type": "handoff",
  "destinations": [
    {
      "type": "assistant",
      "assistantName": "BillingSpecialist",
      "contextEngineeringPlan": { "type": "all" }
    }
  ]
}
```

### Context Options

- `"type": "all"` -- Full conversation history
- `"type": "lastNMessages"` -- Last N messages only
- `"type": "userAndAssistantMessages"` -- Filter out system/tool messages
- `"type": "none"` -- Fresh start

### Silent Handoffs

No verbal announcement; set `firstMessage: ""` and `messages: []` on the handoff tool.

### Dynamic Squad Routing

Server responds to `handoff-destination-request` webhook with runtime-determined destination.

---

## 13. Key Limitations and Gotchas

1. **Web-to-phone transfers always drop.** PSTN-to-SIP also unsupported.
2. **warm-transfer-experimental only works with Twilio, Vapi numbers, and SIP trunks.** Not Telnyx or Vonage.
3. **TwiML mode limited to 4096 characters.**
4. **No native ring group or failover chain.** Must implement via server logic or prompt engineering.
5. **No built-in callback tool.** Must build custom.
6. **transfer-destination-request has 7.5 second timeout.** Server must respond fast.
7. **No dedicated transfer-failed webhook.** Must infer from endedReason.
8. **Voicemail detection during warm transfer** only supported by Google and OpenAI providers.
9. **SIP REFER must be enabled** with your SIP provider for SIP transfers to work.
10. **IP-based SIP auth not recommended** due to shared infrastructure routing issues.

---

## 14. Comparison with Lumentra's Current Implementation

| Capability                   | Lumentra (LiveKit Agents)           | Vapi                                                                    |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| Cold transfer                | SIP REFER, manual implementation    | `blind-transfer` (built-in)                                             |
| Warm transfer                | Custom hold music + SIP REFER       | 6 warm modes (message, summary, wait-for-operator, TwiML, experimental) |
| Consultation transfer        | Custom SIP + DTMF accept/decline    | `warm-transfer-experimental` with AI transfer assistant                 |
| Callback                     | Custom `queue_callback` tool + DB   | Custom tool (not built-in)                                              |
| Transfer context to operator | Manual via custom tools             | AI-generated summary, SIP headers, TwiML                                |
| Hold music                   | BackgroundAudioPlayer (self-hosted) | `holdAudioUrl` or default ringtone                                      |
| Dynamic routing              | Custom API + escalation_contacts    | `transfer-destination-request` webhook                                  |
| Multi-destination failover   | Custom retry logic in agent.py      | No built-in; server logic or prompt engineering                         |
| Transfer events              | Custom SSE (EscalationEventBus)     | `transfer-update`, `status-update`, `end-of-call-report`                |
| SIP transfer                 | SIP REFER (self-hosted LiveKit)     | SIP REFER/BYE/DIAL (cloud)                                              |
| Targeted transfer            | Fuzzy match on role/name            | Custom tool params + server routing                                     |
| Voicemail on transfer        | Not implemented                     | Voicemail detection (Google/OpenAI) in experimental mode                |

### What Vapi Does Better

- 8 built-in transfer modes vs Lumentra's manual SIP REFER
- AI-generated summaries played to operators automatically
- `warm-transfer-experimental` is a full consultation transfer without custom SIP/DTMF logic
- Transfer plan is a simple JSON config, not custom Python code
- Built-in hold music via URL
- Dashboard tool creation (no code needed for basic transfers)

### What Lumentra Does Better

- Full control over transfer logic (self-hosted)
- Custom retry/failover chain across multiple contacts
- Built-in callback system with queue and scheduling
- Real-time SSE events to dashboard
- No vendor lock-in on telephony provider
- No 7.5s webhook timeout constraint
- SIP trunk auto-registration per tenant
- Targeted transfer by role/name matching
