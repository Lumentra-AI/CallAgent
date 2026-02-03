// Groq Tool Definitions
// Available tools for the voice agent

import type {
  GroqTool,
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
} from "../../types/voice.js";
import { query, queryAll } from "../database/client.js";
import { insertOne } from "../database/query-helpers.js";
import {
  signalwireConfig,
  signalwireApiUrl,
  transferCall,
} from "../signalwire/client.js";

// Generate confirmation code
function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Tool definitions for Groq with optimized schemas for function calling
// Key optimizations:
// 1. Explicit examples in descriptions (improves parameter extraction)
// 2. Strict enum values where applicable (reduces hallucinations)
// 3. Clear preconditions (prevents premature tool calls)
// 4. Pattern hints for string formats

export const voiceAgentTools: GroqTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check available appointment slots for a date. Call this when customer asks about availability, open times, or when they can book. Example triggers: 'when are you available', 'what times do you have', 'is tomorrow open'.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "Date in YYYY-MM-DD format. Examples: '2026-01-24' for tomorrow, '2026-01-27' for next Monday. Convert spoken dates like 'tomorrow' or 'next Tuesday' to this format.",
          },
          service_type: {
            type: "string",
            description:
              "Optional service type. Examples: 'haircut', 'consultation', 'cleaning'.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_booking",
      description:
        "Create an appointment booking. ONLY call after customer confirms: (1) specific time slot, (2) their name. Example: Customer says 'yes, book me at 2pm' after you offered slots.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description:
              "Customer's name. Examples: 'John Smith', 'Maria Garcia'. Ask if not provided.",
          },
          customer_phone: {
            type: "string",
            description:
              "Phone number in any format. Examples: '555-123-4567', '(555) 123-4567'. Use caller ID if available.",
          },
          date: {
            type: "string",
            description:
              "Booking date in YYYY-MM-DD format. Example: '2026-01-24'.",
          },
          time: {
            type: "string",
            description:
              "Time in 24-hour HH:MM format. Examples: '09:00' for 9 AM, '14:00' for 2 PM, '17:30' for 5:30 PM.",
          },
          service_type: {
            type: "string",
            description:
              "Type of service. Examples: 'general', 'consultation', 'appointment'.",
          },
          notes: {
            type: "string",
            description:
              "Special requests or notes. Example: 'prefers morning appointments'.",
          },
        },
        required: ["customer_name", "customer_phone", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description:
        "Transfer call to human staff. Use when: (1) customer explicitly requests human/person/agent, (2) customer has complaint or refund request, (3) you cannot resolve their issue after 2+ attempts.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: [
              "customer_request",
              "complaint",
              "refund_request",
              "complex_issue",
              "billing_question",
              "cannot_resolve",
            ],
            description:
              "Reason for transfer. Must be one of the allowed values.",
          },
        },
        required: ["reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "end_call",
      description:
        "Hang up the call. STRICT CONDITIONS - ALL must be true: (1) Customer's request is fully handled (order placed, booking confirmed, question answered), (2) Customer said 'goodbye', 'bye', 'that's all', or similar farewell, (3) You already said your goodbye. Do NOT call for just 'thank you' - that's mid-conversation.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: [
              "conversation_complete",
              "customer_requested_hangup",
              "order_confirmed",
              "booking_confirmed",
            ],
            description: "Why the call is ending.",
          },
        },
        required: ["reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_order",
      description:
        "Place a food order. PRECONDITIONS - must have ALL before calling: (1) customer_name - ask 'what name for the order?', (2) items - the food they want, (3) order_type - 'pickup' or 'delivery', (4) IF delivery: complete street address. Phone comes from caller ID automatically. NEVER use placeholder values like 'unknown' - ask the customer instead.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description:
              "Customer's actual name. Examples: 'John', 'Sarah Miller'. If unknown, ask: 'What name should I put the order under?'",
          },
          customer_phone: {
            type: "string",
            description:
              "Leave empty - system uses caller ID automatically. Only fill if customer provides different number.",
          },
          order_type: {
            type: "string",
            enum: ["pickup", "delivery"],
            description:
              "Must be exactly 'pickup' or 'delivery'. Ask customer: 'Is this for pickup or delivery?'",
          },
          items: {
            type: "string",
            description:
              "Comma-separated list of items with sizes. Examples: 'Large Pepperoni Pizza', 'Medium Cheese Pizza, Garlic Knots, 2-Liter Coke'.",
          },
          delivery_address: {
            type: "string",
            description:
              "REQUIRED for delivery orders. Full street address. Examples: '123 Main Street', '456 Oak Ave Apt 2B'. Ask: 'What is the delivery address?'",
          },
          special_instructions: {
            type: "string",
            description:
              "Optional requests. Examples: 'extra napkins', 'no contact delivery', 'ring doorbell'.",
          },
        },
        required: ["customer_name", "order_type", "items"],
      },
    },
  },
];

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

  try {
    // Get existing bookings for the date
    const existingBookings = await queryAll<BookingTimeRow>(
      `SELECT booking_time FROM bookings
       WHERE tenant_id = $1 AND booking_date = $2 AND status != 'cancelled'`,
      [context.tenantId, args.date],
    );

    // Generate available slots (simple 9am-5pm, hourly slots)
    const bookedTimes = new Set(
      existingBookings?.map((b) => b.booking_time) || [],
    );
    const allSlots = [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ];
    const availableSlots = allSlots.filter((slot) => !bookedTimes.has(slot));

    if (availableSlots.length === 0) {
      return {
        available: false,
        slots: [],
        message: `I'm sorry, we don't have any availability on ${args.date}. Would you like to check another date?`,
      };
    }

    // Format slots for voice (e.g., "9 AM", "2 PM")
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

  try {
    const confirmationCode = generateConfirmationCode();

    const data = await insertOne<BookingRow>("bookings", {
      tenant_id: context.tenantId,
      customer_name: args.customer_name,
      customer_phone: args.customer_phone,
      booking_type: args.service_type || "general",
      booking_date: args.date,
      booking_time: args.time,
      notes: args.notes,
      status: "confirmed",
      confirmation_code: confirmationCode,
      reminder_sent: false,
    });

    const formattedTime = formatTimeForVoice(args.time);
    const formattedDate = formatDateForVoice(args.date);

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

  // Check if we have an escalation phone number
  if (!context.escalationPhone) {
    console.warn("[TOOLS] No escalation phone configured");
    return {
      transferred: false,
      message:
        "I'm sorry, I'm not able to transfer you right now. Is there anything else I can help with?",
    };
  }

  // Check SignalWire config
  if (!signalwireApiUrl || !context.callSid) {
    console.warn("[TOOLS] SignalWire not configured or no callSid");
    return {
      transferred: false,
      message:
        "I'm having trouble completing the transfer. Can I take a message instead?",
    };
  }

  const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3100";

  try {
    // Log the escalation in the database
    await query(
      `UPDATE calls SET outcome_type = $1, updated_at = $2 WHERE call_sid = $3`,
      ["escalation", new Date().toISOString(), context.callSid],
    );

    // Initiate the transfer via SignalWire
    const result = await transferCall(
      context.callSid,
      context.escalationPhone,
      BACKEND_URL,
    );

    if (!result.success) {
      console.error("[TOOLS] Transfer failed:", result.error);
      return {
        transferred: false,
        message:
          "I wasn't able to complete the transfer. Would you like to leave a message?",
      };
    }

    console.log(`[TOOLS] Transfer initiated to ${context.escalationPhone}`);
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

  try {
    if (
      !signalwireApiUrl ||
      !signalwireConfig.projectId ||
      !signalwireConfig.apiToken
    ) {
      console.error("[TOOLS] SignalWire not configured");
      return {
        ended: false,
        message: "Unable to end call - configuration error.",
      };
    }

    // Use SignalWire REST API to end the call
    const credentials = Buffer.from(
      `${signalwireConfig.projectId}:${signalwireConfig.apiToken}`,
    ).toString("base64");

    const response = await fetch(
      `${signalwireApiUrl}/Calls/${context.callSid}.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "Status=completed",
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[TOOLS] Failed to end call:", error);
      return {
        ended: false,
        message: "Unable to end call at this time.",
      };
    }

    console.log(`[TOOLS] Call ${context.callSid} ended successfully`);
    return {
      ended: true,
      message: "Call ended.",
    };
  } catch (error) {
    console.error("[TOOLS] end_call error:", error);
    return {
      ended: false,
      message: "Error ending call.",
    };
  }
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

// Execute create_order for restaurant/food orders
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

  // For delivery, REQUIRE address
  if (args.order_type === "delivery" && isInvalidValue(args.delivery_address)) {
    console.log("[TOOLS] Rejected: delivery without address");
    return {
      success: false,
      message:
        "For delivery, I need your address. What's the delivery address?",
    };
  }

  // Use caller phone from context (never ask for it)
  const customerPhone =
    args.customer_phone && !isInvalidValue(args.customer_phone)
      ? args.customer_phone
      : context.callerPhone || "caller";

  try {
    const confirmationCode = `TP-${generateConfirmationCode()}`;

    // Calculate estimated time based on order type
    const estimatedMinutes = args.order_type === "pickup" ? 20 : 40;
    const readyTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);
    const formattedTime = readyTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Build notes with all order details
    const notes = [
      args.items,
      args.order_type === "delivery" && args.delivery_address
        ? `DELIVERY TO: ${args.delivery_address}`
        : "PICKUP ORDER",
      args.special_instructions ? `NOTES: ${args.special_instructions}` : "",
    ]
      .filter(Boolean)
      .join(". ");

    // Insert order as booking
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

// Tool executor - routes tool calls to the right function
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<unknown> {
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
