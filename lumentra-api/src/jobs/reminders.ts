import { getSupabase } from "../services/database/client.js";
import { sendReminder } from "../services/twilio/sms.js";
import { sendBookingReminder } from "../services/notifications/notification-service.js";

/**
 * Process booking reminders (legacy - uses direct SMS)
 *
 * Finds bookings that are 24 hours away and haven't been reminded yet.
 * Sends SMS reminders to customers.
 */
export async function processReminders(): Promise<void> {
  const db = getSupabase();

  // Calculate the reminder window (24 hours from now, +/- 30 minutes)
  const now = new Date();
  const reminderTarget = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Get the date and time range
  const targetDate = reminderTarget.toISOString().split("T")[0];
  const targetTimeStart = reminderTarget.toTimeString().slice(0, 5);

  // Add 30 minutes to the time
  const targetTimeEnd = new Date(reminderTarget.getTime() + 30 * 60 * 1000)
    .toTimeString()
    .slice(0, 5);

  // Find bookings that need reminders
  const { data: bookings, error } = await db
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .eq("reminder_sent", false)
    .eq("booking_date", targetDate)
    .gte("booking_time", targetTimeStart)
    .lt("booking_time", targetTimeEnd);

  if (error) {
    console.error("[REMINDERS] Query error:", error);
    return;
  }

  if (!bookings || bookings.length === 0) {
    return; // No reminders to send
  }

  console.log(`[REMINDERS] Sending ${bookings.length} reminders`);

  // Send reminders
  for (const booking of bookings) {
    try {
      await sendReminder(booking.id);
    } catch (err) {
      console.error(`[REMINDERS] Failed for booking ${booking.id}:`, err);
    }
  }
}

/**
 * Send due reminders using the notification service
 *
 * Checks for:
 * - 24-hour reminders for bookings tomorrow
 * - 1-hour reminders for bookings in the next hour
 */
export async function sendDueReminders(): Promise<void> {
  const db = getSupabase();
  const now = new Date();

  // 24-hour reminders
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  // Find bookings that need 24h reminders
  const { data: bookings24h, error: err24 } = await db
    .from("bookings")
    .select(
      `
      id, tenant_id, customer_name, customer_phone, customer_email,
      booking_type, booking_date, booking_time, duration_minutes,
      confirmation_code, contact_id,
      contacts:contact_id (id, name, phone, email, do_not_sms, do_not_email)
    `,
    )
    .in("status", ["pending", "confirmed"])
    .eq("booking_date", tomorrowDate)
    .eq("reminder_sent", false);

  if (err24) {
    console.error("[REMINDERS] 24h query error:", err24);
  } else if (bookings24h && bookings24h.length > 0) {
    console.log(
      `[REMINDERS] Processing ${bookings24h.length} 24-hour reminders`,
    );

    for (const booking of bookings24h) {
      try {
        const contact = booking.contacts as unknown as {
          id: string;
          name?: string;
          phone: string;
          email?: string;
          do_not_sms: boolean;
          do_not_email: boolean;
        } | null;

        if (contact) {
          await sendBookingReminder(
            booking.tenant_id,
            booking as any,
            contact as any,
            24,
          );
        }

        // Mark reminder as sent
        await db
          .from("bookings")
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", booking.id);
      } catch (err) {
        console.error(`[REMINDERS] 24h failed for ${booking.id}:`, err);
      }
    }
  }

  // 1-hour reminders
  const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const todayDate = now.toISOString().split("T")[0];
  const oneHourTime = oneHour.toTimeString().slice(0, 5);
  const oneHourEnd = new Date(oneHour.getTime() + 15 * 60 * 1000)
    .toTimeString()
    .slice(0, 5);

  // Find bookings in the next hour that haven't had 1h reminders
  const { data: bookings1h, error: err1 } = await db
    .from("bookings")
    .select(
      `
      id, tenant_id, customer_name, customer_phone, customer_email,
      booking_type, booking_date, booking_time, duration_minutes,
      confirmation_code, contact_id,
      contacts:contact_id (id, name, phone, email, do_not_sms, do_not_email)
    `,
    )
    .in("status", ["pending", "confirmed"])
    .eq("booking_date", todayDate)
    .gte("booking_time", oneHourTime)
    .lte("booking_time", oneHourEnd);

  if (err1) {
    console.error("[REMINDERS] 1h query error:", err1);
  } else if (bookings1h && bookings1h.length > 0) {
    // Check if we already sent 1h reminders via notifications table
    const bookingIds = bookings1h.map((b) => b.id);
    const { data: existing } = await db
      .from("notifications")
      .select("booking_id")
      .in("booking_id", bookingIds)
      .eq("notification_type", "booking_reminder_1h");

    const alreadySent = new Set((existing || []).map((n) => n.booking_id));

    for (const booking of bookings1h) {
      if (alreadySent.has(booking.id)) continue;

      try {
        const contact = booking.contacts as unknown as {
          id: string;
          name?: string;
          phone: string;
          email?: string;
          do_not_sms: boolean;
          do_not_email: boolean;
        } | null;

        if (contact) {
          await sendBookingReminder(
            booking.tenant_id,
            booking as any,
            contact as any,
            1,
          );
        }
      } catch (err) {
        console.error(`[REMINDERS] 1h failed for ${booking.id}:`, err);
      }
    }
  }
}
