-- Platform admins table (DB-driven admin management)
-- Env var PLATFORM_ADMIN_EMAILS serves as bootstrap/fallback
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  added_by TEXT, -- email of the admin who added this entry
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins (email);
