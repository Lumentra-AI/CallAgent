import { Hono } from "hono";
import { queryOne, queryAll } from "../services/database/client.js";
import { updateOne } from "../services/database/query-helpers.js";
import { releaseNumber } from "../services/signalwire/phone.js";
import { invalidateTenant } from "../services/database/tenant-cache.js";
import { notifyAdmin } from "../services/notifications/admin-notify.js";
import { getPlatformAdminContext } from "../middleware/auth.js";
import { logActivity } from "../services/audit/logger.js";
import { parsePlatformAdminEmails } from "../utils/platform-admin.js";

// Tier feature defaults for auto-adjustment on tier change
const TIER_FEATURE_DEFAULTS: Record<string, Record<string, boolean>> = {
  starter: {
    sms_confirmations: false,
    sentiment_analysis: false,
    call_recording: true,
    transcription: true,
    live_transfer: false,
    priority_support: false,
  },
  professional: {
    sms_confirmations: true,
    sentiment_analysis: true,
    call_recording: true,
    transcription: true,
    live_transfer: false,
    priority_support: false,
  },
  enterprise: {
    sms_confirmations: true,
    sentiment_analysis: true,
    call_recording: true,
    transcription: true,
    live_transfer: true,
    priority_support: true,
  },
};

export const adminRoutes = new Hono();

adminRoutes.get("/me", async (c) => {
  const admin = getPlatformAdminContext(c);

  return c.json({
    isPlatformAdmin: admin.isPlatformAdmin,
    authMethod: admin.authMethod,
    user: admin.user
      ? {
          id: admin.user.id,
          email: admin.email,
        }
      : null,
  });
});

// ============================================================================
// PLATFORM CONFIG STATUS
// ============================================================================

/**
 * GET /admin/platform-config - Returns platform configuration status
 */
adminRoutes.get("/platform-config", async (c) => {
  return c.json({
    email: {
      configured: !!(
        process.env.RESEND_API_KEY &&
        process.env.EMAIL_FROM &&
        process.env.ADMIN_EMAIL
      ),
      from: process.env.EMAIL_FROM || null,
      adminEmail: process.env.ADMIN_EMAIL || null,
    },
    version: "0.1.0",
    voicePipeline: "LiveKit Agents + Cartesia TTS",
    database: "Supabase PostgreSQL",
  });
});

// ============================================================================
// PLATFORM ADMIN MANAGEMENT
// ============================================================================

/**
 * GET /admin/admins - List all platform admins (DB + env var)
 */
adminRoutes.get("/admins", async (c) => {
  try {
    // Get DB admins
    const dbAdmins = await queryAll<{
      id: string;
      email: string;
      added_by: string | null;
      created_at: string;
    }>(
      `SELECT id, email, added_by, created_at FROM platform_admins ORDER BY created_at ASC`,
    );

    // Get env var admins
    const envEmails = parsePlatformAdminEmails(
      process.env.PLATFORM_ADMIN_EMAILS,
    );
    const dbEmailSet = new Set(
      (dbAdmins || []).map((a) => a.email.toLowerCase()),
    );

    // Merge: DB admins get their full record, env-only admins get a synthetic entry
    const admins: Array<{
      id: string;
      email: string;
      added_by: string | null;
      created_at: string;
      source: "database" | "env" | "both";
    }> = (dbAdmins || []).map((a) => ({
      ...a,
      source: envEmails.has(a.email.toLowerCase())
        ? ("both" as const)
        : ("database" as const),
    }));

    // Add env-only admins that aren't in DB
    for (const envEmail of envEmails) {
      if (!dbEmailSet.has(envEmail)) {
        admins.push({
          id: `env-${envEmail}`,
          email: envEmail,
          added_by: "environment",
          created_at: "",
          source: "env" as const,
        });
      }
    }

    return c.json({ admins });
  } catch (error) {
    console.error("[ADMIN] Error listing admins:", error);
    return c.json({ error: "Failed to list admins" }, 500);
  }
});

/**
 * POST /admin/admins - Add a new platform admin
 */
adminRoutes.post("/admins", async (c) => {
  const admin = getPlatformAdminContext(c);
  const body = await c.req.json();

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return c.json({ error: "Valid email is required" }, 400);
  }

  try {
    // Check if already exists
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM platform_admins WHERE email = $1`,
      [email],
    );

    if (existing) {
      return c.json({ error: "This email is already a platform admin" }, 409);
    }

    const result = await queryOne<{
      id: string;
      email: string;
      added_by: string;
      created_at: string;
    }>(
      `INSERT INTO platform_admins (email, added_by) VALUES ($1, $2) RETURNING id, email, added_by, created_at`,
      [email, admin.email || "unknown"],
    );

    console.log(`[ADMIN] Platform admin added: ${email} by ${admin.email}`);

    return c.json({ admin: result }, 201);
  } catch (error) {
    console.error("[ADMIN] Error adding admin:", error);
    return c.json({ error: "Failed to add admin" }, 500);
  }
});

/**
 * DELETE /admin/admins/:email - Remove a platform admin
 */
adminRoutes.delete("/admins/:email", async (c) => {
  const adminCtx = getPlatformAdminContext(c);
  const email = decodeURIComponent(c.req.param("email")).trim().toLowerCase();

  // Prevent self-removal
  if (adminCtx.email?.toLowerCase() === email) {
    return c.json({ error: "You cannot remove yourself" }, 400);
  }

  // Prevent removing env var admins (they can only be removed by editing env)
  const envEmails = parsePlatformAdminEmails(process.env.PLATFORM_ADMIN_EMAILS);
  if (envEmails.has(email)) {
    return c.json(
      {
        error:
          "This admin is defined in the environment variable and cannot be removed from the UI",
      },
      400,
    );
  }

  try {
    const result = await queryOne<{ id: string }>(
      `DELETE FROM platform_admins WHERE email = $1 RETURNING id`,
      [email],
    );

    if (!result) {
      return c.json({ error: "Admin not found" }, 404);
    }

    console.log(
      `[ADMIN] Platform admin removed: ${email} by ${adminCtx.email}`,
    );

    return c.json({ success: true });
  } catch (error) {
    console.error("[ADMIN] Error removing admin:", error);
    return c.json({ error: "Failed to remove admin" }, 500);
  }
});

// ============================================================================
// TENANT MANAGEMENT ROUTES (P3)
// ============================================================================

interface AdminTenantRow {
  id: string;
  business_name: string;
  industry: string;
  phone_number: string;
  contact_email: string | null;
  status: string;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  agent_name: string | null;
  agent_personality: object | null;
  voice_config: object | null;
  greeting_standard: string | null;
  greeting_after_hours: string | null;
  greeting_returning: string | null;
  timezone: string | null;
  operating_hours: object | null;
  escalation_enabled: boolean;
  escalation_phone: string | null;
  escalation_triggers: string[] | null;
  features: object | null;
  metadata: object | null;
  custom_instructions: string | null;
  setup_completed: boolean;
  setup_step: string | null;
  location_city: string | null;
  location_address: string | null;
}

/**
 * GET /admin/tenants
 * List all tenants with search, filter, sort, and pagination
 */
adminRoutes.get("/tenants", async (c) => {
  const search = c.req.query("search")?.trim() || "";
  const status = c.req.query("status") || "";
  const tier = c.req.query("tier") || "";
  const industry = c.req.query("industry") || "";
  const sortBy = c.req.query("sortBy") || "created_at";
  const sortOrder = c.req.query("sortOrder") === "asc" ? "ASC" : "DESC";
  const limit = Math.min(parseInt(c.req.query("limit") || "25", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  // Validate sort column to prevent SQL injection
  const validSortColumns = [
    "business_name",
    "created_at",
    "updated_at",
    "status",
    "subscription_tier",
    "industry",
  ];
  const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : "created_at";

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(
        `(t.business_name ILIKE $${paramIndex} OR t.contact_email ILIKE $${paramIndex} OR t.phone_number ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      conditions.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (tier) {
      conditions.push(`t.subscription_tier = $${paramIndex}`);
      params.push(tier);
      paramIndex++;
    }

    if (industry) {
      conditions.push(`t.industry = $${paramIndex}`);
      params.push(industry);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM tenants t ${whereClause}`;
    const countResult = await queryOne<{ count: string }>(countSql, params);
    const total = parseInt(countResult?.count || "0", 10);

    // Get tenants with member count and call stats
    const sql = `
      SELECT
        t.id,
        t.business_name,
        t.industry,
        t.phone_number,
        t.contact_email,
        t.status,
        t.subscription_tier,
        t.is_active,
        t.created_at,
        t.updated_at,
        (SELECT COUNT(*) FROM tenant_members tm WHERE tm.tenant_id = t.id AND tm.is_active = true) AS member_count,
        (SELECT COUNT(*) FROM calls c WHERE c.tenant_id = t.id AND c.created_at > NOW() - INTERVAL '30 days') AS calls_30d,
        (SELECT MAX(c.created_at) FROM calls c WHERE c.tenant_id = t.id) AS last_call_at
      FROM tenants t
      ${whereClause}
      ORDER BY t.${safeSortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const tenants = await queryAll<
      AdminTenantRow & {
        member_count: string;
        calls_30d: string;
        last_call_at: string | null;
      }
    >(sql, [...params, limit, offset]);

    return c.json({
      tenants,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[ADMIN] Error listing tenants:", error);
    return c.json({ error: "Failed to list tenants" }, 500);
  }
});

/**
 * GET /admin/tenants/:id
 * Get full tenant details including members, call stats, phone config, and port requests
 */
adminRoutes.get("/tenants/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const tenant = await queryOne<AdminTenantRow>(
      `SELECT * FROM tenants WHERE id = $1`,
      [id],
    );

    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    // Get members with user emails
    const members = await queryAll<{
      id: string;
      user_id: string;
      role: string;
      is_active: boolean;
      created_at: string;
      accepted_at: string | null;
      email: string | null;
    }>(
      `SELECT tm.id, tm.user_id, tm.role, tm.is_active, tm.created_at, tm.accepted_at,
              u.email
       FROM tenant_members tm
       LEFT JOIN auth.users u ON u.id = tm.user_id
       WHERE tm.tenant_id = $1 AND tm.is_active = true
       ORDER BY tm.created_at ASC`,
      [id],
    );

    // Get call stats
    const callStats = await queryOne<{
      total_calls: string;
      calls_this_week: string;
      calls_this_month: string;
      avg_duration: string;
    }>(
      `SELECT
        COUNT(*) AS total_calls,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS calls_this_week,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS calls_this_month,
        COALESCE(AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL), 0) AS avg_duration
       FROM calls
       WHERE tenant_id = $1`,
      [id],
    );

    // Get recent calls (last 10)
    const recentCalls = await queryAll<{
      id: string;
      caller_phone: string | null;
      caller_name: string | null;
      status: string;
      duration_seconds: number | null;
      sentiment_score: number | null;
      created_at: string;
      outcome_type: string | null;
    }>(
      `SELECT id, caller_phone, caller_name, status, duration_seconds,
              sentiment_score, created_at, outcome_type
       FROM calls
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [id],
    );

    // Get phone configuration
    const phoneConfig = await queryOne<PhoneConfigRow>(
      `SELECT * FROM phone_configurations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id],
    );

    // Get port request if exists
    const portRequest = await queryOne<PortRequestRow>(
      `SELECT * FROM port_requests WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id],
    );

    return c.json({
      tenant,
      members,
      callStats: callStats
        ? {
            total_calls: parseInt(callStats.total_calls, 10),
            calls_this_week: parseInt(callStats.calls_this_week, 10),
            calls_this_month: parseInt(callStats.calls_this_month, 10),
            avg_duration: Math.round(parseFloat(callStats.avg_duration)),
          }
        : {
            total_calls: 0,
            calls_this_week: 0,
            calls_this_month: 0,
            avg_duration: 0,
          },
      recentCalls,
      phoneConfig,
      portRequest,
    });
  } catch (error) {
    console.error("[ADMIN] Error fetching tenant:", error);
    return c.json({ error: "Failed to fetch tenant" }, 500);
  }
});

/**
 * PUT /admin/tenants/:id
 * Update tenant fields (admin override, no role check)
 */
adminRoutes.put("/tenants/:id", async (c) => {
  const id = c.req.param("id");
  const admin = getPlatformAdminContext(c);
  const body = await c.req.json();

  try {
    const existing = await queryOne<AdminTenantRow>(
      `SELECT * FROM tenants WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    // Remove fields that should not be directly updated
    delete body.id;
    delete body.created_at;

    body.updated_at = new Date().toISOString();

    // Capture old values for audit log
    const oldValues: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (key !== "updated_at") {
        oldValues[key] = (existing as unknown as Record<string, unknown>)[key];
      }
    }

    const updated = await updateOne<AdminTenantRow>("tenants", body, { id });

    // Invalidate cache so voice agent picks up changes
    await invalidateTenant(id);

    // Audit log
    await logActivity({
      tenantId: id,
      userId: admin.userId ?? null,
      action: "update",
      resourceType: "tenant",
      resourceId: id,
      oldValues,
      newValues: body,
    });

    console.log(`[ADMIN] Tenant ${id} updated by platform admin`);

    return c.json({ tenant: updated });
  } catch (error) {
    console.error("[ADMIN] Error updating tenant:", error);
    return c.json({ error: "Failed to update tenant" }, 500);
  }
});

/**
 * PUT /admin/tenants/:id/status
 * Change tenant status (active/suspended/draft/pending_verification)
 */
adminRoutes.put("/tenants/:id/status", async (c) => {
  const id = c.req.param("id");
  const admin = getPlatformAdminContext(c);
  const body = await c.req.json();

  const validStatuses = [
    "draft",
    "pending_verification",
    "active",
    "suspended",
  ];

  if (!body.status || !validStatuses.includes(body.status)) {
    return c.json(
      {
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      },
      400,
    );
  }

  try {
    const existing = await queryOne<AdminTenantRow>(
      `SELECT * FROM tenants WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    const previousStatus = existing.status;

    const updates: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    };

    // Also set is_active based on status
    if (body.status === "active") {
      updates.is_active = true;
    } else if (body.status === "suspended") {
      updates.is_active = false;
    }

    await updateOne("tenants", updates, { id });

    // Invalidate cache
    await invalidateTenant(id);

    // Audit log
    await logActivity({
      tenantId: id,
      userId: admin.userId ?? null,
      action: "update",
      resourceType: "tenant",
      resourceId: id,
      oldValues: { status: previousStatus },
      newValues: { status: body.status, reason: body.reason || null },
    });

    console.log(
      `[ADMIN] Tenant ${id} status changed: ${previousStatus} -> ${body.status}${body.reason ? ` (reason: ${body.reason})` : ""}`,
    );

    return c.json({ success: true, previousStatus });
  } catch (error) {
    console.error("[ADMIN] Error updating tenant status:", error);
    return c.json({ error: "Failed to update tenant status" }, 500);
  }
});

/**
 * PUT /admin/tenants/:id/tier
 * Change tenant subscription tier
 */
adminRoutes.put("/tenants/:id/tier", async (c) => {
  const id = c.req.param("id");
  const admin = getPlatformAdminContext(c);
  const body = await c.req.json();

  const validTiers = ["starter", "professional", "enterprise"];

  if (!body.tier || !validTiers.includes(body.tier)) {
    return c.json(
      {
        error: `Invalid tier. Must be one of: ${validTiers.join(", ")}`,
      },
      400,
    );
  }

  try {
    const existing = await queryOne<AdminTenantRow>(
      `SELECT * FROM tenants WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    const previousTier = existing.subscription_tier;
    const previousFeatures = existing.features || {};

    // Auto-adjust features to tier defaults (merge onto existing)
    const tierDefaults = TIER_FEATURE_DEFAULTS[body.tier] || {};
    const mergedFeatures = {
      ...((existing.features as Record<string, unknown>) || {}),
      ...tierDefaults,
    };

    await updateOne(
      "tenants",
      {
        subscription_tier: body.tier,
        features: JSON.stringify(mergedFeatures),
        updated_at: new Date().toISOString(),
      },
      { id },
    );

    // Invalidate cache
    await invalidateTenant(id);

    // Audit log
    await logActivity({
      tenantId: id,
      userId: admin.userId ?? null,
      action: "update",
      resourceType: "tenant",
      resourceId: id,
      oldValues: {
        subscription_tier: previousTier,
        features: previousFeatures,
      },
      newValues: { subscription_tier: body.tier, features: mergedFeatures },
    });

    console.log(
      `[ADMIN] Tenant ${id} tier changed: ${previousTier} -> ${body.tier}`,
    );

    return c.json({ success: true, previousTier, features: mergedFeatures });
  } catch (error) {
    console.error("[ADMIN] Error updating tenant tier:", error);
    return c.json({ error: "Failed to update tenant tier" }, 500);
  }
});

/**
 * POST /admin/tenants/:id/features
 * Update tenant feature flags
 */
adminRoutes.post("/tenants/:id/features", async (c) => {
  const id = c.req.param("id");
  const admin = getPlatformAdminContext(c);
  const body = await c.req.json();

  // Accept either { feature, enabled } (single) or { features: {...} } (bulk)
  let featureUpdates: Record<string, boolean>;
  if (body.feature && typeof body.enabled === "boolean") {
    featureUpdates = { [body.feature]: body.enabled };
  } else if (body.features && typeof body.features === "object") {
    featureUpdates = body.features;
  } else {
    return c.json(
      { error: "Provide { feature, enabled } or { features: {...} }" },
      400,
    );
  }

  try {
    const existing = await queryOne<AdminTenantRow>(
      `SELECT * FROM tenants WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    const previousFeatures = existing.features || {};
    // Merge new features onto existing (does not replace unmentioned features)
    const mergedFeatures = {
      ...((existing.features as Record<string, unknown>) || {}),
      ...featureUpdates,
    };

    await updateOne(
      "tenants",
      {
        features: JSON.stringify(mergedFeatures),
        updated_at: new Date().toISOString(),
      },
      { id },
    );

    // Invalidate cache
    await invalidateTenant(id);

    // Audit log
    await logActivity({
      tenantId: id,
      userId: admin.userId ?? null,
      action: "update",
      resourceType: "tenant",
      resourceId: id,
      oldValues: { features: previousFeatures },
      newValues: { features: mergedFeatures },
    });

    console.log(`[ADMIN] Tenant ${id} features updated by platform admin`);

    return c.json({ success: true, features: mergedFeatures });
  } catch (error) {
    console.error("[ADMIN] Error updating tenant features:", error);
    return c.json({ error: "Failed to update tenant features" }, 500);
  }
});

/**
 * PUT /admin/tenants/:id/feature-overrides
 * Manage tenant_feature_overrides (dashboard page visibility).
 * Body: { overrides: { feature_key: boolean, ... } }
 */
adminRoutes.put("/tenants/:id/feature-overrides", async (c) => {
  const id = c.req.param("id");
  const admin = getPlatformAdminContext(c);
  const body = await c.req.json();

  if (!body.overrides || typeof body.overrides !== "object") {
    return c.json(
      { error: "Provide { overrides: { feature_key: boolean, ... } }" },
      400,
    );
  }

  try {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM tenants WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    // Upsert each override
    for (const [featureKey, enabled] of Object.entries(body.overrides)) {
      if (typeof enabled !== "boolean") continue;

      await queryOne(
        `INSERT INTO tenant_feature_overrides (tenant_id, feature_key, enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, feature_key)
         DO UPDATE SET enabled = $3, updated_at = NOW()`,
        [id, featureKey, enabled],
      );
    }

    // Return current overrides
    const overrides = await queryAll<{
      feature_key: string;
      enabled: boolean;
    }>(
      `SELECT feature_key, enabled FROM tenant_feature_overrides WHERE tenant_id = $1`,
      [id],
    );

    // Audit log
    await logActivity({
      tenantId: id,
      userId: admin.userId ?? null,
      action: "update",
      resourceType: "feature_overrides",
      resourceId: id,
      oldValues: null,
      newValues: body.overrides,
    });

    console.log(
      `[ADMIN] Tenant ${id} feature overrides updated by platform admin`,
    );

    return c.json({ success: true, overrides: overrides || [] });
  } catch (error) {
    console.error("[ADMIN] Error updating feature overrides:", error);
    return c.json({ error: "Failed to update feature overrides" }, 500);
  }
});

/**
 * GET /admin/tenants/:id/feature-overrides
 * List feature overrides for a tenant
 */
adminRoutes.get("/tenants/:id/feature-overrides", async (c) => {
  const id = c.req.param("id");

  try {
    const overrides = await queryAll<{
      feature_key: string;
      enabled: boolean;
      updated_at: string;
    }>(
      `SELECT feature_key, enabled, updated_at
       FROM tenant_feature_overrides
       WHERE tenant_id = $1
       ORDER BY feature_key ASC`,
      [id],
    );

    return c.json({ overrides: overrides || [] });
  } catch (error) {
    console.error("[ADMIN] Error fetching feature overrides:", error);
    return c.json({ error: "Failed to fetch feature overrides" }, 500);
  }
});

/**
 * GET /admin/tenants/:id/activity
 * View audit trail for a specific tenant (platform admin only)
 */
adminRoutes.get("/tenants/:id/activity", async (c) => {
  const id = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  try {
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE tenant_id = $1`,
      [id],
    );
    const total = parseInt(countResult?.count || "0", 10);

    const logs = await queryAll<{
      id: string;
      user_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      old_values: Record<string, unknown> | null;
      new_values: Record<string, unknown> | null;
      created_at: string;
      email?: string | null;
    }>(
      `SELECT a.id, a.user_id, a.action, a.resource_type, a.resource_id,
              a.old_values, a.new_values, a.created_at, u.email
       FROM audit_logs a
       LEFT JOIN auth.users u ON u.id::text = a.user_id
       WHERE a.tenant_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset],
    );

    return c.json({ logs: logs || [], total, limit, offset });
  } catch (error) {
    console.error("[ADMIN] Error fetching tenant activity:", error);
    return c.json({ error: "Failed to fetch activity" }, 500);
  }
});

/**
 * DELETE /admin/tenants/:id
 * Soft-delete a tenant (sets is_active=false, status=suspended)
 */
adminRoutes.delete("/tenants/:id", async (c) => {
  const id = c.req.param("id");
  const admin = getPlatformAdminContext(c);

  try {
    const existing = await queryOne<AdminTenantRow>(
      `SELECT * FROM tenants WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    // Only allow soft delete on suspended, draft, or test tenants
    const metadata = existing.metadata as Record<string, unknown> | null;
    const isTest = metadata?.is_test === true;
    const canDelete =
      existing.status === "suspended" || existing.status === "draft" || isTest;

    if (!canDelete) {
      return c.json(
        {
          error:
            "Active tenants must be suspended before deletion. Only suspended, draft, or test tenants can be deleted.",
        },
        409,
      );
    }

    await updateOne(
      "tenants",
      {
        is_active: false,
        status: "deleted",
        updated_at: new Date().toISOString(),
      },
      { id },
    );

    // Invalidate cache
    await invalidateTenant(id);

    // Audit log
    await logActivity({
      tenantId: id,
      userId: admin.userId ?? null,
      action: "delete",
      resourceType: "tenant",
      resourceId: id,
      oldValues: { status: existing.status, is_active: existing.is_active },
      newValues: { status: "deleted", is_active: false },
    });

    console.log(`[ADMIN] Tenant ${id} soft-deleted by platform admin`);

    return c.json({ success: true });
  } catch (error) {
    console.error("[ADMIN] Error deleting tenant:", error);
    return c.json({ error: "Failed to delete tenant" }, 500);
  }
});

/**
 * GET /admin/users
 * List all users (from auth.users) with their tenant memberships
 */
adminRoutes.get("/users", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  try {
    const users = await queryAll<{
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      tenant_count: string;
    }>(
      `SELECT
        u.id,
        u.email,
        u.created_at,
        u.last_sign_in_at,
        (SELECT COUNT(*) FROM tenant_members tm WHERE tm.user_id = u.id AND tm.is_active = true) AS tenant_count
       FROM auth.users u
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return c.json({ users });
  } catch (error) {
    console.error("[ADMIN] Error listing users:", error);
    return c.json({ error: "Failed to list users" }, 500);
  }
});

// ============================================================================
// PORT REQUEST MANAGEMENT (existing)
// ============================================================================

interface PortRequestRow {
  id: string;
  tenant_id: string;
  phone_number: string;
  current_carrier: string;
  authorized_name: string;
  status: string;
  estimated_completion: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface PhoneConfigRow {
  id: string;
  tenant_id: string;
  phone_number: string | null;
  setup_type: string;
  provider_sid: string | null;
  status: string;
  port_request_id: string | null;
}

/**
 * GET /admin/port-requests
 * List all port requests, optionally filtered by status
 */
adminRoutes.get("/port-requests", async (c) => {
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  try {
    let sql: string;
    let params: unknown[];

    if (status) {
      sql = `
        SELECT pr.*, t.business_name, t.contact_email
        FROM port_requests pr
        JOIN tenants t ON t.id = pr.tenant_id
        WHERE pr.status = $1
        ORDER BY pr.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [status, limit, offset];
    } else {
      sql = `
        SELECT pr.*, t.business_name, t.contact_email
        FROM port_requests pr
        JOIN tenants t ON t.id = pr.tenant_id
        ORDER BY pr.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, offset];
    }

    const requests = await queryAll<
      PortRequestRow & { business_name: string; contact_email: string }
    >(sql, params);

    return c.json({ portRequests: requests, count: requests.length });
  } catch (error) {
    console.error("[ADMIN] Error listing port requests:", error);
    return c.json({ error: "Failed to list port requests" }, 500);
  }
});

/**
 * GET /admin/port-requests/:id
 * Get a single port request with full details
 */
adminRoutes.get("/port-requests/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const request = await queryOne<
      PortRequestRow & { business_name: string; contact_email: string }
    >(
      `SELECT pr.*, t.business_name, t.contact_email
       FROM port_requests pr
       JOIN tenants t ON t.id = pr.tenant_id
       WHERE pr.id = $1`,
      [id],
    );

    if (!request) {
      return c.json({ error: "Port request not found" }, 404);
    }

    // Get associated phone config
    const phoneConfig = await queryOne<PhoneConfigRow>(
      `SELECT * FROM phone_configurations
       WHERE port_request_id = $1`,
      [id],
    );

    return c.json({ portRequest: request, phoneConfig });
  } catch (error) {
    console.error("[ADMIN] Error fetching port request:", error);
    return c.json({ error: "Failed to fetch port request" }, 500);
  }
});

/**
 * PUT /admin/port-requests/:id/status
 * Update port request status
 */
adminRoutes.put("/port-requests/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const validStatuses = [
    "draft",
    "submitted",
    "pending",
    "approved",
    "rejected",
    "completed",
  ];

  if (!body.status || !validStatuses.includes(body.status)) {
    return c.json(
      {
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      },
      400,
    );
  }

  try {
    const existing = await queryOne<PortRequestRow>(
      `SELECT * FROM port_requests WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return c.json({ error: "Port request not found" }, 404);
    }

    const updates: Record<string, unknown> = {
      status: body.status,
    };

    if (body.status === "submitted" && !existing.submitted_at) {
      updates.submitted_at = new Date().toISOString();
    }

    if (body.status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    if (body.status === "rejected" && body.rejection_reason) {
      updates.rejection_reason = body.rejection_reason;
    }

    if (body.estimated_completion) {
      updates.estimated_completion = body.estimated_completion;
    }

    await updateOne("port_requests", updates, { id });

    console.log(
      `[ADMIN] Port request ${id} status updated: ${existing.status} -> ${body.status}`,
    );

    return c.json({ success: true, previousStatus: existing.status });
  } catch (error) {
    console.error("[ADMIN] Error updating port status:", error);
    return c.json({ error: "Failed to update port request status" }, 500);
  }
});

/**
 * POST /admin/port-requests/:id/complete
 * Mark a port as completed and perform all side effects:
 *   1. Update port_requests status to 'completed'
 *   2. Update phone_configurations with ported number
 *   3. Release temporary number (if any)
 *   4. Update tenants.phone_number
 *   5. Invalidate tenant cache
 */
adminRoutes.post("/port-requests/:id/complete", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  try {
    const portRequest = await queryOne<PortRequestRow>(
      `SELECT * FROM port_requests WHERE id = $1`,
      [id],
    );

    if (!portRequest) {
      return c.json({ error: "Port request not found" }, 404);
    }

    if (portRequest.status === "completed") {
      return c.json({ error: "Port request is already completed" }, 409);
    }

    const portedNumber = body.final_phone_number || portRequest.phone_number;

    // 1. Update port_requests
    await updateOne(
      "port_requests",
      {
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { id },
    );

    // 2. Get the phone configuration linked to this port request
    const phoneConfig = await queryOne<PhoneConfigRow>(
      `SELECT * FROM phone_configurations WHERE port_request_id = $1`,
      [id],
    );

    let releasedTempNumber: string | null = null;

    if (phoneConfig) {
      // 3. Release temporary number if one was provisioned
      if (
        phoneConfig.status === "porting_with_temp" &&
        phoneConfig.provider_sid
      ) {
        try {
          await releaseNumber(phoneConfig.provider_sid);
          releasedTempNumber = phoneConfig.phone_number;
          console.log(
            `[ADMIN] Released temp number ${phoneConfig.phone_number} (SID: ${phoneConfig.provider_sid})`,
          );
        } catch (err) {
          console.error("[ADMIN] Failed to release temp number:", err);
          // Continue - don't block completion for this
        }
      }

      // 4. Update phone_configurations with ported number
      await updateOne(
        "phone_configurations",
        {
          phone_number: portedNumber,
          status: "active",
          provider_sid: null, // Ported number is managed by the carrier
          verified_at: new Date().toISOString(),
        },
        { id: phoneConfig.id },
      );
    }

    // 5. Update tenants.phone_number
    await updateOne(
      "tenants",
      {
        phone_number: portedNumber,
        updated_at: new Date().toISOString(),
      },
      { id: portRequest.tenant_id },
    );

    // 6. Invalidate tenant cache so agent picks up new number
    await invalidateTenant(portRequest.tenant_id);

    // 7. Notify admin of completion
    await notifyAdmin("port_request_completed", {
      portRequestId: id,
      tenantId: portRequest.tenant_id,
      portedNumber,
      releasedTempNumber,
    });

    console.log(
      `[ADMIN] Port request ${id} completed. Ported number: ${portedNumber}`,
    );

    return c.json({
      success: true,
      portedNumber,
      releasedTempNumber,
    });
  } catch (error) {
    console.error("[ADMIN] Error completing port request:", error);
    return c.json({ error: "Failed to complete port request" }, 500);
  }
});

// ============================================
// Vapi Usage Tracking (Admin Only)
// ============================================

// GET /admin/vapi-usage -- All tenants' Vapi spend for a billing cycle
adminRoutes.get("/vapi-usage", async (c) => {
  const cycle = c.req.query("cycle") || new Date().toISOString().slice(0, 7);
  const rows = await queryAll(
    `SELECT vu.tenant_id, vu.billing_cycle, vu.total_cost, vu.total_minutes,
            vu.total_calls, vu.last_call_at, vu.updated_at,
            t.business_name, t.phone_number, t.voice_pipeline
     FROM vapi_usage vu
     JOIN tenants t ON t.id = vu.tenant_id
     WHERE vu.billing_cycle = $1
     ORDER BY vu.total_cost DESC`,
    [cycle],
  );
  return c.json({ usage: rows, billing_cycle: cycle });
});

// GET /admin/vapi-usage/:tenantId -- Single tenant's usage history
adminRoutes.get("/vapi-usage/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const rows = await queryAll(
    `SELECT * FROM vapi_usage WHERE tenant_id = $1 ORDER BY billing_cycle DESC LIMIT 12`,
    [tenantId],
  );
  return c.json({ usage: rows });
});
