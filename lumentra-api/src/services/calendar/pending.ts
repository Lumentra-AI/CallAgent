/**
 * Pending Bookings Service
 * Handles booking requests that couldn't be directly confirmed
 * Used for assisted mode when no calendar integration is available
 */

import { getSupabase } from "../database/client.js";
import type { BookingRequest, BookingConfirmation } from "./types.js";
import type { PendingBooking } from "../../types/database.js";

export interface PendingBookingWithCall extends PendingBooking {
  calls?: {
    id: string;
    started_at: string;
    transcript?: string;
  };
}

/**
 * Create a pending booking
 * Called when direct calendar booking fails or is unavailable
 */
export async function createPendingBooking(
  tenantId: string,
  booking: BookingRequest,
  callId?: string,
): Promise<BookingConfirmation> {
  const db = getSupabase();

  // Parse date and time from ISO string if provided
  const requestedDate = booking.startTime
    ? booking.startTime.split("T")[0]
    : null;
  const requestedTime = booking.startTime
    ? booking.startTime.split("T")[1]?.substring(0, 5)
    : null;

  const { data, error } = await db
    .from("pending_bookings")
    .insert({
      tenant_id: tenantId,
      call_id: callId,
      customer_name: booking.customerName,
      customer_phone: booking.customerPhone,
      customer_email: booking.customerEmail,
      requested_date: requestedDate,
      requested_time: requestedTime,
      service: booking.service,
      notes: booking.notes,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[PENDING_BOOKING] Creation failed:", error);
    throw new Error(`Failed to create pending booking: ${error.message}`);
  }

  console.log(`[PENDING_BOOKING] Created pending booking ${data.id}`);

  return {
    id: data.id,
    status: "pending",
    startTime: booking.startTime,
    endTime: booking.endTime,
  };
}

/**
 * Confirm a pending booking
 * Called by staff when they manually confirm the booking
 */
export async function confirmPendingBooking(
  bookingId: string,
  userId: string,
): Promise<void> {
  const db = getSupabase();

  const { error } = await db
    .from("pending_bookings")
    .update({
      status: "confirmed",
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (error) {
    console.error("[PENDING_BOOKING] Confirmation failed:", error);
    throw new Error(`Failed to confirm pending booking: ${error.message}`);
  }

  console.log(`[PENDING_BOOKING] Confirmed booking ${bookingId} by ${userId}`);
}

/**
 * Reject a pending booking
 * Called by staff when they cannot fulfill the booking request
 */
export async function rejectPendingBooking(
  bookingId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const db = getSupabase();

  const updateData: Record<string, unknown> = {
    status: "rejected",
    confirmed_by: userId,
    confirmed_at: new Date().toISOString(),
  };

  // Append rejection reason to notes if provided
  if (reason) {
    const { data: existing } = await db
      .from("pending_bookings")
      .select("notes")
      .eq("id", bookingId)
      .single();

    const existingNotes = existing?.notes || "";
    updateData.notes = existingNotes
      ? `${existingNotes}\n\nRejected: ${reason}`
      : `Rejected: ${reason}`;
  }

  const { error } = await db
    .from("pending_bookings")
    .update(updateData)
    .eq("id", bookingId);

  if (error) {
    console.error("[PENDING_BOOKING] Rejection failed:", error);
    throw new Error(`Failed to reject pending booking: ${error.message}`);
  }

  console.log(`[PENDING_BOOKING] Rejected booking ${bookingId} by ${userId}`);
}

/**
 * Get pending bookings for a tenant
 */
export async function getPendingBookings(
  tenantId: string,
  status?: string,
): Promise<PendingBookingWithCall[]> {
  const db = getSupabase();

  let query = db
    .from("pending_bookings")
    .select("*, calls(id, started_at, transcript)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[PENDING_BOOKING] Failed to get bookings:", error);
    throw new Error(`Failed to get pending bookings: ${error.message}`);
  }

  return (data || []) as PendingBookingWithCall[];
}

/**
 * Get a single pending booking by ID
 */
export async function getPendingBookingById(
  bookingId: string,
  tenantId: string,
): Promise<PendingBookingWithCall | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("pending_bookings")
    .select("*, calls(id, started_at, transcript)")
    .eq("id", bookingId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("[PENDING_BOOKING] Failed to get booking:", error);
    throw new Error(`Failed to get pending booking: ${error.message}`);
  }

  return data as PendingBookingWithCall;
}

/**
 * Convert a pending booking to a confirmed booking in the bookings table
 */
export async function convertPendingToConfirmed(
  bookingId: string,
  tenantId: string,
  userId: string,
  confirmedDate?: string,
  confirmedTime?: string,
): Promise<string> {
  const db = getSupabase();

  // Get the pending booking
  const pending = await getPendingBookingById(bookingId, tenantId);
  if (!pending) {
    throw new Error("Pending booking not found");
  }

  // Use provided date/time or fall back to requested
  const bookingDate = confirmedDate || pending.requested_date;
  const bookingTime = confirmedTime || pending.requested_time;

  if (!bookingDate || !bookingTime) {
    throw new Error("Booking date and time are required");
  }

  // Generate confirmation code
  const confirmationCode = generateConfirmationCode();

  // Create the confirmed booking
  const { data: booking, error: bookingError } = await db
    .from("bookings")
    .insert({
      tenant_id: tenantId,
      call_id: pending.call_id,
      customer_name: pending.customer_name,
      customer_phone: pending.customer_phone,
      customer_email: pending.customer_email,
      booking_date: bookingDate,
      booking_time: bookingTime,
      booking_type: pending.service || "appointment",
      notes: pending.notes,
      status: "confirmed",
      confirmation_code: confirmationCode,
      source: "call",
    })
    .select()
    .single();

  if (bookingError) {
    console.error(
      "[PENDING_BOOKING] Failed to create confirmed booking:",
      bookingError,
    );
    throw new Error(`Failed to create booking: ${bookingError.message}`);
  }

  // Update pending booking status
  await confirmPendingBooking(bookingId, userId);

  console.log(
    `[PENDING_BOOKING] Converted pending ${bookingId} to confirmed ${booking.id}`,
  );

  return booking.id;
}

function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
