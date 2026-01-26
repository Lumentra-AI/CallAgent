# Architecture Recommendations for Sub-500ms Voice AI

## Critical Decision: Remove FunctionGemma/Ollama

### Why This Must Go

The FunctionGemma via Ollama approach has fundamental production issues:

1. **Documented Latency Spikes (GitHub Issue #13552, #9103):**

   - After 5+ second idle: 20 second+ latency
   - Memory leaks causing degradation over time
   - "Head-of-line blocking" under concurrent load

2. **Ollama's Own Documentation States:**

   > "Ollama excels in its intended role: a simple, accessible tool for local development, prototyping, and single-user applications. Its strength lies in its ease of use, not its ability to handle high-concurrency production traffic."

3. **The FunctionGemma Model Itself:**
   - Designed as "a strong base for further training" - not direct production use
   - 270M params is too small for reliable function calling without fine-tuning
   - You're adding latency to route to a system that routes back to an LLM

### The Simpler, Faster Alternative

**Groq's Llama 3.1 8B has native tool calling.** You don't need a separate router.

```typescript
// OLD: FunctionGemma routes -> then Groq handles
// Latency: 50-20000ms (Ollama) + 400ms (Groq) = 450-20400ms

// NEW: Groq handles everything with native tools
// Latency: 200ms (Groq with tools) = 200ms
```

---

## Recommended Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STREAMING PIPELINE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Speech                                                        │
│      │                                                              │
│      ▼                                                              │
│  ┌─────────────────┐                                                │
│  │   SignalWire    │ WebSocket (persistent connection)              │
│  │   Media Stream  │                                                │
│  └────────┬────────┘                                                │
│           │ Audio chunks (20ms)                                     │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │    Deepgram     │ WebSocket (persistent connection)              │
│  │  Nova-2 Stream  │ Interim results enabled                        │
│  └────────┬────────┘                                                │
│           │ Partial transcripts (streaming)                         │
│           │                                                         │
│           │    ┌──────────────────────────────┐                     │
│           │    │   Quick Pattern Check        │                     │
│           │    │   (in-process, <1ms)         │                     │
│           │    │                              │                     │
│           │    │   greeting? -> template      │                     │
│           │    │   farewell? -> template      │                     │
│           │    │   else -> LLM                │                     │
│           │    └──────────────────────────────┘                     │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │      Groq       │ HTTP/2 (connection pooling)                    │
│  │  Llama 3.1 8B   │ stream: true                                   │
│  │  Native Tools   │ TTFT: ~200ms                                   │
│  └────────┬────────┘                                                │
│           │ Token stream (as generated)                             │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │    Cartesia     │ WebSocket (persistent connection)              │
│  │  Sonic Stream   │ TTFA: ~40ms                                    │
│  └────────┬────────┘                                                │
│           │ Audio chunks (as synthesized)                           │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │   SignalWire    │                                                │
│  │  Media Inject   │                                                │
│  └─────────────────┘                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Latency Breakdown (Target)

| Stage             | Time  | Cumulative | Notes               |
| ----------------- | ----- | ---------- | ------------------- |
| Audio buffering   | 20ms  | 20ms       | Minimum for quality |
| STT first partial | 100ms | 120ms      | Interim result      |
| STT final         | 150ms | 150ms      | From speech end     |
| Pattern check     | 1ms   | 151ms      | In-process          |
| LLM TTFT          | 200ms | 351ms      | Groq streaming      |
| TTS TTFA          | 40ms  | 391ms      | Cartesia streaming  |
| Network + buffer  | 50ms  | 441ms      | Same region         |
| **Total**         |       | **~450ms** | Target achieved     |

---

## Code Architecture

### 1. Simplified Turn Manager

```typescript
// lumentra-api/src/services/voice/turn-manager-v2.ts

export class TurnManagerV2 {
  private sttStream: DeepgramStreamingClient;
  private llmClient: GroqStreamingClient;
  private ttsStream: CartesiaStreamingClient;

  // Quick patterns for template responses (no LLM needed)
  private static QUICK_PATTERNS = {
    greeting: /^(hi|hello|hey|good\s*(morning|afternoon|evening))[\s!.,]*$/i,
    farewell: /^(bye|goodbye|thanks|thank you)[\s!.,]*$/i,
    affirmative: /^(yes|yeah|ok|okay|sure)[\s!.,]*$/i,
  };

  async processUserTurn(transcript: string): Promise<void> {
    const startTime = performance.now();

    // Step 1: Quick pattern check (< 1ms)
    const quickMatch = this.checkQuickPatterns(transcript);
    if (quickMatch) {
      await this.speakTemplate(quickMatch);
      this.logLatency("template", startTime);
      return;
    }

    // Step 2: Stream to LLM with tools
    const responseStream = await this.llmClient.streamWithTools(
      transcript,
      this.conversationHistory,
      this.systemPrompt,
      this.tools,
    );

    // Step 3: Stream LLM output directly to TTS
    for await (const chunk of responseStream) {
      if (chunk.type === "text") {
        // Don't wait for full response - stream to TTS
        this.ttsStream.queueText(chunk.content);
      } else if (chunk.type === "tool_call") {
        await this.handleToolCall(chunk);
      }
    }

    this.logLatency("llm", startTime);
  }

  private checkQuickPatterns(text: string): string | null {
    for (const [key, pattern] of Object.entries(TurnManagerV2.QUICK_PATTERNS)) {
      if (pattern.test(text.trim())) {
        return key;
      }
    }
    return null;
  }
}
```

### 2. Groq Streaming Client

```typescript
// lumentra-api/src/services/groq/streaming.ts

import Groq from "groq-sdk";

export class GroqStreamingClient {
  private client: Groq;
  private model = "llama-3.1-8b-instant";

  async *streamWithTools(
    userMessage: string,
    history: Message[],
    systemPrompt: string,
    tools: Tool[],
  ): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      tools: tools,
      stream: true, // CRITICAL: Enable streaming
      temperature: 0.5,
      max_tokens: 150,
    });

    let currentToolCall: PartialToolCall | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield { type: "text", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            currentToolCall = {
              id: tc.id,
              name: tc.function.name,
              arguments: "",
            };
          }
          if (tc.function?.arguments) {
            currentToolCall!.arguments += tc.function.arguments;
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === "tool_calls" && currentToolCall) {
        yield {
          type: "tool_call",
          id: currentToolCall.id,
          name: currentToolCall.name,
          arguments: JSON.parse(currentToolCall.arguments),
        };
        currentToolCall = null;
      }
    }
  }
}
```

### 3. Cartesia Streaming TTS

```typescript
// lumentra-api/src/services/cartesia/streaming.ts

export class CartesiaStreamingClient {
  private ws: WebSocket | null = null;
  private contextId: string;
  private textBuffer: string[] = [];
  private isProcessing = false;

  async connect(): Promise<void> {
    this.ws = new WebSocket(
      `wss://api.cartesia.ai/tts/websocket?api_key=${this.apiKey}&cartesia_version=2024-06-10`,
    );

    this.ws.on("message", (data) => {
      const response = JSON.parse(data.toString());
      if (response.type === "chunk") {
        // Immediately send to SignalWire
        this.onAudioChunk(Buffer.from(response.data, "base64"));
      }
    });

    // Keep connection alive
    this.startHeartbeat();
  }

  queueText(text: string): void {
    this.textBuffer.push(text);
    if (!this.isProcessing) {
      this.processBuffer();
    }
  }

  private async processBuffer(): Promise<void> {
    this.isProcessing = true;

    while (this.textBuffer.length > 0) {
      const text = this.textBuffer.shift()!;

      // Stream to Cartesia with context for consistent voice
      this.ws?.send(
        JSON.stringify({
          model_id: "sonic-english",
          transcript: text,
          voice: { mode: "id", id: this.voiceId },
          context_id: this.contextId, // Maintains voice consistency
          output_format: {
            container: "raw",
            encoding: "pcm_mulaw",
            sample_rate: 8000,
          },
          continue: this.textBuffer.length > 0, // Signal more coming
        }),
      );
    }

    this.isProcessing = false;
  }

  private startHeartbeat(): void {
    // Keep WebSocket alive to avoid reconnection latency
    setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 15000);
  }
}
```

### 4. Connection Manager

```typescript
// lumentra-api/src/services/connections/manager.ts

export class ConnectionManager {
  private static instance: ConnectionManager;

  private deepgramPool: WebSocket[] = [];
  private cartesiaPool: WebSocket[] = [];
  private groqClient: Groq;

  private constructor() {
    // Pre-warm connections on startup
    this.warmConnections();
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  private async warmConnections(): Promise<void> {
    // Pre-create Deepgram connections (keep 5 warm)
    for (let i = 0; i < 5; i++) {
      this.deepgramPool.push(await this.createDeepgramConnection());
    }

    // Pre-create Cartesia connections (keep 5 warm)
    for (let i = 0; i < 5; i++) {
      this.cartesiaPool.push(await this.createCartesiaConnection());
    }

    // Groq uses HTTP/2 with connection reuse automatically
    this.groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      // HTTP/2 handles connection pooling
    });

    console.log("[CONN] Pre-warmed 5 Deepgram + 5 Cartesia connections");
  }

  async getDeepgramConnection(): Promise<WebSocket> {
    if (this.deepgramPool.length > 0) {
      return this.deepgramPool.pop()!;
    }
    // Create new if pool exhausted
    return this.createDeepgramConnection();
  }

  returnDeepgramConnection(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN && this.deepgramPool.length < 10) {
      this.deepgramPool.push(ws);
    } else {
      ws.close();
    }
  }
}
```

---

## Tools Configuration

### Voice Agent Tools (for Groq)

```typescript
// lumentra-api/src/services/groq/tools.ts

export const voiceAgentTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check available appointment slots. Use when user asks about availability.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format",
          },
          service_type: {
            type: "string",
            description: "Type of service (optional)",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_booking",
      description:
        "Create a booking. Use ONLY when user confirms time and provides name.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_phone: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
        },
        required: ["customer_name", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description:
        "Transfer to staff. Use ONLY for complaints, complex issues, or explicit requests.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
        required: ["reason"],
      },
    },
  },
];
```

---

## System Prompt Optimization

```typescript
// lumentra-api/src/services/groq/prompts.ts

export function buildOptimizedSystemPrompt(
  agentName: string,
  businessName: string,
  industry: string,
): string {
  return `You are ${agentName}, voice assistant for ${businessName} (${industry}).

CRITICAL RULES:
- Keep responses under 30 words
- Never use bullet points or lists
- Sound natural, like a phone conversation
- Confirm details by repeating them back
- Use tools only when you have enough info

TOOL USAGE:
- check_availability: Use when user asks about times/dates
- create_booking: Use ONLY when you have name AND date/time confirmed
- transfer_to_human: Use for complaints, refunds, or when user requests

RESPONSE STYLE:
- Good: "I have 2pm and 4pm available tomorrow. Which works better?"
- Bad: "Available times: 1. 2pm 2. 4pm 3. 5pm"

Never explain what you're doing. Just do it naturally.`;
}
```

---

## Metrics & Monitoring

```typescript
// lumentra-api/src/lib/metrics.ts

export interface LatencyMetrics {
  sttTTFT: number; // Time to first transcript
  sttFinal: number; // Time to final transcript
  llmTTFT: number; // Time to first token
  llmComplete: number; // Time to completion
  ttsTTFA: number; // Time to first audio
  ttsComplete: number; // Time to complete audio
  e2eLatency: number; // End-to-end voice-to-voice
}

export class MetricsCollector {
  private metrics: LatencyMetrics[] = [];

  record(metrics: LatencyMetrics): void {
    this.metrics.push(metrics);

    // Log if exceeding targets
    if (metrics.e2eLatency > 500) {
      console.warn(`[METRICS] High latency: ${metrics.e2eLatency}ms`, {
        breakdown: {
          stt: metrics.sttFinal,
          llm: metrics.llmTTFT,
          tts: metrics.ttsTTFA,
        },
      });
    }
  }

  getP95(): LatencyMetrics {
    const sorted = [...this.metrics].sort(
      (a, b) => a.e2eLatency - b.e2eLatency,
    );
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx];
  }
}
```

---

## Fallback Strategy

```typescript
// lumentra-api/src/services/fallback/multi-provider.ts

export class MultiProviderFallback {
  private providers = {
    stt: ["deepgram", "groq-whisper", "assemblyai"],
    llm: ["groq", "cerebras", "together"],
    tts: ["cartesia", "elevenlabs", "smallest"],
  };

  private currentProviders = {
    stt: "deepgram",
    llm: "groq",
    tts: "cartesia",
  };

  async executeWithFallback<T>(
    type: "stt" | "llm" | "tts",
    fn: (provider: string) => Promise<T>,
  ): Promise<T> {
    const providers = this.providers[type];

    for (const provider of providers) {
      try {
        return await fn(provider);
      } catch (error) {
        console.error(`[FALLBACK] ${provider} failed:`, error);
        // Continue to next provider
      }
    }

    throw new Error(`All ${type} providers failed`);
  }
}
```

---

## Migration Checklist

### Files to Delete

- [ ] `src/services/functiongemma/router.ts`
- [ ] `src/services/functiongemma/types.ts`

### Files to Modify

- [ ] `src/services/groq/client.ts` - Add streaming config
- [ ] `src/services/voice/turn-manager.ts` - Remove FunctionGemma, simplify
- [ ] `src/services/fallback/chain.ts` - Remove router, simplify
- [ ] `src/services/deepgram/client.ts` - Reduce utteranceEndMs
- [ ] `src/index.ts` - Remove FunctionGemma health check

### Files to Add

- [ ] `src/services/groq/streaming.ts` - Streaming client
- [ ] `src/services/cartesia/streaming.ts` - Streaming TTS
- [ ] `src/services/connections/manager.ts` - Connection pooling
- [ ] `src/lib/metrics.ts` - Latency tracking

### Environment Variables to Add

```bash
# Production Groq (not free tier)
GROQ_API_KEY=gsk_xxx  # Paid tier key

# Fallback providers
CEREBRAS_API_KEY=xxx
ASSEMBLYAI_API_KEY=xxx
ELEVENLABS_API_KEY=xxx
```

---

## Human Transfer Handling

### Design Philosophy

The AI agent is designed to sound human and handle calls independently. Customers should not realize they're talking to an AI. The goal is to **resolve calls without human intervention** while gracefully handling requests for human transfer.

### Transfer Request Flow

```text
Customer asks for human
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  ATTEMPT 1: Polite redirect                         │
│  "I'd be happy to help you with that right now.     │
│   Our team members are currently assisting other    │
│   customers. What can I help you with today?"       │
└─────────────────────────────────────────────────────┘
         │
         ▼ (customer insists)
┌─────────────────────────────────────────────────────┐
│  ATTEMPT 2: Acknowledge + offer value               │
│  "I understand. I can actually handle most          │
│   requests including bookings, changes, and         │
│   questions. Could you tell me what you need?       │
│   I might be able to resolve this quickly for you." │
└─────────────────────────────────────────────────────┘
         │
         ▼ (customer still insists / gets frustrated / angry)
┌─────────────────────────────────────────────────────┐
│  ATTEMPT 3: Stay calm, attempt transfer             │
│  "Of course, let me connect you with a team member."│
│                                                     │
│  Check: Is human available?                         │
│  ├─ YES → Transfer with context                     │
│  └─ NO  → Continue to UNAVAILABLE flow              │
└─────────────────────────────────────────────────────┘
         │
         ▼ (human unavailable)
┌─────────────────────────────────────────────────────┐
│  UNAVAILABLE: Final offer                           │
│  "I apologize, but our team members are all         │
│   currently occupied. Would you like me to:         │
│   - Take a message and have someone call you back?  │
│   - Schedule a specific callback time?              │
│   - See if I can help with your request?"           │
│                                                     │
│  → Do whatever the customer chooses                 │
└─────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// lumentra-api/src/services/voice/human-transfer.ts

export interface TransferState {
  attempts: number;
  customerMood: "neutral" | "frustrated" | "angry";
  lastRequest: string;
}

export class HumanTransferHandler {
  private state: TransferState = {
    attempts: 0,
    customerMood: "neutral",
    lastRequest: "",
  };

  // Detect transfer request in transcript
  detectTransferIntent(transcript: string): boolean {
    const patterns = [
      /speak\s*(to|with)?\s*(a\s*)?(human|person|someone|representative|agent|staff|manager)/i,
      /talk\s*(to|with)?\s*(a\s*)?(human|person|someone|representative|agent|staff|manager)/i,
      /transfer\s*(me)?\s*(to)?\s*(a\s*)?(human|person|someone|representative|agent|staff)/i,
      /real\s*person/i,
      /not\s*(a\s*)?robot/i,
      /actual\s*human/i,
    ];
    return patterns.some((p) => p.test(transcript));
  }

  // Detect escalating frustration
  detectFrustration(transcript: string): "neutral" | "frustrated" | "angry" {
    const angryPatterns = [
      /fuck|shit|damn|hell|ass|stupid|idiot/i,
      /this\s*is\s*(ridiculous|bullshit|insane)/i,
      /what\s*the\s*(hell|fuck)/i,
    ];

    const frustratedPatterns = [
      /I\s*(already|just)\s*said/i,
      /I\s*told\s*you/i,
      /I\s*don'?t\s*want\s*(to|this)/i,
      /stop|enough|please\s*just/i,
      /are\s*you\s*(even\s*)?listening/i,
    ];

    if (angryPatterns.some((p) => p.test(transcript))) return "angry";
    if (frustratedPatterns.some((p) => p.test(transcript))) return "frustrated";
    return "neutral";
  }

  // Get appropriate response based on state
  async handleTransferRequest(
    transcript: string,
    tenantConfig: TenantConfig,
  ): Promise<TransferResponse> {
    this.state.attempts++;
    this.state.customerMood = this.detectFrustration(transcript);
    this.state.lastRequest = transcript;

    // Skip straight to transfer if angry or 3+ attempts
    if (this.state.customerMood === "angry" || this.state.attempts >= 3) {
      return this.attemptTransfer(tenantConfig);
    }

    // Attempt 1: Polite redirect
    if (this.state.attempts === 1) {
      return {
        action: "respond",
        message: this.getAttempt1Response(tenantConfig),
      };
    }

    // Attempt 2: Acknowledge + offer value
    if (this.state.attempts === 2) {
      return {
        action: "respond",
        message: this.getAttempt2Response(tenantConfig),
      };
    }

    // Should not reach here, but fallback to transfer
    return this.attemptTransfer(tenantConfig);
  }

  private getAttempt1Response(config: TenantConfig): string {
    return `I'd be happy to help you with that right now. Our team is currently assisting other ${config.terminology.customer}s. What can I help you with?`;
  }

  private getAttempt2Response(config: TenantConfig): string {
    return `I understand. I can actually handle most requests including ${config.capabilities.join(", ")}. Could you tell me what you need? I might be able to resolve this quickly for you.`;
  }

  private async attemptTransfer(
    config: TenantConfig,
  ): Promise<TransferResponse> {
    const isAvailable = await this.checkHumanAvailability(config);

    if (isAvailable) {
      return {
        action: "transfer",
        message:
          "Of course, let me connect you with a team member. One moment please.",
        transferTo: config.transferNumber,
        context: this.buildTransferContext(),
      };
    }

    // Human unavailable - final options
    return {
      action: "respond",
      message:
        "I apologize, but our team members are all currently occupied. Would you like me to take a message and have someone call you back, or schedule a specific callback time? I can also try to help with your request if you'd like.",
      awaitingChoice: true,
      options: ["callback", "message", "continue_with_ai"],
    };
  }

  private async checkHumanAvailability(config: TenantConfig): Promise<boolean> {
    // Check if within business hours
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    const hours = config.businessHours[currentDay];
    if (!hours || !hours.open) return false;

    const [openHour] = hours.openTime.split(":").map(Number);
    const [closeHour] = hours.closeTime.split(":").map(Number);

    if (currentHour < openHour || currentHour >= closeHour) return false;

    // Check current call queue / staff availability via integration
    // This would connect to the business's PBX or call center software
    return config.humanAvailable ?? true;
  }

  private buildTransferContext(): TransferContext {
    return {
      conversationSummary: this.state.lastRequest,
      customerMood: this.state.customerMood,
      attemptsMade: this.state.attempts,
      timestamp: new Date().toISOString(),
    };
  }
}

export interface TransferResponse {
  action: "respond" | "transfer";
  message: string;
  transferTo?: string;
  context?: TransferContext;
  awaitingChoice?: boolean;
  options?: string[];
}

export interface TransferContext {
  conversationSummary: string;
  customerMood: string;
  attemptsMade: number;
  timestamp: string;
}
```

### System Prompt Addition for Human Transfer

```typescript
// Add to system prompt

const HUMAN_TRANSFER_INSTRUCTIONS = `
HUMAN TRANSFER RULES:
When a customer asks to speak with a human:
1. First attempt: Politely offer to help. You can handle most requests.
2. Second attempt: Acknowledge their request, explain your capabilities, ask what they need.
3. Third attempt OR if customer is angry/frustrated: Attempt transfer immediately.

IMPORTANT:
- Never argue or make the customer feel unheard
- Stay calm even if they use profanity
- If transfer unavailable, offer: callback, message, or continue with AI
- Let the customer choose - do not force any option

NEVER SAY:
- "I'm just an AI"
- "I can't do that because I'm a computer"
- "Let me transfer you to a real person"
- Any phrase that reveals you're AI
`;
```

### Metrics to Track

```typescript
interface TransferMetrics {
  totalTransferRequests: number;
  resolvedWithoutTransfer: number; // Success metric
  transfersCompleted: number;
  transfersUnavailable: number;
  averageAttemptsBeforeTransfer: number;
  customerMoodAtTransfer: {
    neutral: number;
    frustrated: number;
    angry: number;
  };
}
```

---

## Testing Plan

### 1. Unit Tests

- Quick pattern matching
- Tool parsing
- Streaming text chunking
- Transfer intent detection
- Frustration detection

### 2. Integration Tests

- Groq streaming with tools
- Cartesia WebSocket streaming
- End-to-end turn processing
- Human transfer flow (all paths)

### 3. Load Tests

- 100 concurrent calls
- 1000 concurrent calls
- Latency under load (p50, p95, p99)

### 4. Chaos Tests

- Provider failure simulation
- Network latency injection
- Connection drop recovery
