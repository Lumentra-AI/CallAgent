/**
 * Port Status Monitor
 *
 * Background job that detects stuck port requests and alerts admin.
 * Runs every 6 hours via the scheduler.
 *
 * Alerts:
 * - Draft requests older than 7 days (admin hasn't acted)
 * - Submitted/pending requests older than 20 business days (carrier may have stalled)
 */

import { queryAll } from "../services/database/client.js";
import { notifyAdmin } from "../services/notifications/admin-notify.js";

interface StuckPortRequest {
  id: string;
  tenant_id: string;
  phone_number: string;
  current_carrier: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  business_name: string;
}

export async function checkPortStatus(): Promise<void> {
  // Find draft requests older than 7 days
  const staleDrafts = await queryAll<StuckPortRequest>(
    `SELECT pr.id, pr.tenant_id, pr.phone_number, pr.current_carrier,
            pr.status, pr.created_at, pr.submitted_at, t.business_name
     FROM port_requests pr
     JOIN tenants t ON t.id = pr.tenant_id
     WHERE pr.status = 'draft'
       AND pr.created_at < NOW() - INTERVAL '7 days'
     ORDER BY pr.created_at ASC`,
  );

  // Find submitted/pending requests older than 20 business days (~28 calendar days)
  const stuckInProgress = await queryAll<StuckPortRequest>(
    `SELECT pr.id, pr.tenant_id, pr.phone_number, pr.current_carrier,
            pr.status, pr.created_at, pr.submitted_at, t.business_name
     FROM port_requests pr
     JOIN tenants t ON t.id = pr.tenant_id
     WHERE pr.status IN ('submitted', 'pending', 'approved')
       AND pr.submitted_at < NOW() - INTERVAL '28 days'
     ORDER BY pr.submitted_at ASC`,
  );

  if (staleDrafts.length === 0 && stuckInProgress.length === 0) {
    return;
  }

  console.log(
    `[PORT-CHECK] Found ${staleDrafts.length} stale drafts, ${stuckInProgress.length} stuck in-progress`,
  );

  if (staleDrafts.length > 0) {
    await notifyAdmin("port_requests_stale_drafts", {
      count: staleDrafts.length,
      requests: staleDrafts.map((r) => ({
        id: r.id,
        phoneNumber: r.phone_number,
        carrier: r.current_carrier,
        business: r.business_name,
        createdAt: r.created_at,
        daysSinceCreated: Math.floor(
          (Date.now() - new Date(r.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      })),
    });
  }

  if (stuckInProgress.length > 0) {
    await notifyAdmin("port_requests_stuck", {
      count: stuckInProgress.length,
      requests: stuckInProgress.map((r) => ({
        id: r.id,
        phoneNumber: r.phone_number,
        carrier: r.current_carrier,
        business: r.business_name,
        status: r.status,
        submittedAt: r.submitted_at,
        daysSinceSubmitted: r.submitted_at
          ? Math.floor(
              (Date.now() - new Date(r.submitted_at).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
      })),
    });
  }
}
