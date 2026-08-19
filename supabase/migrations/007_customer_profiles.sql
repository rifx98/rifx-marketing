-- ============================================
-- RIFX Marketing — Memoria a Largo Plazo
-- ============================================

-- Customer identity is tenant scoped from its first schema version. A global
-- phone-number primary key can merge two unrelated businesses during backfill.
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  customer_name TEXT,
  business_type TEXT,
  location TEXT,
  budget_range TEXT,
  service_interest TEXT,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT customer_profiles_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT customer_profiles_phone_not_blank
    CHECK (btrim(phone_number) <> ''),
  CONSTRAINT customer_profiles_tenant_phone_key
    UNIQUE (tenant_id, phone_number)
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM PUBLIC;

DO $customer_profile_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_profiles TO service_role';
  END IF;
END
$customer_profile_roles$;

CREATE INDEX IF NOT EXISTS customer_profiles_tenant_last_interaction_idx
  ON public.customer_profiles (tenant_id, last_interaction DESC);

-- Backfill without cross-tenant conflict or overwrite.
INSERT INTO public.customer_profiles (
  tenant_id,
  phone_number,
  customer_name,
  business_type,
  location,
  budget_range,
  service_interest,
  last_interaction,
  updated_at
)
SELECT
  tenant_id,
  phone_number,
  customer_name,
  business_type,
  location,
  budget_range,
  service_interest,
  COALESCE(updated_at, created_at, NOW()) AS last_interaction,
  NOW() AS updated_at
FROM (
  SELECT DISTINCT ON (tenant_id, phone_number)
    tenant_id,
    phone_number,
    customer_name,
    business_type,
    location,
    budget_range,
    service_interest,
    updated_at,
    created_at,
    id
  FROM public.conversations
  WHERE tenant_id IS NOT NULL
    AND phone_number IS NOT NULL
    AND btrim(phone_number) <> ''
  ORDER BY
    tenant_id,
    phone_number,
    updated_at DESC NULLS LAST,
    created_at DESC NULLS LAST,
    id DESC
) AS latest_conversation
WHERE tenant_id IS NOT NULL
  AND phone_number IS NOT NULL
  AND btrim(phone_number) <> ''
ON CONFLICT (tenant_id, phone_number)
DO UPDATE SET
  customer_name = COALESCE(EXCLUDED.customer_name, customer_profiles.customer_name),
  business_type = COALESCE(EXCLUDED.business_type, customer_profiles.business_type),
  location = COALESCE(EXCLUDED.location, customer_profiles.location),
  budget_range = COALESCE(EXCLUDED.budget_range, customer_profiles.budget_range),
  service_interest = COALESCE(EXCLUDED.service_interest, customer_profiles.service_interest),
  last_interaction = GREATEST(
    EXCLUDED.last_interaction,
    customer_profiles.last_interaction
  ),
  updated_at = NOW();
