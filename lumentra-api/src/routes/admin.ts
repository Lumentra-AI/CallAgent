import { Hono } from "hono";
import { queryOne, queryAll } from "../services/database/client.js";
import { updateOne } from "../services/database/query-helpers.js";
import { releaseNumber } from "../services/signalwire/phone.js";
import { invalidateTenant } from "../services/database/tenant-cache.js";
import { notifyAdmin } from "../services/notifications/admin-notify.js";

export const adminRoutes = new Hono();

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
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
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
