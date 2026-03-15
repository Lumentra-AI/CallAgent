-- Migration 027: Chat system tables and knowledge base
-- Creates chat_sessions, knowledge_base tables with RLS policies,
-- and adds chat_config/chat_widget_enabled columns to tenants.
--
-- NOTE: chat_sessions already exists in the live DB but had no migration
-- in source control. All CREATE/ALTER statements use IF NOT EXISTS or
-- DO blocks so this migration is safe to run against both fresh and
-- existing databases.

-- ============================================================
-- 1. chat_sessions table
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ============================================================
-- 2. Indexes on chat_sessions
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_id ON chat_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions (status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message ON chat_sessions (last_message_at);

-- ============================================================
-- 3. RLS on chat_sessions
-- ============================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Service role (API) can do everything
DROP POLICY IF EXISTS chat_sessions_service_all ON chat_sessions;
CREATE POLICY chat_sessions_service_all ON chat_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only read their tenant's sessions
DROP POLICY IF EXISTS chat_sessions_tenant_read ON chat_sessions;
CREATE POLICY chat_sessions_tenant_read ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. knowledge_base table
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. Indexes on knowledge_base
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant_id ON knowledge_base (tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON knowledge_base (tenant_id, is_active);

-- ============================================================
-- 6. RLS on knowledge_base
-- ============================================================

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_base_service_all ON knowledge_base;
CREATE POLICY knowledge_base_service_all ON knowledge_base
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS knowledge_base_tenant_read ON knowledge_base;
CREATE POLICY knowledge_base_tenant_read ON knowledge_base
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. Add chat columns to tenants
-- ============================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS chat_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS chat_widget_enabled BOOLEAN DEFAULT false;
