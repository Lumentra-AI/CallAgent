/**
 * Built-in Calendar Service
 * Implements CalendarService interface using Lumentra's own bookings table
 */

import type {
  CalendarService,
  TimeSlot,
  BookingRequest,
  BookingConfirmation,
  DateRange,
} from "./types.js";
import { getSupabase } from "../database/client.js";

interface OperatingHours {
  [day: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

interface ExistingBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number | null;
  status: string;
}

interface TenantData {
  operating_hours: OperatingHours | null;
}

export class BuiltinCalendarService implements CalendarService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async checkAvailability(
    _tenantId: string,
    dateRange: DateRange,
  ): Promise<TimeSlot[]> {
    const db = getSupabase();

    // Get existing bookings
    const startDate = dateRange.start.split("T")[0];
    const endDate = dateRange.end.split("T")[0];

    const { data: bookings } = await db
      .from("bookings")
      .select("id, booking_date, booking_time, duration_minutes")
      .eq("tenant_id", this.tenantId)
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .neq("status", "cancelled");

    // Get tenant operating hours
    const { data: tenant } = await db
      .from("tenants")
      .select("operating_hours")
      .eq("id", this.tenantId)
      .single();

    return this.generateSlots(
      dateRange,
      (bookings || []) as ExistingBooking[],
      (tenant as TenantData | null)?.operating_hours ?? null,
    );
  }

  async createBooking(
    _tenantId: string,
    booking: BookingRequest,
  ): Promise<BookingConfirmation> {
    const db = getSupabase();

    // Generate confirmation code
    const confirmationCode = this.generateConfirmationCode();

    // Parse date and time from ISO string
    const bookingDate = booking.startTime.split("T")[0];
    const bookingTime = booking.startTime.split("T")[1].substring(0, 5);

    // Calculate duration in minutes
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);
    const durationMinutes = Math.round(
      (endTime.getTime() - startTime.getTime()) / 60000,
    );

    const { data, error } = await db
      .from("bookings")
      .insert({
        tenant_id: this.tenantId,
        customer_name: booking.customerName,
        customer_phone: booking.customerPhone,
        customer_email: booking.customerEmail,
        booking_date: bookingDate,
        booking_time: bookingTime,
        booking_type: booking.service || "appointment",
        duration_minutes: durationMinutes,
        notes: booking.notes,
        status: "confirmed",
        confirmation_code: confirmationCode,
        source: "call",
      })
      .select()
      .single();

    if (error) {
      console.error("[BUILTIN_CALENDAR] Booking creation failed:", error);
      throw new Error(`Failed to create booking: ${error.message}`);
    }

    return {
      id: data.id,
      status: "confirmed",
      startTime: booking.startTime,
      endTime: booking.endTime,
    };
  }

  async cancelBooking(_tenantId: string, bookingId: string): Promise<boolean> {
    const db = getSupabase();

    const { error } = await db
      .from("bookings")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", this.tenantId)
      .eq("id", bookingId);

    if (error) {
      console.error("[BUILTIN_CALENDAR] Booking cancellation failed:", error);
      throw new Error(`Failed to cancel booking: ${error.message}`);
    }

    return true;
  }

  async getBookings(
    _tenantId: string,
    dateRange: DateRange,
  ): Promise<BookingConfirmation[]> {
    const db = getSupabase();

    const startDate = dateRange.start.split("T")[0];
    const endDate = dateRange.end.split("T")[0];

    const { data, error } = await db
      .from("bookings")
      .select("id, booking_date, booking_time, duration_minutes, status")
      .eq("tenant_id", this.tenantId)
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .order("booking_date")
      .order("booking_time");

    if (error) {
      console.error("[BUILTIN_CALENDAR] Failed to get bookings:", error);
      throw new Error(`Failed to get bookings: ${error.message}`);
    }

    return (data || []).map((booking: ExistingBooking) => {
      const startDateTime = `${booking.booking_date}T${booking.booking_time}:00`;
      const duration = booking.duration_minutes || 30;
      const endDateTime = new Date(
        new Date(startDateTime).getTime() + duration * 60000,
      ).toISOString();

      return {
        id: booking.id,
        status:
          booking.status === "cancelled"
            ? ("pending" as const)
            : ("confirmed" as const),
        startTime: new Date(startDateTime).toISOString(),
        endTime: endDateTime,
      };
    });
  }

  /**
   * Generate time slots based on operating hours and existing bookings
   */
  private generateSlots(
    dateRange: DateRange,
    bookings: ExistingBooking[],
    operatingHours: OperatingHours | null,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotDuration = 30; // minutes

    // Default business hours if none configured
    const defaultHours: { open: string; close: string; closed?: boolean } = {
      open: "09:00",
      close: "17:00",
      closed: false,
    };

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dayName = dayNames[dayOfWeek];
      const dateStr = currentDate.toISOString().split("T")[0];

      // Get operating hours for this day
      const dayHours = operatingHours?.[dayName] || defaultHours;

      // Skip if closed
      if (dayHours.closed) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Parse open/close times
      const [openHour, openMinute] = dayHours.open.split(":").map(Number);
      const [closeHour, closeMinute] = dayHours.close.split(":").map(Number);

      // Get bookings for this day
      const dayBookings = bookings.filter((b) => b.booking_date === dateStr);

      // Generate slots for the day
      let hour = openHour;
      let minute = openMinute;

      while (hour < closeHour || (hour === closeHour && minute < closeMinute)) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, minute, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

        // Check if within requested range
        if (slotStart >= startDate && slotEnd <= endDate) {
          // Check if slot conflicts with existing booking
          const isBooked = dayBookings.some((booking) => {
            const bookingStart = booking.booking_time;
            const bookingDuration = booking.duration_minutes || 30;

            // Parse booking times
            const [bHour, bMin] = bookingStart.split(":").map(Number);
            const bookingStartTime = new Date(currentDate);
            bookingStartTime.setHours(bHour, bMin, 0, 0);

            const bookingEndTime = new Date(bookingStartTime);
            bookingEndTime.setMinutes(
              bookingEndTime.getMinutes() + bookingDuration,
            );

            // Check overlap
            return slotStart < bookingEndTime && slotEnd > bookingStartTime;
          });

          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            available: !isBooked,
          });
        }

        // Move to next slot
        minute += slotDuration;
        if (minute >= 60) {
          hour += Math.floor(minute / 60);
          minute = minute % 60;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  /**
   * Generate a unique confirmation code
   */
  private generateConfirmationCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
