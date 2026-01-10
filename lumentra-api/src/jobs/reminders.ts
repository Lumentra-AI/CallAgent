import { getSupabase } from "../services/database/client.js";
import { sendReminder } from "../services/twilio/sms.js";

/**
 * Process booking reminders
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
