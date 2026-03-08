-- Migration 021: Phone provisioning audit log
-- Tracks every provision and release action for billing audits,
-- daily limit enforcement, and orphaned number detection.

CREATE TABLE IF NOT EXISTS phone_provision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  phone_number TEXT NOT NULL,
  provider_sid TEXT,
  action TEXT NOT NULL CHECK (action IN ('provision', 'release', 'port', 'forward', 'sip')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provision_log_tenant_date
  ON phone_provision_log(tenant_id, created_at DESC);
