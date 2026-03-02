// Chat Sessions API Routes (Dashboard-facing, authenticated)
// Browse and review chat widget conversations

import { Hono } from "hono";
import { tenantQueryOne, tenantQueryAll } from "../services/database/client.js";
import { getAuthTenantId } from "../middleware/index.js";

export const chatSessionsRoutes = new Hono();

interface ChatSessionRow {
  id: string;
  session_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  messages: unknown;
  message_count: number;
  status: string;
  source_url: string | null;
  created_at: string;
  last_message_at: string;
  closed_at: string | null;
}

// ============================================================================
// GET /api/chat-sessions - List chat sessions
// ============================================================================

chatSessionsRoutes.get("/", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);
    const status = c.req.query("status");
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const search = c.req.query("search");
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    const conditions: string[] = ["tenant_id = $1"];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (search) {
      conditions.push(
        `(visitor_name ILIKE $${paramIndex} OR visitor_email ILIKE $${paramIndex} OR visitor_phone ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Total count
    const countResult = await tenantQueryOne<{ count: string }>(
      tenantId,
      `SELECT COUNT(*) as count FROM chat_sessions ${whereClause}`,
      params,
    );
    const total = parseInt(countResult?.count || "0", 10);

    // Paginated data (exclude full messages array for list view)
    const sessions = await tenantQueryAll<ChatSessionRow>(
      tenantId,
      `SELECT
        id, session_id, visitor_name, visitor_email, visitor_phone,
        message_count, status, source_url,
        created_at, last_message_at, closed_at
       FROM chat_sessions ${whereClause}
       ORDER BY last_message_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return c.json({
      sessions: sessions || [],
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[CHAT-SESSIONS] List error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ============================================================================
// GET /api/chat-sessions/stats - Aggregate stats
// ============================================================================

chatSessionsRoutes.get("/stats", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);

    const stats = await tenantQueryOne<{
      total_sessions: string;
      active_sessions: string;
      avg_messages: string;
      leads_captured: string;
      sessions_today: string;
      sessions_this_week: string;
    }>(
      tenantId,
      `SELECT
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE status = 'active' AND last_message_at > NOW() - INTERVAL '30 minutes') as active_sessions,
        COALESCE(ROUND(AVG(message_count)), 0) as avg_messages,
        COUNT(*) FILTER (WHERE visitor_email IS NOT NULL OR visitor_phone IS NOT NULL) as leads_captured,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as sessions_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as sessions_this_week
       FROM chat_sessions
       WHERE tenant_id = $1`,
      [tenantId],
    );

    return c.json({
      totalSessions: parseInt(stats?.total_sessions || "0", 10),
      activeSessions: parseInt(stats?.active_sessions || "0", 10),
      avgMessages: parseInt(stats?.avg_messages || "0", 10),
      leadsCaptured: parseInt(stats?.leads_captured || "0", 10),
      sessionsToday: parseInt(stats?.sessions_today || "0", 10),
      sessionsThisWeek: parseInt(stats?.sessions_this_week || "0", 10),
    });
  } catch (error) {
    console.error("[CHAT-SESSIONS] Stats error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ============================================================================
// GET /api/chat-sessions/:id - Get single session with messages
// ============================================================================

chatSessionsRoutes.get("/:id", async (c) => {
  try {
    const tenantId = getAuthTenantId(c);
    const sessionId = c.req.param("id");

    const session = await tenantQueryOne<ChatSessionRow>(
      tenantId,
      `SELECT * FROM chat_sessions WHERE id = $1 AND tenant_id = $2`,
      [sessionId, tenantId],
    );

    if (!session) {
      return c.json({ error: "Chat session not found" }, 404);
    }

    return c.json(session);
  } catch (error) {
    console.error("[CHAT-SESSIONS] Get error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default chatSessionsRoutes;
