// Database client will be used in production for real availability
// import { getSupabase } from "../../database/client.js";

interface CheckAvailabilityParams {
  tenantId?: string;
  date: string;
  serviceType?: string; // Will be used to filter by service type
}

interface AvailabilitySlot {
  time: string;
  available: boolean;
}

interface CheckAvailabilityResult {
  date: string;
  slots: AvailabilitySlot[];
  message: string;
}

/**
 * Check availability for a given date
 *
 * For now, this returns mock availability.
 * In production, this would query the bookings table and business hours.
 */
export async function checkAvailability(
  params: CheckAvailabilityParams,
): Promise<CheckAvailabilityResult> {
  const { tenantId, date, serviceType } = params;

  console.log(
    `[CHECK-AVAILABILITY] Checking ${date} for tenant ${tenantId}, service: ${serviceType || "any"}`,
  );

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return {
      date,
      slots: [],
      message: "Please provide a date in the format YYYY-MM-DD",
    };
  }

  // Parse and validate date
  const requestedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (requestedDate < today) {
    return {
      date,
      slots: [],
      message:
        "That date is in the past. Would you like to check a future date?",
    };
  }

  // For now, generate mock availability
  // In production: query bookings table and calculate available slots
  const slots = generateMockAvailability(requestedDate);

  // Filter for available slots
  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return {
      date,
      slots: [],
      message: `I'm sorry, we're fully booked on ${formatDate(requestedDate)}. Would you like to try another date?`,
    };
  }

  // Format response for voice
  const timeList = availableSlots
    .slice(0, 3) // Only mention first 3 to keep it concise
    .map((s) => formatTime(s.time))
    .join(", ");

  const message =
    availableSlots.length === 1
      ? `We have one opening on ${formatDate(requestedDate)} at ${timeList}.`
      : availableSlots.length <= 3
        ? `We have openings on ${formatDate(requestedDate)} at ${timeList}.`
        : `We have ${availableSlots.length} openings on ${formatDate(requestedDate)}. Some available times are ${timeList}. Would any of those work for you?`;

  return {
    date,
    slots,
    message,
  };
}

/**
 * Generate mock availability slots
 * In production, this would be replaced with actual booking data
 */
function generateMockAvailability(date: Date): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const dayOfWeek = date.getDay();

  // Closed on Sunday
  if (dayOfWeek === 0) {
    return [];
  }

  // Generate slots from 9 AM to 5 PM
  for (let hour = 9; hour < 17; hour++) {
    // Randomly mark some slots as unavailable
    const available = Math.random() > 0.3;

    slots.push({
      time: `${hour.toString().padStart(2, "0")}:00`,
      available,
    });

    // Add half-hour slots
    slots.push({
      time: `${hour.toString().padStart(2, "0")}:30`,
      available: Math.random() > 0.3,
    });
  }

  return slots;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}
