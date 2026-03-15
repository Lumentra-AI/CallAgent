// Chat Conversation Store
// Supabase-backed persistent store for chat widget sessions

import { queryOne, queryCount } from "../database/client.js";
import type { ConversationMessage } from "../../types/voice.js";

export interface VisitorInfo {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ConversationSession {
  sessionId: string;
  tenantId: string;
  messages: ConversationMessage[];
  visitorInfo?: VisitorInfo;
  createdAt: Date;
  lastMessageAt: Date;
}

interface ChatSessionRow {
  id: string;
  tenant_id: string;
  session_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  messages: ConversationMessage[];
  message_count: number;
  status: string;
  source_url: string | null;
  created_at: string;
  last_message_at: string;
  closed_at: string | null;
}

/**
 * Get or create a conversation session
 */
export async function getOrCreateSession(
  sessionId: string,
  tenantId: string,
  sourceUrl?: string,
): Promise<ConversationSession> {
  const row = await queryOne<ChatSessionRow>(
    `INSERT INTO chat_sessions (tenant_id, session_id, source_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id) DO UPDATE SET last_message_at = NOW()
     RETURNING *`,
    [tenantId, sessionId, sourceUrl || null],
  );

  if (!row) {
    throw new Error("Failed to create chat session");
  }

  return rowToSession(row);
}

/**
 * Get conversation history for a session
 */
export async function getConversationHistory(
  sessionId: string,
  tenantId?: string,
): Promise<ConversationMessage[]> {
  const sql = tenantId
    ? `SELECT messages FROM chat_sessions WHERE session_id = $1 AND tenant_id = $2`
    : `SELECT messages FROM chat_sessions WHERE session_id = $1`;
  const params = tenantId ? [sessionId, tenantId] : [sessionId];
  const row = await queryOne<{ messages: ConversationMessage[] }>(sql, params);

  return row?.messages || [];
}

/**
 * Save message exchange to history
 */
export async function saveToHistory(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  const now = new Date().toISOString();
  const newMessages = [
    { role: "user" as const, content: userMessage, timestamp: now },
    { role: "assistant" as const, content: assistantMessage, timestamp: now },
  ];

  // Append messages, increment count, trim to last 40
  await queryOne(
    `UPDATE chat_sessions
     SET messages = (
       CASE
         WHEN jsonb_array_length(messages) >= 38
         THEN (SELECT jsonb_agg(elem) FROM (
           SELECT elem FROM jsonb_array_elements(messages || $1::jsonb) AS elem
           ORDER BY elem->>'timestamp' ASC
           OFFSET greatest(0, jsonb_array_length(messages || $1::jsonb) - 40)
         ) sub)
         ELSE messages || $1::jsonb
       END
     ),
     message_count = message_count + 2,
     last_message_at = NOW()
     WHERE session_id = $2`,
    [JSON.stringify(newMessages), sessionId],
  );
}

/**
 * Update visitor info for a session
 */
export async function updateVisitorInfo(
  sessionId: string,
  info: Partial<VisitorInfo>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (info.name !== undefined) {
    sets.push(`visitor_name = $${idx++}`);
    params.push(info.name);
  }
  if (info.email !== undefined) {
    sets.push(`visitor_email = $${idx++}`);
    params.push(info.email);
  }
  if (info.phone !== undefined) {
    sets.push(`visitor_phone = $${idx++}`);
    params.push(info.phone);
  }

  if (sets.length === 0) return;

  params.push(sessionId);
  await queryOne(
    `UPDATE chat_sessions SET ${sets.join(", ")} WHERE session_id = $${idx}`,
    params,
  );
}

/**
 * Get visitor info for a session
 */
export async function getVisitorInfo(
  sessionId: string,
): Promise<VisitorInfo | undefined> {
  const row = await queryOne<{
    visitor_name: string | null;
    visitor_email: string | null;
    visitor_phone: string | null;
  }>(
    `SELECT visitor_name, visitor_email, visitor_phone
     FROM chat_sessions WHERE session_id = $1`,
    [sessionId],
  );

  if (!row) return undefined;
  if (!row.visitor_name && !row.visitor_email && !row.visitor_phone)
    return undefined;

  return {
    name: row.visitor_name || undefined,
    email: row.visitor_email || undefined,
    phone: row.visitor_phone || undefined,
  };
}

/**
 * Close a session (mark as closed)
 */
export async function closeSession(sessionId: string): Promise<void> {
  await queryOne(
    `UPDATE chat_sessions SET status = 'closed', closed_at = NOW()
     WHERE session_id = $1 AND status = 'active'`,
    [sessionId],
  );
}

/**
 * Get active session count (for monitoring)
 */
export async function getSessionCount(): Promise<number> {
  return queryCount(
    `SELECT 1 FROM chat_sessions WHERE status = 'active'
     AND last_message_at > NOW() - INTERVAL '30 minutes'`,
  );
}

/**
 * Close sessions idle for more than 2 hours
 */
export async function closeIdleSessions(): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `WITH closed AS (
       UPDATE chat_sessions
       SET status = 'closed', closed_at = NOW()
       WHERE status = 'active'
         AND last_message_at < NOW() - INTERVAL '2 hours'
       RETURNING 1
     )
     SELECT COUNT(*)::text as count FROM closed`,
    [],
  );
  const count = parseInt(result?.count || "0", 10);
  if (count > 0) {
    console.log(`[CHAT] Closed ${count} idle sessions`);
  }
  return count;
}

// Start idle session cleanup interval (10 minutes) without blocking test/process exit
const idleSessionCleanupInterval = setInterval(
  () => {
    closeIdleSessions().catch((err) =>
      console.error("[CHAT] Idle cleanup error:", err),
    );
  },
  10 * 60 * 1000,
);

idleSessionCleanupInterval.unref?.();

function rowToSession(row: ChatSessionRow): ConversationSession {
  const visitorInfo: VisitorInfo | undefined =
    row.visitor_name || row.visitor_email || row.visitor_phone
      ? {
          name: row.visitor_name || undefined,
          email: row.visitor_email || undefined,
          phone: row.visitor_phone || undefined,
        }
      : undefined;

  return {
    sessionId: row.session_id,
    tenantId: row.tenant_id,
    messages: row.messages || [],
    visitorInfo,
    createdAt: new Date(row.created_at),
    lastMessageAt: new Date(row.last_message_at),
  };
}
