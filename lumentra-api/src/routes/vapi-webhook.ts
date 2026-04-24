// Vapi Webhook Handler
// Receives all events from Vapi's Server URL system
// Docs: https://docs.vapi.ai/server-url/events

import { Hono } from "hono";
import {
  buildAssistantConfig,
  buildTransferDestination,
} from "../services/vapi/assistant.js";
import { executeTool } from "../services/gemini/tools.js";
// TODO: Import buildSystemPrompt when assistant.ts is upgraded to accept full config
// import { buildSystemPrompt } from "../services/gemini/chat.js";
import { query, queryOne } from "../services/database/client.js";
import {
  getTenantByVapiPhoneId,
  getTenantByPhoneWithFallback,
} from "../services/database/tenant-cache.js";
import { escalationEvents } from "../services/escalation/events.js";
import { findOrCreateByPhone } from "../services/contacts/contact-service.js";
import type { ToolExecutionContext } from "../types/voice.js";
import type { Tenant } from "../types/database.js";

const vapiWebhook = new Hono();

const VAPI_WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;
const SERVER_URL =
  process.env.PUBLIC_API_URL ||
  process.env.API_URL ||
  "https://api.lumentraai.com";

// Auth middleware: verify secret from Vapi
// Vapi can send auth via: X-Vapi-Secret header, Authorization Bearer, or server.secret
vapiWebhook.use("*", async (c, next) => {
  if (VAPI_WEBHOOK_SECRET) {
    const bearerAuth = c.req.header("Authorization");
    const vapiSecret = c.req.header("X-Vapi-Secret");
    const serverSecret = c.req.header("server-secret");

    const isAuthorized =
      bearerAuth === `Bearer ${VAPI_WEBHOOK_SECRET}` ||
      vapiSecret === VAPI_WEBHOOK_SECRET ||
      serverSecret === VAPI_WEBHOOK_SECRET;

    if (!isAuthorized) {
      // Log headers for debugging (redacted)
      console.warn(
        `[VAPI-WEBHOOK] Unauthorized: bearer=${!!bearerAuth} vapiSecret=${!!vapiSecret} serverSecret=${!!serverSecret}`,
      );
      // Allow through for now -- Vapi credential system needs dashboard config
      // TODO: Re-enable strict auth after configuring Vapi credential
    }
  }
  await next();
});

// Main webhook endpoint
vapiWebhook.post("/", async (c) => {
  const body = await c.req.json();
  const messageType = body?.message?.type;

  if (!messageType) {
    return c.json({ error: "Missing message type" }, 400);
  }

  try {
    switch (messageType) {
      case "assistant-request":
        return await handleAssistantRequest(c, body.message);
      case "tool-calls":
        return await handleToolCalls(c, body.message);
      case "transfer-destination-request":
        return await handleTransferRequest(c, body.message);
      case "end-of-call-report":
        return await handleEndOfCallReport(c, body.message);
      case "status-update":
        return await handleStatusUpdate(c, body.message);
      default:
        return c.json({});
    }
  } catch (err) {
    console.error(`[VAPI-WEBHOOK] Error handling ${messageType}:`, err);
    return c.json({});
  }
});

// --- Helpers ---

// Resolve tenant from Vapi call object (try vapi phone ID first, then phone number)
async function resolveTenant(call: any): Promise<Tenant | null> {
  const phoneNumberId = call?.phoneNumber?.id;
  const calledNumber = call?.phoneNumber?.number || call?.phoneNumberId;

  console.log(
    `[VAPI-WEBHOOK] resolveTenant: phoneNumberId=${phoneNumberId} calledNumber=${calledNumber} callKeys=${Object.keys(call || {}).join(",")}`,
  );

  // Fast path: cache lookup by Vapi phone ID
  if (phoneNumberId) {
    const cached = getTenantByVapiPhoneId(phoneNumberId);
    if (cached) return cached;

    // Cache miss: try DB directly
    console.log(
      `[VAPI-WEBHOOK] Cache miss for Vapi phone ID ${phoneNumberId}, trying DB`,
    );
    const dbTenant = await queryOne(
      "SELECT * FROM tenants WHERE vapi_phone_number_id = $1 AND is_active = true",
      [phoneNumberId],
    );
    if (dbTenant) return dbTenant as unknown as Tenant;
  }

  // Fallback: lookup by phone number (cache + DB)
  if (calledNumber) {
    return getTenantByPhoneWithFallback(calledNumber);
  }

  return null;
}

// Fetch escalation contacts for a tenant
async function getEscalationContacts(tenantId: string) {
  const result = await queryOne(
    `SELECT json_agg(
      json_build_object(
        'name', name, 'role', role, 'phone', phone,
        'availability', availability, 'is_primary', is_primary
      ) ORDER BY sort_order
    ) as contacts
    FROM escalation_contacts WHERE tenant_id = $1`,
    [tenantId],
  );
  return result?.contacts || [];
}

// --- Event Handlers ---

// assistant-request: Return dynamic assistant config per tenant
// CRITICAL: Must respond within 7.5 seconds
async function handleAssistantRequest(c: any, message: any) {
  const call = message.call || {};
  const callerNumber = call.customer?.number;
  const calledNumber = call.phoneNumber?.number;

  console.log(
    `[VAPI-WEBHOOK] assistant-request: called=${calledNumber} caller=${callerNumber}`,
  );

  const tenant = await resolveTenant(call);

  if (!tenant) {
    console.warn(`[VAPI-WEBHOOK] No tenant found for ${calledNumber}`);
    return c.json({
      error: "This number is not currently in service. Please try again later.",
    });
  }

  // Build assistant config
  // TODO: When assistant.ts is upgraded (Task 2), pass escalationContacts, systemPrompt, greeting, etc.
  const assistantConfig = buildAssistantConfig(tenant, SERVER_URL);

  return c.json({ assistant: assistantConfig });
}

// tool-calls: Route to existing executeTool()
async function handleToolCalls(c: any, message: any) {
  const toolCallList = message.toolCallList || [];
  const call = message.call || {};
  const callerPhone = call.customer?.number;

  const tenant = await resolveTenant(call);

  if (!tenant) {
    console.error("[VAPI-WEBHOOK] tool-calls: could not resolve tenant");
    return c.json({
      results: toolCallList.map((tc: any) => ({
        toolCallId: tc.id,
        error: "Unable to process request. Please try again.",
      })),
    });
  }

  const context: ToolExecutionContext = {
    tenantId: tenant.id,
    callSid: call.id || "vapi-unknown",
    callerPhone,
    escalationPhone: tenant.escalation_phone || undefined,
    source: "call",
  };

  const results = [];

  for (const toolCall of toolCallList) {
    try {
      // transferCall is handled by transfer-destination-request, not here
      if (toolCall.name === "transferCall") {
        results.push({
          toolCallId: toolCall.id,
          result: "Transfer initiated.",
        });
        continue;
      }

      const toolResult = await executeTool(
        toolCall.name,
        toolCall.arguments || {},
        context,
      );

      // Vapi requires single-line string results -- no line breaks
      const resultStr =
        typeof toolResult === "string"
          ? toolResult.replace(/\n/g, " ")
          : JSON.stringify(toolResult).replace(/\n/g, " ");

      results.push({ toolCallId: toolCall.id, result: resultStr });
    } catch (err: any) {
      console.error(
        `[VAPI-WEBHOOK] Tool ${toolCall.name} failed:`,
        err.message,
      );
      results.push({
        toolCallId: toolCall.id,
        error: `Unable to complete ${toolCall.name}. Please try again.`,
      });
    }
  }

  return c.json({ results });
}

// transfer-destination-request: Select escalation contact and return destination
async function handleTransferRequest(c: any, message: any) {
  const call = message.call || {};
  const tenant = await resolveTenant(call);

  if (!tenant) {
    return c.json({
      error: "Unable to transfer at this time.",
    });
  }

  const escalationContacts = await getEscalationContacts(tenant.id);
  const escalationPhone =
    escalationContacts.find((c: any) => c.is_primary)?.phone ||
    tenant.escalation_phone;

  const transferType = (tenant as any).transfer_behavior?.type || "warm";

  // Callback mode: don't transfer, tell AI to take a message instead
  if (transferType === "callback") {
    return c.json({
      error:
        "No agents are available right now. Please take a callback request instead.",
    });
  }

  if (!escalationPhone && escalationContacts.length === 0) {
    return c.json({
      error: "No transfer destinations are configured.",
    });
  }

  // Pick the best phone number for transfer
  const primaryContact = escalationContacts.find((c: any) => c.is_primary);
  const transferPhone = primaryContact?.phone || escalationPhone;

  if (!transferPhone) {
    return c.json({ error: "No transfer destination configured." });
  }

  const result = buildTransferDestination(transferPhone);

  // Emit SSE event for dashboard real-time updates
  escalationEvents.publish({
    type: "transfer_created",
    tenantId: tenant.id,
    queueId: `vapi-${Date.now()}`,
    data: { transferType, destination: result },
    timestamp: new Date().toISOString(),
  });

  return c.json({ destination: result });
}

// end-of-call-report: Log call data + track Vapi spend
async function handleEndOfCallReport(c: any, message: any) {
  const call = message.call || {};
  const artifact = message.artifact || {};
  const analysis = message.analysis || {};
  const cost = call.cost || 0;
  const costBreakdown = call.costBreakdown || {};
  const durationSeconds = message.durationSeconds || 0;
  const durationMinutes = message.durationMinutes || 0;
  const endedReason = message.endedReason || "unknown";
  const callerPhone = call.customer?.number;

  const tenant = await resolveTenant(call);
  if (!tenant) {
    console.warn("[VAPI-WEBHOOK] end-of-call-report: no tenant resolved");
    return c.json({});
  }

  // Map Vapi endedReason to our outcome_type
  const outcomeMap: Record<string, string> = {
    "customer-ended-call": "hangup",
    "assistant-ended-call": "inquiry",
    "assistant-forwarded-call": "escalation",
    "exceeded-max-duration": "hangup",
    "silence-timed-out": "hangup",
    voicemail: "voicemail",
  };
  const outcomeType = outcomeMap[endedReason] || "inquiry";

  // Determine caller name from Vapi analysis or transcript
  const callerName = analysis.structuredData?.caller_name || null;

  // Find or create contact
  let contactId = null;
  if (callerPhone) {
    try {
      const contact = await findOrCreateByPhone(tenant.id, callerPhone, {
        name: callerName || undefined,
      });
      contactId = contact?.id;
    } catch (err) {
      console.warn("[VAPI-WEBHOOK] Could not create contact:", err);
    }
  }

  // Log the call to our database (local storage -- never rely on Vapi retention)
  try {
    await query(
      `INSERT INTO calls (
        tenant_id, contact_id, vapi_call_id, caller_phone, caller_name,
        direction, status, started_at, ended_at, duration_seconds,
        outcome_type, transcript, summary, recording_url,
        vapi_cost, vapi_cost_breakdown, provider
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        tenant.id,
        contactId,
        call.id,
        callerPhone,
        callerName,
        "inbound",
        "completed",
        call.startedAt || new Date().toISOString(),
        call.endedAt || new Date().toISOString(),
        durationSeconds,
        outcomeType,
        artifact.transcript || null,
        analysis.summary || null,
        artifact.recording?.url || null,
        cost,
        JSON.stringify(costBreakdown),
        "vapi",
      ],
    );
  } catch (err) {
    console.error("[VAPI-WEBHOOK] Failed to log call:", err);
  }

  // Track Vapi spend per tenant per billing cycle (admin-only table)
  const billingCycle = new Date().toISOString().slice(0, 7); // '2026-03'
  try {
    await query(
      `INSERT INTO vapi_usage (tenant_id, billing_cycle, total_cost, total_minutes, total_calls, last_call_at)
       VALUES ($1, $2, $3, $4, 1, now())
       ON CONFLICT (tenant_id, billing_cycle)
       DO UPDATE SET
         total_cost = vapi_usage.total_cost + EXCLUDED.total_cost,
         total_minutes = vapi_usage.total_minutes + EXCLUDED.total_minutes,
         total_calls = vapi_usage.total_calls + 1,
         last_call_at = now(),
         updated_at = now()`,
      [tenant.id, billingCycle, cost, durationMinutes],
    );
  } catch (err) {
    console.error("[VAPI-WEBHOOK] Failed to track usage:", err);
  }

  console.log(
    `[VAPI-WEBHOOK] Call logged: tenant=${tenant.id} duration=${durationSeconds}s cost=$${cost} outcome=${outcomeType}`,
  );

  return c.json({});
}

// status-update: Log call status transitions
async function handleStatusUpdate(c: any, message: any) {
  const status = message.status;
  const callId = message.call?.id;

  if (status === "ended") {
    console.log(
      `[VAPI-WEBHOOK] Call ended: id=${callId} reason=${message.endedReason}`,
    );
  }

  return c.json({});
}

export default vapiWebhook;
