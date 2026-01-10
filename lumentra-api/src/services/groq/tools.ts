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
} from "../../types/voice.js";
import { getSupabase } from "../database/client.js";

// Generate confirmation code
function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Tool definitions for Groq
export const voiceAgentTools: GroqTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check available appointment or booking slots for a specific date. Use this when the customer asks about availability or wants to know when they can book.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to check in YYYY-MM-DD format",
          },
          service_type: {
            type: "string",
            description: "The type of service or appointment (optional)",
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
        "Create a new booking or appointment for the customer. Use this when the customer confirms they want to book a specific time slot.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "The customer's full name",
          },
          customer_phone: {
            type: "string",
            description: "The customer's phone number",
          },
          date: {
            type: "string",
            description: "The booking date in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "The booking time in HH:MM format (24-hour)",
          },
          service_type: {
            type: "string",
            description: "The type of service being booked (optional)",
          },
          notes: {
            type: "string",
            description: "Any additional notes or special requests (optional)",
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
        "Transfer the call to a human staff member. Use this when the customer explicitly requests to speak with a person, or when you cannot help with their request.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "The reason for the transfer",
          },
        },
        required: ["reason"],
      },
    },
  },
];

// Tool execution functions
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
    const supabase = getSupabase();
    const { data: existingBookings, error } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("tenant_id", context.tenantId)
      .eq("booking_date", args.date)
      .neq("status", "cancelled");

    if (error) {
      console.error("[TOOLS] Error fetching bookings:", error);
      return {
        available: false,
        message:
          "I'm having trouble checking availability right now. Please try again.",
      };
    }

    // Generate available slots (simple 9am-5pm, hourly slots)
    const bookedTimes = new Set(
      existingBookings?.map((b: { booking_time: string }) => b.booking_time) ||
        [],
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
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("bookings")
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      console.error("[TOOLS] Error creating booking:", error);
      return {
        success: false,
        message:
          "I wasn't able to complete the booking. Would you like me to try again?",
      };
    }

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

  // In the full implementation, this would:
  // 1. Look up the tenant's escalation phone number
  // 2. Initiate a call transfer via SignalWire
  // For now, we return a message that the transfer will happen

  return {
    transferred: true,
    message:
      "I'll transfer you to a staff member now. Please hold for just a moment.",
  };
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
    case "transfer_to_human":
      return executeTransferToHuman(
        args as unknown as TransferToHumanArgs,
        context,
      );
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
