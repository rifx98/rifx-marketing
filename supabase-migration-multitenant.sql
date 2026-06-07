-- ============================================
-- RIFX Marketing — Migration: Multi-Tenant
-- ============================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

-- 1. Tabla de Tenants (cada cliente/empresa que usa el CRM)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  company_name TEXT DEFAULT 'Mi Empresa',
  owner_name TEXT DEFAULT '',
  plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial','start','advanced','plus','master')),
  plan_status TEXT DEFAULT 'active' CHECK (plan_status IN ('active','expired','cancelled')),
  plan_started_at TIMESTAMPTZ DEFAULT NOW(),
  plan_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 104857600, -- 100MB default (trial)
  contact_limit INTEGER DEFAULT 200, -- trial default
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Anuncios (admin publica, usuarios ven en dashboard)
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','update','warning','promo')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Pagos/Suscripciones
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL, -- en centavos
  currency TEXT DEFAULT 'USD',
  payment_method TEXT DEFAULT 'manual',
  transaction_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Agregar tenant_id a tablas existentes
ALTER TABLE config ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_config_tenant ON config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);

-- 6. RLS para nuevas tablas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON tenants TO service_role FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON announcements TO service_role FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON payments TO service_role FOR ALL USING (true) WITH CHECK (true);
