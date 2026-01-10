import { getSupabase } from "../../database/client.js";
import { queueSms } from "../../twilio/sms.js";

interface CreateBookingParams {
  tenantId?: string;
  callId?: string;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  serviceType?: string;
  notes?: string;
}

interface CreateBookingResult {
  success: boolean;
  confirmationCode?: string;
  message: string;
  bookingId?: string;
}

/**
 * Create a new booking
 *
 * This creates a booking record and queues an SMS confirmation.
 */
export async function createBooking(
  params: CreateBookingParams,
): Promise<CreateBookingResult> {
  const {
    tenantId,
    callId,
    customerName,
    customerPhone,
    date,
    time,
    serviceType,
    notes,
  } = params;

  console.log(
    `[CREATE-BOOKING] Creating booking for ${customerName} on ${date} at ${time}`,
  );

  // Validate required fields
  if (!customerName || !customerPhone || !date || !time) {
    return {
      success: false,
      message:
        "I need your name, phone number, date, and time to complete the booking.",
    };
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return {
      success: false,
      message:
        "I couldn't understand that date. Could you give me the date again?",
    };
  }

  // Validate time format
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(time)) {
    return {
      success: false,
      message:
        "I couldn't understand that time. Could you give me the time again?",
    };
  }

  // Normalize phone number
  const normalizedPhone = normalizePhone(customerPhone);
  if (!normalizedPhone) {
    return {
      success: false,
      message: "I couldn't understand that phone number. Could you repeat it?",
    };
  }

  // Generate confirmation code
  const confirmationCode = generateConfirmationCode();

  try {
    const db = getSupabase();

    // Check if slot is still available (in production)
    // For now, we assume it is

    // Create booking record
    const { data: booking, error } = await db
      .from("bookings")
      .insert({
        tenant_id: tenantId,
        call_id: callId,
        customer_name: customerName,
        customer_phone: normalizedPhone,
        booking_type: serviceType || "general",
        booking_date: date,
        booking_time: time,
        notes,
        status: "confirmed",
        confirmation_code: confirmationCode,
        reminder_sent: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[CREATE-BOOKING] Database error:", error);
      return {
        success: false,
        message:
          "I'm having trouble completing that booking right now. Could we try again in a moment?",
      };
    }

    console.log(
      `[CREATE-BOOKING] Booking created: ${booking.id}, code: ${confirmationCode}`,
    );

    // Queue SMS confirmation
    if (tenantId) {
      await queueSms({
        tenantId,
        bookingId: booking.id,
        toPhone: normalizedPhone,
        messageType: "confirmation",
        context: {
          customerName,
          date: formatDateForSms(date),
          time: formatTimeForSms(time),
          confirmationCode,
        },
      });
    }

    // Format success message for voice
    const formattedDate = formatDateForVoice(date);
    const formattedTime = formatTimeForVoice(time);

    return {
      success: true,
      confirmationCode,
      bookingId: booking.id,
      message: `Your booking is confirmed for ${formattedDate} at ${formattedTime}. Your confirmation code is ${spellOutCode(confirmationCode)}. I've sent a confirmation text to your phone.`,
    };
  } catch (error) {
    console.error("[CREATE-BOOKING] Error:", error);
    return {
      success: false,
      message:
        "I'm sorry, something went wrong. Would you like me to try again?",
    };
  }
}

/**
 * Generate a human-readable confirmation code
 */
function generateConfirmationCode(): string {
  // Format: ABC-1234
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed I, O to avoid confusion
  const numbers = "0123456789";

  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  code += "-";
  for (let i = 0; i < 4; i++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }

  return code;
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // US phone number
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Already has country code
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // International or invalid
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Spell out confirmation code for voice clarity
 */
function spellOutCode(code: string): string {
  // NATO phonetic alphabet for letters
  const nato: Record<string, string> = {
    A: "Alpha",
    B: "Bravo",
    C: "Charlie",
    D: "Delta",
    E: "Echo",
    F: "Foxtrot",
    G: "Golf",
    H: "Hotel",
    J: "Juliet",
    K: "Kilo",
    L: "Lima",
    M: "Mike",
    N: "November",
    P: "Papa",
    Q: "Quebec",
    R: "Romeo",
    S: "Sierra",
    T: "Tango",
    U: "Uniform",
    V: "Victor",
    W: "Whiskey",
    X: "X-ray",
    Y: "Yankee",
    Z: "Zulu",
  };

  const parts: string[] = [];

  for (const char of code) {
    if (char === "-") {
      continue;
    } else if (nato[char]) {
      parts.push(nato[char]);
    } else {
      parts.push(char);
    }
  }

  return parts.join(", ");
}

function formatDateForVoice(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTimeForVoice(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function formatDateForSms(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeForSms(time: string): string {
  return formatTimeForVoice(time);
}
