# Vapi Server URL Webhook System -- Deep Research (2026-03-22)

Sources: docs.vapi.ai/server-url, docs.vapi.ai/server-url/events, docs.vapi.ai/server-url/server-authentication, docs.vapi.ai/tools/custom-tools, docs.vapi.ai/server-url/setting-server-urls, docs.vapi.ai/api-reference/webhooks/server-message, VapiAI/server-side-example-python-flask (GitHub)

---

## 1. Overview

Vapi Server URLs are **bidirectional webhook endpoints** -- not just fire-and-forget. The server receives events AND can return responses that influence live call behavior (dynamic assistant config, tool results, transfer destinations).

All messages are HTTP `POST` requests with JSON body. The core structure is:

```json
{
  "message": {
    "type": "<event-type>",
    "call": { /* Call Object -- always present */ },
    ...event-specific fields
  }
}
```

---

## 2. Server URL Priority Hierarchy

Server URLs can be set at four levels. Higher specificity wins:

| Priority    | Level                      | Scope                     |
| ----------- | -------------------------- | ------------------------- |
| 1 (highest) | Function/Tool level        | Per-tool `server.url`     |
| 2           | Assistant level            | `assistant.server.url`    |
| 3           | Phone number level         | Phone number `server.url` |
| 4 (lowest)  | Organization/Account level | Dashboard org settings    |

Configuration at any level:

```json
{
  "server": {
    "url": "https://api.example.com/webhook",
    "credentialId": "cred_xxx", // optional, references stored credential
    "timeoutSeconds": 20, // default 20s
    "backoffPlan": {
      // optional retry config
      "type": "fixed|exponential",
      "maxRetries": 0,
      "baseDelaySeconds": 1
    }
  }
}
```

### Controlling Which Events Are Sent

The `serverMessages` array on the assistant controls which event types are dispatched to the server URL. If omitted, defaults apply. You can add/remove event types like `"speech-update"`, `"transcript"`, `"model-output"`, etc.

---

## 3. Complete Event Reference

### Events REQUIRING a Response (Synchronous)

#### 3.1 `assistant-request`

**When:** Inbound call arrives and NO `assistantId`, `squadId`, or `workflowId` is pre-configured on the phone number.

**Timeout:** 7.5 seconds -- must respond within this window.

**Payload:**

```json
{
  "message": {
    "type": "assistant-request",
    "call": {
      "id": "call-uuid",
      "type": "inboundPhoneCall",
      "status": "ringing",
      "phoneNumberId": "pn_xxx",
      "customer": {
        "number": "+14155551234"
      }
    }
  }
}
```

**Response options (return ONE):**

Option A -- Return a saved assistant by ID:

```json
{
  "assistantId": "asst_xxx"
}
```

Option B -- Return inline (transient) assistant config:

```json
{
  "assistant": {
    "name": "My Agent",
    "firstMessage": "Hello, thanks for calling!",
    "model": {
      "provider": "openai",
      "model": "gpt-4o",
      "temperature": 0.7,
      "systemPrompt": "You are a helpful receptionist...",
      "functions": [
        {
          "name": "book_appointment",
          "description": "Book an appointment",
          "parameters": {
            "type": "object",
            "properties": {
              "date": { "type": "string" },
              "time": { "type": "string" }
            },
            "required": ["date", "time"]
          }
        }
      ]
    },
    "voice": {
      "provider": "11labs",
      "voiceId": "voice-id-here"
    },
    "serverUrl": "https://api.example.com/webhook",
    "serverMessages": ["end-of-call-report", "status-update", "tool-calls"]
  }
}
```

Option C -- Return a squad or workflow:

```json
{ "squadId": "squad_xxx" }
// or
{ "workflowId": "wf_xxx" }
```

Option D -- Reject the call (spam filtering):

```json
{
  "error": "Sorry, your number has been blocked."
}
```

The error message is spoken to the caller, then the call is terminated.

**Key use case:** Multi-tenant systems. Extract `call.customer.number` (caller) and the called number to look up the tenant, then return a tenant-specific assistant config with custom system prompt, tools, voice, etc.

---

#### 3.2 `tool-calls`

**When:** The LLM invokes a tool/function during conversation.

**Payload:**

```json
{
  "message": {
    "type": "tool-calls",
    "call": {
      /* Call Object */
    },
    "assistant": {
      /* Assistant config */
    },
    "timestamp": 1678901234567,
    "toolCallList": [
      {
        "id": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
        "name": "get_weather",
        "arguments": {
          "location": "San Francisco"
        }
      }
    ],
    "toolWithToolCallList": [
      {
        "type": "function",
        "name": "get_weather",
        "description": "Retrieves current weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": { "type": "string" }
          }
        },
        "server": {
          "url": "https://api.example.com/weather"
        },
        "messages": [],
        "toolCall": {
          "id": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
          "type": "function",
          "function": {
            "name": "get_weather",
            "parameters": {
              "location": "San Francisco"
            }
          }
        }
      }
    ]
  }
}
```

**`toolCallList`** = simplified array: just `id`, `name`, `arguments`. Use this for routing.
**`toolWithToolCallList`** = enriched array: includes the full tool definition + the tool call. Useful if your server needs to inspect the tool schema.

**Required response format:**

```json
{
  "results": [
    {
      "toolCallId": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
      "result": "The weather in San Francisco is 62F, partly cloudy."
    }
  ]
}
```

**CRITICAL response rules:**

- MUST return HTTP 200 (any other status is ignored)
- `toolCallId` MUST match the `id` from the request
- `result` MUST be a **single-line string** (line breaks cause parsing errors)
- Both `result` and `error` fields must be strings, never objects/arrays
- Always wrap in `results` array, even for a single tool call
- For multiple simultaneous tool calls, return all results in the same array with matching `toolCallId` values

**Error response:**

```json
{
  "results": [
    {
      "toolCallId": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
      "error": "Weather service is currently unavailable"
    }
  ]
}
```

**Tool-call response with spoken message (ToolCallResultMessage):**
The response can also specify what the assistant says, using this richer format:

```json
{
  "results": [
    {
      "toolCallId": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
      "result": "Appointment booked successfully",
      "message": {
        "type": "request-complete",
        "content": "I've booked your appointment for tomorrow at 3 PM.",
        "role": "assistant",
        "endCallAfterSpokenEnabled": false
      }
    }
  ]
}
```

Or on failure:

```json
{
  "results": [
    {
      "toolCallId": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
      "error": "No slots available",
      "message": {
        "type": "request-failed",
        "content": "I'm sorry, there are no available slots for that date.",
        "role": "assistant"
      }
    }
  ]
}
```

---

#### 3.3 `transfer-destination-request`

**When:** The LLM initiates a transfer without a pre-configured destination.

**Payload:**

```json
{
  "message": {
    "type": "transfer-destination-request",
    "call": {
      /* Call Object */
    }
  }
}
```

**Response:**

```json
{
  "destination": {
    "type": "number",
    "number": "+14155551234",
    "transferPlan": {
      "mode": "blind-transfer",
      "message": "Please hold while I transfer you."
    }
  }
}
```

Transfer modes: `blind-transfer`, `warm-transfer-say-message`, `warm-transfer-wait-for-operator-to-speak-first`, `warm-transfer-say-summary`.

SIP destination:

```json
{
  "destination": {
    "type": "sip",
    "sipUri": "sip:agent@example.com",
    "transferPlan": {
      "mode": "blind-transfer"
    }
  }
}
```

---

#### 3.4 `knowledge-base-request`

**When:** A custom knowledge base with `provider = "custom-knowledge-base"` is queried.

**Payload:**

```json
{
  "message": {
    "type": "knowledge-base-request",
    "messages": [
      /* conversation history */
    ],
    "messagesOpenAIFormatted": [
      /* OpenAI-format messages */
    ]
  }
}
```

**Response:**

```json
{
  "documents": [
    {
      "content": "Our business hours are Monday-Friday 9am-5pm.",
      "similarity": 0.95,
      "uuid": "doc-uuid-123"
    }
  ]
}
```

---

### Informational Events (No Response Required)

Return `{}` or any body with HTTP 200. Response content is ignored.

#### 3.5 `status-update`

**When:** Call status changes.

```json
{
  "message": {
    "type": "status-update",
    "status": "in-progress",
    "call": {
      /* Call Object */
    }
  }
}
```

Possible statuses: `scheduled`, `queued`, `ringing`, `in-progress`, `forwarding`, `ended`.

When `status` is `"ended"`, the `endedReason` field is present (see Section 5 for all reason codes).

---

#### 3.6 `end-of-call-report`

**When:** After call ends. Contains the full call summary.

```json
{
  "message": {
    "type": "end-of-call-report",
    "endedReason": "customer-ended-call",
    "call": {
      "id": "call-uuid",
      "orgId": "org-uuid",
      "type": "inboundPhoneCall",
      "status": "ended",
      "startedAt": "2026-03-22T10:00:00.000Z",
      "endedAt": "2026-03-22T10:05:32.000Z",
      "cost": 0.15,
      "costBreakdown": {
        "stt": 0.02,
        "llm": 0.08,
        "tts": 0.03,
        "vapi": 0.02,
        "transport": 0.0,
        "total": 0.15
      },
      "phoneNumber": { "id": "pn_xxx", "number": "+18005551234" },
      "customer": { "number": "+14155551234" },
      "assistant": {
        /* assistant config used */
      },
      "metadata": {
        /* custom metadata if set */
      }
    },
    "artifact": {
      "recording": {
        "url": "https://storage.vapi.ai/recordings/call-uuid.wav",
        "stereoUrl": "https://storage.vapi.ai/recordings/call-uuid-stereo.wav"
      },
      "transcript": "Agent: Hello, thanks for calling. How can I help?\nUser: I'd like to book an appointment...",
      "messages": [
        {
          "role": "assistant",
          "message": "Hello, thanks for calling. How can I help?",
          "time": 1678901234.567,
          "secondsFromStart": 0.5
        },
        {
          "role": "user",
          "message": "I'd like to book an appointment for tomorrow.",
          "time": 1678901237.123,
          "secondsFromStart": 3.1
        },
        {
          "role": "tool_calls",
          "toolCalls": [
            {
              "id": "call_xxx",
              "function": {
                "name": "book_appointment",
                "arguments": "{\"date\":\"2026-03-23\",\"time\":\"10:00\"}"
              }
            }
          ],
          "time": 1678901240.0,
          "secondsFromStart": 6.0
        },
        {
          "role": "tool_call_result",
          "name": "book_appointment",
          "result": "Appointment confirmed for March 23 at 10:00 AM",
          "time": 1678901241.5,
          "secondsFromStart": 7.5
        }
      ],
      "stereoRecordingUrl": "https://...",
      "videoRecordingUrl": null,
      "videoRecordingStartDelaySeconds": null
    },
    "analysis": {
      "summary": "The caller booked an appointment for March 23 at 10 AM.",
      "structuredData": {
        /* if structured output configured */
      },
      "successEvaluation": "true"
    },
    "startedAt": "2026-03-22T10:00:00.000Z",
    "endedAt": "2026-03-22T10:05:32.000Z",
    "durationSeconds": 332,
    "durationMinutes": 5.53
  }
}
```

**Available data in end-of-call-report:**

- `artifact.transcript` -- full text transcript
- `artifact.messages` -- structured message array with timestamps (role, message, secondsFromStart)
- `artifact.recording.url` -- mono recording URL
- `artifact.recording.stereoUrl` -- stereo recording (agent L, caller R)
- `call.cost` -- total cost in USD
- `call.costBreakdown` -- per-component costs (stt, llm, tts, vapi, transport)
- `durationSeconds` / `durationMinutes` -- call duration
- `endedReason` -- why the call ended
- `analysis.summary` -- AI-generated summary (if analysisPlan configured)
- `analysis.structuredData` -- extracted structured data (if structuredOutput configured)
- `analysis.successEvaluation` -- success/failure assessment (if configured)

---

#### 3.7 `hang`

**When:** The assistant fails to respond within a reasonable timeframe during an active call.

```json
{
  "message": {
    "type": "hang",
    "call": {
      /* Call Object */
    }
  }
}
```

---

#### 3.8 `transcript`

**When:** Real-time transcript chunks during the call.

```json
{
  "message": {
    "type": "transcript",
    "role": "user",
    "transcriptType": "partial",
    "transcript": "I'd like to book an appoint...",
    "isFiltered": false,
    "detectedThreats": [],
    "originalTranscript": "I'd like to book an appoint..."
  }
}
```

`transcriptType`: `"partial"` (streaming) or `"final"` (complete utterance).

---

#### 3.9 `speech-update`

**When:** Speech state changes. Must be enabled via `serverMessages: ["speech-update"]`.

```json
{
  "message": {
    "type": "speech-update",
    "status": "started",
    "role": "assistant",
    "turn": 2
  }
}
```

---

#### 3.10 `conversation-update`

**When:** Conversation history is updated.

```json
{
  "message": {
    "type": "conversation-update",
    "messages": [
      /* current messages */
    ],
    "messagesOpenAIFormatted": [
      /* OpenAI chat format */
    ]
  }
}
```

---

#### 3.11 `model-output`

**When:** LLM token streaming during generation.

```json
{
  "message": {
    "type": "model-output",
    "output": {
      /* token or tool call chunk */
    },
    "turnId": "abc-123"
  }
}
```

---

#### 3.12 `transfer-update`

**When:** A call transfer occurs.

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

---

#### 3.13 `user-interrupted`

**When:** User interrupts assistant speech.

```json
{
  "message": {
    "type": "user-interrupted",
    "turnId": "abc-123"
  }
}
```

---

#### 3.14 `language-change-detected`

**When:** Transcriber detects a language switch.

```json
{
  "message": {
    "type": "language-change-detected",
    "language": "es"
  }
}
```

---

#### 3.15 `phone-call-control`

**When:** System delegates hangup/forwarding to your server.

```json
{
  "message": {
    "type": "phone-call-control",
    "request": "forward",
    "destination": {
      /* destination object */
    }
  }
}
```

---

#### 3.16 `voice-input`

**When:** Custom voice provider input.

```json
{
  "message": {
    "type": "voice-input",
    "input": "text to speak"
  }
}
```

---

#### 3.17 Session/Chat Lifecycle Events

```json
{ "message": { "type": "chat.created", "chat": { /* Chat object */ } } }
{ "message": { "type": "chat.deleted", "chat": { /* Chat object */ } } }
{ "message": { "type": "session.created", "session": { /* Session object */ } } }
{ "message": { "type": "session.updated", "session": { /* Session object */ } } }
{ "message": { "type": "session.deleted", "session": { /* Session object */ } } }
```

---

### Specialized Server Endpoints

These use dedicated URLs, not the main server URL:

- **`voice-request`** at `assistant.voice.server.url` -- receives/sends raw PCM audio (custom voice provider)
- **`call.endpointing.request`** at `assistant.startSpeakingPlan.smartEndpointingPlan.server.url` -- respond with `{ "timeoutSeconds": N }` for dynamic endpointing

---

## 4. Tool/Function Definition Schema

### Creating a tool via API:

```bash
curl -X POST 'https://api.vapi.ai/tool' \
  -H 'Authorization: Bearer <VAPI_API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "function",
    "function": {
      "name": "book_appointment",
      "description": "Books an appointment for the caller",
      "parameters": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "description": "Appointment date in YYYY-MM-DD format"
          },
          "time": {
            "type": "string",
            "description": "Appointment time in HH:MM format"
          },
          "service": {
            "type": "string",
            "description": "Type of service requested"
          }
        },
        "required": ["date", "time"]
      }
    },
    "async": false,
    "server": {
      "url": "https://api.example.com/vapi/tools",
      "credentialId": "cred_xxx"
    },
    "messages": [
      {
        "type": "request-start",
        "content": "Let me check availability for you..."
      },
      {
        "type": "request-complete",
        "content": "Great, I've got that booked for you."
      },
      {
        "type": "request-failed",
        "content": "I'm sorry, I wasn't able to book that appointment."
      },
      {
        "type": "request-response-delayed",
        "content": "This is taking a moment, please hold on..."
      }
    ]
  }'
```

### Inline tools in assistant config (via `assistant-request` response):

```json
{
  "assistant": {
    "model": {
      "provider": "openai",
      "model": "gpt-4o",
      "systemPrompt": "You are a helpful receptionist...",
      "functions": [
        {
          "name": "book_appointment",
          "description": "Books an appointment",
          "parameters": {
            "type": "object",
            "properties": {
              "date": { "type": "string" },
              "time": { "type": "string" }
            },
            "required": ["date", "time"]
          }
        }
      ]
    }
  }
}
```

Note: `functions` inside `model` is the legacy approach. The newer approach uses `toolIds` referencing pre-created tools, or inline `tools` array.

### Assigning pre-created tools to an assistant:

```bash
curl -X PATCH 'https://api.vapi.ai/assistant/<ASSISTANT_ID>' \
  -H 'Authorization: Bearer <VAPI_API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{ "toolIds": ["tool_xxx", "tool_yyy"] }'
```

### Tool messages (spoken during execution):

| Message Type               | When Spoken                          |
| -------------------------- | ------------------------------------ |
| `request-start`            | When tool execution begins           |
| `request-complete`         | After successful result              |
| `request-failed`           | After error result                   |
| `request-response-delayed` | When execution exceeds expected time |

### Async tools:

When `"async": true` is set on the tool, Vapi does NOT wait for the tool response to continue the conversation. The assistant keeps talking. This is useful for fire-and-forget operations (e.g., logging, sending emails, updating CRM).

Your server should still return HTTP 200, but the response content does not affect the conversation flow.

### Tool types comparison:

| Type                       | Server Needed | Language           | Max Timeout        |
| -------------------------- | ------------- | ------------------ | ------------------ |
| Custom Function Tool       | Yes           | Any                | 20s (configurable) |
| Code Tool                  | No            | TypeScript only    | 60s                |
| API Request Tool           | No            | N/A (config-based) | 45s                |
| Client-side Tool (Web SDK) | No            | JavaScript         | N/A                |

---

## 5. `endedReason` Codes

### Assistant-related (17 codes)

- `assistant-ended-call` -- assistant intentionally ended call
- `assistant-not-found` -- invalid assistantId
- `assistant-error` -- assistant config error
- `assistant-forwarded-call` -- call forwarded by assistant
- `assistant-join-timed-out` -- assistant didn't join in time
- Plus ~12 more pipeline/processing errors

### Phone/Connectivity (11 codes)

- `customer-ended-call` -- caller hung up
- `customer-busy` -- line busy
- `customer-did-not-answer` -- no answer
- `customer-did-not-give-microphone-permission` -- web call, no mic
- Various Twilio/Vonage-specific failures

### Call Start Errors (9 codes)

- `assistant-not-valid` -- invalid config
- `no-server-available` -- server URL unreachable
- Various resource/config errors

### Other

- `exceeded-max-duration` -- max call length hit
- `silence-timed-out` -- silence timeout
- `voicemail` -- voicemail detected
- `unknown-error` -- contact support with call ID

---

## 6. Authentication / Security

Vapi uses a **credential-based system** for webhook authentication. Create credentials in the dashboard, then reference them by `credentialId`.

### Three authentication methods:

#### 6.1 Bearer Token (most common)

Create credential in dashboard with:

- Token: your secret API key
- Header: `Authorization` (default)
- Bearer prefix: enabled (default)

Vapi sends: `Authorization: Bearer your-api-token-here`

Server verification:

```typescript
app.post("/webhook", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.VAPI_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // process event...
});
```

#### 6.2 Legacy: X-Vapi-Secret header

Older approach (still supported). Set header name to `X-Vapi-Secret`, disable Bearer prefix.

Vapi sends: `X-Vapi-Secret: your-secret-value`

```typescript
const secret = req.headers["x-vapi-secret"];
if (secret !== process.env.VAPI_SECRET) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

#### 6.3 OAuth 2.0 (Client Credentials)

For enterprise integrations. Vapi automatically:

1. Requests token from your OAuth endpoint using client credentials
2. Caches and refreshes tokens
3. Sends `Authorization: Bearer <access_token>` on every webhook call

Config fields: Token URL, Client ID, Client Secret, Scope.

#### 6.4 HMAC Signature Verification

For integrity verification. Vapi signs the request body:

Config fields:

- Secret Key: shared signing key
- Algorithm: SHA256 or SHA1
- Signature Header: custom header name (e.g., `X-Vapi-Signature`)
- Timestamp Header: optional replay protection
- Payload Format: how the signing payload is constructed

Server verification:

```typescript
import crypto from "crypto";

function verifyHmac(req: Request): boolean {
  const signature = req.headers["x-vapi-signature"] as string;
  const timestamp = req.headers["x-vapi-timestamp"] as string;
  const body = JSON.stringify(req.body);

  const payload = `${timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.VAPI_HMAC_SECRET!)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}
```

### IP Allowlisting

Vapi publishes static IP addresses for webhook egress. See docs.vapi.ai/security-and-privacy/static-ip-addresses.

---

## 7. Complete Node.js/Express Server Example

```typescript
import express from "express";

const app = express();
app.use(express.json());

// Authentication middleware
function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${process.env.VAPI_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/vapi/webhook", authenticate, async (req, res) => {
  const { message } = req.body;

  switch (message.type) {
    // --- Dynamic assistant config (inbound calls) ---
    case "assistant-request": {
      const callerNumber = message.call?.customer?.number;
      const calledNumber =
        message.call?.phoneNumber?.number || message.call?.phoneCallProviderId; // extract called number

      // Look up tenant by called number
      const tenant = await db.tenants.findByPhone(calledNumber);
      if (!tenant) {
        return res.json({ error: "This number is not in service." });
      }

      // Return dynamic assistant config
      return res.json({
        assistant: {
          name: tenant.businessName,
          firstMessage: tenant.greeting,
          model: {
            provider: "openai",
            model: "gpt-4o",
            temperature: 0.7,
            systemPrompt: buildSystemPrompt(tenant),
          },
          voice: {
            provider: "cartesia",
            voiceId: tenant.voiceId,
          },
          serverUrl: `https://api.example.com/vapi/webhook`,
          serverMessages: [
            "end-of-call-report",
            "status-update",
            "tool-calls",
            "transfer-destination-request",
          ],
        },
      });
    }

    // --- Tool/function execution ---
    case "tool-calls": {
      const results = [];

      for (const toolCall of message.toolCallList) {
        try {
          let result: string;

          switch (toolCall.name) {
            case "book_appointment":
              const booking = await bookingService.create(toolCall.arguments);
              result = `Appointment booked for ${booking.date} at ${booking.time}`;
              break;

            case "check_availability":
              const slots = await bookingService.getSlots(toolCall.arguments);
              result =
                slots.length > 0
                  ? `Available slots: ${slots.join(", ")}`
                  : "No available slots for that date";
              break;

            case "get_business_hours":
              const hours = await tenantService.getHours(message.call.id);
              result = JSON.stringify(hours); // stringify objects
              break;

            default:
              result = `Unknown function: ${toolCall.name}`;
          }

          results.push({ toolCallId: toolCall.id, result });
        } catch (err) {
          results.push({
            toolCallId: toolCall.id,
            error: `Failed to execute ${toolCall.name}: ${err.message}`,
          });
        }
      }

      return res.json({ results });
    }

    // --- Transfer destination ---
    case "transfer-destination-request": {
      const contacts = await escalationService.getAvailable(message.call.id);
      if (contacts.length === 0) {
        return res.json({
          destination: {
            type: "number",
            number: "+18005551234", // fallback
            transferPlan: { mode: "blind-transfer" },
          },
        });
      }
      return res.json({
        destination: {
          type: "number",
          number: contacts[0].phone,
          transferPlan: {
            mode: "warm-transfer-say-message",
            message: `Transferring a caller who needs help with ${message.call?.assistant?.name || "general inquiry"}.`,
          },
        },
      });
    }

    // --- End of call report ---
    case "end-of-call-report": {
      const { call, artifact, analysis, endedReason, durationSeconds } =
        message;

      await callLogService.save({
        callId: call.id,
        callerNumber: call.customer?.number,
        calledNumber: call.phoneNumber?.number,
        duration: durationSeconds,
        cost: call.cost,
        costBreakdown: call.costBreakdown,
        transcript: artifact?.transcript,
        messages: artifact?.messages,
        recordingUrl: artifact?.recording?.url,
        stereoRecordingUrl: artifact?.recording?.stereoUrl,
        summary: analysis?.summary,
        structuredData: analysis?.structuredData,
        endedReason,
        assistantId: call.assistantId,
      });

      return res.json({});
    }

    // --- Status updates ---
    case "status-update": {
      console.log(`Call ${message.call.id} status: ${message.status}`);
      if (message.status === "ended") {
        console.log(`Ended reason: ${message.endedReason}`);
      }
      return res.json({});
    }

    // --- Real-time transcript ---
    case "transcript": {
      if (message.transcriptType === "final") {
        // Process final transcript chunk
        await realtimeService.pushTranscript(message.call.id, {
          role: message.role,
          text: message.transcript,
        });
      }
      return res.json({});
    }

    // --- All other events ---
    default:
      return res.json({});
  }
});

app.listen(3100, () => console.log("Vapi webhook server running on :3100"));
```

---

## 8. Comparison: Vapi Server URL vs LiveKit Agents

| Aspect           | Vapi Server URL                  | LiveKit Agents                          |
| ---------------- | -------------------------------- | --------------------------------------- |
| Architecture     | Webhook-based (HTTP POST)        | Agent process (Python/Node, persistent) |
| Tool execution   | HTTP request/response cycle      | In-process function calls               |
| Latency          | Network round-trip per tool call | Near-zero (in-process)                  |
| State management | Stateless (must use DB/cache)    | Stateful (in-memory per session)        |
| Dynamic config   | `assistant-request` webhook      | Agent code reads config at start        |
| Streaming        | No (event-based)                 | Yes (real-time audio/data)              |
| Hosting          | Any HTTP endpoint                | Dedicated agent process                 |
| Multi-tenant     | Return different config per call | Read tenant config at session start     |
| Async tools      | `"async": true` flag             | Native async/await                      |
| Max tool timeout | 20s default (configurable)       | No hard limit                           |
| Audio access     | Only via recording URL post-call | Real-time audio frames                  |

---

## 9. Key Integration Patterns for Multi-Tenant Platforms

### Pattern 1: Phone-number-level Server URL

Set a different server URL per phone number at provisioning time. Each phone number points to your API with the phone number as a path parameter:

```
https://api.example.com/vapi/webhook/+18005551234
```

### Pattern 2: Single Server URL + Dynamic Routing

Use one server URL for all calls. In `assistant-request`, extract the called number from `message.call` to identify the tenant and return tenant-specific config.

### Pattern 3: Pre-created Assistants

Create a Vapi assistant per tenant via the API. Set `assistantId` on the phone number. No `assistant-request` webhook needed -- but less dynamic.

### Pattern 4: Hybrid

Use `assistant-request` for dynamic config but pre-create tools via the API. Return `toolIds` in the assistant config rather than inline tool definitions.

---

## 10. Local Development

```bash
# Terminal 1: Start your local server
npm run dev  # runs on localhost:3100

# Terminal 2: Create ngrok tunnel
ngrok http 3100
# Copy the https://xxx.ngrok-free.app URL

# Terminal 3 (alternative): Use Vapi CLI
vapi listen --forward-to localhost:3100/vapi/webhook
```

Set the ngrok URL as your server URL in the Vapi dashboard or via API.

---

## 11. Gotchas and Best Practices

1. **7.5s timeout on `assistant-request`** -- Keep DB lookups fast. Cache tenant configs.
2. **20s default timeout on tool-calls** -- Configurable per-tool via `server.timeoutSeconds`.
3. **Single-line strings only in tool results** -- Line breaks cause parsing failures. Use `JSON.stringify()` for structured data, or flatten to one line.
4. **HTTP 200 required** -- Any other status code causes the result to be ignored.
5. **Match toolCallId exactly** -- Mismatched IDs cause results to be silently dropped.
6. **`results` array wrapper is mandatory** -- Even for single tool calls.
7. **Cost tracking** -- `end-of-call-report` includes per-component cost breakdown (STT, LLM, TTS, Vapi platform fee, transport).
8. **Recording availability** -- Recording URLs in `end-of-call-report` may take a few seconds to become accessible after the call ends.
9. **Credential rotation** -- Use `credentialId` references so you can rotate secrets in the dashboard without redeploying code.
10. **Static IP addresses** -- Vapi publishes egress IPs for firewall allowlisting.
