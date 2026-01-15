// Booking Service - CRM booking management
import { getSupabase } from "../database/client.js";
import {
  BookingFilters,
  PaginationParams,
  PaginatedResult,
  CalendarEvent,
  DaySummary,
} from "../../types/crm.js";
import { Booking } from "../../types/database.js";

export async function createBooking(
  tenantId: string,
  data: {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    booking_type: string;
    booking_date: string;
    booking_time: string;
    duration_minutes?: number;
    notes?: string;
    amount_cents?: number;
    contact_id?: string;
    resource_id?: string;
    slot_id?: string;
    call_id?: string;
    source?: "call" | "web" | "manual" | "api";
  },
): Promise<Booking> {
  const db = getSupabase();
  const confirmationCode = generateConfirmationCode();

  const { data: booking, error } = await db
    .from("bookings")
    .insert({
      tenant_id: tenantId,
      ...data,
      confirmation_code: confirmationCode,
      status: "pending",
      reminder_sent: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create booking: ${error.message}`);

  // Update slot booked_count if slot_id provided
  if (data.slot_id) {
    await db.rpc("increment_slot_booked", { p_slot_id: data.slot_id });
  }

  return booking;
}

export async function getBooking(
  tenantId: string,
  id: string,
): Promise<Booking | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from("bookings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`Failed to get booking: ${error.message}`);
  return data;
}

export async function updateBooking(
  tenantId: string,
  id: string,
  updates: Partial<Booking>,
): Promise<Booking> {
  const db = getSupabase();
  delete (updates as any).id;
  delete (updates as any).tenant_id;
  delete (updates as any).confirmation_code;

  const { data, error } = await db
    .from("bookings")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update booking: ${error.message}`);
  return data;
}

export async function cancelBooking(
  tenantId: string,
  id: string,
  reason?: string,
): Promise<Booking> {
  const booking = await getBooking(tenantId, id);
  if (!booking) throw new Error("Booking not found");

  // Release slot if exists
  if (booking.slot_id) {
    const db = getSupabase();
    await db.rpc("decrement_slot_booked", { p_slot_id: booking.slot_id });
  }

  return updateBooking(tenantId, id, {
    status: "cancelled",
    notes: reason
      ? `${booking.notes || ""}\nCancelled: ${reason}`.trim()
      : booking.notes,
  });
}

export async function rescheduleBooking(
  tenantId: string,
  id: string,
  newDate: string,
  newTime: string,
  newSlotId?: string,
): Promise<Booking> {
  const booking = await getBooking(tenantId, id);
  if (!booking) throw new Error("Booking not found");

  const db = getSupabase();

  // Release old slot
  if (booking.slot_id) {
    await db.rpc("decrement_slot_booked", { p_slot_id: booking.slot_id });
  }

  // Reserve new slot
  if (newSlotId) {
    await db.rpc("increment_slot_booked", { p_slot_id: newSlotId });
  }

  return updateBooking(tenantId, id, {
    booking_date: newDate,
    booking_time: newTime,
    slot_id: newSlotId,
    rescheduled_from: id,
    rescheduled_count: (booking.rescheduled_count || 0) + 1,
  });
}

export async function searchBookings(
  tenantId: string,
  filters: BookingFilters = {},
  pagination: PaginationParams = {},
): Promise<PaginatedResult<Booking>> {
  const db = getSupabase();
  const limit = pagination.limit || 20;
  const offset = pagination.offset || 0;

  let query = db
    .from("bookings")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    query = query.in("status", statuses);
  }
  if (filters.contact_id) query = query.eq("contact_id", filters.contact_id);
  if (filters.resource_id) query = query.eq("resource_id", filters.resource_id);
  if (filters.start_date) query = query.gte("booking_date", filters.start_date);
  if (filters.end_date) query = query.lte("booking_date", filters.end_date);
  if (filters.booking_type)
    query = query.eq("booking_type", filters.booking_type);

  const sortBy = pagination.sort_by || "booking_date";
  const sortOrder = pagination.sort_order || "asc";
  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to search bookings: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    limit,
    offset,
    has_more: (count || 0) > offset + limit,
  };
}

export async function getCalendarData(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<CalendarEvent[]> {
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .select(
      "id, customer_name, customer_phone, booking_date, booking_time, duration_minutes, status, booking_type, confirmation_code",
    )
    .eq("tenant_id", tenantId)
    .gte("booking_date", startDate)
    .lte("booking_date", endDate)
    .in("status", ["pending", "confirmed"])
    .order("booking_date")
    .order("booking_time");

  if (error) throw new Error(`Failed to get calendar data: ${error.message}`);

  return (data || []).map((b) => ({
    id: b.id,
    title: b.customer_name,
    start: `${b.booking_date}T${b.booking_time}`,
    end: `${b.booking_date}T${addMinutes(b.booking_time, b.duration_minutes || 60)}`,
    status: b.status,
    contact_name: b.customer_name,
    contact_phone: b.customer_phone,
    booking_type: b.booking_type,
    confirmation_code: b.confirmation_code,
  }));
}

export async function getDaySummary(
  tenantId: string,
  date: string,
): Promise<DaySummary> {
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .select("status, amount_cents")
    .eq("tenant_id", tenantId)
    .eq("booking_date", date);

  if (error) throw new Error(`Failed to get day summary: ${error.message}`);

  const bookings = data || [];
  return {
    date,
    total_bookings: bookings.length,
    confirmed_bookings: bookings.filter((b) => b.status === "confirmed").length,
    pending_bookings: bookings.filter((b) => b.status === "pending").length,
    cancelled_bookings: bookings.filter((b) => b.status === "cancelled").length,
    available_slots: 0, // To be filled from availability
    total_slots: 0,
    revenue_cents: bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + (b.amount_cents || 0), 0),
  };
}

export async function confirmBooking(
  tenantId: string,
  id: string,
): Promise<Booking> {
  return updateBooking(tenantId, id, { status: "confirmed" });
}

export async function markCompleted(
  tenantId: string,
  id: string,
): Promise<Booking> {
  return updateBooking(tenantId, id, { status: "completed" });
}

export async function markNoShow(
  tenantId: string,
  id: string,
): Promise<Booking> {
  return updateBooking(tenantId, id, { status: "no_show" });
}

export async function getUpcomingBookings(
  tenantId: string,
  hoursAhead: number = 24,
): Promise<Booking[]> {
  const db = getSupabase();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const { data, error } = await db
    .from("bookings")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "confirmed"])
    .gte("booking_date", now.toISOString().split("T")[0])
    .lte("booking_date", future.toISOString().split("T")[0])
    .order("booking_date")
    .order("booking_time");

  if (error)
    throw new Error(`Failed to get upcoming bookings: ${error.message}`);
  return data || [];
}

function generateConfirmationCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
