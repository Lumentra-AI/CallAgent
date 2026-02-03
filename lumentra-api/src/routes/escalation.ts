import { Hono } from "hono";
import {
  queryOne,
  queryAll,
  transaction,
} from "../services/database/client.js";
import {
  insertOne,
  updateOne,
  deleteRows,
} from "../services/database/query-helpers.js";
import { getAuthUserId } from "../middleware/index.js";
import { invalidateTenant } from "../services/database/tenant-cache.js";
import type { PoolClient } from "pg";

export const escalationRoutes = new Hono();

/** Type definitions for database rows */
interface MembershipRow {
  tenant_id: string;
  role: string;
}

interface EscalationContactRow {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  role: string | null;
  is_primary: boolean;
  availability: string;
  availability_hours: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TenantRow {
  id: string;
  escalation_enabled: boolean | null;
  escalation_triggers: string[] | null;
  transfer_behavior: Record<string, unknown> | null;
}

/**
 * GET /api/escalation/contacts
 * Get escalation contacts for tenant
 */
escalationRoutes.get("/contacts", async (c) => {
  const userId = getAuthUserId(c);

  try {
    const membershipSql = `
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
      LIMIT 1
    `;
    const membership = await queryOne<{ tenant_id: string }>(membershipSql, [
      userId,
    ]);

    if (!membership) {
      return c.json({ contacts: [] });
    }

    const contactsSql = `
      SELECT *
      FROM escalation_contacts
      WHERE tenant_id = $1
      ORDER BY sort_order ASC
    `;
    const contacts = await queryAll<EscalationContactRow>(contactsSql, [
      membership.tenant_id,
    ]);

    return c.json({ contacts: contacts || [] });
  } catch (error) {
    console.error("[ESCALATION] Error fetching contacts:", error);
    return c.json({ error: "Failed to fetch escalation contacts" }, 500);
  }
});

/**
 * POST /api/escalation/contacts
 * Add an escalation contact
 */
escalationRoutes.post("/contacts", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);

  if (!body.name || !body.phone) {
    return c.json({ error: "name and phone are required" }, 400);
  }

  try {
    // Get tenant
    const membershipSql = `
      SELECT tenant_id, role
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
        AND role = ANY($2)
      LIMIT 1
    `;
    const membership = await queryOne<MembershipRow>(membershipSql, [
      userId,
      ["owner", "admin"],
    ]);

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const tenantId = membership.tenant_id;

    // Get current max sort_order
    const maxOrderSql = `
      SELECT sort_order
      FROM escalation_contacts
      WHERE tenant_id = $1
      ORDER BY sort_order DESC
      LIMIT 1
    `;
    const existing = await queryOne<{ sort_order: number }>(maxOrderSql, [
      tenantId,
    ]);
    const nextOrder = existing ? existing.sort_order + 1 : 0;

    // If setting as primary, unset other primaries
    if (body.is_primary) {
      await updateOne(
        "escalation_contacts",
        { is_primary: false },
        { tenant_id: tenantId },
      );
    }

    const contact = await insertOne<EscalationContactRow>(
      "escalation_contacts",
      {
        tenant_id: tenantId,
        name: body.name,
        phone: body.phone,
        role: body.role || null,
        is_primary: body.is_primary || nextOrder === 0,
        availability: body.availability || "business_hours",
        availability_hours: body.availability_hours
          ? JSON.stringify(body.availability_hours)
          : null,
        sort_order: nextOrder,
      },
    );

    return c.json(contact, 201);
  } catch (error) {
    console.error("[ESCALATION] Error adding contact:", error);
    return c.json({ error: "Failed to add escalation contact" }, 500);
  }
});

/**
 * PUT /api/escalation/contacts/:id
 * Update an escalation contact
 */
escalationRoutes.put("/contacts/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const userId = getAuthUserId(c);

  try {
    // Get tenant
    const membershipSql = `
      SELECT tenant_id, role
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
        AND role = ANY($2)
      LIMIT 1
    `;
    const membership = await queryOne<MembershipRow>(membershipSql, [
      userId,
      ["owner", "admin"],
    ]);

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Verify contact belongs to tenant
    const existingSql = `
      SELECT tenant_id
      FROM escalation_contacts
      WHERE id = $1
    `;
    const existing = await queryOne<{ tenant_id: string }>(existingSql, [id]);

    if (!existing || existing.tenant_id !== membership.tenant_id) {
      return c.json({ error: "Contact not found" }, 404);
    }

    // If setting as primary, unset other primaries
    if (body.is_primary) {
      const unsetPrimarySql = `
        UPDATE escalation_contacts
        SET is_primary = false
        WHERE tenant_id = $1 AND id != $2
      `;
      await queryOne(unsetPrimarySql, [membership.tenant_id, id]);
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.is_primary !== undefined) updateData.is_primary = body.is_primary;
    if (body.availability !== undefined)
      updateData.availability = body.availability;
    if (body.availability_hours !== undefined)
      updateData.availability_hours = body.availability_hours
        ? JSON.stringify(body.availability_hours)
        : null;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const contact = await updateOne<EscalationContactRow>(
      "escalation_contacts",
      updateData,
      { id },
    );

    return c.json(contact);
  } catch (error) {
    console.error("[ESCALATION] Error updating contact:", error);
    return c.json({ error: "Failed to update escalation contact" }, 500);
  }
});

/**
 * DELETE /api/escalation/contacts/:id
 * Delete an escalation contact
 */
escalationRoutes.delete("/contacts/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);

  try {
    // Get tenant
    const membershipSql = `
      SELECT tenant_id, role
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
        AND role = ANY($2)
      LIMIT 1
    `;
    const membership = await queryOne<MembershipRow>(membershipSql, [
      userId,
      ["owner", "admin"],
    ]);

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Verify contact belongs to tenant and check if it's primary
    const contactSql = `
      SELECT tenant_id, is_primary
      FROM escalation_contacts
      WHERE id = $1
    `;
    const contact = await queryOne<{ tenant_id: string; is_primary: boolean }>(
      contactSql,
      [id],
    );

    if (!contact || contact.tenant_id !== membership.tenant_id) {
      return c.json({ error: "Contact not found" }, 404);
    }

    // If deleting primary, check if there are other contacts
    if (contact.is_primary) {
      const countSql = `
        SELECT COUNT(*) as count
        FROM escalation_contacts
        WHERE tenant_id = $1
      `;
      const countResult = await queryOne<{ count: string }>(countSql, [
        membership.tenant_id,
      ]);
      const count = parseInt(countResult?.count || "0", 10);

      if (count > 1) {
        // Promote another contact to primary after deletion
        const nextContactSql = `
          SELECT id
          FROM escalation_contacts
          WHERE tenant_id = $1 AND id != $2
          ORDER BY sort_order ASC
          LIMIT 1
        `;
        const nextContact = await queryOne<{ id: string }>(nextContactSql, [
          membership.tenant_id,
          id,
        ]);

        if (nextContact) {
          await updateOne(
            "escalation_contacts",
            { is_primary: true },
            { id: nextContact.id },
          );
        }
      }
    }

    // Delete the contact
    await deleteRows("escalation_contacts", { id });

    // Reorder remaining contacts
    const remainingSql = `
      SELECT id
      FROM escalation_contacts
      WHERE tenant_id = $1
      ORDER BY sort_order ASC
    `;
    const remaining = await queryAll<{ id: string }>(remainingSql, [
      membership.tenant_id,
    ]);

    if (remaining && remaining.length > 0) {
      for (let i = 0; i < remaining.length; i++) {
        await updateOne(
          "escalation_contacts",
          { sort_order: i },
          { id: remaining[i].id },
        );
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("[ESCALATION] Error deleting contact:", error);
    return c.json({ error: "Failed to delete escalation contact" }, 500);
  }
});

/**
 * GET /api/escalation/triggers
 * Get escalation triggers for tenant
 */
escalationRoutes.get("/triggers", async (c) => {
  const userId = getAuthUserId(c);

  try {
    const membershipSql = `
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
      LIMIT 1
    `;
    const membership = await queryOne<{ tenant_id: string }>(membershipSql, [
      userId,
    ]);

    if (!membership) {
      return c.json({
        triggers: [],
        transfer_behavior: { type: "warm", no_answer: "message" },
      });
    }

    const tenantSql = `
      SELECT escalation_enabled, escalation_triggers, transfer_behavior
      FROM tenants
      WHERE id = $1
    `;
    const tenant = await queryOne<TenantRow>(tenantSql, [membership.tenant_id]);

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
  } catch (error) {
    console.error("[ESCALATION] Error fetching triggers:", error);
    return c.json({ error: "Failed to fetch escalation triggers" }, 500);
  }
});

/**
 * PUT /api/escalation/triggers
 * Update escalation triggers and behavior
 */
escalationRoutes.put("/triggers", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);

  try {
    // Get tenant
    const membershipSql = `
      SELECT tenant_id, role
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
        AND role = ANY($2)
      LIMIT 1
    `;
    const membership = await queryOne<MembershipRow>(membershipSql, [
      userId,
      ["owner", "admin"],
    ]);

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.enabled !== undefined)
      updateData.escalation_enabled = body.enabled;
    if (body.triggers !== undefined)
      updateData.escalation_triggers = body.triggers;
    if (body.transfer_behavior !== undefined)
      updateData.transfer_behavior = JSON.stringify(body.transfer_behavior);

    await updateOne("tenants", updateData, { id: membership.tenant_id });

    await invalidateTenant(membership.tenant_id);

    return c.json({ success: true });
  } catch (error) {
    console.error("[ESCALATION] Error updating triggers:", error);
    return c.json({ error: "Failed to update escalation triggers" }, 500);
  }
});

/**
 * POST /api/escalation/contacts/reorder
 * Reorder escalation contacts
 */
escalationRoutes.post("/contacts/reorder", async (c) => {
  const body = await c.req.json();
  const userId = getAuthUserId(c);

  if (!body.order || !Array.isArray(body.order)) {
    return c.json({ error: "order array is required" }, 400);
  }

  try {
    // Get tenant
    const membershipSql = `
      SELECT tenant_id, role
      FROM tenant_members
      WHERE user_id = $1
        AND is_active = true
        AND role = ANY($2)
      LIMIT 1
    `;
    const membership = await queryOne<MembershipRow>(membershipSql, [
      userId,
      ["owner", "admin"],
    ]);

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Update sort order for each contact in a transaction
    await transaction(async (client: PoolClient) => {
      for (let i = 0; i < body.order.length; i++) {
        await client.query(
          `UPDATE escalation_contacts SET sort_order = $1 WHERE id = $2 AND tenant_id = $3`,
          [i, body.order[i], membership.tenant_id],
        );
      }
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[ESCALATION] Error reordering contacts:", error);
    return c.json({ error: "Failed to reorder contacts" }, 500);
  }
});
