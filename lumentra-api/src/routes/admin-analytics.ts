import { Hono } from "hono";
import { queryOne, queryAll } from "../services/database/client.js";
import { getPlatformAdminContext } from "../middleware/auth.js";

export const adminAnalyticsRoutes = new Hono();

// ============================================================================
// 1. GET /analytics/overview - Platform KPIs
// ============================================================================

adminAnalyticsRoutes.get("/analytics/overview", async (c) => {
  getPlatformAdminContext(c); // verify admin context exists

  try {
    // --- Tenant stats ---
    const tenantStats = await queryOne<{
      total_tenants: string;
      active_tenants: string;
      suspended_tenants: string;
      new_signups_week: string;
      new_signups_month: string;
      setup_completed_count: string;
    }>(
      `SELECT
        COUNT(*) AS total_tenants,
        COUNT(*) FILTER (WHERE status = 'active') AS active_tenants,
        COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_tenants,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_signups_week,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_signups_month,
        COUNT(*) FILTER (WHERE setup_completed = true) AS setup_completed_count
      FROM tenants
      WHERE status != 'deleted'`,
    );

    // --- Call stats ---
    const callStats = await queryOne<{
      total_today: string;
      total_week: string;
      total_month: string;
      total_all_time: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE) AS total_today,
        COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days') AS total_week,
        COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '30 days') AS total_month,
        COUNT(*) AS total_all_time
      FROM calls`,
    );

    // --- User count ---
    const userCount = await queryOne<{ total_users: string }>(
      `SELECT COUNT(*) AS total_users FROM tenant_members WHERE is_active = true`,
    );

    // --- Active rate: tenants with a call in last 7 days / active tenants ---
    const activeRate = await queryOne<{ active_callers: string }>(
      `SELECT COUNT(DISTINCT tenant_id) AS active_callers
       FROM calls
       WHERE started_at >= NOW() - INTERVAL '7 days'`,
    );

    // --- Avg calls per tenant per month ---
    // Use last 30 days of calls across active tenants
    const activeTenantCount = Number(tenantStats?.active_tenants || 0);
    const totalCallsMonth = Number(callStats?.total_month || 0);
    const avgCallsPerTenantMonth =
      activeTenantCount > 0
        ? Math.round((totalCallsMonth / activeTenantCount) * 10) / 10
        : 0;

    // --- Top industries ---
    const topIndustries = await queryAll<{ industry: string; count: string }>(
      `SELECT COALESCE(industry, 'unknown') AS industry, COUNT(*) AS count
       FROM tenants
       WHERE status != 'deleted'
       GROUP BY industry
       ORDER BY count DESC
       LIMIT 10`,
    );

    // --- Tier distribution ---
    const tierDistribution = await queryAll<{ tier: string; count: string }>(
      `SELECT COALESCE(subscription_tier, 'starter') AS tier, COUNT(*) AS count
       FROM tenants
       WHERE status != 'deleted'
       GROUP BY subscription_tier
       ORDER BY count DESC`,
    );

    const totalTenants = Number(tenantStats?.total_tenants || 0);
    const setupCompletedCount = Number(tenantStats?.setup_completed_count || 0);
    const setupCompletionRate =
      totalTenants > 0
        ? Math.round((setupCompletedCount / totalTenants) * 1000) / 10
        : 0;

    const activeCallers = Number(activeRate?.active_callers || 0);
    const activeRatePercent =
      activeTenantCount > 0
        ? Math.round((activeCallers / activeTenantCount) * 1000) / 10
        : 0;

    return c.json({
      total_tenants: totalTenants,
      active_tenants: activeTenantCount,
      suspended_tenants: Number(tenantStats?.suspended_tenants || 0),
      total_calls_today: Number(callStats?.total_today || 0),
      total_calls_week: Number(callStats?.total_week || 0),
      total_calls_month: totalCallsMonth,
      total_calls_all_time: Number(callStats?.total_all_time || 0),
      avg_calls_per_tenant_month: avgCallsPerTenantMonth,
      total_users: Number(userCount?.total_users || 0),
      new_signups_this_week: Number(tenantStats?.new_signups_week || 0),
      new_signups_this_month: Number(tenantStats?.new_signups_month || 0),
      setup_completion_rate: setupCompletionRate,
      active_rate: activeRatePercent,
      top_industries: topIndustries.map((r) => ({
        industry: r.industry,
        count: Number(r.count),
      })),
      tier_distribution: tierDistribution.map((r) => ({
        tier: r.tier,
        count: Number(r.count),
      })),
    });
  } catch (error) {
    console.error("[ADMIN_ANALYTICS] Error fetching overview:", error);
    return c.json({ error: "Failed to fetch analytics overview" }, 500);
  }
});

// ============================================================================
// 2. GET /analytics/growth - Time series data
// ============================================================================

adminAnalyticsRoutes.get("/analytics/growth", async (c) => {
  getPlatformAdminContext(c);

  const period = c.req.query("period") || "daily";
  const range = Math.min(
    Math.max(parseInt(c.req.query("range") || "30", 10), 1),
    365,
  );

  // Validate period
  const validPeriods = ["daily", "weekly", "monthly"];
  if (!validPeriods.includes(period)) {
    return c.json(
      { error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` },
      400,
    );
  }

  // Map period to date_trunc interval and generate_series interval
  const truncInterval =
    period === "daily" ? "day" : period === "weekly" ? "week" : "month";
  const seriesInterval =
    period === "daily" ? "1 day" : period === "weekly" ? "1 week" : "1 month";

  try {
    // --- Signups time series ---
    const signups = await queryAll<{ date: string; count: string }>(
      `SELECT
        gs.d::date AS date,
        COALESCE(t.cnt, 0) AS count
      FROM generate_series(
        (CURRENT_DATE - $1::int * INTERVAL '1 day')::date,
        CURRENT_DATE::date,
        $2::interval
      ) AS gs(d)
      LEFT JOIN (
        SELECT date_trunc($3, created_at)::date AS d, COUNT(*) AS cnt
        FROM tenants
        WHERE created_at >= CURRENT_DATE - $1::int * INTERVAL '1 day'
          AND status != 'deleted'
        GROUP BY 1
      ) t ON gs.d = t.d
      ORDER BY gs.d ASC`,
      [range, seriesInterval, truncInterval],
    );

    // --- Calls time series ---
    const calls = await queryAll<{ date: string; count: string }>(
      `SELECT
        gs.d::date AS date,
        COALESCE(c.cnt, 0) AS count
      FROM generate_series(
        (CURRENT_DATE - $1::int * INTERVAL '1 day')::date,
        CURRENT_DATE::date,
        $2::interval
      ) AS gs(d)
      LEFT JOIN (
        SELECT date_trunc($3, started_at)::date AS d, COUNT(*) AS cnt
        FROM calls
        WHERE started_at >= CURRENT_DATE - $1::int * INTERVAL '1 day'
        GROUP BY 1
      ) c ON gs.d = c.d
      ORDER BY gs.d ASC`,
      [range, seriesInterval, truncInterval],
    );

    // --- Active tenants time series (tenants with at least 1 call in the period bucket) ---
    const activeTenants = await queryAll<{ date: string; count: string }>(
      `SELECT
        gs.d::date AS date,
        COALESCE(a.cnt, 0) AS count
      FROM generate_series(
        (CURRENT_DATE - $1::int * INTERVAL '1 day')::date,
        CURRENT_DATE::date,
        $2::interval
      ) AS gs(d)
      LEFT JOIN (
        SELECT date_trunc($3, started_at)::date AS d, COUNT(DISTINCT tenant_id) AS cnt
        FROM calls
        WHERE started_at >= CURRENT_DATE - $1::int * INTERVAL '1 day'
        GROUP BY 1
      ) a ON gs.d = a.d
      ORDER BY gs.d ASC`,
      [range, seriesInterval, truncInterval],
    );

    return c.json({
      signups: signups.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      calls: calls.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      active_tenants: activeTenants.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    });
  } catch (error) {
    console.error("[ADMIN_ANALYTICS] Error fetching growth data:", error);
    return c.json({ error: "Failed to fetch growth data" }, 500);
  }
});

// ============================================================================
// 3. GET /analytics/calls - Call analytics
// ============================================================================

adminAnalyticsRoutes.get("/analytics/calls", async (c) => {
  getPlatformAdminContext(c);

  const days = Math.min(
    Math.max(parseInt(c.req.query("days") || "30", 10), 1),
    365,
  );

  try {
    // --- Total + avg duration + failure rate ---
    const summary = await queryOne<{
      total: string;
      avg_duration: string;
      failed_count: string;
    }>(
      `SELECT
        COUNT(*) AS total,
        COALESCE(AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL), 0) AS avg_duration,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
      FROM calls
      WHERE started_at >= NOW() - $1::int * INTERVAL '1 day'`,
      [days],
    );

    const total = Number(summary?.total || 0);
    const avgDuration = Math.round(Number(summary?.avg_duration || 0));
    const failedCount = Number(summary?.failed_count || 0);
    const failureRate =
      total > 0 ? Math.round((failedCount / total) * 1000) / 10 : 0;

    // --- By outcome ---
    const outcomeRows = await queryAll<{
      outcome_type: string | null;
      count: string;
    }>(
      `SELECT COALESCE(outcome_type, 'unknown') AS outcome_type, COUNT(*) AS count
       FROM calls
       WHERE started_at >= NOW() - $1::int * INTERVAL '1 day'
       GROUP BY outcome_type
       ORDER BY count DESC`,
      [days],
    );

    const byOutcome: Record<string, number> = {};
    for (const row of outcomeRows) {
      byOutcome[row.outcome_type || "unknown"] = Number(row.count);
    }

    // --- By industry ---
    const byIndustry = await queryAll<{
      industry: string;
      count: string;
      success_rate: string;
    }>(
      `SELECT
        COALESCE(t.industry, 'unknown') AS industry,
        COUNT(*) AS count,
        COALESCE(
          ROUND(
            (COUNT(*) FILTER (WHERE c.outcome_success = true))::numeric /
            NULLIF(COUNT(*), 0) * 100,
            1
          ),
          0
        ) AS success_rate
      FROM calls c
      JOIN tenants t ON t.id = c.tenant_id
      WHERE c.started_at >= NOW() - $1::int * INTERVAL '1 day'
      GROUP BY t.industry
      ORDER BY count DESC`,
      [days],
    );

    // --- By hour of day ---
    const byHour = await queryAll<{ hour: string; count: string }>(
      `SELECT
        gs.h AS hour,
        COALESCE(c.cnt, 0) AS count
      FROM generate_series(0, 23) AS gs(h)
      LEFT JOIN (
        SELECT EXTRACT(HOUR FROM started_at)::int AS h, COUNT(*) AS cnt
        FROM calls
        WHERE started_at >= NOW() - $1::int * INTERVAL '1 day'
        GROUP BY 1
      ) c ON gs.h = c.h
      ORDER BY gs.h ASC`,
      [days],
    );

    return c.json({
      total,
      by_outcome: byOutcome,
      by_industry: byIndustry.map((r) => ({
        industry: r.industry,
        count: Number(r.count),
        success_rate: Number(r.success_rate),
      })),
      by_hour: byHour.map((r) => ({
        hour: Number(r.hour),
        count: Number(r.count),
      })),
      avg_duration_seconds: avgDuration,
      failure_rate: failureRate,
    });
  } catch (error) {
    console.error("[ADMIN_ANALYTICS] Error fetching call analytics:", error);
    return c.json({ error: "Failed to fetch call analytics" }, 500);
  }
});

// ============================================================================
// 4. GET /analytics/tenants/top - Top performing tenants
// ============================================================================

adminAnalyticsRoutes.get("/analytics/tenants/top", async (c) => {
  getPlatformAdminContext(c);

  const metric = c.req.query("metric") || "calls";
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") || "10", 10), 1),
    50,
  );

  const validMetrics = ["calls", "bookings", "duration"];
  if (!validMetrics.includes(metric)) {
    return c.json(
      { error: `Invalid metric. Must be one of: ${validMetrics.join(", ")}` },
      400,
    );
  }

  try {
    let sql: string;

    if (metric === "calls") {
      sql = `
        SELECT
          t.id AS tenant_id,
          t.business_name,
          COALESCE(t.industry, 'unknown') AS industry,
          COUNT(c.id) AS metric_value
        FROM tenants t
        JOIN calls c ON c.tenant_id = t.id
        WHERE t.status != 'deleted'
          AND c.started_at >= NOW() - INTERVAL '30 days'
        GROUP BY t.id, t.business_name, t.industry
        ORDER BY metric_value DESC
        LIMIT $1`;
    } else if (metric === "bookings") {
      sql = `
        SELECT
          t.id AS tenant_id,
          t.business_name,
          COALESCE(t.industry, 'unknown') AS industry,
          COUNT(b.id) AS metric_value
        FROM tenants t
        JOIN bookings b ON b.tenant_id = t.id
        WHERE t.status != 'deleted'
          AND b.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY t.id, t.business_name, t.industry
        ORDER BY metric_value DESC
        LIMIT $1`;
    } else {
      // duration
      sql = `
        SELECT
          t.id AS tenant_id,
          t.business_name,
          COALESCE(t.industry, 'unknown') AS industry,
          COALESCE(SUM(c.duration_seconds), 0) AS metric_value
        FROM tenants t
        JOIN calls c ON c.tenant_id = t.id
        WHERE t.status != 'deleted'
          AND c.started_at >= NOW() - INTERVAL '30 days'
          AND c.duration_seconds IS NOT NULL
        GROUP BY t.id, t.business_name, t.industry
        ORDER BY metric_value DESC
        LIMIT $1`;
    }

    const rows = await queryAll<{
      tenant_id: string;
      business_name: string;
      industry: string;
      metric_value: string;
    }>(sql, [limit]);

    return c.json(
      rows.map((r) => ({
        tenant_id: r.tenant_id,
        business_name: r.business_name,
        industry: r.industry,
        metric_value: Number(r.metric_value),
      })),
    );
  } catch (error) {
    console.error("[ADMIN_ANALYTICS] Error fetching top tenants:", error);
    return c.json({ error: "Failed to fetch top tenants" }, 500);
  }
});

// ============================================================================
// 5. GET /analytics/tenants/at-risk - Tenants needing attention
// ============================================================================

adminAnalyticsRoutes.get("/analytics/tenants/at-risk", async (c) => {
  getPlatformAdminContext(c);

  try {
    const atRisk: Array<{
      tenant_id: string;
      business_name: string;
      industry: string;
      reason: string;
      detail: string;
    }> = [];

    // --- no_calls_7d: active tenants with no calls in last 7 days ---
    const noCalls = await queryAll<{
      id: string;
      business_name: string;
      industry: string;
      last_call_at: string | null;
    }>(
      `SELECT
        t.id,
        t.business_name,
        COALESCE(t.industry, 'unknown') AS industry,
        (SELECT MAX(c.started_at) FROM calls c WHERE c.tenant_id = t.id) AS last_call_at
      FROM tenants t
      WHERE t.status = 'active'
        AND t.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM calls c
          WHERE c.tenant_id = t.id
            AND c.started_at >= NOW() - INTERVAL '7 days'
        )
      ORDER BY t.business_name ASC
      LIMIT 50`,
    );

    for (const row of noCalls) {
      const lastCallStr = row.last_call_at
        ? `Last call: ${new Date(row.last_call_at).toISOString().split("T")[0]}`
        : "No calls ever";
      atRisk.push({
        tenant_id: row.id,
        business_name: row.business_name,
        industry: row.industry,
        reason: "no_calls_7d",
        detail: `Active tenant with no calls in the last 7 days. ${lastCallStr}.`,
      });
    }

    // --- setup_incomplete: created > 48h ago, setup_completed = false ---
    const incompleteSetup = await queryAll<{
      id: string;
      business_name: string;
      industry: string;
      created_at: string;
    }>(
      `SELECT
        t.id,
        t.business_name,
        COALESCE(t.industry, 'unknown') AS industry,
        t.created_at
      FROM tenants t
      WHERE t.setup_completed = false
        AND t.status != 'deleted'
        AND t.created_at < NOW() - INTERVAL '48 hours'
      ORDER BY t.created_at ASC
      LIMIT 50`,
    );

    for (const row of incompleteSetup) {
      const createdDate = new Date(row.created_at).toISOString().split("T")[0];
      atRisk.push({
        tenant_id: row.id,
        business_name: row.business_name,
        industry: row.industry,
        reason: "setup_incomplete",
        detail: `Tenant created on ${createdDate} has not completed setup.`,
      });
    }

    // --- high_failure_rate: > 20% failed calls in last 30 days (min 5 calls) ---
    const highFailure = await queryAll<{
      id: string;
      business_name: string;
      industry: string;
      total_calls: string;
      failed_calls: string;
      failure_pct: string;
    }>(
      `SELECT
        t.id,
        t.business_name,
        COALESCE(t.industry, 'unknown') AS industry,
        sub.total_calls,
        sub.failed_calls,
        sub.failure_pct
      FROM tenants t
      JOIN (
        SELECT
          tenant_id,
          COUNT(*) AS total_calls,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed_calls,
          ROUND(
            (COUNT(*) FILTER (WHERE status = 'failed'))::numeric /
            NULLIF(COUNT(*), 0) * 100,
            1
          ) AS failure_pct
        FROM calls
        WHERE started_at >= NOW() - INTERVAL '30 days'
        GROUP BY tenant_id
        HAVING COUNT(*) >= 5
          AND ROUND(
            (COUNT(*) FILTER (WHERE status = 'failed'))::numeric /
            NULLIF(COUNT(*), 0) * 100,
            1
          ) > 20
      ) sub ON sub.tenant_id = t.id
      WHERE t.status != 'deleted'
      ORDER BY sub.failure_pct DESC
      LIMIT 50`,
    );

    for (const row of highFailure) {
      atRisk.push({
        tenant_id: row.id,
        business_name: row.business_name,
        industry: row.industry,
        reason: "high_failure_rate",
        detail: `${Number(row.failure_pct)}% failure rate (${Number(row.failed_calls)}/${Number(row.total_calls)} calls) in the last 30 days.`,
      });
    }

    return c.json(atRisk);
  } catch (error) {
    console.error("[ADMIN_ANALYTICS] Error fetching at-risk tenants:", error);
    return c.json({ error: "Failed to fetch at-risk tenants" }, 500);
  }
});
