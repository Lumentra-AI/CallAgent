/**
 * Activity / Audit Log Routes
 *
 * GET /api/activity - Returns recent audit log entries for the tenant
 */

import { Hono } from "hono";
import { getAuthContext } from "../middleware/index.js";
import { queryAll, queryOne } from "../services/database/client.js";

export const activityRoutes = new Hono();

interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  email?: string | null;
}

/**
 * GET /api/activity
 * Returns paginated audit log for the current tenant.
 * Supports filtering by resource_type and action.
 */
activityRoutes.get("/", async (c) => {
  const auth = getAuthContext(c);

  // Only owner/admin can view full audit trail
  if (!["owner", "admin"].includes(auth.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const resourceType = c.req.query("resource_type");
  const action = c.req.query("action");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  try {
    const conditions: string[] = ["a.tenant_id = $1"];
    const params: unknown[] = [auth.tenantId];
    let paramIndex = 2;

    if (resourceType) {
      conditions.push(`a.resource_type = $${paramIndex}`);
      params.push(resourceType);
      paramIndex++;
    }

    if (action) {
      conditions.push(`a.action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs a WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult?.count || "0", 10);

    const logs = await queryAll<AuditLogRow>(
      `SELECT a.id, a.user_id, a.action, a.resource_type, a.resource_id,
              a.old_values, a.new_values, a.created_at, u.email
       FROM audit_logs a
       LEFT JOIN auth.users u ON u.id::text = a.user_id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return c.json({ logs: logs || [], total, limit, offset });
  } catch (error) {
    console.error("[ACTIVITY] Error fetching audit logs:", error);
    return c.json({ error: "Failed to fetch activity" }, 500);
  }
});
