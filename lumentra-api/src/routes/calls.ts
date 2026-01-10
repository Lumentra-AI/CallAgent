import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";

export const callsRoutes = new Hono();

/**
 * GET /api/calls
 * List calls with optional filters
 */
callsRoutes.get("/", async (c) => {
  const tenantId = c.req.query("tenant_id");
  const status = c.req.query("status");
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const db = getSupabase();

  let query = db
    .from("calls")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    calls: data,
    total: count,
    limit,
    offset,
  });
});

/**
 * GET /api/calls/:id
 * Get a single call by ID
 */
callsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getSupabase();

  const { data, error } = await db
    .from("calls")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: "Call not found" }, 404);
  }

  return c.json(data);
});

/**
 * GET /api/calls/stats
 * Get call statistics for a tenant
 */
callsRoutes.get("/stats/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const db = getSupabase();

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get this week's date range
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  // Today's calls
  const { count: callsToday } = await db
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString());

  // This week's calls
  const { count: callsWeek } = await db
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", weekStart.toISOString());

  // Average duration
  const { data: durationData } = await db
    .from("calls")
    .select("duration_seconds")
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .not("duration_seconds", "is", null)
    .limit(100);

  const avgDuration =
    durationData && durationData.length > 0
      ? durationData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
        durationData.length
      : 0;

  return c.json({
    callsToday: callsToday || 0,
    callsWeek: callsWeek || 0,
    avgDurationSeconds: Math.round(avgDuration),
  });
});
