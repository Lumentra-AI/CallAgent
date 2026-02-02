import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { getAuthUserId } from "../middleware/index.js";

export const promotionsRoutes = new Hono();

/**
 * GET /api/promotions
 * Get promotions for tenant
 */
promotionsRoutes.get("/", async (c) => {
  const activeOnly = c.req.query("active") === "true";
  const userId = getAuthUserId(c);
  const db = getSupabase();

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ promotions: [] });
  }

  let query = db
    .from("tenant_promotions")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data: promotions, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ promotions: promotions || [] });
});

/**
 * POST /api/promotions
 * Create a promotion
 */
promotionsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  if (!body.offer_text) {
    return c.json({ error: "offer_text is required" }, 400);
  }

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { data: promotion, error } = await db
    .from("tenant_promotions")
    .insert({
      tenant_id: membership.tenant_id,
      offer_text: body.offer_text,
      mention_behavior: body.mention_behavior || "relevant",
      is_active: body.is_active !== undefined ? body.is_active : true,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(promotion, 201);
});

/**
 * GET /api/promotions/:id
 * Get a specific promotion
 */
promotionsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { data: promotion, error } = await db
    .from("tenant_promotions")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", membership.tenant_id)
    .single();

  if (error || !promotion) {
    return c.json({ error: "Promotion not found" }, 404);
  }

  return c.json(promotion);
});

/**
 * PUT /api/promotions/:id
 * Update a promotion
 */
promotionsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Verify promotion belongs to tenant
  const { data: existing } = await db
    .from("tenant_promotions")
    .select("tenant_id")
    .eq("id", id)
    .single();

  if (!existing || existing.tenant_id !== membership.tenant_id) {
    return c.json({ error: "Promotion not found" }, 404);
  }

  const updateData: Record<string, unknown> = {};
  if (body.offer_text !== undefined) updateData.offer_text = body.offer_text;
  if (body.mention_behavior !== undefined)
    updateData.mention_behavior = body.mention_behavior;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  if (body.starts_at !== undefined) updateData.starts_at = body.starts_at;
  if (body.ends_at !== undefined) updateData.ends_at = body.ends_at;

  const { data: promotion, error } = await db
    .from("tenant_promotions")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(promotion);
});

/**
 * DELETE /api/promotions/:id
 * Delete a promotion
 */
promotionsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Verify promotion belongs to tenant
  const { data: existing } = await db
    .from("tenant_promotions")
    .select("tenant_id")
    .eq("id", id)
    .single();

  if (!existing || existing.tenant_id !== membership.tenant_id) {
    return c.json({ error: "Promotion not found" }, 404);
  }

  const { error } = await db.from("tenant_promotions").delete().eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

/**
 * POST /api/promotions/:id/toggle
 * Toggle promotion active state
 */
promotionsRoutes.post("/:id/toggle", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Get current state
  const { data: existing } = await db
    .from("tenant_promotions")
    .select("tenant_id, is_active")
    .eq("id", id)
    .single();

  if (!existing || existing.tenant_id !== membership.tenant_id) {
    return c.json({ error: "Promotion not found" }, 404);
  }

  const { data: promotion, error } = await db
    .from("tenant_promotions")
    .update({ is_active: !existing.is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(promotion);
});
