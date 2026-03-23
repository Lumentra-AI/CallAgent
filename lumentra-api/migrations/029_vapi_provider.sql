-- Migration 029: Vapi provider support
-- Extends voice_pipeline enum to include 'vapi', adds vapi_phone_number column,
-- creates vapi_usage table for cost tracking

-- Allow 'vapi' as a voice_pipeline value
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_voice_pipeline_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_voice_pipeline_check
  CHECK (voice_pipeline IN ('custom', 'livekit', 'vapi'));

-- Default new tenants to vapi
ALTER TABLE tenants ALTER COLUMN voice_pipeline SET DEFAULT 'vapi';

-- Store the actual Vapi phone number (E.164)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vapi_phone_number TEXT;
CREATE INDEX IF NOT EXISTS idx_tenants_vapi_phone ON tenants(vapi_phone_number) WHERE vapi_phone_number IS NOT NULL;

-- Store Twilio credentials reference for this tenant's number
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS twilio_number_sid TEXT;

-- Vapi usage tracking (admin-only, per tenant per billing cycle)
CREATE TABLE IF NOT EXISTS vapi_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  billing_cycle TEXT NOT NULL,
  total_cost NUMERIC(10,4) DEFAULT 0,
  total_minutes NUMERIC(10,2) DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, billing_cycle)
);

-- RLS on vapi_usage: service role can access, no tenant-level access
ALTER TABLE vapi_usage ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API server uses service role)
CREATE POLICY vapi_usage_service_role ON vapi_usage FOR ALL USING (true);

-- Index for fast billing cycle lookups
CREATE INDEX IF NOT EXISTS idx_vapi_usage_cycle ON vapi_usage(billing_cycle, tenant_id);
