// Vapi Webhook Routes
// Handles all Vapi server events: assistant-request, tool-calls, end-of-call-report, etc.

import { Hono } from "hono";
import {
  getTenantByPhoneWithFallback,
  getTenantById,
  getTenantByVapiPhoneId,
} from "../services/database/tenant-cache.js";
import {
  buildAssistantConfig,
  buildTransferDestination,
} from "../services/vapi/assistant.js";
import { executeTool } from "../services/gemini/tools.js";
import { insertOne } from "../services/database/query-helpers.js";
import type { ToolExecutionContext } from "../types/voice.js";

const vapiRoutes = new Hono();

// Verify Vapi webhook signature (optional but recommended)
function verifySignature(
  secret: string | undefined,
  signature: string | undefined,
): boolean {
  if (!secret) return true; // Skip verification if no secret configured
  if (!signature) return false;
  // In production, implement proper HMAC verification
  return true;
}

// Main webhook endpoint - handles all Vapi server messages
vapiRoutes.post("/webhook", async (c) => {
  const signature = c.req.header("x-vapi-signature");
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  if (!verifySignature(secret, signature)) {
    console.error("[VAPI] Invalid webhook signature");
    return c.json({ error: "Invalid signature" }, 401);
  }

  try {
    const body = await c.req.json();
    const messageType = body.message?.type;

    console.log(`[VAPI] Received webhook: ${messageType}`);

    switch (messageType) {
      case "assistant-request":
        return handleAssistantRequest(c, body);

      case "tool-calls":
        return handleToolCalls(c, body);

      case "end-of-call-report":
        return handleEndOfCallReport(c, body);

      case "status-update":
        return handleStatusUpdate(c, body);

      case "transfer-destination-request":
        return handleTransferRequest(c, body);

      case "hang":
        console.log("[VAPI] Call hang event:", body.message?.reason);
        return c.json({});

      case "speech-update":
        // Informational - no response needed
        return c.json({});

      case "conversation-update":
        // Informational - no response needed
        return c.json({});

      default:
        console.log(`[VAPI] Unhandled message type: ${messageType}`);
        return c.json({});
    }
  } catch (error) {
    console.error("[VAPI] Webhook error:", error);
    return c.json({ error: "Internal error" }, 500);
  }
});

// Handle assistant-request - return dynamic assistant config for inbound calls
async function handleAssistantRequest(c: any, body: any) {
  // Extract phone number from various possible payload structures
  // Vapi may send phoneNumber.number OR just phoneNumberId
  let phoneNumber =
    body.message?.call?.phoneNumber?.number ||
    body.message?.phoneNumber?.number ||
    body.call?.phoneNumber?.number;

  const phoneNumberId =
    body.message?.call?.phoneNumberId ||
    body.message?.phoneNumberId ||
    body.call?.phoneNumberId;

  const callerNumber =
    body.message?.call?.customer?.number ||
    body.message?.customer?.number ||
    body.call?.customer?.number;

  console.log(
    `[VAPI] Assistant request - phone: ${phoneNumber}, phoneNumberId: ${phoneNumberId}, caller: ${callerNumber}`,
  );

  // FAST PATH: Try direct lookup by Vapi phone number ID first (no API call needed)
  if (phoneNumberId) {
    const tenant = getTenantByVapiPhoneId(phoneNumberId);
    if (tenant) {
      console.log(
        `[VAPI] Found tenant by vapi_phone_number_id: ${tenant.business_name}`,
      );
      const serverUrl = process.env.BACKEND_URL || "http://localhost:3100";
      const assistant = buildAssistantConfig(tenant, serverUrl);

      return c.json({
        assistant,
        metadata: {
          tenantId: tenant.id,
          businessName: tenant.business_name,
          callerPhone: callerNumber,
        },
      });
    }
    console.log(
      `[VAPI] No tenant found for phoneNumberId: ${phoneNumberId}, trying phone number lookup`,
    );
  }

  // FALLBACK: If no direct match by phoneNumberId, try phone number lookup
  // First try to resolve phoneNumberId to actual phone number via Vapi API
  if (!phoneNumber && phoneNumberId) {
    try {
      const vapiResponse = await fetch(
        `https://api.vapi.ai/phone-number/${phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
          },
        },
      );
      if (vapiResponse.ok) {
        const vapiPhone = (await vapiResponse.json()) as { number: string };
        phoneNumber = vapiPhone.number;
        console.log(
          `[VAPI] Resolved phoneNumberId ${phoneNumberId} to ${phoneNumber}`,
        );
      } else {
        console.error(
          `[VAPI] Failed to resolve phoneNumberId ${phoneNumberId}:`,
          await vapiResponse.text(),
        );
      }
    } catch (err) {
      console.error(`[VAPI] Error resolving phoneNumberId:`, err);
    }
  }

  if (!phoneNumber) {
    console.error(
      "[VAPI] No phone number in assistant request. Payload:",
      JSON.stringify(body, null, 2),
    );
    return c.json({
      error: "Phone number required",
    });
  }

  // Look up tenant by phone number
  const tenant = await getTenantByPhoneWithFallback(phoneNumber);

  if (!tenant) {
    console.error(`[VAPI] No tenant found for phone: ${phoneNumber}`);
    return c.json({
      error: `No tenant configured for ${phoneNumber}`,
    });
  }

  // Build dynamic assistant config
  const serverUrl = process.env.BACKEND_URL || "http://localhost:3100";
  const assistant = buildAssistantConfig(tenant, serverUrl);

  console.log(`[VAPI] Returning assistant for tenant: ${tenant.business_name}`);

  return c.json({
    assistant,
    // Pass tenant context as metadata
    metadata: {
      tenantId: tenant.id,
      businessName: tenant.business_name,
      callerPhone: callerNumber,
    },
  });
}

// Handle tool-calls - execute tools and return results
async function handleToolCalls(c: any, body: any) {
  const toolCalls = body.message?.toolCallList || [];
  const metadata = body.message?.call?.metadata || {};
  const callerPhone =
    body.message?.call?.customer?.number || metadata.callerPhone;
  const callId = body.message?.call?.id;

  console.log(
    `[VAPI] Tool calls received:`,
    toolCalls.map((t: any) => t.function?.name),
  );

  const results: any[] = [];

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name;
    const toolArgs = toolCall.function?.arguments || {};
    const toolCallId = toolCall.id;

    console.log(`[VAPI] Executing tool: ${toolName}`, toolArgs);

    // Build execution context
    const context: ToolExecutionContext = {
      tenantId: metadata.tenantId,
      callSid: callId,
      callerPhone: callerPhone,
      escalationPhone: undefined, // Will be fetched from tenant if needed
    };

    // Get tenant for escalation phone if transfer tool
    if (toolName === "transfer_to_human" && metadata.tenantId) {
      const tenant = getTenantById(metadata.tenantId);
      if (tenant?.escalation_phone) {
        context.escalationPhone = tenant.escalation_phone;
      }
    }

    try {
      const result = await executeTool(toolName, toolArgs, context);

      results.push({
        toolCallId,
        result: JSON.stringify(result),
      });
    } catch (error) {
      console.error(`[VAPI] Tool execution error for ${toolName}:`, error);
      results.push({
        toolCallId,
        result: JSON.stringify({
          success: false,
          message: "An error occurred. Please try again.",
        }),
      });
    }
  }

  return c.json({ results });
}

// Handle end-of-call-report - save call record with transcript
async function handleEndOfCallReport(c: any, body: any) {
  const report = body.message;
  const call = report?.call;
  const metadata = call?.metadata || {};

  console.log(`[VAPI] End of call report for: ${call?.id}`);

  if (!call?.id || !metadata.tenantId) {
    console.warn("[VAPI] Missing call ID or tenant ID in end-of-call report");
    return c.json({});
  }

  try {
    // Extract call data
    const transcript = report?.transcript || "";
    const recordingUrl = report?.recordingUrl;
    const endedReason = report?.endedReason;
    const cost = report?.cost;
    const startedAt = call?.startedAt;
    const endedAt = call?.endedAt;
    const duration =
      startedAt && endedAt
        ? Math.floor(
            (new Date(endedAt).getTime() - new Date(startedAt).getTime()) /
              1000,
          )
        : 0;

    // Determine outcome based on transcript analysis
    const outcomeType = analyzeOutcome(transcript, report?.messages || []);

    // Save call record
    await insertOne("calls", {
      tenant_id: metadata.tenantId,
      vapi_call_id: call.id,
      call_sid: call.id, // For compatibility
      direction: "inbound",
      caller_phone: call?.customer?.number,
      agent_phone: call?.phoneNumber?.number,
      status: "completed",
      duration_seconds: duration,
      started_at: startedAt,
      ended_at: endedAt,
      transcript: transcript,
      recording_url: recordingUrl,
      outcome_type: outcomeType,
      sentiment_score: analyzeSentiment(transcript),
      intents_detected: detectIntents(transcript),
      cost_cents: cost ? Math.round(cost * 100) : null,
      ended_reason: endedReason,
    });

    console.log(
      `[VAPI] Call record saved for ${call.id}, outcome: ${outcomeType}`,
    );
  } catch (error) {
    console.error("[VAPI] Failed to save call record:", error);
  }

  return c.json({});
}

// Handle status-update - track call state changes
async function handleStatusUpdate(c: any, body: any) {
  const status = body.message?.status;
  const callId = body.message?.call?.id;

  console.log(`[VAPI] Status update: ${callId} -> ${status}`);

  // Could update call status in DB if needed
  // For now, just log it

  return c.json({});
}

// Handle transfer-destination-request - provide escalation phone number
async function handleTransferRequest(c: any, body: any) {
  const metadata = body.message?.call?.metadata || {};

  console.log(
    `[VAPI] Transfer destination request for tenant: ${metadata.tenantId}`,
  );

  if (!metadata.tenantId) {
    return c.json({
      error: "No tenant context for transfer",
    });
  }

  // Get tenant escalation phone
  const tenant = getTenantById(metadata.tenantId);

  if (!tenant?.escalation_phone) {
    console.warn(`[VAPI] No escalation phone for tenant: ${metadata.tenantId}`);
    return c.json({
      error: "No escalation phone configured",
    });
  }

  return c.json({
    destination: buildTransferDestination(tenant.escalation_phone),
  });
}

// Separate endpoint for tool execution (used by tools with custom server URLs)
vapiRoutes.post("/tools", async (c) => {
  // This endpoint receives individual tool calls when tools have custom server URLs
  // The format is similar to tool-calls but for a single tool

  try {
    const body = await c.req.json();
    const toolName = body.message?.functionCall?.name;
    const toolArgs = body.message?.functionCall?.parameters || {};
    const metadata = body.message?.call?.metadata || {};
    const callerPhone = body.message?.call?.customer?.number;
    const callId = body.message?.call?.id;

    console.log(`[VAPI] Direct tool call: ${toolName}`, toolArgs);

    const context: ToolExecutionContext = {
      tenantId: metadata.tenantId,
      callSid: callId,
      callerPhone: callerPhone,
      escalationPhone: undefined,
    };

    const result = await executeTool(toolName, toolArgs, context);

    return c.json({
      result: JSON.stringify(result),
    });
  } catch (error) {
    console.error("[VAPI] Tool call error:", error);
    return c.json({
      result: JSON.stringify({
        success: false,
        message: "An error occurred. Please try again.",
      }),
    });
  }
});

// Helper: Analyze call outcome from transcript
function analyzeOutcome(transcript: string, _messages: unknown[]): string {
  const lower = transcript.toLowerCase();

  // Check for booking confirmation
  if (
    lower.includes("confirmation") ||
    lower.includes("booked") ||
    lower.includes("scheduled")
  ) {
    return "booking";
  }

  // Check for order confirmation
  if (lower.includes("order confirmed") || lower.includes("your order")) {
    return "order";
  }

  // Check for transfer/escalation
  if (lower.includes("transfer") || lower.includes("connecting you")) {
    return "escalation";
  }

  // Check for inquiry
  if (
    lower.includes("hours") ||
    lower.includes("location") ||
    lower.includes("pricing")
  ) {
    return "inquiry";
  }

  // Default
  return "general";
}

// Helper: Analyze sentiment (0-1 scale)
function analyzeSentiment(transcript: string): number {
  const lower = transcript.toLowerCase();

  const positiveWords = [
    "thank",
    "great",
    "excellent",
    "perfect",
    "wonderful",
    "appreciate",
    "happy",
  ];
  const negativeWords = [
    "upset",
    "angry",
    "frustrated",
    "terrible",
    "awful",
    "worst",
    "hate",
  ];

  let score = 0.5; // Neutral start

  for (const word of positiveWords) {
    if (lower.includes(word)) score += 0.1;
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) score -= 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

// Helper: Detect intents from transcript
function detectIntents(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  const intents: string[] = [];

  if (
    lower.includes("book") ||
    lower.includes("appointment") ||
    lower.includes("schedule")
  ) {
    intents.push("booking");
  }
  if (
    lower.includes("order") ||
    lower.includes("pizza") ||
    lower.includes("delivery")
  ) {
    intents.push("order");
  }
  if (
    lower.includes("price") ||
    lower.includes("cost") ||
    lower.includes("how much")
  ) {
    intents.push("pricing");
  }
  if (
    lower.includes("hours") ||
    lower.includes("open") ||
    lower.includes("close")
  ) {
    intents.push("hours");
  }
  if (
    lower.includes("transfer") ||
    lower.includes("human") ||
    lower.includes("person")
  ) {
    intents.push("escalation");
  }

  return intents;
}

export default vapiRoutes;
