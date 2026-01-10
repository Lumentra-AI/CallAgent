import { Hono } from "hono";
import { handleAssistantRequest } from "../services/vapi/handlers/assistant-request.js";
import { handleToolCalls } from "../services/vapi/handlers/tool-calls.js";
import { handleStatusUpdate } from "../services/vapi/handlers/status-update.js";
import { handleEndOfCallReport } from "../services/vapi/handlers/end-of-call-report.js";
import type { VapiWebhookPayload } from "../types/vapi.js";

export const vapiRoutes = new Hono();

/**
 * Main Vapi webhook endpoint
 * CRITICAL: This must respond in <50ms for low-latency conversations
 *
 * Events handled:
 * - assistant-request: Return dynamic assistant config (FAST - use cache)
 * - tool-calls: Execute booking/availability tools
 * - status-update: Track call state changes
 * - end-of-call-report: Store transcript, trigger callbacks
 */
vapiRoutes.post("/", async (c) => {
  const startTime = Date.now();

  try {
    const payload = (await c.req.json()) as VapiWebhookPayload;
    const eventType = payload.message?.type;

    // Debug: Log full payload structure for assistant-request
    if (eventType === "assistant-request") {
      console.log("[VAPI] Full payload:", JSON.stringify(payload, null, 2));
    }

    console.log(`[VAPI] Received ${eventType} event`);

    let response;

    switch (eventType) {
      case "assistant-request":
        // CRITICAL PATH - must be <50ms
        // Returns dynamic assistant config based on phone number
        response = await handleAssistantRequest(payload);
        break;

      case "tool-calls":
        // Handle function calls (booking, availability, transfer)
        response = await handleToolCalls(payload);
        break;

      case "status-update":
        // Track call state (ringing, connected, ended)
        response = await handleStatusUpdate(payload);
        break;

      case "end-of-call-report":
        // Final processing (store transcript, check for missed call)
        response = await handleEndOfCallReport(payload);
        break;

      default:
        console.log(`[VAPI] Unhandled event type: ${eventType}`);
        response = {};
    }

    const latency = Date.now() - startTime;
    console.log(`[VAPI] ${eventType} handled in ${latency}ms`);

    // Warn if we're too slow for the critical path
    if (eventType === "assistant-request" && latency > 50) {
      console.warn(
        `[VAPI] WARNING: assistant-request took ${latency}ms (target: <50ms)`,
      );
    }

    return c.json(response);
  } catch (error) {
    console.error("[VAPI] Webhook error:", error);

    // Return empty object to prevent Vapi from retrying
    // Log error for investigation but don't break the call
    return c.json({});
  }
});
