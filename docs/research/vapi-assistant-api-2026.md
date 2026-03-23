# Vapi Assistant API -- Complete Reference (2026)

Research date: 2026-03-22
Sources: docs.vapi.ai, VapiAI/server-sdk-typescript GitHub, Vapi OpenAPI spec

---

## Table of Contents

1. [Create Assistant](#1-create-assistant)
2. [Update Assistant](#2-update-assistant)
3. [Assistant Configuration Fields](#3-assistant-configuration-fields)
4. [Model Provider Options](#4-model-provider-options)
5. [Voice Provider Options](#5-voice-provider-options)
6. [Transcriber Provider Options](#6-transcriber-provider-options)
7. [Tools and Functions](#7-tools-and-functions)
8. [Phone Numbers](#8-phone-numbers)
9. [Squads (Multi-Assistant)](#9-squads-multi-assistant)
10. [Bring Your Own Keys (BYOK)](#10-bring-your-own-keys-byok)
11. [Dynamic Variables](#11-dynamic-variables)
12. [Transient vs Permanent Assistants](#12-transient-vs-permanent-assistants)

---

## 1. Create Assistant

**Endpoint:** `POST https://api.vapi.ai/assistant`
**Auth:** `Authorization: Bearer <API_KEY>`
**Content-Type:** `application/json`
**Response:** `201 Created` -- returns full Assistant object with generated `id`

### Minimal Example (cURL)

```bash
curl -X POST "https://api.vapi.ai/assistant" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Support Assistant",
    "model": {
      "provider": "openai",
      "model": "gpt-4o",
      "messages": [
        {
          "role": "system",
          "content": "You are Alex, a customer service voice assistant for TechSolutions."
        }
      ]
    },
    "voice": {
      "provider": "11labs",
      "voiceId": "cgSgspJ2msm6clMCkdW9"
    },
    "firstMessage": "Hi there, this is Alex from TechSolutions customer support. How can I help you today?"
  }'
```

### TypeScript SDK

```typescript
const assistant = await vapi.assistants.create({
  name: "Customer Support Assistant",
  model: {
    provider: "openai",
    model: "gpt-4o",
    messages: [{ role: "system", content: "You are Alex..." }],
    toolIds: ["tool-id-1", "tool-id-2"],
    temperature: 0.7,
    maxTokens: 250,
  },
  voice: { provider: "11labs", voiceId: "cgSgspJ2msm6clMCkdW9" },
  firstMessage: "Hi there, how can I help you today?",
  maxDurationSeconds: 600,
});
```

---

## 2. Update Assistant

**Endpoint:** `PATCH https://api.vapi.ai/assistant/{id}`
**Auth:** `Authorization: Bearer <API_KEY>`
**Response:** Returns updated Assistant object

All fields from CreateAssistantDTO are updatable. Send only the fields you want to change.

```bash
curl -X PATCH "https://api.vapi.ai/assistant/asst_abc123" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "firstMessage": "Welcome! How can I assist you?",
    "model": {
      "provider": "openai",
      "model": "gpt-4.1-mini",
      "temperature": 0.5
    }
  }'
```

### Other CRUD Operations

| Operation | Method | Endpoint          |
| --------- | ------ | ----------------- |
| List      | GET    | `/assistant`      |
| Get       | GET    | `/assistant/{id}` |
| Delete    | DELETE | `/assistant/{id}` |

---

## 3. Assistant Configuration Fields

Complete `CreateAssistantDTO` schema (from TypeScript SDK + OpenAPI spec):

### Core Pipeline

| Field         | Type   | Required | Description                                         |
| ------------- | ------ | -------- | --------------------------------------------------- |
| `name`        | string | No       | Assistant identifier. Required for squad transfers. |
| `model`       | object | No       | LLM configuration (see Section 4)                   |
| `voice`       | object | No       | Voice/TTS configuration (see Section 5)             |
| `transcriber` | object | No       | STT configuration (see Section 6)                   |

### Messages & Interaction

| Field                              | Type     | Default                    | Description                                                                                                          |
| ---------------------------------- | -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `firstMessage`                     | string   | -                          | Opening message spoken when call connects                                                                            |
| `firstMessageMode`                 | enum     | `"assistant-speaks-first"` | Options: `assistant-speaks-first`, `assistant-waits-for-user`, `assistant-speaks-first-with-model-generated-message` |
| `firstMessageInterruptionsEnabled` | boolean  | -                          | Whether user can interrupt the first message                                                                         |
| `voicemailMessage`                 | string   | -                          | Message to leave on voicemail                                                                                        |
| `endCallMessage`                   | string   | -                          | Final message before hanging up                                                                                      |
| `endCallPhrases`                   | string[] | -                          | Phrases that trigger automatic hangup                                                                                |

### Call Control

| Field                   | Type   | Default | Description                                        |
| ----------------------- | ------ | ------- | -------------------------------------------------- |
| `maxDurationSeconds`    | number | 600     | Maximum call duration (10 min default)             |
| `silenceTimeoutSeconds` | number | -       | End call after N seconds of silence                |
| `voicemailDetection`    | object | -       | Voicemail detection configuration                  |
| `startSpeakingPlan`     | object | -       | When assistant should start speaking (endpointing) |
| `stopSpeakingPlan`      | object | -       | Interruption detection settings                    |
| `keypadInputPlan`       | object | -       | DTMF input handling                                |

### Audio & Environment

| Field                           | Type   | Default                           | Description                       |
| ------------------------------- | ------ | --------------------------------- | --------------------------------- |
| `backgroundSound`               | enum   | `"office"` (phone), `"off"` (web) | Background audio: `off`, `office` |
| `backgroundSpeechDenoisingPlan` | object | -                                 | Noise filtering configuration     |

### Webhooks & Events

| Field            | Type     | Description                           |
| ---------------- | -------- | ------------------------------------- |
| `server`         | object   | Webhook destination URL + auth config |
| `clientMessages` | string[] | Message types sent to client SDK      |
| `serverMessages` | string[] | Message types sent to server webhook  |

### Post-Call Analysis

| Field          | Type   | Description                                                 |
| -------------- | ------ | ----------------------------------------------------------- |
| `analysisPlan` | object | Post-call analysis (summary, structured data, success eval) |
| `artifactPlan` | object | Recording/transcript storage config                         |

### Hooks (Event Triggers)

| Field   | Type  | Description                      |
| ------- | ----- | -------------------------------- |
| `hooks` | array | Event-driven actions (see below) |

Available hook events:

- `call.ending` -- call concludes
- `assistant.speech.interrupted` -- customer interrupts assistant
- `customer.speech.interrupted` -- assistant interrupts customer
- `customer.speech.timeout` -- customer silent for N seconds (default 7.5s)
- `assistant.transcriber.endpointedSpeechLowConfidence` -- low-confidence transcript

Hook actions: `say` (exact text or LLM prompt) and `tool` (transferCall, function, endCall).

### Other

| Field                          | Type     | Description                                             |
| ------------------------------ | -------- | ------------------------------------------------------- |
| `credentials`                  | array    | Dynamic credentials for calls                           |
| `credentialIds`                | string[] | Credential subset                                       |
| `transportConfigurations`      | array    | Provider-specific transport settings                    |
| `observabilityPlan`            | object   | Langfuse observability integration                      |
| `monitorPlan`                  | object   | Live listening/control settings                         |
| `compliancePlan`               | object   | HIPAA/compliance configuration                          |
| `metadata`                     | object   | Custom key-value storage                                |
| `modelOutputInMessagesEnabled` | boolean  | Use raw model output vs. transcription (default: false) |

### Analysis Plan Detail

```json
{
  "analysisPlan": {
    "summaryPrompt": "Summarize the call in 2-3 sentences.",
    "structuredDataPrompt": "Extract structured data per the JSON Schema.",
    "structuredDataSchema": {
      "type": "object",
      "properties": {
        "customerName": { "type": "string" },
        "issue": { "type": "string" },
        "resolved": { "type": "boolean" }
      }
    },
    "successEvaluationPrompt": "Determine if the call was successful.",
    "successEvaluationRubric": "PassFail"
  }
}
```

Rubric options: `NumericScale`, `DescriptiveScale`, `Checklist`, `Matrix`, `PercentageScale`, `LikertScale`, `AutomaticRubric`, `PassFail`

### Start Speaking Plan Detail

```json
{
  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingPlan": {
      "provider": "livekit",
      "waitFunction": "..."
    },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.1,
      "onNoPunctuationSeconds": 1.5,
      "onNumberSeconds": 0.5
    },
    "customEndpointingRules": [
      {
        "type": "user",
        "regex": "bye|goodbye",
        "timeoutSeconds": 0.5
      }
    ]
  }
}
```

Smart endpointing providers: `livekit` (English), `vapi` (non-English), `krisp` (audio-based), `deepgram-flux`, `assembly`

### Stop Speaking Plan Detail

```json
{
  "stopSpeakingPlan": {
    "numWords": 0,
    "voiceSeconds": 0.2,
    "backoffSeconds": 1.0,
    "acknowledgementPhrases": ["uh huh", "mmhm"],
    "interruptionPhrases": ["stop", "hold on"]
  }
}
```

---

## 4. Model Provider Options

### Supported Providers (15+)

| Provider     | `provider` value | Key                              |
| ------------ | ---------------- | -------------------------------- |
| OpenAI       | `openai`         | Most popular, widest model range |
| Anthropic    | `anthropic`      | Claude models                    |
| Google       | `google`         | Gemini models                    |
| Groq         | `groq`           | Fast inference                   |
| DeepSeek     | `deepseek`       | DeepSeek models                  |
| OpenRouter   | `openrouter`     | Multi-model router               |
| Together AI  | `together-ai`    | Open-source models               |
| DeepInfra    | `deepinfra`      | Open-source hosting              |
| Perplexity   | `perplexity-ai`  | Search-augmented                 |
| Anyscale     | `anyscale`       | Scalable inference               |
| Cerebras     | `cerebras`       | Ultra-fast inference             |
| xAI          | `xai`            | Grok models                      |
| InflectionAI | `inflection-ai`  | Pi models                        |
| Vapi         | `vapi`           | Vapi's own model                 |
| Custom LLM   | `custom-llm`     | Your own server                  |

### OpenAI Model Schema

```typescript
{
  provider: "openai",
  model: string,               // Required. See model list below
  messages: [                   // System prompt + conversation state
    { role: "system", content: "You are..." }
  ],
  tools: [...],                 // Inline tool definitions
  toolIds: ["id1", "id2"],      // Reference saved tools by ID
  knowledgeBase: {...},         // Knowledge base config
  fallbackModels: [...],        // Fallback if primary fails
  temperature: 0,              // Default: 0 (for prompt caching)
  maxTokens: 250,              // Default: 250 per turn
  emotionRecognitionEnabled: false,  // Detect user emotion
  numFastTurns: 0,             // Fast model for initial turns
  promptCacheRetention: "in_memory",
  promptCacheKey: "...",
  toolStrictCompatibilityMode: "..."  // For Azure
}
```

**Supported OpenAI Models:**

- GPT-5 series: `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`
- GPT-4.1 series: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`
- Reasoning: `o3`, `o3-mini`, `o4-mini`, `o1-mini`
- GPT-4o series: `gpt-4o`, `gpt-4o-mini`, `chatgpt-4o-latest`
- Realtime: `gpt-4o-realtime-preview-*`, `gpt-realtime-2025-08-28`
- GPT-4 Turbo: `gpt-4-turbo`, `gpt-4-turbo-2024-04-09`
- GPT-3.5: `gpt-3.5-turbo`, `gpt-3.5-turbo-0125`
- Azure regional variants: `model:region` format (e.g., `gpt-4o-2024-11-20:swedencentral`)

### Anthropic Model Schema

```typescript
{
  provider: "anthropic",
  model: string,                // Required
  messages: [...],
  tools: [...],
  toolIds: [...],
  knowledgeBase: {...},
  thinking: {                   // Extended thinking (claude-3-7-sonnet only)
    budgetTokens: number
  },
  temperature: 0,
  maxTokens: 250,
  emotionRecognitionEnabled: false,
  numFastTurns: 0
}
```

**Supported Anthropic Models:**

- `claude-opus-4-5-20251101`, `claude-opus-4-20250514`
- `claude-sonnet-4-5-20250929`, `claude-sonnet-4-20250514`
- `claude-haiku-4-5-20251001`
- `claude-3-7-sonnet-20250219`
- `claude-3-5-sonnet-20241022`, `claude-3-5-sonnet-20240620`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`

### Google Model Schema

**Supported Google Models:**

- `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-pro-exp-02-05`
- `gemini-2.0-flash-realtime-exp`
- `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-1.0-pro`

### Custom LLM Model Schema

```typescript
{
  provider: "custom-llm",
  url: "https://your-server.com/chat/completions",  // Required
  model: "your-model-name",                          // Required
  messages: [...],
  tools: [...],
  toolIds: [...],
  headers: { "Authorization": "Bearer ..." },
  metadataSendMode: "off" | "variable" | "destructured",
  timeoutSeconds: 20,
  temperature: 0,
  maxTokens: 250,
  wordLevelConfidenceEnabled: false,
  emotionRecognitionEnabled: false,
  numFastTurns: 0
}
```

Custom LLM auth methods:

1. **API Key** -- static key in request headers
2. **OAuth2** -- client credentials flow with automatic token refresh

### Anthropic Bedrock (AWS)

Use your own AWS infrastructure with STS role assumption:

```json
{
  "provider": "anthropic-bedrock",
  "region": "us-east-1",
  "authenticationPlan": {
    "type": "aws-sts",
    "roleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/VapiBedrockRole",
    "externalId": "optional-external-id"
  }
}
```

Vapi's AWS account: `533267069243` (for trust policy).

---

## 5. Voice Provider Options

### Supported Providers (20+)

| Provider   | `provider` value | Notes                               |
| ---------- | ---------------- | ----------------------------------- |
| Vapi       | `vapi`           | Built-in curated voices (11 voices) |
| ElevenLabs | `11labs`         | Premium quality, cloning            |
| Cartesia   | `cartesia`       | Ultra-fast, Sonic-3                 |
| OpenAI     | `openai`         | GPT-voice models                    |
| PlayHT     | `playht`         | Emotion control                     |
| Deepgram   | `deepgram`       | Aura-2 TTS                          |
| Azure      | `azure`          | Microsoft voices                    |
| LMNT       | `lmnt`           | Fast synthesis                      |
| Hume       | `hume`           | Emotion-aware                       |
| Rime AI    | `rime-ai`        | -                                   |
| Inworld    | `inworld`        | Game/metaverse                      |
| Neets      | `neets`          | -                                   |
| Neuphonic  | `neuphonic`      | -                                   |
| Minimax    | `minimax`        | -                                   |
| Sesame     | `sesame`         | -                                   |
| SmallestAI | `smallest-ai`    | -                                   |
| WellSaid   | `wellsaid`       | Enterprise                          |
| Tavus      | `tavus`          | Video avatars                       |
| Custom     | `custom`         | Your own TTS server                 |

### Vapi Built-in Voices

Male: Elliot (Canadian), Rohan (Indian American), Nico (American), Kai (American), Sagar (Indian American), Godfrey (American), Neil (Indian American)
Female: Savannah (Southern American), Emma (Asian American), Clara (American)

```json
{ "provider": "vapi", "voiceId": "Elliot", "speed": 1.0 }
```

### ElevenLabs Voice Schema

```typescript
{
  provider: "11labs",
  voiceId: string,              // Required (ElevenLabs voice ID)
  model?: string,               // ElevenLabs model
  stability?: number,           // 0-1
  similarityBoost?: number,     // 0-1
  style?: number,               // 0-1
  speed?: number,               // Speed multiplier
  useSpeakerBoost?: boolean,
  optimizeStreamingLatency?: number,  // Default: 3
  enableSsmlParsing?: boolean,       // Default: false
  autoMode?: boolean,
  language?: string,
  cachingEnabled?: boolean,
  pronunciationDictionaryLocators?: [...],
  chunkPlan?: {...},
  fallbackPlan?: {...}
}
```

### Cartesia Voice Schema

```typescript
{
  provider: "cartesia",
  voiceId: string,              // Required (Cartesia UUID)
  model?: string,               // e.g., "sonic-3"
  language?: string,
  experimentalControls?: {...},
  generationConfig?: {          // Sonic-3 speed/volume/controls
    speed?: number,
    volume?: number,
    ...
  },
  pronunciationDictId?: string,
  cachingEnabled?: boolean,
  chunkPlan?: {...},
  fallbackPlan?: {...}
}
```

### OpenAI Voice Schema

```typescript
{
  provider: "openai",
  voiceId: string,              // Required (e.g., "alloy", "echo", "nova", "shimmer")
  model?: string,               // TTS model
  instructions?: string,        // Voice control prompt (not for tts-1)
  speed?: number,
  cachingEnabled?: boolean,
  chunkPlan?: {...},
  fallbackPlan?: {...}
}
```

### PlayHT Voice Schema

```typescript
{
  provider: "playht",
  voiceId: string,              // Required
  speed?: number,
  temperature?: number,
  emotion?: string,             // PlayHT emotion enum
  voiceGuidance?: number,
  styleGuidance?: number,
  textGuidance?: number,
  model?: string,
  language?: string,
  cachingEnabled?: boolean,
  chunkPlan?: {...},
  fallbackPlan?: {...}
}
```

### Deepgram Voice Schema

```typescript
{
  provider: "deepgram",
  voiceId: string,              // Required
  model?: string,               // Default: "aura-2"
  mipOptOut?: boolean,
  cachingEnabled?: boolean,
  chunkPlan?: {...},
  fallbackPlan?: {...}
}
```

### Voice Fallback Plan

All voice providers support a `fallbackPlan` for provider-level redundancy:

```json
{
  "voice": {
    "provider": "cartesia",
    "voiceId": "...",
    "fallbackPlan": {
      "voices": [
        { "provider": "11labs", "voiceId": "..." },
        { "provider": "openai", "voiceId": "alloy" }
      ]
    }
  }
}
```

### Chunk Plan

Controls how LLM output is chunked before sending to TTS:

```json
{
  "chunkPlan": {
    "enabled": true,
    "minCharacters": 30,
    "punctuationBoundaries": [".", "!", "?"],
    "formatPlan": { "enabled": true }
  }
}
```

---

## 6. Transcriber Provider Options

### Supported Providers (12+)

| Provider     | `provider` value     | Models                          |
| ------------ | -------------------- | ------------------------------- |
| Deepgram     | `deepgram`           | nova-3, flux-general-en, nova-2 |
| AssemblyAI   | `assembly-ai`        | -                               |
| Azure        | `azure`              | Various languages               |
| Google       | `google`             | Gemini-based                    |
| ElevenLabs   | `11labs`             | Scribe models                   |
| Gladia       | `gladia`             | fast, accurate, solaria-1       |
| Speechmatics | `speechmatics`       | standard/enhanced               |
| OpenAI       | `openai`             | Whisper-based                   |
| Cartesia     | `cartesia`           | ink-whisper                     |
| Soniox       | `soniox`             | -                               |
| Talkscriber  | `talkscriber`        | Whisper-based                   |
| Custom       | `custom-transcriber` | Your own WebSocket STT          |

### Common Transcriber Parameters

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-3",
    "language": "en",
    "confidenceThreshold": 0.4,
    "endpointing": 255,
    "keywords": ["TechSolutions:2"],
    "fallbackPlan": {
      "transcriberPlan": [{ "provider": "assembly-ai" }]
    }
  }
}
```

---

## 7. Tools and Functions

### Tool Types

| Type            | `type` value     | Description                  |
| --------------- | ---------------- | ---------------------------- |
| Custom Function | `function`       | Webhook to your server       |
| Transfer Call   | `transferCall`   | Route to phone/SIP/assistant |
| Handoff         | `handoff`        | Transfer within squads       |
| End Call        | `endCall`        | Programmatic hangup          |
| DTMF            | `dtmf`           | Keypad entry                 |
| SMS             | `sms`            | Send text messages           |
| API Request     | `apiRequest`     | HTTP calls with templates    |
| Code            | `code`           | TypeScript on Vapi infra     |
| MCP             | `mcp`            | Model Context Protocol       |
| Voicemail       | `voicemail`      | Voicemail handling           |
| Query           | `query`          | Knowledge base query         |
| Google Calendar | `googleCalendar` | Calendar integration         |
| Google Sheets   | `googleSheets`   | Sheets integration           |
| Slack           | `slack`          | Slack messages               |
| GoHighLevel     | `ghl`            | GHL integration              |

### Creating a Standalone Tool

**Endpoint:** `POST https://api.vapi.ai/tool`

```json
{
  "type": "function",
  "function": {
    "name": "check_availability",
    "description": "Check appointment availability for a given date",
    "parameters": {
      "type": "object",
      "properties": {
        "date": {
          "type": "string",
          "description": "Date in YYYY-MM-DD format"
        },
        "service": {
          "type": "string",
          "description": "Service type requested"
        }
      },
      "required": ["date"]
    }
  },
  "server": {
    "url": "https://your-api.com/tools/availability",
    "timeoutSeconds": 20,
    "headers": { "Authorization": "Bearer ..." }
  },
  "async": false,
  "messages": [
    {
      "type": "toolMessageStart",
      "content": "Let me check availability for you..."
    },
    {
      "type": "toolMessageComplete",
      "content": "I found the availability information."
    },
    {
      "type": "toolMessageFailed",
      "content": "I'm sorry, I couldn't check availability right now."
    },
    {
      "type": "toolMessageDelayed",
      "content": "Still checking, one moment please...",
      "timingMilliseconds": 3000
    }
  ]
}
```

### Attaching Tools to an Assistant

Two methods:

**Method 1: By Tool ID (recommended)**

```json
{
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "toolIds": ["tool_abc123", "tool_def456"],
    "messages": [...]
  }
}
```

**Method 2: Inline Definition**

```json
{
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": { "type": "string" }
            },
            "required": ["location"]
          }
        },
        "server": { "url": "https://..." }
      }
    ]
  }
}
```

Both `tools` and `toolIds` can be used together on the same model.

### Tool Webhook Request/Response

**Vapi sends to your server:**

```json
{
  "message": {
    "toolCallList": [
      {
        "id": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
        "name": "check_availability",
        "arguments": {
          "date": "2026-03-25",
          "service": "haircut"
        }
      }
    ]
  }
}
```

**Your server responds:**

```json
{
  "results": [
    {
      "toolCallId": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
      "result": "Available slots: 10:00 AM, 2:00 PM, 4:30 PM"
    }
  ]
}
```

### Transfer Call Tool

```json
{
  "type": "transferCall",
  "destinations": [
    {
      "type": "number",
      "number": "+16054440129",
      "message": "Transferring you now...",
      "transferPlan": { "mode": "blind-transfer" }
    },
    {
      "type": "sip",
      "sipUri": "sip:agent@pbx.example.com"
    }
  ]
}
```

### Handoff Tool (for Squads)

```json
{
  "type": "handoff",
  "destinations": [
    {
      "type": "assistant",
      "assistantName": "Scheduling Bot",
      "description": "Transfer when customer wants to book an appointment"
    }
  ]
}
```

### MCP Tool

```json
{
  "type": "mcp",
  "function": { "name": "mcpTools" },
  "server": {
    "url": "https://mcp.zapier.com/api/mcp/s/[token]/mcp",
    "headers": { "Authorization": "Bearer ..." }
  },
  "metadata": { "protocol": "shttp" }
}
```

### Advanced Tool Features

- **`async`**: If true, assistant continues talking while tool runs in background
- **`rejectionPlan`**: Regex/Liquid conditions to block tool execution
- **`variableExtractionPlan`**: Extract structured data from tool responses
- **`backoffPlan`**: Retry with exponential/fixed backoff
- **Tool messages**: `toolMessageStart`, `toolMessageComplete`, `toolMessageFailed`, `toolMessageDelayed`

---

## 8. Phone Numbers

### Create a Vapi-Managed Number

**Endpoint:** `POST https://api.vapi.ai/phone-number`

```bash
curl -X POST "https://api.vapi.ai/phone-number" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "vapi",
    "assistantId": "asst_abc123",
    "numberDesiredAreaCode": "415"
  }'
```

### Provider Options

| Provider           | Required Fields                          | Notes                            |
| ------------------ | ---------------------------------------- | -------------------------------- |
| `vapi`             | `provider`                               | Free US numbers (max 10/account) |
| `twilio`           | `provider`, `number`, `twilioAccountSid` | Import existing Twilio numbers   |
| `vonage`           | `provider`, `number`, `credentialId`     | Import Vonage numbers            |
| `telnyx`           | `provider`, `number`, `credentialId`     | Import Telnyx numbers            |
| `byo-phone-number` | `provider`, `credentialId`               | Bring your own SIP trunk         |

### Linking a Phone Number to an Assistant

Three mutually exclusive options on the phone number:

| Field         | Description                        |
| ------------- | ---------------------------------- |
| `assistantId` | Single assistant handles all calls |
| `squadId`     | Squad of assistants handles calls  |
| `workflowId`  | Visual workflow handles calls      |

If none set, Vapi sends an `assistant-request` webhook to your `server.url` for dynamic routing.

### Fallback Destination

```json
{
  "fallbackDestination": {
    "type": "number",
    "number": "+1234567890",
    "message": "Transferring the call now",
    "transferPlan": { "mode": "blind-transfer" }
  }
}
```

### Phone Number + Hooks

```json
{
  "hooks": [
    {
      "on": "call.ringing",
      "do": [{ "type": "say", "exact": "Please hold..." }]
    }
  ]
}
```

### SMS Support

```json
{ "smsEnabled": true }
```

Requires Twilio provider.

---

## 9. Squads (Multi-Assistant)

Squads enable multiple specialized assistants that hand off to each other during a single call.

### Why Squads?

- **Reduced hallucination**: Focused prompts per assistant
- **Lower costs**: Shorter prompts = fewer tokens
- **Improved latency**: Smaller contexts process faster

### Creating a Squad

Squads are defined either as saved resources or inline with calls.

**Inline Squad with Call:**

```json
{
  "squad": {
    "members": [
      {
        "assistant": {
          "name": "Emma",
          "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [
              { "role": "system", "content": "You are Emma, a receptionist..." }
            ]
          },
          "voice": { "provider": "azure", "voiceId": "emma" },
          "transcriber": { "provider": "deepgram" },
          "firstMessage": "Hi, I am Emma, what is your name?",
          "firstMessageMode": "assistant-speaks-first"
        },
        "assistantDestinations": [
          {
            "type": "assistant",
            "assistantName": "Mary",
            "message": "Please hold on while I transfer you to Mary.",
            "description": "Transfer when customer wants to book an appointment."
          }
        ]
      },
      {
        "assistantId": "saved-assistant-id-for-mary"
      }
    ]
  }
}
```

The first member in the array starts the call.

### Member Types

- **Transient**: Full assistant definition inline under `assistant`
- **Persistent**: Reference by `assistantId`

### Handoff Configuration

Each member can define `assistantDestinations` (legacy) or use `handoff` tools:

```json
{
  "assistantDestinations": [
    {
      "type": "assistant",
      "assistantName": "Scheduling Bot",
      "message": "Let me transfer you to scheduling.",
      "description": "Transfer when customer wants to schedule."
    }
  ]
}
```

### Context Transfer Between Assistants

```json
{
  "contextEngineeringPlan": "userAndAssistantMessages"
}
```

Options:

- `all` -- full conversation history
- `lastNMessages` -- recent N messages only
- `userAndAssistantMessages` -- excludes system/tool messages (recommended)
- `none` -- blank slate

### Variable Extraction Across Handoffs

```json
{
  "variableExtractionPlan": {
    "properties": {
      "customerName": { "type": "string" },
      "appointmentType": { "type": "string" }
    }
  }
}
```

Extracted variables available to subsequent assistants via `{{customerName}}`.

### Squad Overrides

Apply configuration to all members:

```json
{
  "memberOverrides": {
    "voice": { "provider": "vapi", "voiceId": "Elliot" }
  }
}
```

Or override a specific assistant:

```json
{
  "assistantOverrides": {
    "voice": { "provider": "vapi", "voiceId": "Elliot" },
    "tools:append": [{ "type": "endCall" }]
  }
}
```

### Squad API Endpoints

| Operation | Method | Endpoint      |
| --------- | ------ | ------------- |
| Create    | POST   | `/squad`      |
| List      | GET    | `/squad`      |
| Get       | GET    | `/squad/{id}` |
| Update    | PATCH  | `/squad/{id}` |
| Delete    | DELETE | `/squad/{id}` |

### Best Practices

- Each assistant should have 1-3 goals maximum
- Minimize squad size -- only separate at clear functional boundaries
- Write specific handoff descriptions with exact trigger conditions
- Use `userAndAssistantMessages` context to reduce token bloat

---

## 10. Bring Your Own Keys (BYOK)

### How It Works

Add API keys in Dashboard > Integrations tab. Once validated, Vapi stops charging for that provider -- you're billed directly by the provider.

### Supported BYOK Providers

| Category          | Providers                                                                       |
| ----------------- | ------------------------------------------------------------------------------- |
| **Transcription** | Deepgram (custom models via `transcriber.model`)                                |
| **LLM**           | Any OpenAI-compatible endpoint (OpenRouter, Together AI, Anyscale, self-hosted) |
| **Voice/TTS**     | All voice providers                                                             |
| **Cloud Storage** | AWS S3, GCP Cloud Storage, Cloudflare R2                                        |

### Configuration

Keys are added through the Dashboard Integrations section. For custom LLM endpoints, configure via the assistant's model:

```json
{
  "model": {
    "provider": "custom-llm",
    "url": "https://your-server.com/v1/chat/completions",
    "model": "your-model-name",
    "headers": { "Authorization": "Bearer your-key" }
  }
}
```

For Anthropic Bedrock, register credentials via the Vapi API with your AWS role ARN.

---

## 11. Dynamic Variables

### Syntax

Use `{{variableName}}` in system prompts, first messages, and tool configurations.

### Setting Values

Variables are set via API using `assistantOverrides.variableValues`:

```json
{
  "assistantId": "asst_abc123",
  "assistantOverrides": {
    "variableValues": {
      "customerName": "John",
      "accountType": "Premium",
      "lastOrder": "March 15"
    }
  }
}
```

Variables CANNOT be set in the dashboard -- API only.

### Default Auto-Populated Variables

| Variable                           | Description                   |
| ---------------------------------- | ----------------------------- |
| `{{now}}`                          | Current UTC datetime          |
| `{{date}}`                         | Current UTC date              |
| `{{time}}`                         | Current UTC time              |
| `{{month}}`, `{{day}}`, `{{year}}` | Date components               |
| `{{customer.number}}`              | Caller's phone number         |
| `{{transport.conversationType}}`   | `chat` or `voice`             |
| `{{customer.X}}`                   | Any custom customer property  |
| `{{transport.X}}`                  | Any custom transport property |

### LiquidJS Formatting

```
{{"now" | date: "%A, %B %d, %Y", "America/Los_Angeles"}}
```

### HIPAA Note

Under zero-data-retention mode, variable values are NOT persisted after the call ends.

---

## 12. Transient vs Permanent Assistants

### Permanent (Saved)

Created via `POST /assistant`, stored with an ID, reusable, visible in dashboard:

```json
// Create once
POST /assistant -> returns { "id": "asst_abc123", ... }

// Reuse by ID
POST /call -> { "assistantId": "asst_abc123", "customer": { "number": "..." } }
```

### Transient (Inline)

Defined fresh in each API request, exists only for that call:

```json
POST /call -> {
  "assistant": {
    "model": { "provider": "openai", "model": "gpt-4o", "messages": [...] },
    "voice": { "provider": "vapi", "voiceId": "Elliot" },
    "firstMessage": "Hello {{customerName}}!"
  },
  "assistantOverrides": {
    "variableValues": { "customerName": "John" }
  },
  "customer": { "number": "+1234567890" }
}
```

### When to Use Each

| Use Case                          | Recommended                        |
| --------------------------------- | ---------------------------------- |
| Stable, reusable config           | Permanent                          |
| Team collaboration via dashboard  | Permanent                          |
| Customer-specific personalization | Transient or Permanent + overrides |
| Testing/prototyping               | Transient                          |
| Campaign-specific variations      | Transient                          |
| Version consistency across calls  | Transient (snapshot)               |

### Hybrid Approach

Use permanent for the base config, override per call:

```json
{
  "assistantId": "asst_abc123",
  "assistantOverrides": {
    "firstMessage": "Hi {{customerName}}, thanks for calling back!",
    "variableValues": { "customerName": "Sarah" },
    "model": { "temperature": 0.8 }
  }
}
```

---

## Appendix: Complete Assistant Create Payload (Kitchen Sink)

```json
{
  "name": "Full-Featured Assistant",

  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant for {{companyName}}."
      }
    ],
    "toolIds": ["tool_check_avail", "tool_book_appt"],
    "tools": [
      {
        "type": "endCall",
        "messages": [{ "type": "toolMessageStart", "content": "Goodbye!" }]
      }
    ],
    "temperature": 0.7,
    "maxTokens": 300,
    "emotionRecognitionEnabled": true,
    "numFastTurns": 2,
    "fallbackModels": [
      { "provider": "anthropic", "model": "claude-sonnet-4-20250514" }
    ]
  },

  "voice": {
    "provider": "cartesia",
    "voiceId": "694f9389-aac1-45b6-b726-9d9369183238",
    "model": "sonic-3",
    "language": "en",
    "chunkPlan": { "enabled": true, "minCharacters": 30 },
    "fallbackPlan": {
      "voices": [{ "provider": "11labs", "voiceId": "cgSgspJ2msm6clMCkdW9" }]
    }
  },

  "transcriber": {
    "provider": "deepgram",
    "model": "nova-3",
    "language": "en",
    "confidenceThreshold": 0.4,
    "keywords": ["TechSolutions:2"],
    "fallbackPlan": {
      "transcriberPlan": [{ "provider": "assembly-ai" }]
    }
  },

  "firstMessage": "Hello! Thanks for calling {{companyName}}. How can I help you today?",
  "firstMessageMode": "assistant-speaks-first",
  "endCallMessage": "Thank you for calling. Goodbye!",
  "endCallPhrases": ["goodbye", "bye", "that's all"],
  "maxDurationSeconds": 900,

  "backgroundSound": "office",
  "backgroundSpeechDenoisingPlan": { "enabled": true },

  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingPlan": { "provider": "livekit" },
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.1,
      "onNoPunctuationSeconds": 1.5,
      "onNumberSeconds": 0.5
    }
  },

  "stopSpeakingPlan": {
    "numWords": 0,
    "voiceSeconds": 0.2,
    "backoffSeconds": 1.0
  },

  "hooks": [
    {
      "on": "customer.speech.timeout",
      "do": [{ "type": "say", "exact": "Are you still there?" }],
      "options": { "timeoutSeconds": 10, "triggerMaxCount": 3 }
    }
  ],

  "analysisPlan": {
    "summaryPrompt": "Summarize the call.",
    "structuredDataSchema": {
      "type": "object",
      "properties": {
        "customerName": { "type": "string" },
        "issue": { "type": "string" },
        "resolved": { "type": "boolean" }
      }
    },
    "successEvaluationRubric": "PassFail"
  },

  "server": {
    "url": "https://your-server.com/vapi-webhook",
    "timeoutSeconds": 20
  },

  "metadata": {
    "team": "support",
    "version": "2.1"
  }
}
```

---

## Appendix: Key API Base URL and Auth

- **Base URL:** `https://api.vapi.ai`
- **Auth Header:** `Authorization: Bearer <VAPI_API_KEY>`
- **API Key Source:** Dashboard > Organization Settings
- **SDK:** `npm install @vapi-ai/server-sdk` (TypeScript), `pip install vapi` (Python)
- **OpenAPI Spec:** `https://api.vapi.ai/api-json`

---

## Appendix: Pricing Model (BYOK Impact)

- Without BYOK: Vapi charges per-minute for STT + LLM + TTS + telephony
- With BYOK: Vapi charges only for platform + telephony; provider costs go direct to your account
- Free tier: 10 minutes/month + 10 US phone numbers
- Phone numbers: Free US numbers; international requires import (Twilio/Vonage/Telnyx)
