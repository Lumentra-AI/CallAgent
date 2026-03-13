-- Migration 026: Normalize escalation contact phone numbers to E.164 format
-- Fixes existing data where phone numbers were stored without country code prefix

-- 10-digit US numbers: prepend +1
UPDATE escalation_contacts
SET phone = '+1' || phone
WHERE phone !~ '^\+'
  AND phone ~ '^[0-9]+$'
  AND length(phone) = 10;

-- 11-digit numbers starting with 1: prepend +
UPDATE escalation_contacts
SET phone = '+' || phone
WHERE phone !~ '^\+'
  AND phone ~ '^1[0-9]+$'
  AND length(phone) = 11;

-- Also normalize the legacy escalation_phone column on tenants table
UPDATE tenants
SET escalation_phone = '+1' || escalation_phone
WHERE escalation_phone IS NOT NULL
  AND escalation_phone !~ '^\+'
  AND escalation_phone ~ '^[0-9]+$'
  AND length(escalation_phone) = 10;

UPDATE tenants
SET escalation_phone = '+' || escalation_phone
WHERE escalation_phone IS NOT NULL
  AND escalation_phone !~ '^\+'
  AND escalation_phone ~ '^1[0-9]+$'
  AND length(escalation_phone) = 11;
