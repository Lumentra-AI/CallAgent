// Review Request Job
import { getSupabase } from "../services/database/client.js";
import { queueNotification } from "../services/notifications/notification-service.js";

/**
 * Send review requests for bookings completed 24 hours ago
 * Runs daily at 9 AM
 */
export async function sendReviewRequests(): Promise<void> {
  const db = getSupabase();

  // Find bookings completed 24-48 hours ago that haven't received review requests
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Get completed bookings with their contacts
  const { data: bookings, error } = await db
    .from("bookings")
    .select(
      `
      id,
      tenant_id,
      customer_name,
      customer_phone,
      customer_email,
      booking_type,
      updated_at,
      contact_id,
      contacts:contact_id (
        id,
        name,
        phone,
        email,
        do_not_sms,
        do_not_email
      )
    `,
    )
    .eq("status", "completed")
    .gte("updated_at", twoDaysAgo.toISOString())
    .lte("updated_at", oneDayAgo.toISOString());

  if (error) {
    console.error("[REVIEW] Failed to get completed bookings:", error);
    return;
  }

  if (!bookings || bookings.length === 0) {
    return;
  }

  // Check which bookings already received review requests
  const bookingIds = bookings.map((b) => b.id);
  const { data: existingNotifications } = await db
    .from("notifications")
    .select("booking_id")
    .in("booking_id", bookingIds)
    .eq("notification_type", "review_request");

  const alreadySent = new Set(
    (existingNotifications || []).map((n) => n.booking_id),
  );

  let sentCount = 0;

  for (const booking of bookings) {
    if (alreadySent.has(booking.id)) continue;

    const contact = booking.contacts as unknown as {
      id: string;
      name?: string;
      phone: string;
      email?: string;
      do_not_sms: boolean;
      do_not_email: boolean;
    } | null;

    // Get tenant info for business name
    const { data: tenant } = await db
      .from("tenants")
      .select("business_name")
      .eq("id", booking.tenant_id)
      .single();

    const variables = {
      customer_name: contact?.name || booking.customer_name || "there",
      business_name: tenant?.business_name || "Our team",
      booking_type: booking.booking_type || "appointment",
    };

    // Send SMS if allowed
    const phone = contact?.phone || booking.customer_phone;
    const doNotSms = contact?.do_not_sms ?? false;

    if (phone && !doNotSms) {
      try {
        await queueNotification(booking.tenant_id, {
          contact_id: contact?.id,
          channel: "sms",
          notification_type: "review_request",
          recipient: phone,
          recipient_name: contact?.name || booking.customer_name,
          booking_id: booking.id,
          template_variables: variables,
        });
        sentCount++;
      } catch (err) {
        console.error(
          `[REVIEW] Failed to send SMS for booking ${booking.id}:`,
          err,
        );
      }
    }

    // Send email if allowed
    const email = contact?.email || booking.customer_email;
    const doNotEmail = contact?.do_not_email ?? false;

    if (email && !doNotEmail) {
      try {
        await queueNotification(booking.tenant_id, {
          contact_id: contact?.id,
          channel: "email",
          notification_type: "review_request",
          recipient: email,
          recipient_name: contact?.name || booking.customer_name,
          booking_id: booking.id,
          template_variables: variables,
        });
        sentCount++;
      } catch (err) {
        console.error(
          `[REVIEW] Failed to send email for booking ${booking.id}:`,
          err,
        );
      }
    }
  }

  if (sentCount > 0) {
    console.log(`[REVIEW] Sent ${sentCount} review requests`);
  }
}
