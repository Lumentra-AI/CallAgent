import { Hono } from "hono";
import {
  queryOne,
  queryAll,
  getDbStatus,
} from "../services/database/client.js";

const BACKGROUND_JOBS = [
  { name: "Reminders", interval: "every 10 minutes" },
  { name: "Callbacks", interval: "every 5 minutes" },
  { name: "Notification queue", interval: "every 15 minutes" },
  { name: "Engagement scores", interval: "every hour" },
  { name: "Daily slot generation", interval: "midnight" },
  { name: "Review requests", interval: "9 AM daily" },
  { name: "Port status check", interval: "every 6 hours" },
];

export const adminMonitoringRoutes = new Hono();

// ============================================================================
// GET /monitoring/health - System health overview
// ============================================================================

adminMonitoringRoutes.get("/monitoring/health", async (c) => {
  try {
    const dbStatus = await getDbStatus();

    const apiStatus = dbStatus.connected ? "healthy" : "degraded";

    let dbHealthStatus: "healthy" | "degraded" | "down";
    if (!dbStatus.connected) {
      dbHealthStatus = "down";
    } else if (dbStatus.latency !== undefined && dbStatus.latency > 1000) {
      dbHealthStatus = "degraded";
    } else {
      dbHealthStatus = "healthy";
    }

    return c.json({
      api: {
        status: apiStatus,
        uptime_seconds: Math.floor(process.uptime()),
        version: process.env.APP_VERSION || "0.1.0",
      },
      database: {
        status: dbHealthStatus,
        latency_ms: dbStatus.latency ?? null,
      },
      background_jobs: {
        scheduled: BACKGROUND_JOBS,
      },
    });
  } catch (error) {
    console.error("[ADMIN-MONITORING] Error fetching health:", error);
    return c.json({ error: "Failed to fetch system health" }, 500);
  }
});

// ============================================================================
// GET /monitoring/active-calls - Currently active calls
// ============================================================================

adminMonitoringRoutes.get("/monitoring/active-calls", async (c) => {
  try {
    const activeCalls = await queryAll<{
      call_id: string;
      tenant_id: string;
      business_name: string;
      caller_phone: string | null;
      started_at: string;
      duration_so_far: string;
      status: string;
    }>(
      `SELECT
        c.id AS call_id,
        c.tenant_id,
        t.business_name,
        c.caller_phone,
        c.started_at,
        EXTRACT(EPOCH FROM NOW() - c.started_at)::int AS duration_so_far,
        c.status
      FROM calls c
      JOIN tenants t ON t.id = c.tenant_id
      WHERE c.status IN ('ringing', 'connected')
      ORDER BY c.started_at ASC`,
    );

    return c.json({
      active_calls: activeCalls.map((call) => ({
        ...call,
        duration_so_far: Number(call.duration_so_far),
      })),
      count: activeCalls.length,
    });
  } catch (error) {
    console.error("[ADMIN-MONITORING] Error fetching active calls:", error);
    return c.json({ error: "Failed to fetch active calls" }, 500);
  }
});

// ============================================================================
// GET /monitoring/port-requests - Port request operations summary
// ============================================================================

adminMonitoringRoutes.get("/monitoring/port-requests", async (c) => {
  try {
    // Total count
    const totalResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM port_requests`,
    );
    const total = Number(totalResult?.count || 0);

    // Counts by status
    const statusCounts = await queryAll<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count
       FROM port_requests
       GROUP BY status`,
    );

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row.status] = Number(row.count);
    }

    // Average completion days (for completed requests)
    const avgResult = await queryOne<{ avg_days: string | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400)::numeric(10,1) AS avg_days
       FROM port_requests
       WHERE status = 'completed' AND completed_at IS NOT NULL`,
    );
    const avgCompletionDays = avgResult?.avg_days
      ? Number(avgResult.avg_days)
      : null;

    // Oldest pending request (days since created_at for oldest non-terminal request)
    const oldestResult = await queryOne<{ oldest_days: string | null }>(
      `SELECT EXTRACT(EPOCH FROM (NOW() - MIN(created_at)) / 86400)::numeric(10,1) AS oldest_days
       FROM port_requests
       WHERE status NOT IN ('completed', 'rejected')`,
    );
    const oldestPendingDays = oldestResult?.oldest_days
      ? Number(oldestResult.oldest_days)
      : null;

    // Pending port requests (all non-terminal, oldest first)
    const pending = await queryAll<{
      id: string;
      tenant_id: string;
      business_name: string;
      phone_number: string;
      current_carrier: string;
      status: string;
      days_pending: string;
      submitted_at: string | null;
      created_at: string;
    }>(
      `SELECT
        pr.id,
        pr.tenant_id,
        t.business_name,
        pr.phone_number,
        pr.current_carrier,
        pr.status,
        EXTRACT(EPOCH FROM (NOW() - pr.created_at) / 86400)::numeric(10,1) AS days_pending,
        pr.submitted_at,
        pr.created_at
      FROM port_requests pr
      JOIN tenants t ON t.id = pr.tenant_id
      WHERE pr.status NOT IN ('completed', 'rejected')
      ORDER BY pr.created_at ASC`,
    );

    return c.json({
      stats: {
        total,
        by_status: byStatus,
        avg_completion_days: avgCompletionDays,
        oldest_pending_days: oldestPendingDays,
      },
      pending: pending.map((row) => ({
        ...row,
        days_pending: Number(row.days_pending),
      })),
    });
  } catch (error) {
    console.error(
      "[ADMIN-MONITORING] Error fetching port request stats:",
      error,
    );
    return c.json({ error: "Failed to fetch port request stats" }, 500);
  }
});

// ============================================================================
// GET /monitoring/errors - Recent call failures
// ============================================================================

adminMonitoringRoutes.get("/monitoring/errors", async (c) => {
  try {
    // Recent 20 failed/missed calls
    const recentFailures = await queryAll<{
      call_id: string;
      tenant_id: string;
      business_name: string;
      caller_phone: string | null;
      status: string;
      created_at: string;
    }>(
      `SELECT
        c.id AS call_id,
        c.tenant_id,
        t.business_name,
        c.caller_phone,
        c.status,
        c.created_at
      FROM calls c
      JOIN tenants t ON t.id = c.tenant_id
      WHERE c.status IN ('failed', 'missed')
      ORDER BY c.created_at DESC
      LIMIT 20`,
    );

    // Failure stats: last 24h
    const stats24h = await queryOne<{
      total: string;
      failures: string;
    }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('failed', 'missed')) AS failures
      FROM calls
      WHERE created_at > NOW() - INTERVAL '24 hours'`,
    );

    const total24h = Number(stats24h?.total || 0);
    const failures24h = Number(stats24h?.failures || 0);
    const failureRate24h =
      total24h > 0 ? Math.round((failures24h / total24h) * 10000) / 100 : 0;

    // Failure stats: last 7d
    const stats7d = await queryOne<{ failures: string }>(
      `SELECT COUNT(*) AS failures
       FROM calls
       WHERE status IN ('failed', 'missed')
         AND created_at > NOW() - INTERVAL '7 days'`,
    );
    const failures7d = Number(stats7d?.failures || 0);

    return c.json({
      recent_failures: recentFailures,
      failure_stats: {
        last_24h: failures24h,
        last_7d: failures7d,
        failure_rate_24h: failureRate24h,
      },
    });
  } catch (error) {
    console.error("[ADMIN-MONITORING] Error fetching error stats:", error);
    return c.json({ error: "Failed to fetch error stats" }, 500);
  }
});
