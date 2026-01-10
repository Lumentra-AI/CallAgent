import { getSupabase } from "../database/client.js";
import { getTwilioClient } from "./client.js";
import { getTemplate } from "./templates.js";

interface QueueSmsParams {
  tenantId: string;
  bookingId?: string;
  callId?: string;
  toPhone: string;
  messageType: "confirmation" | "reminder" | "missed_call" | "custom";
  context: Record<string, string>;
  customBody?: string;
}

/**
 * Queue an SMS message for sending
 *
 * This creates a record in sms_messages and attempts to send via Twilio.
 */
export async function queueSms(params: QueueSmsParams): Promise<void> {
  const {
    tenantId,
    bookingId,
    callId,
    toPhone,
    messageType,
    context,
    customBody,
  } = params;

  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!fromPhone) {
    console.warn("[SMS] No TWILIO_PHONE_NUMBER configured, skipping SMS");
    return;
  }

  // Get message body from template or custom
  const body = customBody || getTemplate(messageType, context);

  const db = getSupabase();

  // Create SMS record
  const { data: smsRecord, error: insertError } = await db
    .from("sms_messages")
    .insert({
      tenant_id: tenantId,
      booking_id: bookingId,
      call_id: callId,
      to_phone: toPhone,
      from_phone: fromPhone,
      message_type: messageType,
      body,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[SMS] Failed to create SMS record:", insertError);
    return;
  }

  // Try to send immediately
  try {
    const client = getTwilioClient();

    if (!client) {
      console.warn("[SMS] Twilio client not configured, message queued");
      return;
    }

    const message = await client.messages.create({
      body,
      from: fromPhone,
      to: toPhone,
    });

    // Update record with Twilio SID and status
    await db
      .from("sms_messages")
      .update({
        twilio_sid: message.sid,
        status: "sent",
      })
      .eq("id", smsRecord.id);

    console.log(`[SMS] Sent to ${toPhone}, SID: ${message.sid}`);
  } catch (error) {
    console.error("[SMS] Failed to send:", error);

    // Update record with error
    await db
      .from("sms_messages")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", smsRecord.id);
  }
}

/**
 * Send a booking reminder SMS
 */
export async function sendReminder(bookingId: string): Promise<boolean> {
  const db = getSupabase();

  // Get booking details
  const { data: booking, error } = await db
    .from("bookings")
    .select("*, tenants(*)")
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    console.error("[SMS] Booking not found:", bookingId);
    return false;
  }

  // Check if already reminded
  if (booking.reminder_sent) {
    console.log("[SMS] Reminder already sent for:", bookingId);
    return true;
  }

  await queueSms({
    tenantId: booking.tenant_id,
    bookingId,
    toPhone: booking.customer_phone,
    messageType: "reminder",
    context: {
      customerName: booking.customer_name,
      businessName: booking.tenants?.business_name || "us",
      date: formatDate(booking.booking_date),
      time: formatTime(booking.booking_time),
      confirmationCode: booking.confirmation_code,
    },
  });

  // Mark as reminded
  await db
    .from("bookings")
    .update({
      reminder_sent: true,
      reminder_sent_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  return true;
}

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}
