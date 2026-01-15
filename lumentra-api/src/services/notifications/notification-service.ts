// Notification Service - Email and SMS notifications
import { getSupabase } from "../database/client.js";
import {
  Notification,
  NotificationTemplate,
  NotificationType,
  Contact,
} from "../../types/crm.js";
import { Booking } from "../../types/database.js";

// ============================================================================
// SEND NOTIFICATIONS
// ============================================================================

export async function sendBookingConfirmation(
  tenantId: string,
  booking: Booking,
  contact: Contact,
): Promise<void> {
  const variables = buildBookingVariables(booking, contact);

  // Send SMS if enabled
  if (!contact.do_not_sms) {
    await queueNotification(tenantId, {
      contact_id: contact.id,
      channel: "sms",
      notification_type: "booking_confirmation",
      recipient: contact.phone,
      recipient_name: contact.name,
      booking_id: booking.id,
      template_variables: variables,
    });
  }

  // Send email if available and enabled
  if (contact.email && !contact.do_not_email) {
    await queueNotification(tenantId, {
      contact_id: contact.id,
      channel: "email",
      notification_type: "booking_confirmation",
      recipient: contact.email,
      recipient_name: contact.name,
      booking_id: booking.id,
      template_variables: variables,
    });
  }
}

export async function sendBookingReminder(
  tenantId: string,
  booking: Booking,
  contact: Contact,
  hoursRemaining: number,
): Promise<void> {
  const variables = buildBookingVariables(booking, contact);
  const type =
    hoursRemaining <= 2 ? "booking_reminder_1h" : "booking_reminder_24h";

  if (!contact.do_not_sms) {
    await queueNotification(tenantId, {
      contact_id: contact.id,
      channel: "sms",
      notification_type: type,
      recipient: contact.phone,
      recipient_name: contact.name,
      booking_id: booking.id,
      template_variables: variables,
    });
  }
}

export async function sendBookingCancellation(
  tenantId: string,
  booking: Booking,
  contact: Contact,
): Promise<void> {
  const variables = buildBookingVariables(booking, contact);

  if (!contact.do_not_sms) {
    await queueNotification(tenantId, {
      contact_id: contact.id,
      channel: "sms",
      notification_type: "booking_cancelled",
      recipient: contact.phone,
      recipient_name: contact.name,
      booking_id: booking.id,
      template_variables: variables,
    });
  }
}

export async function sendMissedCallFollowup(
  tenantId: string,
  callId: string,
  contact: Contact,
): Promise<void> {
  if (contact.do_not_sms) return;

  const db = getSupabase();
  const { data: tenant } = await db
    .from("tenants")
    .select("business_name")
    .eq("id", tenantId)
    .single();

  await queueNotification(tenantId, {
    contact_id: contact.id,
    channel: "sms",
    notification_type: "missed_call_followup",
    recipient: contact.phone,
    recipient_name: contact.name,
    call_id: callId,
    template_variables: {
      customer_name: contact.name || "there",
      business_name: tenant?.business_name || "Our team",
    },
  });
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

export async function queueNotification(
  tenantId: string,
  data: {
    contact_id?: string;
    channel: "email" | "sms";
    notification_type: NotificationType;
    recipient: string;
    recipient_name?: string;
    booking_id?: string;
    call_id?: string;
    template_variables?: Record<string, unknown>;
    scheduled_at?: string;
  },
): Promise<Notification> {
  const db = getSupabase();

  // Get template
  const template = await getDefaultTemplate(
    tenantId,
    data.notification_type,
    data.channel,
  );

  // Render content
  const rendered = renderTemplate(template, data.template_variables || {});

  const { data: notification, error } = await db
    .from("notifications")
    .insert({
      tenant_id: tenantId,
      contact_id: data.contact_id,
      channel: data.channel,
      notification_type: data.notification_type,
      status: data.scheduled_at ? "pending" : "queued",
      recipient: data.recipient,
      recipient_name: data.recipient_name,
      subject: rendered.subject,
      body: rendered.body,
      body_html: rendered.bodyHtml,
      template_id: template?.id,
      template_variables: data.template_variables || {},
      scheduled_at: data.scheduled_at,
      booking_id: data.booking_id,
      call_id: data.call_id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to queue notification: ${error.message}`);

  // If not scheduled, send immediately
  if (!data.scheduled_at) {
    processNotification(notification.id).catch(console.error);
  }

  return notification;
}

export async function processNotification(
  notificationId: string,
): Promise<void> {
  const db = getSupabase();

  const { data: notification, error } = await db
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (error || !notification) return;

  try {
    await db
      .from("notifications")
      .update({ status: "sending" })
      .eq("id", notificationId);

    if (notification.channel === "sms") {
      await sendSms(notification);
    } else if (notification.channel === "email") {
      await sendEmail(notification);
    }

    await db
      .from("notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", notificationId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const retryCount = notification.retry_count + 1;

    await db
      .from("notifications")
      .update({
        status: retryCount >= notification.max_retries ? "failed" : "pending",
        error_message: message,
        retry_count: retryCount,
        next_retry_at: new Date(
          Date.now() + retryCount * 5 * 60 * 1000,
        ).toISOString(),
      })
      .eq("id", notificationId);
  }
}

export async function processQueue(): Promise<number> {
  const db = getSupabase();

  const { data: notifications, error } = await db
    .from("notifications")
    .select("id")
    .eq("status", "queued")
    .order("created_at")
    .limit(50);

  if (error || !notifications) return 0;

  for (const n of notifications) {
    await processNotification(n.id);
  }

  return notifications.length;
}

export async function retryFailed(): Promise<number> {
  const db = getSupabase();

  const { data: notifications, error } = await db
    .from("notifications")
    .select("id")
    .eq("status", "pending")
    .lt("next_retry_at", new Date().toISOString())
    .lt("retry_count", 3)
    .limit(20);

  if (error || !notifications) return 0;

  for (const n of notifications) {
    await processNotification(n.id);
  }

  return notifications.length;
}

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

export async function getDefaultTemplate(
  tenantId: string,
  type: NotificationType,
  channel: "email" | "sms",
): Promise<NotificationTemplate | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("notification_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("notification_type", type)
    .eq("channel", channel)
    .eq("is_default", true)
    .eq("is_active", true)
    .single();

  if (error?.code === "PGRST116") {
    // Return built-in default
    return getBuiltInTemplate(type, channel);
  }

  return data;
}

function getBuiltInTemplate(
  type: NotificationType,
  channel: "email" | "sms",
): NotificationTemplate | null {
  const templates: Record<
    string,
    { sms: string; email: { subject: string; body: string } }
  > = {
    booking_confirmation: {
      sms: "Hi {{customer_name}}, your {{booking_type}} is confirmed for {{booking_date}} at {{booking_time}}. Code: {{confirmation_code}}",
      email: {
        subject: "Booking Confirmed - {{confirmation_code}}",
        body: "Hi {{customer_name}},\n\nYour {{booking_type}} is confirmed.\n\nDate: {{booking_date}}\nTime: {{booking_time}}\nCode: {{confirmation_code}}",
      },
    },
    booking_reminder_24h: {
      sms: "Reminder: Your {{booking_type}} is tomorrow at {{booking_time}}. Code: {{confirmation_code}}",
      email: {
        subject: "Reminder: Appointment Tomorrow",
        body: "Reminder for tomorrow...",
      },
    },
    booking_reminder_1h: {
      sms: "Reminder: Your {{booking_type}} is in 1 hour at {{booking_time}}. See you soon!",
      email: {
        subject: "Reminder: Appointment in 1 Hour",
        body: "See you soon...",
      },
    },
    booking_cancelled: {
      sms: "Your {{booking_type}} for {{booking_date}} has been cancelled.",
      email: {
        subject: "Booking Cancelled",
        body: "Your booking has been cancelled.",
      },
    },
    missed_call_followup: {
      sms: "Hi! We missed your call. How can we help? - {{business_name}}",
      email: { subject: "We missed your call", body: "Sorry we missed you..." },
    },
  };

  const t = templates[type];
  if (!t) return null;

  if (channel === "sms") {
    return {
      id: `builtin_${type}_sms`,
      tenant_id: "",
      name: `Built-in ${type}`,
      notification_type: type,
      channel: "sms",
      body_template: t.sms,
      is_active: true,
      is_default: true,
      available_variables: [],
      preview_data: {},
      created_at: "",
      updated_at: "",
    };
  }

  return {
    id: `builtin_${type}_email`,
    tenant_id: "",
    name: `Built-in ${type}`,
    notification_type: type,
    channel: "email",
    subject_template: t.email.subject,
    body_template: t.email.body,
    is_active: true,
    is_default: true,
    available_variables: [],
    preview_data: {},
    created_at: "",
    updated_at: "",
  };
}

export function renderTemplate(
  template: NotificationTemplate | null,
  variables: Record<string, unknown>,
): { subject?: string; body: string; bodyHtml?: string } {
  if (!template) {
    return { body: JSON.stringify(variables) };
  }

  const render = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      String(variables[key] || ""),
    );
  };

  return {
    subject: template.subject_template
      ? render(template.subject_template)
      : undefined,
    body: render(template.body_template),
    bodyHtml: template.body_html_template
      ? render(template.body_html_template)
      : undefined,
  };
}

// ============================================================================
// SMS & EMAIL PROVIDERS
// ============================================================================

async function sendSms(notification: Notification): Promise<void> {
  // Use existing Twilio service
  const { sendSMS } = await import("../twilio/sms.js");
  await sendSMS(notification.recipient, notification.body);
}

async function sendEmail(notification: Notification): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn(
      "[Notification] RESEND_API_KEY not configured, skipping email",
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(resendApiKey);

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "noreply@lumentra.ai",
    to: notification.recipient,
    subject: notification.subject || "Notification",
    text: notification.body,
    html: notification.body_html || undefined,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildBookingVariables(
  booking: Booking,
  contact: Contact,
): Record<string, string> {
  return {
    customer_name: contact.name || booking.customer_name || "there",
    booking_type: booking.booking_type || "appointment",
    booking_date: formatDate(booking.booking_date),
    booking_time: formatTime(booking.booking_time),
    confirmation_code: booking.confirmation_code,
    duration_minutes: String(booking.duration_minutes || 60),
  };
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}
