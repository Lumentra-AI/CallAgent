/**
 * Team Management Routes
 *
 * GET  /api/team           - List team members with allowed_pages
 * PUT  /api/team/:memberId - Update member's allowed_pages
 */

import { Hono } from "hono";
import { getAuthContext } from "../middleware/index.js";
import { logActivity } from "../services/audit/logger.js";
import { queryOne, queryAll } from "../services/database/client.js";
import { updateOne } from "../services/database/query-helpers.js";
import { ALL_FEATURES } from "../services/features/feature-resolver.js";

export const teamRoutes = new Hono();

interface MemberDetailRow {
  id: string;
  user_id: string;
  role: string;
  allowed_pages: string[] | null;
  is_active: boolean;
  created_at: string;
  accepted_at: string | null;
  email: string | null;
}

/**
 * GET /api/team
 * List all active members of the current tenant with their access settings.
 * Requires owner or admin role.
 */
teamRoutes.get("/", async (c) => {
  const auth = getAuthContext(c);

  if (!["owner", "admin"].includes(auth.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const members = await queryAll<MemberDetailRow>(
      `SELECT tm.id, tm.user_id, tm.role, tm.allowed_pages, tm.is_active,
              tm.created_at, tm.accepted_at, u.email
       FROM tenant_members tm
       LEFT JOIN auth.users u ON u.id = tm.user_id
       WHERE tm.tenant_id = $1 AND tm.is_active = true
       ORDER BY tm.created_at ASC`,
      [auth.tenantId],
    );

    return c.json({ members: members || [] });
  } catch (error) {
    console.error("[TEAM] Error listing members:", error);
    return c.json({ error: "Failed to list team members" }, 500);
  }
});

/**
 * PUT /api/team/:memberId
 * Update a member's allowed_pages and/or role.
 * Requires owner or admin role. Cannot modify own permissions or another owner.
 */
teamRoutes.put("/:memberId", async (c) => {
  const auth = getAuthContext(c);
  const memberId = c.req.param("memberId");

  if (!["owner", "admin"].includes(auth.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();

  try {
    // Load target member
    const target = await queryOne<MemberDetailRow>(
      `SELECT id, user_id, role, allowed_pages
       FROM tenant_members
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [memberId, auth.tenantId],
    );

    if (!target) {
      return c.json({ error: "Member not found" }, 404);
    }

    // Cannot modify an owner
    if (target.role === "owner") {
      return c.json({ error: "Cannot modify owner permissions" }, 403);
    }

    // Cannot modify your own allowed_pages
    if (target.user_id === auth.userId && body.allowed_pages !== undefined) {
      return c.json({ error: "Cannot modify your own page restrictions" }, 403);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and set allowed_pages
    if (body.allowed_pages !== undefined) {
      if (body.allowed_pages === null) {
        // null = full access
        updates.allowed_pages = null;
      } else if (Array.isArray(body.allowed_pages)) {
        // Validate each page key
        const invalid = body.allowed_pages.filter(
          (p: string) => !ALL_FEATURES.includes(p as any),
        );
        if (invalid.length > 0) {
          return c.json(
            { error: `Invalid page keys: ${invalid.join(", ")}` },
            400,
          );
        }
        updates.allowed_pages = body.allowed_pages;
      } else {
        return c.json({ error: "allowed_pages must be an array or null" }, 400);
      }
    }

    // Validate and set role (only owner can change roles)
    if (body.role !== undefined) {
      if (auth.role !== "owner") {
        return c.json({ error: "Only owners can change member roles" }, 403);
      }
      const validRoles = ["admin", "member", "readonly"];
      if (!validRoles.includes(body.role)) {
        return c.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
          400,
        );
      }
      updates.role = body.role;
    }

    const updated = await updateOne<MemberDetailRow>(
      "tenant_members",
      updates,
      {
        id: memberId,
        tenant_id: auth.tenantId,
      },
    );

    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "update",
      resourceType: "tenant_member",
      resourceId: memberId,
      oldValues: { role: target.role, allowed_pages: target.allowed_pages },
      newValues: updates,
    });

    return c.json({ member: updated });
  } catch (error) {
    console.error("[TEAM] Error updating member:", error);
    return c.json({ error: "Failed to update team member" }, 500);
  }
});
