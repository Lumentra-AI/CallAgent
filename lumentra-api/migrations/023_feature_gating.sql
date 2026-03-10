-- Migration 023: Feature gating and page-level access control
-- Adds tenant_feature_overrides for platform admin feature toggles
-- Adds allowed_pages on tenant_members for staff page restrictions

-- ============================================================================
-- TENANT FEATURE OVERRIDES
-- Platform admin can enable/disable features per tenant beyond tier defaults
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, feature_key)
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_feature_overrides_tenant
  ON tenant_feature_overrides(tenant_id);

-- Updated at trigger
DROP TRIGGER IF EXISTS trigger_feature_overrides_updated_at ON tenant_feature_overrides;
CREATE TRIGGER trigger_feature_overrides_updated_at
  BEFORE UPDATE ON tenant_feature_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: service role only (platform admin operations go through API)
ALTER TABLE tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ALLOWED PAGES ON TENANT MEMBERS
-- NULL = full access (owner/admin), TEXT[] = restricted to listed pages (staff)
-- ============================================================================
ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS allowed_pages TEXT[];

-- ============================================================================
-- COMMENT DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE tenant_feature_overrides IS 'Platform admin feature toggles per tenant. Merged with tier defaults during feature resolution.';
COMMENT ON COLUMN tenant_feature_overrides.feature_key IS 'Feature identifier: crm, analytics, calendar, chat_widget, escalation, resources, notifications, deals, tasks, pending_bookings, voice_recording, sms';
COMMENT ON COLUMN tenant_members.allowed_pages IS 'Pages this member can access. NULL = full access (owner/admin default). Array = restricted to listed pages only.';
