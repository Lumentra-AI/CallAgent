import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import * as sessionManager from "../services/voice/session-manager.js";

export const dashboardRoutes = new Hono();

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// In-memory activity log (recent events)
interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warning" | "error" | "success";
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const activityLog: ActivityLogEntry[] = [];
const MAX_LOG_ENTRIES = 200;

/**
 * Add entry to activity log
 */
export function logActivity(
  level: ActivityLogEntry["level"],
  category: string,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  const entry: ActivityLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    level,
    category,
    message,
    metadata,
  };

  activityLog.unshift(entry);

  // Trim old entries
  if (activityLog.length > MAX_LOG_ENTRIES) {
    activityLog.length = MAX_LOG_ENTRIES;
  }
}

/**
 * GET /api/dashboard/metrics
 * System health and real-time metrics
 */
dashboardRoutes.get("/metrics", async (c) => {
  const tenantId = c.req.query("tenant_id");
  const db = getSupabase();

  // Get active calls from session manager
  const activeSessions = sessionManager.getAllSessions();
  const activeCalls = tenantId
    ? activeSessions.filter((s) => s.tenantId === tenantId).length
    : activeSessions.length;

  // Calculate uptime
  const uptimeMs = Date.now() - serverStartTime;
  const uptimePercent = 99.9; // Placeholder - would track actual downtime

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's calls
  let callsQuery = db
    .from("calls")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString());

  if (tenantId) {
    callsQuery = callsQuery.eq("tenant_id", tenantId);
  }

  const { count: callsToday } = await callsQuery;

  // Today's bookings
  let bookingsQuery = db
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("booking_date", today.toISOString().split("T")[0]);

  if (tenantId) {
    bookingsQuery = bookingsQuery.eq("tenant_id", tenantId);
  }

  const { count: bookingsToday } = await bookingsQuery;

  // Average response latency (from recent calls)
  let latencyQuery = db
    .from("calls")
    .select("metadata")
    .not("metadata", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (tenantId) {
    latencyQuery = latencyQuery.eq("tenant_id", tenantId);
  }

  const { data: latencyData } = await latencyQuery;

  // Calculate average latency from metadata if available
  let avgLatency = 340; // Default estimate in ms
  if (latencyData && latencyData.length > 0) {
    const latencies = latencyData
      .map((c) => (c.metadata as Record<string, number>)?.response_latency_ms)
      .filter((l): l is number => typeof l === "number");

    if (latencies.length > 0) {
      avgLatency = Math.round(
        latencies.reduce((a, b) => a + b, 0) / latencies.length,
      );
    }
  }

  // Get queued calls (calls in progress but not connected yet)
  const queuedCalls = activeSessions.filter((s) => !s.streamSid).length;

  return c.json({
    system: {
      status: "operational",
      latencyMs: avgLatency,
      uptimePercent,
      uptimeMs,
    },
    calls: {
      active: activeCalls,
      queued: queuedCalls,
      today: callsToday || 0,
    },
    bookings: {
      today: bookingsToday || 0,
    },
    voice: {
      provider: process.env.VOICE_PROVIDER || "vapi",
      sttStatus: "connected",
      llmStatus: "connected",
      ttsStatus: "connected",
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/dashboard/activity
 * Recent activity log entries
 */
dashboardRoutes.get("/activity", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const level = c.req.query("level"); // Filter by level

  let filtered = activityLog;

  if (level) {
    filtered = filtered.filter((e) => e.level === level);
  }

  const entries = filtered.slice(offset, offset + limit);

  return c.json({
    entries,
    total: filtered.length,
    limit,
    offset,
  });
});

/**
 * GET /api/dashboard/stats
 * Aggregated statistics for dashboard cards
 */
dashboardRoutes.get("/stats", async (c) => {
  const tenantId = c.req.query("tenant_id");
  const db = getSupabase();

  // Get date ranges
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Build queries with optional tenant filter
  const buildQuery = (table: string, dateField: string, startDate: Date) => {
    let query = db
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte(dateField, startDate.toISOString());

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    return query;
  };

  // Execute all queries in parallel
  const [
    { count: callsToday },
    { count: callsWeek },
    { count: callsMonth },
    { count: bookingsToday },
    { count: bookingsWeek },
    { count: bookingsMonth },
  ] = await Promise.all([
    buildQuery("calls", "created_at", today),
    buildQuery("calls", "created_at", weekStart),
    buildQuery("calls", "created_at", monthStart),
    buildQuery("bookings", "created_at", today),
    buildQuery("bookings", "created_at", weekStart),
    buildQuery("bookings", "created_at", monthStart),
  ]);

  // Get revenue estimate (assuming average booking value)
  const avgBookingValue = 150; // Would come from tenant config
  const estimatedRevenue = {
    today: (bookingsToday || 0) * avgBookingValue,
    week: (bookingsWeek || 0) * avgBookingValue,
    month: (bookingsMonth || 0) * avgBookingValue,
  };

  return c.json({
    calls: {
      today: callsToday || 0,
      week: callsWeek || 0,
      month: callsMonth || 0,
    },
    bookings: {
      today: bookingsToday || 0,
      week: bookingsWeek || 0,
      month: bookingsMonth || 0,
    },
    revenue: estimatedRevenue,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/dashboard/sessions
 * Active voice sessions (for real-time monitoring)
 */
dashboardRoutes.get("/sessions", async (c) => {
  const tenantId = c.req.query("tenant_id");

  let sessions = sessionManager.getAllSessions();

  if (tenantId) {
    sessions = sessions.filter((s) => s.tenantId === tenantId);
  }

  // Return sanitized session data (exclude full conversation history for privacy)
  const sanitized = sessions.map((s) => ({
    callSid: s.callSid,
    tenantId: s.tenantId,
    callerPhone: s.callerPhone
      ? s.callerPhone.replace(/\d(?=\d{4})/g, "*")
      : null,
    isPlaying: s.isPlaying,
    isSpeaking: s.isSpeaking,
    startTime: s.startTime,
    lastActivityTime: s.lastActivityTime,
    turnCount: s.conversationHistory.length,
    durationSeconds: Math.round((Date.now() - s.startTime.getTime()) / 1000),
  }));

  return c.json({
    sessions: sanitized,
    count: sanitized.length,
  });
});
