-- ============================================
-- RIFX Marketing — Migration: Pricing Guard
-- ============================================
-- Ejecuta en: Supabase Dashboard → SQL Editor → New Query
-- Idempotente: seguro de ejecutar varias veces.

CREATE TABLE IF NOT EXISTS service_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT,
  base_price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  billing_type TEXT DEFAULT 'one_time'
    CHECK (billing_type IN ('one_time','monthly','hourly','per_project','custom')),
  included_items TEXT[] DEFAULT '{}',
  optional_addons JSONB DEFAULT '[]',
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  is_custom_quote BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sp_tenant ON service_pricing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sp_active ON service_pricing(tenant_id, is_active);

ALTER TABLE service_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pricing FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE service_pricing FROM PUBLIC;

DO $service_pricing_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.service_pricing FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.service_pricing FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_pricing TO service_role';
  END IF;
END
$service_pricing_roles$;
