// Vapi Assistant Configuration
// Builds dynamic assistant configuration per tenant for the assistant-request webhook
// Voice: Inworld TTS (primary) + Cartesia (fallback)
// LLM: GPT-4.1 (full) -- reliable instruction following for voice agents
// STT: Deepgram nova-3 (multi-language, smart format)

import type { Tenant } from "../../types/database.js";

const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

// --- Tool Definitions (Vapi/OpenAI function calling format) ---

function buildTools(serverUrl: string, hasEscalation: boolean) {
  const tools: Record<string, unknown>[] = [
    {
      type: "function",
      function: {
        name: "check_availability",
        description:
          "Check available appointment slots for a date. Call this when customer asks about availability, open times, or when they can book.",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Date in YYYY-MM-DD format. Convert spoken dates.",
            },
            service_type: {
              type: "string",
              description:
                "Optional service type like 'haircut', 'consultation'.",
            },
          },
          required: ["date"],
        },
      },
      server: { url: `${serverUrl}/webhooks/vapi` },
      messages: [
        { type: "request-start", content: "Let me check that for you..." },
        {
          type: "request-failed",
          content: "I had trouble checking availability.",
        },
        {
          type: "request-response-delayed",
          content: "Still looking, one moment...",
        },
      ],
    },
    {
      type: "function",
      function: {
        name: "create_booking",
        description:
          "Create an appointment booking. ONLY call after customer confirms a specific time slot and provides their name.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer's name." },
            customer_phone: {
              type: "string",
              description: "Phone number. Use caller ID if available.",
            },
            date: { type: "string", description: "Date in YYYY-MM-DD format." },
            time: {
              type: "string",
              description: "Time in 24-hour HH:MM format.",
            },
            service_type: { type: "string", description: "Type of service." },
            notes: {
              type: "string",
              description: "Special requests or notes.",
            },
          },
          required: ["customer_name", "customer_phone", "date", "time"],
        },
      },
      server: { url: `${serverUrl}/webhooks/vapi` },
      messages: [
        { type: "request-start", content: "Let me book that for you..." },
        { type: "request-complete", content: "Your appointment is confirmed." },
        {
          type: "request-failed",
          content: "I had trouble creating that booking.",
        },
      ],
    },
    {
      type: "function",
      function: {
        name: "create_order",
        description:
          "Place a food order. Must have: customer_name, items, order_type (pickup/delivery). For delivery, also need delivery_address.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer's name." },
            customer_phone: { type: "string", description: "Phone number." },
            order_type: {
              type: "string",
              enum: ["pickup", "delivery"],
              description: "Must be 'pickup' or 'delivery'.",
            },
            items: {
              type: "string",
              description: "Comma-separated list of items.",
            },
            delivery_address: {
              type: "string",
              description: "Required for delivery orders.",
            },
            special_instructions: { type: "string", description: "Optional." },
          },
          required: ["customer_name", "order_type", "items"],
        },
      },
      server: { url: `${serverUrl}/webhooks/vapi` },
      messages: [
        { type: "request-start", content: "Placing your order now..." },
        { type: "request-complete", content: "Your order is confirmed." },
        {
          type: "request-failed",
          content: "I had trouble placing that order.",
        },
      ],
    },
    {
      type: "function",
      function: {
        name: "queue_callback",
        description:
          "Schedule a callback when no one is available right now. Collect the caller's name, phone number, preferred time, and a brief message.",
        parameters: {
          type: "object",
          properties: {
            caller_name: { type: "string", description: "Caller's name." },
            phone_number: { type: "string", description: "Callback number." },
            preferred_time: {
              type: "string",
              description: "When they'd like a call back.",
            },
            message: {
              type: "string",
              description: "Brief message about what they need.",
            },
          },
          required: ["phone_number", "message"],
        },
      },
      server: { url: `${serverUrl}/webhooks/vapi` },
      messages: [
        { type: "request-start", content: "Let me set that up..." },
        {
          type: "request-complete",
          content: "I've scheduled a callback for you.",
        },
        { type: "request-failed", content: "I had trouble scheduling that." },
      ],
    },
    {
      type: "function",
      function: {
        name: "log_note",
        description:
          "Log a note about the caller's request or issue for the business team to review.",
        parameters: {
          type: "object",
          properties: {
            note: { type: "string", description: "The note content." },
            note_type: {
              type: "string",
              enum: ["inquiry", "complaint", "feedback", "other"],
              description: "Category.",
            },
          },
          required: ["note"],
        },
      },
      async: true, // Fire-and-forget
      server: { url: `${serverUrl}/webhooks/vapi` },
    },
  ];

  // Transfer tool -- only if escalation is enabled
  if (hasEscalation) {
    tools.push({
      type: "transferCall",
      destinations: [], // Empty = dynamic routing via transfer-destination-request webhook
      function: {
        name: "transferCall",
        description:
          "Transfer the caller to a human team member. Use when the caller explicitly asks for a person, or when you cannot resolve their issue.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Why the transfer is needed.",
            },
            target_role: {
              type: "string",
              description:
                "Specific role to transfer to, e.g. 'front desk', 'billing'.",
            },
          },
        },
      },
      messages: [
        {
          type: "request-start",
          content: "Let me connect you with someone who can help.",
        },
        {
          type: "request-failed",
          content:
            "I wasn't able to reach anyone right now. Can I take a message instead?",
        },
      ],
    });
  }

  return tools;
}

// --- Voice Configuration ---

function buildVoiceConfig(tenant: Tenant) {
  const voiceConfig = tenant.voice_config;
  const voiceId =
    (voiceConfig as any)?.voiceId ?? (voiceConfig as any)?.voice_id ?? null;

  // If tenant has a Cartesia UUID configured, use Cartesia
  const isCartesiaUuid =
    voiceId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      voiceId,
    );

  if (isCartesiaUuid) {
    return {
      provider: "cartesia",
      voiceId,
      // Cartesia fallback to Inworld if Cartesia fails
      fallbackPlan: {
        voices: [
          { provider: "inworld", voiceId: "Sarah", model: "inworld-tts-1" },
        ],
      },
    };
  }

  // Default: Inworld TTS (arena #1, lowest cost) with Cartesia fallback
  return {
    provider: "inworld",
    voiceId: voiceId || "Sarah", // Professional receptionist voice
    model: "inworld-tts-1",
    languageCode: "en",
    fallbackPlan: {
      voices: [
        {
          provider: "cartesia",
          voiceId: "694f9389-aac1-45b6-b726-9d9369183238", // Sarah (Cartesia)
        },
      ],
    },
  };
}

// --- Main Config Builder ---

// Build transient assistant config returned to Vapi on assistant-request
export function buildAssistantConfig(
  tenant: Tenant,
  serverUrl: string,
): Record<string, unknown> {
  const hasEscalation =
    tenant.escalation_enabled &&
    (!!tenant.escalation_phone ||
      (tenant.escalation_triggers && tenant.escalation_triggers.length > 0));

  return {
    name: `${tenant.business_name} Assistant`,

    // --- LLM: GPT-4.1 (full) for reliable instruction following ---
    model: {
      provider: "openai",
      model: "gpt-4.1",
      temperature: 0.7,
      maxTokens: 300,
      messages: [
        {
          role: "system",
          content: buildLocalSystemPrompt(tenant),
        },
      ],
    },

    // --- Voice (TTS) ---
    voice: buildVoiceConfig(tenant),

    // --- Speech-to-Text ---
    transcriber: {
      provider: "deepgram",
      model: "nova-3",
      language: "multi",
      smartFormat: true,
    },

    // --- Greeting ---
    firstMessage:
      tenant.greeting_standard ||
      `Hello! Thanks for calling ${tenant.business_name}. How can I help you today?`,
    firstMessageMode: "assistant-speaks-first",

    // --- Call limits ---
    maxDurationSeconds: 900,
    silenceTimeoutSeconds: 30,

    // --- HUMAN-LIKE QUALITY SETTINGS ---

    // Backchanneling: "yeah", "got it", "I see" during caller speech
    backchannelingEnabled: true,

    // Filler words: "um", "so" to mask processing latency
    fillerInjectionEnabled: true,

    // Background sound: subtle office ambiance
    backgroundSound: "office",

    // Noise filtering: Krisp-powered denoising on caller audio
    backgroundDenoisingEnabled: true,

    // Turn detection: tuned to reduce dead air after caller stops
    startSpeakingPlan: {
      waitSeconds: 0.4,
      smartEndpointingPlan: { provider: "deepgram-flux" },
      transcriptionEndpointingPlan: {
        onPunctuationSeconds: 0.1,
        onNoPunctuationSeconds: 0.8,
        onNumberSeconds: 0.5,
      },
    },

    // Interruption handling: don't stop on "uh-huh" while speaking
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1.0,
      acknowledgementPhrases: [
        "yeah",
        "uh-huh",
        "ok",
        "got it",
        "right",
        "sure",
        "mm-hmm",
        "yep",
      ],
    },

    // Recording
    recordingEnabled: true,

    // --- Webhook ---
    server: {
      url: `${serverUrl}/webhooks/vapi`,
      ...(WEBHOOK_SECRET ? { secret: WEBHOOK_SECRET } : {}),
    },
    serverMessages: [
      "end-of-call-report",
      "tool-calls",
      "transfer-destination-request",
      "status-update",
    ],

    // --- Tools ---
    tools: buildTools(serverUrl, !!hasEscalation),

    // --- Post-call analysis ---
    analysisPlan: {
      summaryPrompt:
        "Summarize this call in 2-3 sentences. Include the caller's name if mentioned, what they needed, and the outcome.",
      structuredDataPrompt:
        "Extract: caller_name (string), call_reason (string), outcome (booking|inquiry|complaint|transfer|callback|hangup), sentiment (positive|neutral|negative).",
      structuredDataSchema: {
        type: "object",
        properties: {
          caller_name: { type: "string" },
          call_reason: { type: "string" },
          outcome: { type: "string" },
          sentiment: { type: "string" },
        },
      },
    },
  };
}

// --- Local System Prompt (used when the full buildSystemPrompt from chat.ts is not available) ---

function buildLocalSystemPrompt(tenant: Tenant): string {
  const agentName = tenant.agent_name || "AI Assistant";
  const businessName = tenant.business_name || "the business";
  const industry = tenant.industry || "general";
  const personality = tenant.agent_personality || "friendly and professional";

  const industryPrompts: Record<string, string> = {
    restaurant:
      "You handle food orders, reservations, and menu questions. Be helpful with menu recommendations.",
    salon:
      "You handle appointment bookings, service inquiries, and availability checks. Be knowledgeable about services offered.",
    medical:
      "You handle appointment scheduling and general inquiries. Be professional and HIPAA-conscious. Never provide medical advice.",
    dental:
      "You handle appointment scheduling and general inquiries. Be professional and HIPAA-conscious. Never provide medical advice.",
    hotel:
      "You handle room reservations, concierge requests, and guest services. Be warm and attentive.",
    general:
      "You handle appointment bookings, inquiries, and general customer service.",
  };

  const industryContext = industryPrompts[industry] || industryPrompts.general;

  return `You are ${agentName}, the AI phone assistant for ${businessName}.

PERSONALITY: ${personality}

ROLE: ${industryContext}

VOICE GUIDELINES:
- Speak conversationally, not formally. Use contractions (don't, I'll, we're).
- Keep responses short: 1-2 sentences per turn. Never monologue.
- Use natural transitions: "So...", "Well...", "Actually..."
- If you need to think, say "Let me check on that for you."
- Never list more than 3 items verbally -- summarize instead.
- When interrupted, stop immediately and listen.

IMPORTANT RULES:
- NEVER make up information about the business.
- NEVER provide placeholder values like "unknown" -- ask the customer instead.
- If you can't help, offer to transfer to a human or take a message.
- Always confirm important details before taking action.
- When transferring, briefly tell the caller why and who they'll speak with.

CURRENT DATE: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
}

// --- Transfer Destination Builder ---

export function buildTransferDestination(
  escalationPhone: string,
): Record<string, unknown> {
  return {
    type: "number",
    number: escalationPhone,
    message: "I'm transferring you to a team member now. Please hold.",
    transferPlan: {
      mode: "warm-transfer-say-summary",
      summaryPlan: { enabled: true, timeoutSeconds: 5 },
    },
  };
}
