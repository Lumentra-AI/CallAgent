/**
 * Team Management Routes
 *
 * GET    /api/team                - List team members with allowed_pages
 * PUT    /api/team/:memberId      - Update member's allowed_pages
 * POST   /api/team/invite         - Invite a user by email (owner/admin)
 * POST   /api/team/accept-invite  - Accept pending invite (authenticated user)
 * POST   /api/team/:memberId/resend-invite - Resend invite email
 * DELETE /api/team/:memberId      - Remove a team member
 */

import { Hono } from "hono";
import { getAuthContext, getServiceClient } from "../middleware/index.js";
import { logActivity } from "../services/audit/logger.js";
import { queryOne, queryAll } from "../services/database/client.js";
import { insertOne, updateOne } from "../services/database/query-helpers.js";
import { ALL_FEATURES } from "../services/features/feature-resolver.js";
import { sendTeamInviteEmail } from "../services/notifications/team-invite-email.js";

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

/**
 * POST /api/team/invite
 * Invite a user by email. Creates Supabase auth user via admin invite,
 * then creates a pending tenant_members row (accepted_at = null).
 * Requires owner or admin role.
 */
teamRoutes.post("/invite", async (c) => {
  const auth = getAuthContext(c);

  if (!["owner", "admin"].includes(auth.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const email = body.email?.trim().toLowerCase();
  const role = body.role || "member";
  const allowedPages = body.allowed_pages ?? null;

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const validRoles = ["admin", "member", "readonly"];
  if (!validRoles.includes(role)) {
    return c.json(
      { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
      400,
    );
  }

  // Only owners can invite admins
  if (role === "admin" && auth.role !== "owner") {
    return c.json({ error: "Only owners can invite admins" }, 403);
  }

  // Validate allowed_pages if provided
  if (allowedPages !== null) {
    if (!Array.isArray(allowedPages)) {
      return c.json({ error: "allowed_pages must be an array or null" }, 400);
    }
    const invalid = allowedPages.filter(
      (p: string) => !ALL_FEATURES.includes(p as any),
    );
    if (invalid.length > 0) {
      return c.json({ error: `Invalid page keys: ${invalid.join(", ")}` }, 400);
    }
  }

  try {
    // Check if user is already a member of this tenant
    const existing = await queryOne<{
      id: string;
      accepted_at: string | null;
      is_active: boolean;
    }>(
      `SELECT id, accepted_at, is_active FROM tenant_members
       WHERE tenant_id = $1 AND user_id IN (
         SELECT id FROM auth.users WHERE email = $2
       )`,
      [auth.tenantId, email],
    );

    if (existing?.is_active) {
      return c.json({ error: "User is already a member of this team" }, 400);
    }

    // Get the redirect URL from the request origin or use the configured app URL
    const appUrl = process.env.APP_URL || "https://app.lumentraai.com";
    const redirectTo = `${appUrl}/accept-invite`;

    // Use Supabase Admin API to invite the user
    const supabaseAdmin = getServiceClient();
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          tenant_id: auth.tenantId,
          role,
          invited_by: auth.userId,
        },
      });

    if (inviteError) {
      console.error("[TEAM] Supabase invite error:", inviteError);

      // If user already exists in auth, create pending membership and send notification email
      if (inviteError.message?.includes("already been registered")) {
        // Direct SQL lookup -- no pagination issues (fixes listUsers() bug)
        const authUser = await queryOne<{ id: string }>(
          `SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1`,
          [email],
        );
        if (!authUser) {
          return c.json({ error: "User exists but could not be found" }, 500);
        }

        // Get business name for the invite email
        const tenant = await queryOne<{ business_name: string }>(
          `SELECT business_name FROM tenants WHERE id = $1`,
          [auth.tenantId],
        );
        const businessName = tenant?.business_name || "a business";

        // Get inviter email for the notification
        const inviter = await queryOne<{ email: string }>(
          `SELECT email FROM auth.users WHERE id = $1`,
          [auth.userId],
        );

        // Create or reactivate membership (pending -- accepted_at = null)
        let member: MemberDetailRow;
        if (existing && !existing.is_active) {
          member = (await updateOne<MemberDetailRow>(
            "tenant_members",
            {
              role,
              allowed_pages: allowedPages,
              invited_by: auth.userId,
              invited_at: new Date().toISOString(),
              accepted_at: null,
              is_active: true,
            },
            { id: existing.id },
          ))!;
        } else {
          member = await insertOne<MemberDetailRow>("tenant_members", {
            tenant_id: auth.tenantId,
            user_id: authUser.id,
            role,
            allowed_pages: allowedPages,
            invited_by: auth.userId,
            invited_at: new Date().toISOString(),
            accepted_at: null,
          });
        }

        // Send invite notification email via Resend
        const appUrl = process.env.APP_URL || "https://app.lumentraai.com";
        const emailResult = await sendTeamInviteEmail({
          to: email,
          businessName,
          inviterEmail: inviter?.email || null,
          acceptUrl: `${appUrl}/accept-invite?existing=1`,
        });

        await logActivity({
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: "create",
          resourceType: "team_invite",
          resourceId: member.id,
          newValues: {
            email,
            role,
            existing_user: true,
            email_sent: emailResult.sent,
          },
        });

        return c.json(
          {
            member,
            invited: true,
            existing_user: true,
            email_sent: emailResult.sent,
          },
          201,
        );
      }

      return c.json(
        { error: inviteError.message || "Failed to send invite" },
        500,
      );
    }

    // Supabase created or found the user -- create membership row
    const newUserId = inviteData.user.id;

    // Handle reactivation of previously removed member
    if (existing && !existing.is_active) {
      const reactivated = await updateOne<MemberDetailRow>(
        "tenant_members",
        {
          role,
          allowed_pages: allowedPages,
          invited_by: auth.userId,
          invited_at: new Date().toISOString(),
          accepted_at: null,
          is_active: true,
        },
        { id: existing.id },
      );

      await logActivity({
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: "create",
        resourceType: "team_invite",
        resourceId: reactivated!.id,
        newValues: { email, role },
      });

      return c.json({ member: reactivated, invited: true }, 201);
    }

    const member = await insertOne<MemberDetailRow>("tenant_members", {
      tenant_id: auth.tenantId,
      user_id: newUserId,
      role,
      allowed_pages: allowedPages,
      invited_by: auth.userId,
      invited_at: new Date().toISOString(),
      accepted_at: null,
    });

    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "create",
      resourceType: "team_invite",
      resourceId: member.id,
      newValues: { email, role },
    });

    return c.json({ member, invited: true }, 201);
  } catch (error) {
    console.error("[TEAM] Error inviting member:", error);

    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return c.json({ error: "User is already a member of this team" }, 400);
    }

    return c.json({ error: "Failed to invite team member" }, 500);
  }
});

/**
 * POST /api/team/accept-invite
 * Stamp accepted_at on the current user's pending membership(s).
 * Uses userAuthMiddleware since the user may not have X-Tenant-ID yet.
 */
teamRoutes.post("/accept-invite", async (c) => {
  const auth = c.get("auth");
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Find all pending memberships for this user
    const pending = await queryAll<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id FROM tenant_members
       WHERE user_id = $1 AND accepted_at IS NULL AND is_active = true`,
      [auth.userId],
    );

    if (!pending || pending.length === 0) {
      // Idempotent: no pending invites means already accepted or none exist
      return c.json({ accepted_tenants: [], count: 0, already_accepted: true });
    }

    const now = new Date().toISOString();
    const accepted: string[] = [];

    for (const row of pending) {
      await updateOne("tenant_members", { accepted_at: now }, { id: row.id });
      accepted.push(row.tenant_id);
    }

    return c.json({ accepted_tenants: accepted, count: accepted.length });
  } catch (error) {
    console.error("[TEAM] Error accepting invite:", error);
    return c.json({ error: "Failed to accept invite" }, 500);
  }
});

/**
 * POST /api/team/:memberId/resend-invite
 * Resend the invite email for a pending member.
 * Requires owner or admin role.
 */
teamRoutes.post("/:memberId/resend-invite", async (c) => {
  const auth = getAuthContext(c);
  const memberId = c.req.param("memberId");

  if (!["owner", "admin"].includes(auth.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const target = await queryOne<MemberDetailRow>(
      `SELECT tm.id, tm.user_id, tm.accepted_at, u.email
       FROM tenant_members tm
       LEFT JOIN auth.users u ON u.id = tm.user_id
       WHERE tm.id = $1 AND tm.tenant_id = $2 AND tm.is_active = true`,
      [memberId, auth.tenantId],
    );

    if (!target) {
      return c.json({ error: "Member not found" }, 404);
    }

    if (target.accepted_at) {
      return c.json(
        { error: "This member has already accepted their invite" },
        400,
      );
    }

    if (!target.email) {
      return c.json({ error: "No email associated with this member" }, 400);
    }

    const appUrl = process.env.APP_URL || "https://app.lumentraai.com";
    const supabaseAdmin = getServiceClient();

    const { error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(target.email, {
        redirectTo: `${appUrl}/accept-invite`,
      });

    if (inviteError) {
      // For already-registered users, send via Resend instead of 500ing
      if (inviteError.message?.includes("already been registered")) {
        const tenant = await queryOne<{ business_name: string }>(
          `SELECT business_name FROM tenants WHERE id = $1`,
          [auth.tenantId],
        );
        const inviter = await queryOne<{ email: string }>(
          `SELECT email FROM auth.users WHERE id = $1`,
          [auth.userId],
        );

        const emailResult = await sendTeamInviteEmail({
          to: target.email,
          businessName: tenant?.business_name || "a business",
          inviterEmail: inviter?.email || null,
          acceptUrl: `${appUrl}/accept-invite?existing=1`,
        });

        if (!emailResult.sent) {
          console.error(
            "[TEAM] Resend invite email failed:",
            emailResult.error,
          );
          return c.json({ error: "Failed to send invite email" }, 500);
        }
      } else {
        console.error("[TEAM] Resend invite error:", inviteError);
        return c.json(
          { error: inviteError.message || "Failed to resend invite" },
          500,
        );
      }
    }

    // Update invited_at timestamp
    await updateOne(
      "tenant_members",
      { invited_at: new Date().toISOString() },
      { id: memberId },
    );

    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "update",
      resourceType: "team_invite",
      resourceId: memberId,
      newValues: { resent: true },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[TEAM] Error resending invite:", error);
    return c.json({ error: "Failed to resend invite" }, 500);
  }
});

/**
 * DELETE /api/team/:memberId
 * Remove a team member (soft delete via is_active = false).
 * Requires owner or admin role. Cannot remove owners.
 */
teamRoutes.delete("/:memberId", async (c) => {
  const auth = getAuthContext(c);
  const memberId = c.req.param("memberId");

  if (!["owner", "admin"].includes(auth.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const target = await queryOne<MemberDetailRow>(
      `SELECT id, user_id, role FROM tenant_members
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [memberId, auth.tenantId],
    );

    if (!target) {
      return c.json({ error: "Member not found" }, 404);
    }

    if (target.role === "owner") {
      return c.json({ error: "Cannot remove an owner" }, 403);
    }

    // Cannot remove yourself
    if (target.user_id === auth.userId) {
      return c.json({ error: "Cannot remove yourself" }, 400);
    }

    await updateOne("tenant_members", { is_active: false }, { id: memberId });

    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "delete",
      resourceType: "tenant_member",
      resourceId: memberId,
      oldValues: { role: target.role },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[TEAM] Error removing member:", error);
    return c.json({ error: "Failed to remove team member" }, 500);
  }
});
