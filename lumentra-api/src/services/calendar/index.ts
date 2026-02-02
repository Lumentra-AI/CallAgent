/**
 * Calendar Service Factory
 * Unified interface for calendar operations across multiple providers
 */

import type {
  CalendarService,
  TimeSlot,
  BookingRequest,
  BookingConfirmation,
  DateRange,
} from "./types.js";
import { GoogleCalendarService } from "./google.js";
import { OutlookCalendarService } from "./outlook.js";
import { CalendlyService } from "./calendly.js";
import { BuiltinCalendarService } from "./builtin.js";
import { createPendingBooking } from "./pending.js";
import { getSupabase } from "../database/client.js";
import type { TenantIntegration } from "../../types/database.js";

/**
 * Get the appropriate calendar service for a tenant
 * Returns external calendar service if connected, otherwise falls back to built-in
 */
export async function getCalendarService(
  tenantId: string,
): Promise<CalendarService> {
  const db = getSupabase();

  // Check if tenant has external integration
  const { data: integration } = await db
    .from("tenant_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("provider", ["google_calendar", "outlook", "calendly"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integration) {
    const typedIntegration = integration as TenantIntegration;

    switch (typedIntegration.provider) {
      case "google_calendar":
        console.log(`[CALENDAR] Using Google Calendar for tenant ${tenantId}`);
        return new GoogleCalendarService(typedIntegration);

      case "outlook":
        console.log(`[CALENDAR] Using Outlook for tenant ${tenantId}`);
        return new OutlookCalendarService(typedIntegration);

      case "calendly":
        console.log(`[CALENDAR] Using Calendly for tenant ${tenantId}`);
        return new CalendlyService(typedIntegration);
    }
  }

  // Default to builtin calendar
  console.log(`[CALENDAR] Using built-in calendar for tenant ${tenantId}`);
  return new BuiltinCalendarService(tenantId);
}

/**
 * Create a booking with automatic fallback to pending bookings
 * Use this during calls to ensure booking requests are always captured
 */
export async function createBookingWithFallback(
  tenantId: string,
  booking: BookingRequest,
  callId?: string,
): Promise<BookingConfirmation> {
  try {
    const service = await getCalendarService(tenantId);
    return await service.createBooking(tenantId, booking);
  } catch (error) {
    console.error(
      "[CALENDAR] Booking failed, creating pending booking:",
      error,
    );
    return await createPendingBooking(tenantId, booking, callId);
  }
}

/**
 * Check availability with fallback to empty slots on error
 */
export async function checkAvailabilityWithFallback(
  tenantId: string,
  dateRange: DateRange,
): Promise<TimeSlot[]> {
  try {
    const service = await getCalendarService(tenantId);
    return await service.checkAvailability(tenantId, dateRange);
  } catch (error) {
    console.error("[CALENDAR] Availability check failed:", error);
    // Return empty array on error - caller should handle this case
    return [];
  }
}

/**
 * Get bookings with fallback to empty array on error
 */
export async function getBookingsWithFallback(
  tenantId: string,
  dateRange: DateRange,
): Promise<BookingConfirmation[]> {
  try {
    const service = await getCalendarService(tenantId);
    return await service.getBookings(tenantId, dateRange);
  } catch (error) {
    console.error("[CALENDAR] Get bookings failed:", error);
    return [];
  }
}

// Export all components
export { GoogleCalendarService } from "./google.js";
export { OutlookCalendarService } from "./outlook.js";
export { CalendlyService } from "./calendly.js";
export { BuiltinCalendarService } from "./builtin.js";
export {
  createPendingBooking,
  confirmPendingBooking,
  rejectPendingBooking,
  getPendingBookings,
} from "./pending.js";
export * from "./types.js";
