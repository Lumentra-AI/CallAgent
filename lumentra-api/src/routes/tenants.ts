import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { invalidateTenant } from "../services/database/tenant-cache.js";

export const tenantsRoutes = new Hono();

/**
 * GET /api/tenants
 * List all tenants (developer only)
 */
tenantsRoutes.get("/", async (c) => {
  const db = getSupabase();

  const { data, error } = await db
    .from("tenants")
    .select("id, business_name, industry, phone_number, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ tenants: data });
});

/**
 * GET /api/tenants/:id
 * Get tenant details
 */
tenantsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getSupabase();

  const { data, error } = await db
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  return c.json(data);
});

/**
 * POST /api/tenants
 * Create a new tenant
 */
tenantsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const db = getSupabase();

  // Validate required fields
  if (!body.business_name || !body.phone_number || !body.industry) {
    return c.json(
      {
        error: "Missing required fields: business_name, phone_number, industry",
      },
      400,
    );
  }

  // Check if phone number is already in use
  const { data: existing } = await db
    .from("tenants")
    .select("id")
    .eq("phone_number", body.phone_number)
    .single();

  if (existing) {
    return c.json({ error: "Phone number already in use" }, 400);
  }

  // Set defaults
  const tenant = {
    ...body,
    agent_name: body.agent_name || "AI Assistant",
    agent_personality: body.agent_personality || {
      tone: "professional",
      verbosity: "balanced",
      empathy: "medium",
      humor: false,
    },
    voice_config: body.voice_config || {
      provider: "cartesia",
      voice_id: "02fe5732-a072-4767-83e3-a91d41d274ca", // Madison - Enthusiastic young adult female
      voice_name: "Madison",
      speaking_rate: 1.0,
      pitch: 1.0,
    },
    greeting_standard:
      body.greeting_standard ||
      `Hello, thank you for calling {business_name}. This is {agent_name}. How can I help you today?`,
    greeting_after_hours:
      body.greeting_after_hours ||
      `Thank you for calling {business_name}. We're currently closed, but I can still help you with questions or schedule an appointment.`,
    greeting_returning: body.greeting_returning || null,
    timezone: body.timezone || "America/New_York",
    operating_hours: body.operating_hours || {
      schedule: [
        { day: 0, enabled: false, open_time: "09:00", close_time: "17:00" },
        { day: 1, enabled: true, open_time: "09:00", close_time: "17:00" },
        { day: 2, enabled: true, open_time: "09:00", close_time: "17:00" },
        { day: 3, enabled: true, open_time: "09:00", close_time: "17:00" },
        { day: 4, enabled: true, open_time: "09:00", close_time: "17:00" },
        { day: 5, enabled: true, open_time: "09:00", close_time: "17:00" },
        { day: 6, enabled: false, open_time: "09:00", close_time: "17:00" },
      ],
      holidays: [],
    },
    escalation_enabled: body.escalation_enabled ?? true,
    escalation_phone: body.escalation_phone || null,
    escalation_triggers: body.escalation_triggers || [
      "speak to human",
      "manager",
    ],
    features: body.features || {
      sms_confirmations: true,
      email_notifications: false,
      live_transfer: true,
      voicemail_fallback: true,
      sentiment_analysis: true,
      recording_enabled: true,
      transcription_enabled: true,
    },
    is_active: true,
    subscription_tier: body.subscription_tier || "starter",
  };

  const { data, error } = await db
    .from("tenants")
    .insert(tenant)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data, 201);
});

/**
 * PUT /api/tenants/:id
 * Update tenant configuration
 */
tenantsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const db = getSupabase();

  // Remove fields that shouldn't be updated directly
  delete body.id;
  delete body.created_at;
  delete body.phone_number; // Phone number changes need special handling

  body.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from("tenants")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Invalidate cache so changes take effect immediately
  await invalidateTenant(id);

  return c.json(data);
});

/**
 * DELETE /api/tenants/:id
 * Deactivate a tenant
 */
tenantsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getSupabase();

  const { error } = await db
    .from("tenants")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Invalidate cache
  await invalidateTenant(id);

  return c.json({ success: true });
});
