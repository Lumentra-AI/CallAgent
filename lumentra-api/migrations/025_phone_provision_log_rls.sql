-- Migration 025: Add RLS to phone_provision_log
-- This table was created in migration 021 without row level security.

ALTER TABLE phone_provision_log ENABLE ROW LEVEL SECURITY;

-- Select: User must be active member of tenant
DROP POLICY IF EXISTS phone_provision_log_select_members ON phone_provision_log;
CREATE POLICY phone_provision_log_select_members ON phone_provision_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = phone_provision_log.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = TRUE
    )
  );

-- Insert: Owner or admin only
DROP POLICY IF EXISTS phone_provision_log_insert_admin ON phone_provision_log;
CREATE POLICY phone_provision_log_insert_admin ON phone_provision_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = phone_provision_log.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.is_active = TRUE
    )
  );

-- No update or delete - audit logs are immutable
