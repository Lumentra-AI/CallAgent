import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Unit tests for pure helper functions extracted from OperationsBoard
// These verify formatting and logic without requiring a React renderer.
// ---------------------------------------------------------------------------

// Re-implement helpers here since they're module-private in the component.
// If these are ever extracted to a shared utility, import them directly.

function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function formatTime12h(timeString: string | null | undefined): string {
  if (!timeString) return "";
  if (timeString.includes(":")) {
    const [hoursStr, minutesStr] = timeString.split(":");
    const hour = parseInt(hoursStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour % 12 || 12;
    return `${display}:${minutesStr} ${ampm}`;
  }
  return timeString;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "Unknown";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return "Unknown";
  const labels: Record<string, string> = {
    booking: "Booking",
    appointment: "Appointment",
    inquiry: "Inquiry",
    support: "Support",
    escalation: "Escalated",
    hangup: "Hang up",
    voicemail: "Voicemail",
    completed: "Completed",
    missed: "Missed",
    abandoned: "Abandoned",
  };
  return labels[outcome.toLowerCase()] ?? outcome;
}

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

test("relativeTime returns 'just now' for timestamps less than 1 minute ago", () => {
  const now = new Date().toISOString();
  assert.equal(relativeTime(now), "just now");
});

test("relativeTime returns minutes for recent timestamps", () => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  assert.equal(relativeTime(fiveMinAgo), "5m ago");
});

test("relativeTime returns hours for older timestamps", () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
  assert.equal(relativeTime(twoHoursAgo), "2h ago");
});

test("relativeTime returns 'yesterday' for 1-day-old timestamps", () => {
  const oneDayAgo = new Date(Date.now() - 25 * 3600_000).toISOString();
  assert.equal(relativeTime(oneDayAgo), "yesterday");
});

test("relativeTime returns 'just now' for future timestamps", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(relativeTime(future), "just now");
});

// ---------------------------------------------------------------------------
// formatTime12h
// ---------------------------------------------------------------------------

test("formatTime12h returns empty string for null/undefined", () => {
  assert.equal(formatTime12h(null), "");
  assert.equal(formatTime12h(undefined), "");
});

test("formatTime12h converts 24h to 12h format", () => {
  assert.equal(formatTime12h("14:30"), "2:30 PM");
  assert.equal(formatTime12h("09:00"), "9:00 AM");
  assert.equal(formatTime12h("00:00"), "12:00 AM");
  assert.equal(formatTime12h("12:00"), "12:00 PM");
  assert.equal(formatTime12h("23:59"), "11:59 PM");
});

test("formatTime12h passes through non-colon strings", () => {
  assert.equal(formatTime12h("noon"), "noon");
});

// ---------------------------------------------------------------------------
// formatPhone
// ---------------------------------------------------------------------------

test("formatPhone returns 'Unknown' for null/undefined", () => {
  assert.equal(formatPhone(null), "Unknown");
  assert.equal(formatPhone(undefined), "Unknown");
});

test("formatPhone formats 10-digit US numbers", () => {
  assert.equal(formatPhone("9452935608"), "(945) 293-5608");
});

test("formatPhone formats 11-digit US numbers starting with 1", () => {
  assert.equal(formatPhone("+19452935608"), "(945) 293-5608");
  assert.equal(formatPhone("19452935608"), "(945) 293-5608");
});

test("formatPhone returns original for non-standard numbers", () => {
  assert.equal(formatPhone("+442071234567"), "+442071234567");
});

// ---------------------------------------------------------------------------
// outcomeLabel
// ---------------------------------------------------------------------------

test("outcomeLabel returns 'Unknown' for null/undefined", () => {
  assert.equal(outcomeLabel(null), "Unknown");
  assert.equal(outcomeLabel(undefined), "Unknown");
});

test("outcomeLabel maps known outcomes", () => {
  assert.equal(outcomeLabel("booking"), "Booking");
  assert.equal(outcomeLabel("missed"), "Missed");
  assert.equal(outcomeLabel("escalation"), "Escalated");
});

test("outcomeLabel is case-insensitive", () => {
  assert.equal(outcomeLabel("BOOKING"), "Booking");
  assert.equal(outcomeLabel("Missed"), "Missed");
});

test("outcomeLabel returns raw string for unknown outcomes", () => {
  assert.equal(outcomeLabel("custom_outcome"), "custom_outcome");
});
