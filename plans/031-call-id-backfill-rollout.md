# Migration 031 rollout — booking ↔ call linkage

## Why

Voice bookings show source='Chat' in the calendar drawer with no transcript /
AI summary. Root cause: `create_booking` runs during the live call before the
`calls` row exists, so `bookings.call_id` is always NULL for voice. Even after
the source-attribution fix (commit `bdd86cd`), `call_id` is still NULL, so the
drawer can't fetch transcript/summary.

This migration adds a `call_sid` correlation column on `bookings` so the
`call_id` can be backfilled when the `calls` row is written at call-end.

## What this migration does

1. `ADD COLUMN bookings.call_sid TEXT` (nullable, no default)
2. Partial index for the backfill predicate
3. Historical rescue: parses existing booking notes for `call-...` tokens and
   populates `call_sid` for old rows (the agent had been storing the SID
   inside `notes` text)
4. Historical link: joins backfilled `call_sid` against `calls.vapi_call_id`
   to set `call_id` where a matching call row exists

## Risk

- Low. New column, all writes are idempotent.
- Index is partial so it's tiny.
- The historical UPDATEs only touch rows where the join succeeds.

## Apply (Coolify / manual SQL)

```bash
ssh root@178.156.205.145
docker exec -i $(docker ps --filter name=postgres -q) \
  psql -U postgres -d lumentra \
  < /opt/lumentra/migrations/031_bookings_call_sid.sql
```

Or via Supabase SQL editor. After applying:

```sql
SELECT count(*) FROM bookings WHERE call_sid IS NOT NULL;  -- backfilled
SELECT count(*) FROM bookings WHERE call_id IS NOT NULL AND source = 'call';
```

## After migration: code changes to push

Two-line patch on `lumentra-api/src/services/gemini/tools.ts` and
`lumentra-api/src/routes/internal.ts`:

1. **tools.ts `executeCreateBooking`** — write call_sid alongside the booking:
   ```ts
   call_sid: context.source === "call" ? context.callSid || null : null,
   ```
2. **internal.ts `/calls/log`** — after `insertOne("calls", ...)` returns
   the new row, backfill bookings:
   ```ts
   await query(
     `UPDATE bookings
         SET call_id = $1
       WHERE tenant_id = $2
         AND call_sid = $3
         AND call_id IS NULL`,
     [record.id, body.tenant_id, body.call_sid],
   );
   ```

These are intentionally NOT included in commit `bdd86cd` so the column
exists before the writers reference it. Push after migration runs.

## Verification post-migration

- Make a real test call that creates a booking
- After call ends, refresh `/calendar`, click the new tile
- Drawer should show `call` source badge, AI summary, and full transcript
