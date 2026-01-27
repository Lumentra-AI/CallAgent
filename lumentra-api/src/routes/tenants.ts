import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { invalidateTenant } from "../services/database/tenant-cache.js";
import { getAuthTenantId, getAuthUserId } from "../middleware/index.js";

export const tenantsRoutes = new Hono();

/**
 * GET /api/tenants
 * List tenants the user has access to (not all tenants)
 */
tenantsRoutes.get("/", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenants the user is a member of
  const { data, error } = await db
    .from("tenant_members")
    .select(
      `
      tenant_id,
      role,
      tenants (
        id,
        business_name,
        industry,
        phone_number,
        is_active,
        created_at
      )
    `,
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Flatten the response - Supabase returns joined data
  interface TenantData {
    id: string;
    business_name: string;
    industry: string;
    phone_number: string;
    is_active: boolean;
    created_at: string;
  }

  const tenants = data
    ?.map((m) => {
      // Handle both object and array returns from Supabase join
      const tenantData = m.tenants as TenantData | TenantData[] | null;
      const tenant = Array.isArray(tenantData) ? tenantData[0] : tenantData;
      return tenant ? { ...tenant, role: m.role } : null;
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return c.json({ tenants: tenants || [] });
});

/**
 * GET /api/tenants/current
 * Get the current tenant (from X-Tenant-ID header, validated via auth)
 */
tenantsRoutes.get("/current", async (c) => {
  const tenantId = getAuthTenantId(c);
  const db = getSupabase();

  const { data, error } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (error) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  return c.json(data);
});

/**
 * GET /api/tenants/:id
 * Get tenant details (must be a member)
 */
tenantsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Verify user has access to this tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", id)
    .eq("is_active", true)
    .single();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { data, error } = await db
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  return c.json({ ...data, userRole: membership.role });
});

/**
 * POST /api/tenants
 * Create a new tenant and link the creating user as owner
 */
tenantsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
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
      voice_id: "02fe5732-a072-4767-83e3-a91d41d274ca",
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

  // Create tenant
  const { data: tenantData, error: tenantError } = await db
    .from("tenants")
    .insert(tenant)
    .select()
    .single();

  if (tenantError) {
    return c.json({ error: tenantError.message }, 500);
  }

  // Create tenant membership for the creating user as owner
  const { error: membershipError } = await db.from("tenant_members").insert({
    tenant_id: tenantData.id,
    user_id: userId,
    role: "owner",
    accepted_at: new Date().toISOString(),
  });

  if (membershipError) {
    // Rollback tenant creation
    await db.from("tenants").delete().eq("id", tenantData.id);
    return c.json({ error: "Failed to create tenant membership" }, 500);
  }

  return c.json(tenantData, 201);
});

/**
 * PUT /api/tenants/:id
 * Update tenant configuration (owner/admin only)
 */
tenantsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Verify user is owner or admin
  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", id)
    .eq("is_active", true)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return c.json({ error: "Forbidden - owner or admin role required" }, 403);
  }

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
 * Deactivate a tenant (owner only)
 */
tenantsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Verify user is owner
  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", id)
    .eq("is_active", true)
    .single();

  if (!membership || membership.role !== "owner") {
    return c.json({ error: "Forbidden - owner role required" }, 403);
  }

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

/**
 * POST /api/tenants/:id/members
 * Invite a user to the tenant (owner/admin only)
 */
tenantsRoutes.post("/:id/members", async (c) => {
  const tenantId = c.req.param("id");
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Verify user is owner or admin
  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!body.user_id || !body.role) {
    return c.json({ error: "user_id and role are required" }, 400);
  }

  // Can't add owner role unless you are owner
  if (body.role === "owner" && membership.role !== "owner") {
    return c.json({ error: "Only owners can add other owners" }, 403);
  }

  const { data, error } = await db
    .from("tenant_members")
    .insert({
      tenant_id: tenantId,
      user_id: body.user_id,
      role: body.role,
      invited_by: userId,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(), // Auto-accept for now
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return c.json({ error: "User is already a member" }, 400);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json(data, 201);
});

/**
 * GET /api/tenants/:id/members
 * List tenant members
 */
tenantsRoutes.get("/:id/members", async (c) => {
  const tenantId = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Verify user has access
  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { data, error } = await db
    .from("tenant_members")
    .select("id, user_id, role, created_at, invited_at, accepted_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ members: data || [] });
});

/**
 * DELETE /api/tenants/:id/members/:memberId
 * Remove a member from the tenant
 */
tenantsRoutes.delete("/:id/members/:memberId", async (c) => {
  const tenantId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Verify user is owner or admin
  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Get target member info
  const { data: targetMember } = await db
    .from("tenant_members")
    .select("role, user_id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .single();

  if (!targetMember) {
    return c.json({ error: "Member not found" }, 404);
  }

  // Can't remove owner unless you are owner
  if (targetMember.role === "owner" && membership.role !== "owner") {
    return c.json({ error: "Only owners can remove owners" }, 403);
  }

  // Can't remove yourself if you're the last owner
  if (targetMember.user_id === userId && targetMember.role === "owner") {
    const { count } = await db
      .from("tenant_members")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .eq("is_active", true);

    if (count === 1) {
      return c.json({ error: "Cannot remove the last owner" }, 400);
    }
  }

  const { error } = await db
    .from("tenant_members")
    .update({ is_active: false })
    .eq("id", memberId);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});
