// Voice Tool Execution
// Handles tool calls from the LiveKit Python agent via internal API

import type {
  ToolExecutionContext,
  CheckAvailabilityArgs,
  CheckAvailabilityResult,
  CreateBookingArgs,
  CreateBookingResult,
  TransferToHumanArgs,
  TransferToHumanResult,
  EndCallArgs,
  EndCallResult,
  CreateOrderArgs,
  CreateOrderResult,
  LogNoteArgs,
  LogNoteResult,
  PrepareTransferArgs,
  PrepareTransferResult,
  QueueCallbackArgs,
  QueueCallbackResult,
} from "../../types/voice.js";
import { query, queryOne, queryAll } from "../database/client.js";
import { insertOne } from "../database/query-helpers.js";
import { findOrCreateByPhone } from "../contacts/contact-service.js";
import { sendBookingConfirmation } from "../notifications/notification-service.js";
import { escalationEvents } from "../escalation/events.js";

// Generate confirmation code
function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Validate a date string is YYYY-MM-DD, not in the past, and within 90 days
function validateBookingDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "Please provide a valid date in YYYY-MM-DD format.";
  }
  const parsed = new Date(date + "T12:00:00");
  if (isNaN(parsed.getTime())) {
    return "That doesn't appear to be a valid date.";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) {
    return "That date is in the past. Please choose a future date.";
  }
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 90);
  if (parsed > maxDate) {
    return "We can only book up to 90 days in advance. Please choose a closer date.";
  }
  return null;
}

// Tool execution functions

interface BookingTimeRow {
  booking_time: string;
}

export async function executeCheckAvailability(
  args: CheckAvailabilityArgs,
  context: ToolExecutionContext,
): Promise<CheckAvailabilityResult> {
  console.log(
    `[TOOLS] check_availability called for tenant ${context.tenantId}:`,
    args,
  );

  const dateError = validateBookingDate(args.date);
  if (dateError) {
    return { available: false, message: dateError };
  }

  try {
    // Get tenant operating hours to generate real slots
    const tenantHours = await queryOne<{
      operating_hours: {
        schedule?: Array<{
          day: number;
          enabled: boolean;
          openTime?: string;
          closeTime?: string;
          open?: string;
          close?: string;
        }>;
      } | null;
    }>("SELECT operating_hours FROM tenants WHERE id = $1", [context.tenantId]);

    // Determine open/close times for the requested date
    const requestedDate = new Date(args.date + "T12:00:00");
    const dayOfWeek = requestedDate.getDay(); // 0=Sun, 6=Sat
    const schedule = tenantHours?.operating_hours?.schedule;
    const dayConfig = schedule?.find((s) => s.day === dayOfWeek);

    // If this day is explicitly disabled, business is closed
    if (dayConfig && dayConfig.enabled === false) {
      const dayName = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][dayOfWeek];
      return {
        available: false,
        slots: [],
        message: `I'm sorry, we're closed on ${dayName}s. Would you like to check another day?`,
      };
    }

    // Parse open/close times (support both camelCase and snake_case)
    const openStr = dayConfig?.openTime || dayConfig?.open || "09:00";
    const closeStr = dayConfig?.closeTime || dayConfig?.close || "17:00";
    const [openH, openM] = openStr.split(":").map(Number);
    const [closeH, closeM] = closeStr.split(":").map(Number);
    const openMinutes = openH * 60 + (openM || 0);
    // Stop 30 min before closing (last bookable slot)
    const closeMinutes = closeH * 60 + (closeM || 0) - 30;

    // Generate 30-minute slots within operating hours, skip lunch (12:00-13:00)
    const allSlots: string[] = [];
    for (let m = openMinutes; m <= closeMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      // Skip lunch hour
      if (h === 12) continue;
      allSlots.push(
        `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      );
    }

    const existingBookings = await queryAll<BookingTimeRow>(
      `SELECT booking_time FROM bookings
       WHERE tenant_id = $1 AND booking_date = $2 AND status != 'cancelled'`,
      [context.tenantId, args.date],
    );

    const bookedTimes = new Set(
      existingBookings?.map((b) => b.booking_time) || [],
    );
    const availableSlots = allSlots.filter((slot) => !bookedTimes.has(slot));

    if (availableSlots.length === 0) {
      return {
        available: false,
        slots: [],
        message: `I'm sorry, we don't have any availability on ${args.date}. Would you like to check another date?`,
      };
    }

    const formattedSlots = availableSlots.slice(0, 3).map(formatTimeForVoice);

    return {
      available: true,
      slots: availableSlots,
      message: `We have availability at ${formattedSlots.join(", ")}.${availableSlots.length > 3 ? " And a few other times as well." : ""} Which time works best for you?`,
    };
  } catch (error) {
    console.error("[TOOLS] check_availability error:", error);
    return {
      available: false,
      message:
        "I encountered an error checking availability. Let me try again.",
    };
  }
}

interface CallIdRow {
  id: string;
}

interface BookingRow {
  id: string;
}

export async function executeCreateBooking(
  args: CreateBookingArgs,
  context: ToolExecutionContext,
): Promise<CreateBookingResult> {
  console.log(
    `[TOOLS] create_booking called for tenant ${context.tenantId}:`,
    args,
  );

  const dateError = validateBookingDate(args.date);
  if (dateError) {
    return { success: false, message: dateError };
  }

  try {
    const confirmationCode = generateConfirmationCode();

    // Try to find the call record for linking (may not exist yet during call)
    let callId: string | null = null;
    if (context.callSid) {
      const callRecord = await queryOne<CallIdRow>(
        "SELECT id FROM calls WHERE vapi_call_id = $1",
        [context.callSid],
      );
      callId = callRecord?.id || null;
    }

    const isChat = !callId && context.callSid;
    const sourceLabel = isChat ? "chat" : "call";
    // DB constraint: source must be call|web|manual|api
    const sourceDb = isChat ? "web" : "call";
    const data = await insertOne<BookingRow>("bookings", {
      tenant_id: context.tenantId,
      customer_name: args.customer_name,
      customer_phone: args.customer_phone,
      booking_type: args.service_type || "general",
      booking_date: args.date,
      booking_time: args.time,
      notes: args.notes
        ? `${args.notes} (${sourceLabel}: ${context.callSid})`
        : `Booked via ${sourceLabel} ${context.callSid}`,
      status: "confirmed",
      confirmation_code: confirmationCode,
      reminder_sent: false,
      source: sourceDb,
      call_id: callId,
    });

    const formattedTime = formatTimeForVoice(args.time);
    const formattedDate = formatDateForVoice(args.date);

    // Wire CRM: find/create contact and queue booking confirmation (non-blocking)
    const callerPhone = args.customer_phone || context.callerPhone;
    if (callerPhone) {
      try {
        const contact = await findOrCreateByPhone(
          context.tenantId,
          callerPhone,
          { name: args.customer_name },
        );
        if (contact) {
          const bookingRecord = await queryOne<any>(
            "SELECT * FROM bookings WHERE id = $1",
            [data.id],
          );
          if (bookingRecord) {
            sendBookingConfirmation(
              context.tenantId,
              bookingRecord,
              contact,
            ).catch((err) =>
              console.error("[TOOLS] booking confirmation error:", err),
            );
          }
        }
      } catch (err) {
        console.error("[TOOLS] CRM contact/notification error:", err);
      }
    }

    return {
      success: true,
      booking_id: data.id,
      confirmation_code: confirmationCode,
      message: `I've booked your appointment for ${formattedDate} at ${formattedTime}. Your confirmation code is ${confirmationCode}. We'll send you a reminder before your appointment.`,
    };
  } catch (error) {
    console.error("[TOOLS] create_booking error:", error);
    return {
      success: false,
      message: "I encountered an error creating the booking. Let me try again.",
    };
  }
}

export async function executeTransferToHuman(
  args: TransferToHumanArgs,
  context: ToolExecutionContext,
): Promise<TransferToHumanResult> {
  console.log(
    `[TOOLS] transfer_to_human called for tenant ${context.tenantId}:`,
    args,
  );

  if (!context.escalationPhone) {
    console.warn("[TOOLS] No escalation phone configured");
    return {
      transferred: false,
      message:
        "I'm sorry, I'm not able to transfer you right now. Is there anything else I can help with?",
    };
  }

  try {
    // Update call outcome
    await query(
      `UPDATE calls SET outcome_type = $1, updated_at = $2 WHERE vapi_call_id = $3`,
      ["escalation", new Date().toISOString(), context.callSid],
    );

    // Return escalation phone - the LiveKit agent handles SIP REFER transfer
    console.log(
      `[TOOLS] Transfer requested to ${context.escalationPhone} - agent will handle SIP REFER`,
    );
    return {
      transferred: true,
      message: "Transferring you now. Please hold.",
    };
  } catch (error) {
    console.error("[TOOLS] Transfer error:", error);
    return {
      transferred: false,
      message:
        "I encountered an error with the transfer. Can I help you another way?",
    };
  }
}

export async function executeEndCall(
  args: EndCallArgs,
  context: ToolExecutionContext,
): Promise<EndCallResult> {
  console.log(`[TOOLS] end_call called for tenant ${context.tenantId}:`, args);

  // Just acknowledge - the LiveKit agent handles session shutdown
  return {
    ended: true,
    message: "Call ended.",
  };
}

// Helper to check for invalid placeholder values
function isInvalidValue(value: string | undefined): boolean {
  if (!value) return true;
  const invalid = [
    "unknown",
    "not provided",
    "n/a",
    "none",
    "undefined",
    "null",
    "",
  ];
  return invalid.includes(value.toLowerCase().trim());
}

export async function executeCreateOrder(
  args: CreateOrderArgs,
  context: ToolExecutionContext,
): Promise<CreateOrderResult> {
  console.log(
    `[TOOLS] create_order called for tenant ${context.tenantId}:`,
    args,
  );

  // VALIDATION: Reject invalid/placeholder values
  if (isInvalidValue(args.customer_name)) {
    console.log("[TOOLS] Rejected: missing customer name");
    return {
      success: false,
      message: "I need a name for the order. What name should I put it under?",
    };
  }

  if (!args.order_type || !["pickup", "delivery"].includes(args.order_type)) {
    console.log("[TOOLS] Rejected: missing order type");
    return {
      success: false,
      message: "Is this order for pickup or delivery?",
    };
  }

  if (isInvalidValue(args.items)) {
    console.log("[TOOLS] Rejected: missing items");
    return {
      success: false,
      message: "What would you like to order?",
    };
  }

  if (args.order_type === "delivery" && isInvalidValue(args.delivery_address)) {
    console.log("[TOOLS] Rejected: delivery without address");
    return {
      success: false,
      message:
        "For delivery, I need your address. What's the delivery address?",
    };
  }

  const customerPhone =
    args.customer_phone && !isInvalidValue(args.customer_phone)
      ? args.customer_phone
      : context.callerPhone || "caller";

  try {
    const confirmationCode = `TP-${generateConfirmationCode()}`;

    const estimatedMinutes = args.order_type === "pickup" ? 20 : 40;
    const readyTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);
    const formattedTime = readyTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const notes = [
      args.items,
      args.order_type === "delivery" && args.delivery_address
        ? `DELIVERY TO: ${args.delivery_address}`
        : "PICKUP ORDER",
      args.special_instructions ? `NOTES: ${args.special_instructions}` : "",
    ]
      .filter(Boolean)
      .join(". ");

    const data = await insertOne<BookingRow>("bookings", {
      tenant_id: context.tenantId,
      customer_name: args.customer_name,
      customer_phone: customerPhone,
      booking_type: args.order_type,
      booking_date: new Date().toISOString().split("T")[0],
      booking_time: new Date().toTimeString().slice(0, 5),
      notes: notes,
      status: "confirmed",
      confirmation_code: confirmationCode,
      reminder_sent: false,
    });

    const orderTypeText =
      args.order_type === "pickup"
        ? `ready for pickup in about ${estimatedMinutes} minutes`
        : `delivered in about ${estimatedMinutes} minutes`;

    return {
      success: true,
      order_id: data.id,
      confirmation_code: confirmationCode,
      estimated_time: formattedTime,
      message: `Your order is confirmed! It will be ${orderTypeText}. Your confirmation number is ${confirmationCode}. Is there anything else I can help you with?`,
    };
  } catch (error) {
    console.error("[TOOLS] create_order error:", error);
    return {
      success: false,
      message: "I encountered an error placing your order. Let me try again.",
    };
  }
}

export async function executeLogNote(
  args: LogNoteArgs,
  context: ToolExecutionContext,
): Promise<LogNoteResult> {
  console.log(`[TOOLS] log_note called for tenant ${context.tenantId}:`, args);

  try {
    // Find or create the contact by phone
    let contactId: string | null = null;
    if (context.callerPhone) {
      const contact = await findOrCreateByPhone(
        context.tenantId,
        context.callerPhone,
      );
      contactId = contact?.id || null;
    }

    if (!contactId) {
      return {
        success: false,
        message: "Note saved.",
      };
    }

    // Find call record for linking
    let callId: string | null = null;
    if (context.callSid) {
      const callRecord = await queryOne<CallIdRow>(
        "SELECT id FROM calls WHERE vapi_call_id = $1",
        [context.callSid],
      );
      callId = callRecord?.id || null;
    }

    const validTypes = [
      "general",
      "preference",
      "complaint",
      "compliment",
      "follow_up",
      "internal",
    ];
    const noteType = validTypes.includes(args.note_type || "")
      ? args.note_type
      : "general";

    await insertOne("contact_notes", {
      tenant_id: context.tenantId,
      contact_id: contactId,
      note_type: noteType,
      content: args.note,
      call_id: callId,
      is_pinned: false,
      is_private: false,
      created_by: "voice_agent",
      created_by_name: "Voice Agent",
    });

    return {
      success: true,
      message: "Note saved.",
    };
  } catch (error) {
    console.error("[TOOLS] log_note error:", error);
    return {
      success: false,
      message: "Note saved.",
    };
  }
}

// ============================================
// Warm Transfer: Contact Selection + Transfer Prep
// ============================================

interface EscalationContactRow {
  id: string;
  name: string;
  phone: string;
  role: string | null;
  is_primary: boolean;
  sort_order: number;
  availability: string;
  availability_hours: Record<
    string,
    { open?: string; close?: string; open_time?: string; close_time?: string }
  > | null;
}

function parseTimeToMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Select escalation contacts available right now based on their availability settings.
 * Returns contacts in sort_order, filtered by current time in the tenant's timezone.
 */
export async function selectAvailableContacts(
  tenantId: string,
  timezone: string,
): Promise<EscalationContactRow[]> {
  const allContacts = await queryAll<EscalationContactRow>(
    `SELECT id, name, phone, role, is_primary, sort_order, availability, availability_hours
     FROM escalation_contacts
     WHERE tenant_id = $1
     ORDER BY sort_order ASC`,
    [tenantId],
  );

  if (!allContacts || allContacts.length === 0) return [];

  // Get current day and time in tenant's timezone
  const now = new Date();
  let dayName = "";
  let currentMinutes = 0;
  try {
    const dayFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    });
    dayName = dayFmt.format(now).toLowerCase();
    const timeFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = timeFmt.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const minute = parseInt(
      parts.find((p) => p.type === "minute")?.value || "0",
    );
    currentMinutes = hour * 60 + minute;
  } catch {
    // If timezone parsing fails, treat all as available
    console.warn(
      `[TOOLS] Failed to parse timezone ${timezone}, returning all contacts`,
    );
    return allContacts;
  }

  const businessDays = ["monday", "tuesday", "wednesday", "thursday", "friday"];

  return allContacts.filter((contact) => {
    if (contact.availability === "always") return true;

    if (contact.availability === "business_hours") {
      if (!businessDays.includes(dayName)) return false;
      return currentMinutes >= 540 && currentMinutes < 1020; // 9:00-17:00
    }

    if (contact.availability === "custom" && contact.availability_hours) {
      const daySchedule = contact.availability_hours[dayName];
      if (!daySchedule) return false;
      const openMin = parseTimeToMinutes(
        daySchedule.open || daySchedule.open_time,
      );
      const closeMin = parseTimeToMinutes(
        daySchedule.close || daySchedule.close_time,
      );
      if (openMin === null || closeMin === null) return false;
      return currentMinutes >= openMin && currentMinutes < closeMin;
    }

    // Unknown availability type: include by default
    return true;
  });
}

function derivePriority(reason: string): string {
  const r = reason.toLowerCase();
  if (/emergency|urgent|medical|safety|threat/.test(r)) return "high";
  if (/complaint|refund|billing|harassment/.test(r)) return "high";
  if (/cancel|issue|problem|cannot_resolve/.test(r)) return "medium";
  return "medium";
}

interface TenantTransferRow {
  transfer_behavior: { type?: string; no_answer?: string } | null;
  timezone: string | null;
}

export async function executePrepareTransfer(
  args: PrepareTransferArgs,
  context: ToolExecutionContext,
): Promise<PrepareTransferResult> {
  console.log(
    `[TOOLS] prepare_transfer called for tenant ${context.tenantId}:`,
    args,
  );

  // Get tenant's transfer_behavior and timezone
  const tenant = await queryOne<TenantTransferRow>(
    "SELECT transfer_behavior, timezone FROM tenants WHERE id = $1",
    [context.tenantId],
  );

  const transferBehavior = tenant?.transfer_behavior || {
    type: "warm",
    no_answer: "message",
  };
  const timezone = tenant?.timezone || "America/New_York";

  // Select available escalation contacts
  let contacts = await selectAvailableContacts(context.tenantId, timezone);

  // Targeted transfer: if target_contact is specified, prioritize matching contact
  if (args.target_contact && contacts.length > 0) {
    const target = args.target_contact.toLowerCase().trim();
    const matchIdx = contacts.findIndex((c) => {
      const roleLower = (c.role || "").toLowerCase();
      const nameLower = c.name.toLowerCase();
      // Exact match on role or name
      if (roleLower === target || nameLower === target) return true;
      // Partial match: target contained in role or name, or vice versa
      if (
        roleLower &&
        (roleLower.includes(target) || target.includes(roleLower))
      )
        return true;
      if (nameLower.includes(target) || target.includes(nameLower)) return true;
      // Underscore/space normalization: "room_service" matches "room service"
      const targetNorm = target.replace(/[_\s-]+/g, " ");
      const roleNorm = roleLower.replace(/[_\s-]+/g, " ");
      const nameNorm = nameLower.replace(/[_\s-]+/g, " ");
      if (roleNorm === targetNorm || nameNorm === targetNorm) return true;
      if (
        roleNorm &&
        (roleNorm.includes(targetNorm) || targetNorm.includes(roleNorm))
      )
        return true;
      if (nameNorm.includes(targetNorm) || targetNorm.includes(nameNorm))
        return true;
      return false;
    });

    if (matchIdx >= 0) {
      // Move matched contact to front, keep others as fallbacks
      const matched = contacts.splice(matchIdx, 1)[0];
      contacts = [matched, ...contacts];
      console.log(
        `[TOOLS] Targeted transfer: matched "${args.target_contact}" to ${matched.name} (${matched.role})`,
      );
    } else {
      console.log(
        `[TOOLS] Targeted transfer: no match for "${args.target_contact}", using sort_order`,
      );
    }
  }

  // Determine effective transfer type
  let effectiveType = transferBehavior.type || "warm";
  if (effectiveType !== "callback" && contacts.length === 0) {
    effectiveType = "callback"; // No contacts available -> force callback
    console.log("[TOOLS] No available contacts, forcing callback mode");
  }

  const priority = derivePriority(args.reason);

  // Create callback_queue entry to track this transfer
  const queueEntry = await insertOne<{ id: string }>("callback_queue", {
    tenant_id: context.tenantId,
    phone_number: context.callerPhone || "",
    reason: args.reason,
    priority,
    status: "pending",
    transfer_type: effectiveType,
    transfer_status:
      effectiveType === "callback" ? "callback_queued" : "pending",
    selected_contact_id: contacts.length > 0 ? contacts[0].id : null,
  });

  // Update call outcome to escalation
  await query(
    "UPDATE calls SET outcome_type = 'escalation', updated_at = $1 WHERE vapi_call_id = $2",
    [new Date().toISOString(), context.callSid],
  );

  console.log(
    `[TOOLS] Transfer prepared: type=${effectiveType}, contacts=${contacts.length}, queue=${queueEntry.id}`,
  );

  escalationEvents.publish({
    type: "transfer_created",
    tenantId: context.tenantId,
    queueId: queueEntry.id,
    data: {
      transferType: effectiveType,
      transferStatus:
        effectiveType === "callback" ? "callback_queued" : "pending",
      phone: context.callerPhone,
      reason: args.reason,
      selectedContactName: contacts.length > 0 ? contacts[0].name : null,
    },
    timestamp: new Date().toISOString(),
  });

  return {
    contacts: contacts.map((c) => ({ phone: c.phone, name: c.name, id: c.id })),
    queue_id: queueEntry.id,
    transfer_type_effective: effectiveType,
    no_answer_behavior: transferBehavior.no_answer || "message",
  };
}

export async function executeQueueCallback(
  args: QueueCallbackArgs,
  context: ToolExecutionContext,
): Promise<QueueCallbackResult> {
  console.log(
    `[TOOLS] queue_callback called for tenant ${context.tenantId}:`,
    args,
  );

  try {
    const entry = await insertOne<{ id: string }>("callback_queue", {
      tenant_id: context.tenantId,
      phone_number: context.callerPhone || "",
      reason: "callback_requested",
      priority: "medium",
      status: "pending",
      transfer_type: "callback",
      transfer_status: "callback_queued",
      conversation_summary: args.message,
      caller_name: args.caller_name || null,
      notes: args.preferred_time
        ? `Preferred callback time: ${args.preferred_time}`
        : null,
    });

    escalationEvents.publish({
      type: "callback_queued",
      tenantId: context.tenantId,
      queueId: entry.id,
      data: {
        transferType: "callback",
        transferStatus: "callback_queued",
        phone: context.callerPhone,
        callerName: args.caller_name || null,
        message: args.message,
      },
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message:
        "I've noted your message. A team member will call you back shortly.",
      queue_id: entry.id,
    };
  } catch (error) {
    console.error("[TOOLS] queue_callback error:", error);
    return {
      success: false,
      message: "I've noted your request. Someone will follow up with you.",
    };
  }
}

// Maps tool names to their required feature key for gating
const TOOL_FEATURE_MAP: Record<string, string> = {
  check_availability: "calendar",
  create_booking: "calendar",
  create_order: "calendar",
  transfer_to_human: "escalations",
  prepare_transfer: "escalations",
  queue_callback: "escalations",
  update_transfer_status: "escalations",
};

// Tool executor - routes tool calls to the right function
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<unknown> {
  // Feature gate: refuse to execute tools for disabled features
  if (context.disabledFeatures?.length) {
    const requiredFeature = TOOL_FEATURE_MAP[toolName];
    if (requiredFeature && context.disabledFeatures.includes(requiredFeature)) {
      console.log(
        `[TOOLS] Blocked ${toolName}: feature "${requiredFeature}" is disabled for tenant ${context.tenantId}`,
      );
      return { success: false, message: "This feature is not available." };
    }
  }

  switch (toolName) {
    case "check_availability":
      return executeCheckAvailability(
        args as unknown as CheckAvailabilityArgs,
        context,
      );
    case "create_booking":
      return executeCreateBooking(
        args as unknown as CreateBookingArgs,
        context,
      );
    case "create_order":
      return executeCreateOrder(args as unknown as CreateOrderArgs, context);
    case "transfer_to_human":
      return executeTransferToHuman(
        args as unknown as TransferToHumanArgs,
        context,
      );
    case "end_call":
      return executeEndCall(args as unknown as EndCallArgs, context);
    case "log_note":
      return executeLogNote(args as unknown as LogNoteArgs, context);
    case "prepare_transfer":
      return executePrepareTransfer(
        args as unknown as PrepareTransferArgs,
        context,
      );
    case "queue_callback":
      return executeQueueCallback(
        args as unknown as QueueCallbackArgs,
        context,
      );
    case "update_transfer_status": {
      const { queue_id, status } = args as { queue_id: string; status: string };
      if (queue_id && status) {
        await query(
          "UPDATE callback_queue SET transfer_status = $1 WHERE id = $2",
          [status, queue_id],
        );
        escalationEvents.publish({
          type: "transfer_status_changed",
          tenantId: context.tenantId,
          queueId: queue_id,
          data: { transferStatus: status },
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Helper functions
function formatTimeForVoice(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  if (minutes === 0) {
    return `${hour12} ${period}`;
  }
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function formatDateForVoice(date: string): string {
  const d = new Date(date + "T12:00:00");
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  return d.toLocaleDateString("en-US", options);
}
