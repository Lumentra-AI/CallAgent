-- Migration 031: Add call_sid to bookings for call_id backfill correlation
--
-- Problem: voice agent's create_booking runs DURING the call, but the calls
-- row is written AFTER the call ends (by call_logger). Any attempt to set
-- bookings.call_id at booking-time fails because the calls row doesn't
-- exist yet. Result: every voice booking has call_id = NULL forever, and
-- the calendar drawer can't fetch transcript/summary.
--
-- Fix: store the call_sid (LiveKit room name / Vapi call ID) on the
-- booking at create-time. When the calls row is later written, we can
-- backfill bookings.call_id by joining on call_sid.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS call_sid TEXT;

-- Partial index: only the rows we actually need to backfill
CREATE INDEX IF NOT EXISTS idx_bookings_call_sid_pending
  ON bookings(tenant_id, call_sid)
  WHERE call_sid IS NOT NULL AND call_id IS NULL;

-- Historical backfill: rescue the call_sid from notes for bookings created
-- before this migration. The old code wrote notes like:
--   "(chat: call-_+19455274974_RYzXBcxwtJqU)"
--   "Booked via chat call-_+19455274974_..."
--   "<user notes> (call: call-_...)"
-- Extract the trailing call-_... token if present.
UPDATE bookings
   SET call_sid = m[1]
  FROM (
    SELECT id, regexp_match(notes, '(call-[^ )]+)') AS m
      FROM bookings
     WHERE call_sid IS NULL
       AND notes ~ 'call-[^ )]+'
  ) src
 WHERE bookings.id = src.id
   AND src.m IS NOT NULL;

-- Then link any historical bookings to their calls row where one exists.
UPDATE bookings b
   SET call_id = c.id
  FROM calls c
 WHERE b.call_id IS NULL
   AND b.call_sid IS NOT NULL
   AND c.tenant_id = b.tenant_id
   AND c.vapi_call_id = b.call_sid;
