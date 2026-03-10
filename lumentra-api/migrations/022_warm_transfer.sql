-- Migration 022: Warm transfer tracking
-- Adds transfer state tracking to callback_queue for warm/cold/callback routing
-- Adds voicemail_number to escalation_contacts for voicemail fallback

-- Transfer tracking columns on callback_queue
ALTER TABLE callback_queue
  ADD COLUMN IF NOT EXISTS transfer_type TEXT CHECK (transfer_type IN ('warm', 'cold', 'callback')),
  ADD COLUMN IF NOT EXISTS transfer_status TEXT DEFAULT 'pending' CHECK (transfer_status IN ('pending', 'initiated', 'completed', 'failed', 'callback_queued')),
  ADD COLUMN IF NOT EXISTS selected_contact_id UUID REFERENCES escalation_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
  ADD COLUMN IF NOT EXISTS caller_name TEXT;

-- Optional voicemail number on escalation contacts
ALTER TABLE escalation_contacts
  ADD COLUMN IF NOT EXISTS voicemail_number TEXT;

-- Index for active transfer lookups
CREATE INDEX IF NOT EXISTS idx_callback_queue_transfer_status
  ON callback_queue(tenant_id, transfer_status)
  WHERE transfer_status IS NOT NULL;
