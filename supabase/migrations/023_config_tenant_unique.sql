-- ============================================================================
-- RIFX Marketing - Fix config table: enforce one row per tenant
-- ============================================================================
-- Problem: config table had no UNIQUE constraint on tenant_id.
-- The upsert(onConflict: 'tenant_id') in /api/panel/config was silently
-- doing nothing (Postgres requires a unique/exclusion constraint for the
-- ON CONFLICT clause to work). Each POST could INSERT a new row instead of
-- UPDATEing the existing one, causing one tenant's config to leak into
-- another's reads via .maybeSingle().
--
-- Fix:
--   1. Deduplicate any existing extra rows, keeping the most recently updated.
--   2. Add UNIQUE (tenant_id) to enforce one-row-per-tenant going forward.
--   3. Add FORCE ROW LEVEL SECURITY (defense in depth).
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout  = '10s';
SET LOCAL statement_timeout = '5min';

-- --------------------------------------------------------------------------
-- 1. Remove duplicate config rows, keeping the most recently updated one.
--    Uses a CTE to identify the canonical row (max updated_at) per tenant.
-- --------------------------------------------------------------------------
DELETE FROM public.config
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id
        ORDER BY updated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.config
  ) ranked
  WHERE rn > 1
);

-- --------------------------------------------------------------------------
-- 2. Add UNIQUE constraint on tenant_id so:
--    a) upsert(onConflict:'tenant_id') works correctly
--    b) No two tenants can ever share a config row
-- --------------------------------------------------------------------------
ALTER TABLE public.config
  ADD CONSTRAINT config_tenant_id_unique UNIQUE (tenant_id);

-- --------------------------------------------------------------------------
-- 3. Ensure FORCE RLS is set (defense-in-depth, though service_role bypasses).
-- --------------------------------------------------------------------------
ALTER TABLE public.config FORCE ROW LEVEL SECURITY;

COMMIT;
