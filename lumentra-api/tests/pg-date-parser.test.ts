import assert from "node:assert/strict";
import test from "node:test";

import { types } from "pg";

import "../src/services/database/pool.js";

// 1082 = DATE (per pg's pg_type catalog / pg-types builtins).
const DATE_OID = 1082;

test("pg DATE parser returns raw YYYY-MM-DD string, not a JS Date", () => {
  const parser = types.getTypeParser(DATE_OID);
  const parsed = parser("2026-04-25");

  assert.equal(typeof parsed, "string");
  assert.equal(parsed, "2026-04-25");
});

test("calendar event.start template literal stays parseable after the fix", () => {
  // Mirrors getCalendarData()'s shape: `${b.booking_date}T${b.booking_time}`.
  const parser = types.getTypeParser(DATE_OID);
  const bookingDate = parser("2026-04-25") as string;
  const bookingTime = "15:00:00";

  const start = `${bookingDate}T${bookingTime}`;

  assert.equal(start, "2026-04-25T15:00:00");
  assert.equal(start.split("T")[0], "2026-04-25");
});
