// SSE endpoint for real-time escalation queue updates
// Registered separately from main escalation routes because EventSource
// cannot send Authorization headers -- auth is via query param token instead.

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createClient } from "@supabase/supabase-js";
import { queryOne } from "../services/database/client.js";
import { escalationEvents } from "../services/escalation/events.js";

export const escalationEventsRoutes = new Hono();

function getSupabaseAuth() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey)
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

escalationEventsRoutes.get("/", async (c) => {
  const token = c.req.query("token");
  const requestedTenantId = c.req.query("tenantId");

  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }

  // Verify JWT
  const supabase = getSupabaseAuth();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Verify user has access to the requested tenant. Caller must pass
  // ?tenantId=... so we know which workspace they want to subscribe to.
  // Falls back to the user's first membership only if no tenantId was given,
  // for backwards compatibility with single-tenant clients.
  let tenantId: string;
  if (requestedTenantId) {
    const membership = await queryOne<{ tenant_id: string }>(
      "SELECT tenant_id FROM tenant_members WHERE user_id = $1 AND tenant_id = $2 AND is_active = true AND accepted_at IS NOT NULL LIMIT 1",
      [user.id, requestedTenantId],
    );
    if (!membership) {
      return c.json({ error: "No access to this tenant" }, 403);
    }
    tenantId = requestedTenantId;
  } else {
    const membership = await queryOne<{ tenant_id: string }>(
      "SELECT tenant_id FROM tenant_members WHERE user_id = $1 AND is_active = true AND accepted_at IS NOT NULL LIMIT 1",
      [user.id],
    );
    if (!membership) {
      return c.json({ error: "No active tenant membership" }, 403);
    }
    tenantId = membership.tenant_id;
  }

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ tenantId, timestamp: new Date().toISOString() }),
    });

    let eventId = 0;

    const unsubscribe = escalationEvents.subscribe(tenantId, (event) => {
      eventId++;
      void stream.writeSSE({
        id: String(eventId),
        event: event.type,
        data: JSON.stringify(event),
      });
    });

    const heartbeat = setInterval(() => {
      void stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      });
    }, 30_000);

    stream.onAbort(() => {
      unsubscribe();
      clearInterval(heartbeat);
    });

    // Keep the stream open until client disconnects
    await new Promise<void>((resolve) => {
      stream.onAbort(() => resolve());
    });
  });
});
