-- ============================================================================
-- 031: Add updated_at to flow_versions & ensure table exists
-- ============================================================================
-- The flow_versions table was created in 029 without an updated_at column.
-- This migration adds it so the API can track when flows were last modified.
-- It also ensures the table exists in case 029 was not fully applied.
-- ============================================================================

BEGIN;

-- Ensure the flow_versions table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_account_id uuid,
  flow_name text NOT NULL,
  flow_version integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'draft' CHECK (kind IN ('draft','published')),
  flow_data jsonb NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at column if it doesn't exist
ALTER TABLE public.flow_versions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_flow_versions_tenant ON public.flow_versions(tenant_id, created_at DESC);

-- Ensure RLS is enabled
ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_versions FORCE ROW LEVEL SECURITY;

-- Recreate policies idempotently
DO $$
BEGIN
  -- Drop existing policies if they exist, then recreate
  DROP POLICY IF EXISTS "Tenants can view own flow versions" ON public.flow_versions;
  DROP POLICY IF EXISTS "Tenants can modify own flow versions" ON public.flow_versions;

  -- Read policy for tenants via JWT
  CREATE POLICY "Tenants can view own flow versions" ON public.flow_versions
    FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);

  -- Write policy for tenants via JWT
  CREATE POLICY "Tenants can modify own flow versions" ON public.flow_versions
    FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);
END $$;

-- Ensure bot_menu_config column exists on config table
ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS bot_menu_config JSONB DEFAULT '{}'::jsonb;

COMMIT;
