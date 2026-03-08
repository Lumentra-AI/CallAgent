-- Migration 020: Gate tenant setup on email verification
-- New users still get a tenant record immediately, but it remains pending until
-- their email address is verified.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'tenants'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%status%'
    AND pg_get_constraintdef(con.oid) LIKE '%draft%'
    AND pg_get_constraintdef(con.oid) LIKE '%active%'
    AND pg_get_constraintdef(con.oid) LIKE '%suspended%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.tenants DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('draft', 'pending_verification', 'active', 'suspended'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
  company_name TEXT;
BEGIN
  company_name := COALESCE(
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.tenants (
    business_name,
    contact_email,
    industry,
    phone_number,
    greeting_standard,
    is_active,
    setup_completed,
    status
  ) VALUES (
    company_name,
    NEW.email,
    'pending_setup',
    'pending_' || NEW.id::TEXT,
    'Hello, thank you for calling. How may I help you today?',
    TRUE,
    FALSE,
    'pending_verification'
  )
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.tenant_members (
    tenant_id,
    user_id,
    role,
    is_active,
    accepted_at
  ) VALUES (
    new_tenant_id,
    NEW.id,
    'owner',
    TRUE,
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates tenant and membership when user signs up with pending email verification';
