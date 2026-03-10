/**
 * Audit Trail Logger
 *
 * Centralized audit logging for all mutation operations.
 * Silently catches errors to avoid blocking the operation being audited.
 */

import { insertOne } from "../database/query-helpers.js";

export interface AuditLogEntry {
  tenantId: string;
  userId: string | null;
  action: "create" | "update" | "delete";
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write an audit log entry. Fire-and-forget -- never throws.
 */
export async function logActivity(entry: AuditLogEntry): Promise<void> {
  try {
    await insertOne("audit_logs", {
      tenant_id: entry.tenantId,
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId || null,
      old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[AUDIT] Failed to write audit log:", err);
  }
}
