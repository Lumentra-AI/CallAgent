// Internal API Routes
// Used by the LiveKit Python agent to communicate with lumentra-api
// Authenticated via INTERNAL_API_KEY bearer token

import { Hono } from "hono";
import {
  getTenantByPhoneWithFallback,
  getTenantById,
} from "../services/database/tenant-cache.js";
import { buildSystemPrompt } from "../services/gemini/chat.js";
import { executeTool } from "../services/gemini/tools.js";
import { insertOne } from "../services/database/query-helpers.js";
import { query, queryAll } from "../services/database/client.js";
import { findOrCreateByPhone } from "../services/contacts/contact-service.js";
import { runPostCallAutomation } from "../services/automation/post-call.js";
import type { ToolExecutionContext } from "../types/voice.js";
import { internalAuth } from "../middleware/internal-auth.js";

export const internalRoutes = new Hono();

/**
 * Normalize a US phone number to E.164 format (+1XXXXXXXXXX).
 * Defense-in-depth: ensures agent always gets properly formatted numbers.
 */
function normalizePhoneE164(phone: string): string {
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");

  if (hasPlus && digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (hasPlus) return `+${digits}`;
  return phone;
}

/**
 * Check if ALL operating hours days are disabled (enabled: false).
 * If so, the tenant effectively has no schedule -- treat as 24/7.
 */
function allHoursDisabled(
  hours: Record<string, unknown> | null | undefined,
): boolean {
  if (!hours || typeof hours !== "object") return false;
  // hours is {schedule: [{day, enabled, openTime, closeTime}, ...]}
  const schedule = Array.isArray(hours.schedule)
    ? hours.schedule
    : Object.values(hours);
  if (schedule.length === 0) return false;
  return schedule.every((day) => {
    if (day && typeof day === "object" && "enabled" in day) {
      return (day as { enabled: boolean }).enabled === false;
    }
    return false;
  });
}

// Build STT keyword hints for Deepgram based on industry
const INDUSTRY_STT_KEYWORDS: Record<string, string[]> = {
  dental: [
    "cleaning",
    "filling",
    "crown",
    "root canal",
    "extraction",
    "whitening",
    "Invisalign",
    "hygienist",
    "cavity",
    "toothache",
    "Dr. Chen",
    "Dr. Patel",
    "new patient",
    "existing patient",
    "insurance",
    "Delta Dental",
    "Cigna",
    "Aetna",
    "MetLife",
    "Guardian",
    "CareCredit",
    "prophylaxis",
    "scaling",
    "X-ray",
    "emergency",
    "appointment",
    "reschedule",
    "cancellation",
  ],
  medical: [
    "appointment",
    "prescription",
    "refill",
    "follow-up",
    "checkup",
    "new patient",
    "existing patient",
    "insurance",
    "referral",
    "lab results",
  ],
  hotel: [
    "reservation",
    "check-in",
    "checkout",
    "king bed",
    "queen bed",
    "suite",
    "double",
    "single",
    "room service",
    "concierge",
  ],
  restaurant: [
    "reservation",
    "table",
    "party",
    "takeout",
    "delivery",
    "menu",
    "special",
    "vegetarian",
    "allergy",
    "gluten-free",
  ],
  salon: [
    "haircut",
    "color",
    "highlights",
    "blowout",
    "manicure",
    "pedicure",
    "stylist",
    "appointment",
    "walk-in",
  ],
  auto_service: [
    "oil change",
    "tire rotation",
    "brake",
    "alignment",
    "inspection",
    "transmission",
    "engine",
    "diagnostic",
  ],
};

function buildSttKeywords(
  industry: string,
  customInstructions?: string,
): string[] {
  const keywords = [...(INDUSTRY_STT_KEYWORDS[industry] || [])];

  // Extract provider names from custom instructions (e.g., "Dr. Sarah Chen")
  if (customInstructions) {
    const drMatches = customInstructions.match(/Dr\.\s+\w+\s+\w+/g);
    if (drMatches) {
      for (const name of drMatches) {
        if (!keywords.includes(name)) keywords.push(name);
      }
    }
  }

  return keywords;
}

// Apply auth to all routes
internalRoutes.use("*", internalAuth());

// GET /internal/tenants/by-phone/:phone
// Returns tenant config + voice config + system prompt for the Python agent
internalRoutes.get("/tenants/by-phone/:phone", async (c) => {
  const phone = decodeURIComponent(c.req.param("phone"));

  if (!phone) {
    return c.json({ error: "Phone number required" }, 400);
  }

  const tenant = await getTenantByPhoneWithFallback(phone);

  if (!tenant) {
    console.warn(`[INTERNAL] No tenant found for phone: ${phone}`);
    return c.json({ error: "Tenant not found" }, 404);
  }

  // Apply defaults for null config fields before building prompt or response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = tenant as any;
  const businessName = tenant.business_name || "our business";
  const agentName = tenant.agent_name || "AI Assistant";
  const industry = tenant.industry || "general";
  const tz = tenant.timezone || "America/New_York";

  // Query escalation contacts for this tenant (used in system prompt)
  const escalationContacts = await queryAll<{
    name: string;
    role: string | null;
  }>(
    `SELECT name, role FROM escalation_contacts
     WHERE tenant_id = $1 ORDER BY sort_order ASC`,
    [tenant.id],
  );

  // Normalize escalation phone for E.164
  // If tenant has no explicit escalation_phone but has contacts with phones,
  // derive it from the primary contact so transfers actually work.
  let escalationPhone = tenant.escalation_phone
    ? normalizePhoneE164(tenant.escalation_phone)
    : null;

  if (!escalationPhone && escalationContacts.length > 0) {
    // Query the primary contact's phone number as fallback
    const primaryContact = await queryAll<{ phone: string }>(
      `SELECT phone FROM escalation_contacts
       WHERE tenant_id = $1 AND phone IS NOT NULL AND phone != ''
       ORDER BY is_primary DESC, sort_order ASC LIMIT 1`,
      [tenant.id],
    );
    if (primaryContact.length > 0 && primaryContact[0].phone) {
      escalationPhone = normalizePhoneE164(primaryContact[0].phone);
      console.log(
        `[INTERNAL] Derived escalation_phone from primary contact: ${escalationPhone}`,
      );
    }
  }

  // If ALL operating_hours days are disabled, treat as 24/7 (null = always open)
  const rawHours = tenant.operating_hours;
  const effectiveHours = allHoursDisabled(
    rawHours as unknown as Record<string, unknown>,
  )
    ? null
    : rawHours;

  // Build the system prompt using defaulted values
  const systemPrompt = buildSystemPrompt(
    agentName,
    businessName,
    industry,
    tenant.agent_personality || {
      tone: "friendly",
      verbosity: "moderate",
      empathy: "high",
    },
    {
      operatingHours: effectiveHours,
      locationAddress: t.location_address || undefined,
      locationCity: t.location_city || undefined,
      customInstructions: t.custom_instructions || undefined,
      escalationPhone: escalationPhone || undefined,
      timezone: tz,
      transferBehavior: t.transfer_behavior || undefined,
      escalationContacts: escalationContacts || undefined,
      escalationTriggers: tenant.escalation_triggers || undefined,
    },
  );

  // Build STT keyword hints per industry for better transcription accuracy
  const sttKeywords = buildSttKeywords(industry, t.custom_instructions);

  return c.json({
    id: tenant.id,
    business_name: businessName,
    industry,
    agent_name: agentName,
    phone_number: tenant.phone_number,
    voice_config: {
      // Normalize camelCase (dashboard) to snake_case (agent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      voice_id:
        (tenant.voice_config as any)?.voiceId ??
        (tenant.voice_config as any)?.voice_id ??
        null,
    },
    agent_personality: tenant.agent_personality || "friendly",
    greeting_standard:
      tenant.greeting_standard ||
      `Thank you for calling ${businessName}. How can I help you today?`,
    greeting_after_hours:
      tenant.greeting_after_hours ||
      `Thank you for calling ${businessName}. We're currently closed, but I can still help you with general questions or take a message.`,
    greeting_returning: tenant.greeting_returning,
    timezone: tz,
    operating_hours: effectiveHours || {
      monday: { open: "09:00", close: "17:00" },
      tuesday: { open: "09:00", close: "17:00" },
      wednesday: { open: "09:00", close: "17:00" },
      thursday: { open: "09:00", close: "17:00" },
      friday: { open: "09:00", close: "17:00" },
      saturday: null,
      sunday: null,
    },
    escalation_enabled:
      tenant.escalation_enabled &&
      (!!escalationPhone || escalationContacts.length > 0),
    escalation_phone: escalationPhone,
    escalation_contacts: escalationContacts,
    escalation_triggers: tenant.escalation_triggers,
    transfer_behavior: t.transfer_behavior || {
      type: "warm",
      no_answer: "message",
    },
    features: tenant.features,
    voice_pipeline: tenant.voice_pipeline,
    max_call_duration_seconds: t.max_call_duration_seconds ?? 900,
    stt_keywords: sttKeywords,
    system_prompt: systemPrompt,
  });
});

// POST /internal/voice-tools/:action
// Routes tool calls from the Python agent to existing tool execution functions
internalRoutes.post("/voice-tools/:action", async (c) => {
  const action = c.req.param("action");

  const body = await c.req.json<{
    tenant_id: string;
    call_sid: string;
    caller_phone?: string;
    escalation_phone?: string;
    args: Record<string, unknown>;
  }>();

  if (!body.tenant_id || !action) {
    return c.json({ error: "tenant_id and action are required" }, 400);
  }

  const context: ToolExecutionContext = {
    tenantId: body.tenant_id,
    callSid: body.call_sid || "",
    callerPhone: body.caller_phone,
    escalationPhone: body.escalation_phone,
    source: "call", // /internal/tools is the voice agent's endpoint
  };

  try {
    const result = await executeTool(action, body.args || {}, context);
    return c.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tool execution failed";
    console.error(`[INTERNAL] Tool ${action} failed:`, error);
    return c.json({ error: message }, 500);
  }
});

// Map agent status values to DB constraint: ('ringing', 'connected', 'completed', 'failed', 'missed')
type DbCallStatus = "ringing" | "connected" | "completed" | "failed" | "missed";

function mapCallStatus(status: string | undefined): DbCallStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "transferred":
      return "completed"; // Transfers are completed calls with escalation outcome
    case "no-answer":
      return "missed";
    default:
      return "completed";
  }
}

// POST /internal/calls/log
// Saves a call record from the Python agent
internalRoutes.post("/calls/log", async (c) => {
  const body = await c.req.json<{
    tenant_id: string;
    call_sid: string;
    caller_phone?: string;
    caller_name?: string;
    direction?: "inbound" | "outbound";
    status?: string;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    ended_reason?: string;
    outcome_type?: "booking" | "inquiry" | "support" | "escalation" | "hangup";
    outcome_success?: boolean;
    transcript?: string;
    summary?: string;
    sentiment_score?: number;
    intents_detected?: string[];
    recording_url?: string;
    cost_cents?: number;
  }>();

  if (!body.tenant_id || !body.call_sid) {
    return c.json({ error: "tenant_id and call_sid are required" }, 400);
  }

  try {
    // Auto-create or find contact by caller phone
    let contactId: string | null = null;
    if (body.caller_phone) {
      try {
        const contact = await findOrCreateByPhone(
          body.tenant_id,
          body.caller_phone,
          { name: body.caller_name || undefined, source: "call" },
        );
        contactId = contact.id;
      } catch (err) {
        console.warn("[INTERNAL] Failed to find/create contact:", err);
      }
    }

    const record = await insertOne("calls", {
      tenant_id: body.tenant_id,
      vapi_call_id: body.call_sid,
      caller_phone: body.caller_phone || null,
      caller_name: body.caller_name || null,
      direction: body.direction || "inbound",
      status: mapCallStatus(body.status),
      started_at: body.started_at,
      ended_at: body.ended_at,
      duration_seconds: body.duration_seconds,
      ended_reason: body.ended_reason || null,
      outcome_type: body.outcome_type || "inquiry",
      outcome_success: body.outcome_success ?? true,
      transcript: body.transcript || null,
      summary: body.summary || null,
      sentiment_score: body.sentiment_score ?? null,
      intents_detected: body.intents_detected || null,
      recording_url: body.recording_url || null,
      cost_cents: body.cost_cents ?? null,
      contact_id: contactId,
    });

    console.log(
      `[INTERNAL] Call logged: ${body.call_sid}, ${body.duration_seconds}s, ${body.outcome_type || "inquiry"}`,
    );

    // Backfill any bookings created during this call. The voice agent's
    // create_booking runs before this calls row exists, so it stores the
    // call_sid and leaves call_id NULL. Now that the calls row is in,
    // link them. Idempotent: WHERE call_id IS NULL guards against
    // double-backfill if /internal/calls/log fires twice for the same SID.
    try {
      const linked = await query(
        `UPDATE bookings
            SET call_id = $1
          WHERE tenant_id = $2
            AND call_sid = $3
            AND call_id IS NULL
        RETURNING id`,
        [record.id, body.tenant_id, body.call_sid],
      );
      if (linked.rowCount && linked.rowCount > 0) {
        console.log(
          `[INTERNAL] Backfilled call_id on ${linked.rowCount} booking(s) for SID ${body.call_sid}`,
        );
      }
    } catch (err) {
      console.error("[INTERNAL] Booking call_id backfill failed:", err);
    }

    // Run post-call automation (deals, tasks, status updates) - non-blocking
    const tenant = getTenantById(body.tenant_id);
    runPostCallAutomation({
      tenantId: body.tenant_id,
      callId: record.id,
      contactId,
      callerPhone: body.caller_phone || null,
      callerName: body.caller_name || null,
      outcomeType: body.outcome_type || "inquiry",
      durationSeconds: body.duration_seconds,
      status: mapCallStatus(body.status),
      industry: tenant?.industry || "restaurant",
    }).catch((err) => {
      console.error("[INTERNAL] Post-call automation error:", err);
    });

    return c.json({ success: true, id: record.id });
  } catch (error) {
    console.error("[INTERNAL] Failed to log call:", error);
    return c.json({ error: "Failed to save call record" }, 500);
  }
});
