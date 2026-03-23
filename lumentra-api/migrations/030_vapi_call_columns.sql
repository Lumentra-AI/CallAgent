-- Migration 030: Add Vapi-specific columns to calls table
-- NOTE: caller_name and recording_url already exist from 001_initial.sql

ALTER TABLE calls ADD COLUMN IF NOT EXISTS vapi_cost NUMERIC(10,4);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS vapi_cost_breakdown JSONB;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'livekit';

-- Index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_calls_provider ON calls(provider) WHERE provider IS NOT NULL;
