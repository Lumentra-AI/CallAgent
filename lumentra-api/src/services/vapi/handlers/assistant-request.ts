import type {
  VapiWebhookPayload,
  VapiAssistantConfig,
} from "../../../types/vapi.js";
import { getTenantByPhoneWithFallback } from "../../database/tenant-cache.js";
import { buildAssistantConfig } from "../assistant-builder.js";

/**
 * Handle assistant-request webhook
 *
 * CRITICAL PATH - This is called at the start of every incoming call.
 * Must respond in <50ms for optimal latency.
 *
 * The response tells Vapi which assistant configuration to use for this call.
 * We build it dynamically based on the tenant's settings.
 */
export async function handleAssistantRequest(
  payload: VapiWebhookPayload,
): Promise<{ assistant?: VapiAssistantConfig; error?: string }> {
  const startTime = Date.now();

  try {
    // Try multiple paths to get the phone number (Vapi payload structure varies)
    const call = payload.message?.call;
    const messagePhoneNumber = payload.message?.phoneNumber;

    // Log available fields for debugging
    console.log("[ASSISTANT-REQUEST] Call data:", {
      callPhoneNumber: call?.phoneNumber,
      messagePhoneNumber: messagePhoneNumber?.number,
      phoneNumberId: call?.phoneNumberId,
      type: call?.type,
      id: call?.id,
    });

    // Try to get phone number from multiple locations
    // 1. First try message.phoneNumber.number (most reliable for inbound)
    // 2. Then try call.phoneNumber.number
    // 3. Finally fallback to env variable
    let vapiPhoneNumber =
      messagePhoneNumber?.number || call?.phoneNumber?.number;

    // If not found, check if we have a phoneNumberId and use our configured phone
    if (!vapiPhoneNumber && call?.phoneNumberId) {
      // Use the phone number from env as fallback when we have a phoneNumberId
      vapiPhoneNumber = process.env.VAPI_PHONE_ID;
      console.log(
        "[ASSISTANT-REQUEST] Using VAPI_PHONE_ID as phone number:",
        vapiPhoneNumber,
      );
    }

    if (!vapiPhoneNumber) {
      console.error(
        "[ASSISTANT-REQUEST] No phone number found in payload or env",
      );
      // Return default assistant instead of error so call doesn't fail
      return { assistant: buildDefaultAssistant() };
    }

    // Look up tenant by their Vapi phone number (from cache - fast!)
    const tenant = await getTenantByPhoneWithFallback(vapiPhoneNumber);

    if (!tenant) {
      console.warn(
        `[ASSISTANT-REQUEST] No tenant found for phone: ${vapiPhoneNumber}`,
      );
      // Return a default assistant for unknown numbers
      return {
        assistant: buildDefaultAssistant(),
      };
    }

    // Get caller info
    const callerNumber = payload.message?.customer?.number;
    const callerName = payload.message?.customer?.name;

    console.log(
      `[ASSISTANT-REQUEST] Tenant: ${tenant.business_name}, Caller: ${callerNumber || "unknown"}`,
    );

    // Build dynamic assistant config from tenant settings
    const assistant = buildAssistantConfig(tenant, {
      callerNumber,
      callerName,
    });

    const latency = Date.now() - startTime;
    console.log(`[ASSISTANT-REQUEST] Built config in ${latency}ms`);
    console.log(
      `[ASSISTANT-REQUEST] Returning assistant:`,
      JSON.stringify(assistant, null, 2),
    );

    return { assistant };
  } catch (error) {
    console.error("[ASSISTANT-REQUEST] Error:", error);
    // Return default assistant to prevent call failure
    return {
      assistant: buildDefaultAssistant(),
    };
  }
}

/**
 * Default assistant for unknown/unregistered phone numbers
 */
function buildDefaultAssistant(): VapiAssistantConfig {
  return {
    name: "Lumentra Agent",
    firstMessage:
      "Hello, you've reached an automated assistant. How can I help you today?",
    firstMessageMode: "assistant-speaks-first",
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: "off",
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,

    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: `You are a helpful voice assistant. Be concise and professional.
If you don't know something, say so. Don't make up information.
Keep responses brief and suitable for voice conversations.`,
      temperature: 0.7,
      maxTokens: 150,
    },

    voice: {
      provider: "cartesia",
      voiceId: "a0e99841-438c-4a64-b679-ae501e7d6091", // Default Cartesia voice
      speed: 1.0,
    },

    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
  };
}
