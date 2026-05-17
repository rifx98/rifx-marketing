-- ============================================
-- RIFX Marketing — Sistema de Suscripciones
-- ============================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

-- 1. Suscripciones activas
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial', 'start', 'advanced', 'plus', 'master')),
  max_contacts INTEGER DEFAULT 200,
  max_bots INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 1,
  price_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone_number);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 2. Historial de pagos de suscripción
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  phone_number TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'payphone',
  payphone_transaction_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON subscription_payments FOR ALL USING (true) WITH CHECK (true);
