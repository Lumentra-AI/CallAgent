import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";

export const callsRoutes = new Hono();

/**
 * GET /api/calls
 * List calls with filters
 */
callsRoutes.get("/", async (c) => {
  const tenantId = c.req.header("X-Tenant-ID") || c.req.query("tenant_id");
  const status = c.req.query("status");
  const outcome = c.req.query("outcome");
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  if (!tenantId) {
    return c.json({ error: "Tenant ID required" }, 400);
  }

  const db = getSupabase();

  let query = db
    .from("calls")
    .select(
      `
      id,
      vapi_call_id,
      direction,
      status,
      caller_phone,
      caller_name,
      started_at,
      ended_at,
      duration_seconds,
      outcome_type,
      summary,
      sentiment_score,
      intents_detected,
      recording_url,
      created_at
    `,
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (outcome) {
    query = query.eq("outcome_type", outcome);
  }

  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  if (search) {
    query = query.or(
      `caller_phone.ilike.%${search}%,caller_name.ilike.%${search}%`,
    );
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[CALLS] List error:", error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    calls: data || [],
    total: count || 0,
    limit,
    offset,
  });
});

/**
 * GET /api/calls/:id
 * Get call details with transcript
 */
callsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const tenantId = c.req.header("X-Tenant-ID");
  const db = getSupabase();

  let query = db.from("calls").select("*").eq("id", id);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.single();

  if (error) {
    return c.json({ error: "Call not found" }, 404);
  }

  // Get linked contact if exists
  let contact = null;
  if (data.contact_id) {
    const { data: contactData } = await db
      .from("contacts")
      .select("id, first_name, last_name, phone, email")
      .eq("id", data.contact_id)
      .single();
    contact = contactData;
  }

  // Get linked booking if exists
  let booking = null;
  if (data.booking_id) {
    const { data: bookingData } = await db
      .from("bookings")
      .select(
        "id, booking_date, booking_time, booking_type, status, confirmation_code",
      )
      .eq("id", data.booking_id)
      .single();
    booking = bookingData;
  }

  return c.json({
    ...data,
    contact,
    booking,
  });
});

/**
 * GET /api/calls/:id/transcript
 * Get call transcript
 */
callsRoutes.get("/:id/transcript", async (c) => {
  const id = c.req.param("id");
  const tenantId = c.req.header("X-Tenant-ID");
  const db = getSupabase();

  let query = db.from("calls").select("id, transcript, summary").eq("id", id);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.single();

  if (error) {
    return c.json({ error: "Call not found" }, 404);
  }

  // Parse transcript if it's a string
  let transcript = data.transcript;
  if (typeof transcript === "string") {
    try {
      transcript = JSON.parse(transcript);
    } catch {
      // Keep as string if not valid JSON
    }
  }

  return c.json({
    id: data.id,
    transcript,
    summary: data.summary,
  });
});

/**
 * GET /api/calls/stats/:tenantId
 * Get call statistics
 */
callsRoutes.get("/stats/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const db = getSupabase();

  // Date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

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

  // This month's calls
  const { count: callsMonth } = await db
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", monthStart.toISOString());

  // Average duration (last 100 completed calls)
  const { data: durationData } = await db
    .from("calls")
    .select("duration_seconds")
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .not("duration_seconds", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const avgDuration =
    durationData && durationData.length > 0
      ? durationData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
        durationData.length
      : 0;

  // Outcome breakdown (last 30 days)
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: outcomeData } = await db
    .from("calls")
    .select("outcome_type")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("outcome_type", "is", null);

  const outcomes: Record<string, number> = {};
  outcomeData?.forEach((call) => {
    const outcome = call.outcome_type || "unknown";
    outcomes[outcome] = (outcomes[outcome] || 0) + 1;
  });

  return c.json({
    callsToday: callsToday || 0,
    callsWeek: callsWeek || 0,
    callsMonth: callsMonth || 0,
    avgDurationSeconds: Math.round(avgDuration),
    outcomes,
  });
});

/**
 * GET /api/calls/analytics/:tenantId
 * Get call analytics for charts (time series and breakdown)
 */
callsRoutes.get("/analytics/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const days = parseInt(c.req.query("days") || "30", 10);
  const db = getSupabase();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Get all calls in date range
  const { data: calls, error } = await db
    .from("calls")
    .select("created_at, outcome_type, duration_seconds, status")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Group by date
  const dailyData: Record<
    string,
    {
      date: string;
      calls: number;
      bookings: number;
      avgDuration: number;
      durations: number[];
    }
  > = {};

  calls?.forEach((call) => {
    const date = new Date(call.created_at).toISOString().split("T")[0];
    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        calls: 0,
        bookings: 0,
        avgDuration: 0,
        durations: [],
      };
    }
    dailyData[date].calls++;
    if (call.outcome_type === "booking") {
      dailyData[date].bookings++;
    }
    if (call.duration_seconds) {
      dailyData[date].durations.push(call.duration_seconds);
    }
  });

  // Calculate averages and create array
  const timeSeries = Object.values(dailyData).map((day) => ({
    date: day.date,
    calls: day.calls,
    bookings: day.bookings,
    avgDuration:
      day.durations.length > 0
        ? Math.round(
            day.durations.reduce((a, b) => a + b, 0) / day.durations.length,
          )
        : 0,
  }));

  // Outcome breakdown
  const outcomes: Record<string, number> = {};
  calls?.forEach((call) => {
    const outcome = call.outcome_type || "unknown";
    outcomes[outcome] = (outcomes[outcome] || 0) + 1;
  });

  const outcomeSeries = Object.entries(outcomes).map(([name, value]) => ({
    name,
    value,
  }));

  // Calculate totals
  const totalCalls = calls?.length || 0;
  const totalBookings =
    calls?.filter((c) => c.outcome_type === "booking").length || 0;
  const conversionRate =
    totalCalls > 0 ? (totalBookings / totalCalls) * 100 : 0;
  const completedCalls = calls?.filter((c) => c.duration_seconds);
  const avgDuration =
    completedCalls && completedCalls.length > 0
      ? completedCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
        completedCalls.length
      : 0;

  // Peak hours analysis
  const hourCounts: Record<number, number> = {};
  calls?.forEach((call) => {
    const hour = new Date(call.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHours = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return c.json({
    period: { days, startDate: startDate.toISOString() },
    summary: {
      totalCalls,
      totalBookings,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgDurationSeconds: Math.round(avgDuration),
    },
    timeSeries,
    outcomes: outcomeSeries,
    peakHours,
  });
});

/**
 * GET /api/calls/recent
 * Get most recent calls (for dashboard)
 */
callsRoutes.get("/recent/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const limit = Math.min(parseInt(c.req.query("limit") || "10", 10), 50);
  const db = getSupabase();

  const { data, error } = await db
    .from("calls")
    .select(
      `
      id,
      caller_phone,
      caller_name,
      duration_seconds,
      outcome_type,
      summary,
      created_at
    `,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ calls: data || [] });
});
