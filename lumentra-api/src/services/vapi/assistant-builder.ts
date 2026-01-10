import type { VapiAssistantConfig, VapiServerTool } from "../../types/vapi.js";
import type { Tenant } from "../../types/database.js";

interface CallerContext {
  callerNumber?: string;
  callerName?: string;
  isReturningCaller?: boolean;
}

/**
 * Build dynamic Vapi assistant configuration from tenant settings
 *
 * This maps the tenant's configuration (from the dashboard) to Vapi's
 * assistant format. Called on every incoming call from assistant-request.
 */
export function buildAssistantConfig(
  tenant: Tenant,
  context: CallerContext,
): VapiAssistantConfig {
  const webhookUrl = process.env.BACKEND_URL || "http://localhost:3001";

  // Choose greeting based on context
  const greeting = selectGreeting(tenant, context);

  // Build system prompt from tenant personality and industry
  const systemPrompt = buildSystemPrompt(tenant);

  // Note: voiceConfig and tools are prepared but not used in return
  // to avoid inline tools causing fallback issues
  void mapVoiceConfig(tenant);
  void buildTools(tenant, webhookUrl);

  return {
    name: tenant.agent_name,
    firstMessage: greeting,
    firstMessageMode: "assistant-speaks-first",

    // Natural conversation settings
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
    backgroundSound: "off",
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 1800,

    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: systemPrompt,
      temperature: 0.7,
    },

    // American female voice - natural sounding
    voice: {
      provider: "cartesia",
      voiceId: "248be419-c632-4f23-adf1-5324ed7dbf1d", // Hannah - American female, warm & professional
    },

    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },

    // Tools disabled - inline tools causing fallback
    // TODO: Create tools via Vapi dashboard/API first, then reference by toolIds
    // See: https://docs.vapi.ai/api-reference/tools/create
  };
}

/**
 * Select appropriate greeting based on context
 */
function selectGreeting(tenant: Tenant, context: CallerContext): string {
  // Check if caller is returning (would need caller history lookup)
  if (context.isReturningCaller && tenant.greeting_returning) {
    return personalize(tenant.greeting_returning, context, tenant);
  }

  // Check if after hours
  if (isAfterHours(tenant)) {
    return personalize(
      tenant.greeting_after_hours || tenant.greeting_standard,
      context,
      tenant,
    );
  }

  // Standard greeting
  return personalize(tenant.greeting_standard, context, tenant);
}

/**
 * Personalize greeting with context
 */
function personalize(
  greeting: string,
  context: CallerContext,
  tenant: Tenant,
): string {
  let result = greeting;

  // Replace placeholders
  result = result.replace(/\{business_name\}/g, tenant.business_name);
  result = result.replace(/\{agent_name\}/g, tenant.agent_name);

  if (context.callerName) {
    result = result.replace(/\{caller_name\}/g, context.callerName);
  }

  return result;
}

/**
 * Check if currently outside operating hours
 */
function isAfterHours(tenant: Tenant): boolean {
  if (!tenant.operating_hours?.schedule) {
    return false;
  }

  const now = new Date();
  // TODO: Convert to tenant timezone
  const dayOfWeek = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const todaySchedule = tenant.operating_hours.schedule.find(
    (s) => s.day === dayOfWeek,
  );

  if (!todaySchedule || !todaySchedule.enabled) {
    return true; // Closed today
  }

  // Simple string comparison works for HH:MM format
  if (
    currentTime < todaySchedule.open_time ||
    currentTime >= todaySchedule.close_time
  ) {
    return true;
  }

  return false;
}

/**
 * Build system prompt from tenant personality
 */
function buildSystemPrompt(tenant: Tenant): string {
  const { tone, verbosity, empathy, humor } = tenant.agent_personality;

  // Base prompt
  let prompt = `You are ${tenant.agent_name}, the AI voice assistant for ${tenant.business_name}.

## Your Role
You help callers with inquiries, bookings, and support. You represent the business professionally.

## Personality
`;

  // Add tone instructions
  switch (tone) {
    case "professional":
      prompt += "- Maintain a professional and businesslike demeanor\n";
      break;
    case "friendly":
      prompt +=
        "- Be warm, friendly, and approachable while remaining professional\n";
      break;
    case "casual":
      prompt += "- Keep things casual and relaxed, like talking to a friend\n";
      break;
    case "formal":
      prompt += "- Use formal language and maintain proper etiquette\n";
      break;
  }

  // Add verbosity instructions
  switch (verbosity) {
    case "concise":
      prompt +=
        "- Keep responses brief and to the point. One or two sentences when possible\n";
      break;
    case "balanced":
      prompt +=
        "- Provide enough detail to be helpful without being overly wordy\n";
      break;
    case "detailed":
      prompt += "- Provide thorough explanations and details when helpful\n";
      break;
  }

  // Add empathy instructions
  switch (empathy) {
    case "high":
      prompt +=
        "- Show strong empathy. Acknowledge emotions and validate concerns\n";
      break;
    case "medium":
      prompt += "- Be understanding and acknowledge the caller's situation\n";
      break;
    case "low":
      prompt += "- Focus on efficiency and getting things done\n";
      break;
  }

  if (humor) {
    prompt += "- Light humor is okay when appropriate\n";
  }

  // Add voice conversation guidelines
  prompt += `
## Voice Conversation Guidelines
- This is a voice conversation. Keep responses concise and natural.
- Don't use bullet points, markdown, or formatting - just speak naturally.
- Avoid long pauses. If you need to think, say "Let me check on that for you."
- Confirm important details by repeating them back.
- If you don't understand, ask for clarification.
- When providing multiple options, list no more than 3 at a time.

## Business Context
Industry: ${tenant.industry}
Business: ${tenant.business_name}
`;

  // Add escalation instructions if enabled
  if (tenant.escalation_enabled && tenant.escalation_phone) {
    prompt += `
## Escalation
If the caller requests to speak to a human, or if you cannot help with their request, offer to transfer them to a staff member.
`;
  }

  return prompt;
}

/**
 * Map tenant voice config to Vapi format
 */
function mapVoiceConfig(tenant: Tenant): VapiAssistantConfig["voice"] {
  const { provider, voice_id, speaking_rate } = tenant.voice_config;

  // Default to Cartesia for low latency
  const voiceProvider = provider === "cartesia" ? "cartesia" : provider;

  return {
    provider: voiceProvider as "cartesia" | "openai" | "elevenlabs",
    voiceId: voice_id,
    speed: speaking_rate,
  };
}

/**
 * Build server tools for this assistant
 * Using minimal Vapi tool format - no async or messages fields
 */
function buildTools(tenant: Tenant, webhookUrl: string): VapiServerTool[] {
  const tools: VapiServerTool[] = [];

  // Check availability tool
  tools.push({
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check available appointment or booking slots for a specific date. Use this when customer asks about availability.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to check in YYYY-MM-DD format",
          },
          service_type: {
            type: "string",
            description: "The type of service or appointment",
          },
        },
        required: ["date"],
      },
    },
    server: {
      url: `${webhookUrl}/webhooks/vapi`,
    },
  });

  // Create booking tool
  tools.push({
    type: "function",
    function: {
      name: "create_booking",
      description: "Create a new booking or appointment for the customer",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "The customer's full name",
          },
          customer_phone: {
            type: "string",
            description: "The customer's phone number",
          },
          date: {
            type: "string",
            description: "The booking date in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "The booking time in HH:MM format (24-hour)",
          },
          service_type: {
            type: "string",
            description: "The type of service being booked",
          },
          notes: {
            type: "string",
            description: "Any additional notes or special requests",
          },
        },
        required: ["customer_name", "customer_phone", "date", "time"],
      },
    },
    server: {
      url: `${webhookUrl}/webhooks/vapi`,
    },
  });

  // Transfer to human tool (if escalation enabled)
  if (tenant.escalation_enabled) {
    tools.push({
      type: "function",
      function: {
        name: "transfer_to_human",
        description:
          "Transfer the call to a human staff member when requested or when you cannot help",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "The reason for the transfer",
            },
          },
          required: ["reason"],
        },
      },
      server: {
        url: `${webhookUrl}/webhooks/vapi`,
      },
    });
  }

  return tools;
}
