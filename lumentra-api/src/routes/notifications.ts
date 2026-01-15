// Notifications API Routes
import { Hono } from "hono";
import { z } from "zod";
import { getSupabase } from "../services/database/client.js";
import {
  queueNotification,
  processQueue,
  retryFailed,
  getDefaultTemplate,
  renderTemplate,
} from "../services/notifications/notification-service.js";

export const notificationsRoutes = new Hono();

function getTenantId(c: any): string {
  const tenantId = c.req.header("X-Tenant-ID");
  if (!tenantId) throw new Error("X-Tenant-ID header is required");
  return tenantId;
}

// GET /api/notifications
notificationsRoutes.get("/", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const query = c.req.query();
    const db = getSupabase();

    let dbQuery = db
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId);

    if (query.status) dbQuery = dbQuery.eq("status", query.status);
    if (query.channel) dbQuery = dbQuery.eq("channel", query.channel);
    if (query.notification_type)
      dbQuery = dbQuery.eq("notification_type", query.notification_type);
    if (query.contact_id) dbQuery = dbQuery.eq("contact_id", query.contact_id);
    if (query.booking_id) dbQuery = dbQuery.eq("booking_id", query.booking_id);

    const limit = parseInt(query.limit || "20");
    const offset = parseInt(query.offset || "0");

    const { data, error, count } = await dbQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({
      data: data || [],
      total: count || 0,
      limit,
      offset,
      has_more: (count || 0) > offset + limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// GET /api/notifications/:id
notificationsRoutes.get("/:id", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const id = c.req.param("id");
    const db = getSupabase();

    const { data, error } = await db
      .from("notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116") return c.json({ error: "Not found" }, 404);
    if (error) return c.json({ error: error.message }, 500);

    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// POST /api/notifications/send
notificationsRoutes.post("/send", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const body = await c.req.json();

    const schema = z.object({
      contact_id: z.string().uuid().optional(),
      channel: z.enum(["email", "sms"]),
      notification_type: z.enum([
        "booking_confirmation",
        "booking_reminder_24h",
        "booking_reminder_1h",
        "booking_modified",
        "booking_cancelled",
        "booking_rescheduled",
        "missed_call_followup",
        "thank_you",
        "review_request",
        "marketing",
        "custom",
      ]),
      recipient: z.string(),
      recipient_name: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      template_id: z.string().uuid().optional(),
      template_variables: z.record(z.unknown()).optional(),
      scheduled_at: z.string().optional(),
      booking_id: z.string().uuid().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.issues },
        400,
      );
    }

    const notification = await queueNotification(tenantId, parsed.data as any);
    return c.json(notification, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// POST /api/notifications/preview
notificationsRoutes.post("/preview", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const body = await c.req.json();

    const { template_id, notification_type, channel, variables } = body;

    let template = null;
    if (template_id) {
      const db = getSupabase();
      const { data } = await db
        .from("notification_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      template = data;
    } else if (notification_type && channel) {
      template = await getDefaultTemplate(tenantId, notification_type, channel);
    }

    if (!template) {
      return c.json({ error: "Template not found" }, 404);
    }

    const rendered = renderTemplate(template, variables || {});
    return c.json(rendered);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// GET /api/notifications/templates
notificationsRoutes.get("/templates", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const db = getSupabase();

    const { data, error } = await db
      .from("notification_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("notification_type")
      .order("channel");

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ templates: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// POST /api/notifications/templates
notificationsRoutes.post("/templates", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const db = getSupabase();

    const schema = z.object({
      name: z.string(),
      notification_type: z.string(),
      channel: z.enum(["email", "sms"]),
      subject_template: z.string().optional(),
      body_template: z.string(),
      body_html_template: z.string().optional(),
      is_default: z.boolean().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed" }, 400);
    }

    const { data, error } = await db
      .from("notification_templates")
      .insert({ tenant_id: tenantId, ...parsed.data, is_active: true })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// PUT /api/notifications/templates/:id
notificationsRoutes.put("/templates/:id", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const db = getSupabase();

    delete body.id;
    delete body.tenant_id;

    const { data, error } = await db
      .from("notification_templates")
      .update(body)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// GET /api/notifications/preferences
notificationsRoutes.get("/preferences", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const db = getSupabase();

    const { data, error } = await db
      .from("notification_preferences")
      .select("*")
      .eq("tenant_id", tenantId);

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ preferences: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// PUT /api/notifications/preferences
notificationsRoutes.put("/preferences", async (c) => {
  try {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const db = getSupabase();

    const { data, error } = await db
      .from("notification_preferences")
      .upsert(
        { tenant_id: tenantId, ...body },
        { onConflict: "tenant_id,notification_type" },
      )
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// POST /api/notifications/process-queue (internal/cron)
notificationsRoutes.post("/process-queue", async (c) => {
  try {
    const processed = await processQueue();
    const retried = await retryFailed();
    return c.json({ processed, retried });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});
