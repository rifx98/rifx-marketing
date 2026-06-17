-- ============================================
-- RIFX Marketing — Migration: Pricing Guard
-- ============================================
-- Ejecuta en: Supabase Dashboard → SQL Editor → New Query
-- Idempotente: seguro de ejecutar varias veces.

CREATE TABLE IF NOT EXISTS service_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
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
