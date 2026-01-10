import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";

export const bookingsRoutes = new Hono();

/**
 * GET /api/bookings
 * List bookings with optional filters
 */
bookingsRoutes.get("/", async (c) => {
  const tenantId = c.req.query("tenant_id");
  const status = c.req.query("status");
  const date = c.req.query("date");
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const db = getSupabase();

  let query = db
    .from("bookings")
    .select("*", { count: "exact" })
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true })
    .range(offset, offset + limit - 1);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (date) {
    query = query.eq("booking_date", date);
  }

  const { data, count, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    bookings: data,
    total: count,
    limit,
    offset,
  });
});

/**
 * GET /api/bookings/:id
 * Get a single booking
 */
bookingsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: "Booking not found" }, 404);
  }

  return c.json(data);
});

/**
 * PATCH /api/bookings/:id
 * Update booking status
 */
bookingsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const db = getSupabase();

  const allowedFields = ["status", "notes", "booking_date", "booking_time"];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from("bookings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data);
});

/**
 * DELETE /api/bookings/:id
 * Cancel a booking
 */
bookingsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getSupabase();

  const { error } = await db
    .from("bookings")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});
