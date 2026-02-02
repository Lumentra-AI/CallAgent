import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { getAuthUserId } from "../middleware/index.js";
import { invalidateTenant } from "../services/database/tenant-cache.js";

export const escalationRoutes = new Hono();

/**
 * GET /api/escalation/contacts
 * Get escalation contacts for tenant
 */
escalationRoutes.get("/contacts", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ contacts: [] });
  }

  const { data: contacts, error } = await db
    .from("escalation_contacts")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .order("sort_order", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ contacts: contacts || [] });
});

/**
 * POST /api/escalation/contacts
 * Add an escalation contact
 */
escalationRoutes.post("/contacts", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  if (!body.name || !body.phone) {
    return c.json({ error: "name and phone are required" }, 400);
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

  const tenantId = membership.tenant_id;

  // Get current max sort_order
  const { data: existing } = await db
    .from("escalation_contacts")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder =
    existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  // If setting as primary, unset other primaries
  if (body.is_primary) {
    await db
      .from("escalation_contacts")
      .update({ is_primary: false })
      .eq("tenant_id", tenantId);
  }

  const { data: contact, error } = await db
    .from("escalation_contacts")
    .insert({
      tenant_id: tenantId,
      name: body.name,
      phone: body.phone,
      role: body.role || null,
      is_primary: body.is_primary || nextOrder === 0,
      availability: body.availability || "business_hours",
      availability_hours: body.availability_hours || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(contact, 201);
});

/**
 * PUT /api/escalation/contacts/:id
 * Update an escalation contact
 */
escalationRoutes.put("/contacts/:id", async (c) => {
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

  // Verify contact belongs to tenant
  const { data: existing } = await db
    .from("escalation_contacts")
    .select("tenant_id")
    .eq("id", id)
    .single();

  if (!existing || existing.tenant_id !== membership.tenant_id) {
    return c.json({ error: "Contact not found" }, 404);
  }

  // If setting as primary, unset other primaries
  if (body.is_primary) {
    await db
      .from("escalation_contacts")
      .update({ is_primary: false })
      .eq("tenant_id", membership.tenant_id)
      .neq("id", id);
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.is_primary !== undefined) updateData.is_primary = body.is_primary;
  if (body.availability !== undefined)
    updateData.availability = body.availability;
  if (body.availability_hours !== undefined)
    updateData.availability_hours = body.availability_hours;
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

  const { data: contact, error } = await db
    .from("escalation_contacts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(contact);
});

/**
 * DELETE /api/escalation/contacts/:id
 * Delete an escalation contact
 */
escalationRoutes.delete("/contacts/:id", async (c) => {
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

  // Verify contact belongs to tenant and check if it's the only primary
  const { data: contact } = await db
    .from("escalation_contacts")
    .select("tenant_id, is_primary")
    .eq("id", id)
    .single();

  if (!contact || contact.tenant_id !== membership.tenant_id) {
    return c.json({ error: "Contact not found" }, 404);
  }

  // If deleting primary, check if there are other contacts
  if (contact.is_primary) {
    const { count } = await db
      .from("escalation_contacts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", membership.tenant_id);

    if (count && count > 1) {
      // Promote another contact to primary after deletion
      const { data: nextContact } = await db
        .from("escalation_contacts")
        .select("id")
        .eq("tenant_id", membership.tenant_id)
        .neq("id", id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();

      if (nextContact) {
        await db
          .from("escalation_contacts")
          .update({ is_primary: true })
          .eq("id", nextContact.id);
      }
    }
  }

  const { error } = await db.from("escalation_contacts").delete().eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Reorder remaining contacts
  const { data: remaining } = await db
    .from("escalation_contacts")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .order("sort_order", { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await db
        .from("escalation_contacts")
        .update({ sort_order: i })
        .eq("id", remaining[i].id);
    }
  }

  return c.json({ success: true });
});

/**
 * GET /api/escalation/triggers
 * Get escalation triggers for tenant
 */
escalationRoutes.get("/triggers", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({
      triggers: [],
      transfer_behavior: { type: "warm", no_answer: "message" },
    });
  }

  const { data: tenant, error } = await db
    .from("tenants")
    .select("escalation_enabled, escalation_triggers, transfer_behavior")
    .eq("id", membership.tenant_id)
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Standard triggers that are always available
  const standardTriggers = [
    "caller_requests",
    "frustration",
    "emergency",
    "complaint",
    "unknown",
    "billing",
  ];

  // Custom triggers (those in tenant's list that aren't standard)
  const customTriggers = (tenant?.escalation_triggers || []).filter(
    (t: string) => !standardTriggers.includes(t),
  );

  return c.json({
    enabled: tenant?.escalation_enabled ?? true,
    triggers: tenant?.escalation_triggers || [],
    standardTriggers,
    customTriggers,
    transfer_behavior: tenant?.transfer_behavior || {
      type: "warm",
      no_answer: "message",
    },
  });
});

/**
 * PUT /api/escalation/triggers
 * Update escalation triggers and behavior
 */
escalationRoutes.put("/triggers", async (c) => {
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

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.enabled !== undefined) updateData.escalation_enabled = body.enabled;
  if (body.triggers !== undefined)
    updateData.escalation_triggers = body.triggers;
  if (body.transfer_behavior !== undefined)
    updateData.transfer_behavior = body.transfer_behavior;

  const { error } = await db
    .from("tenants")
    .update(updateData)
    .eq("id", membership.tenant_id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await invalidateTenant(membership.tenant_id);

  return c.json({ success: true });
});

/**
 * POST /api/escalation/contacts/reorder
 * Reorder escalation contacts
 */
escalationRoutes.post("/contacts/reorder", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);
  const db = getSupabase();

  if (!body.order || !Array.isArray(body.order)) {
    return c.json({ error: "order array is required" }, 400);
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

  // Update sort order for each contact
  for (let i = 0; i < body.order.length; i++) {
    await db
      .from("escalation_contacts")
      .update({ sort_order: i })
      .eq("id", body.order[i])
      .eq("tenant_id", membership.tenant_id);
  }

  return c.json({ success: true });
});
