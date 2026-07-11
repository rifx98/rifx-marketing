-- ============================================
-- RIFX Marketing — Notificaciones Push
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_id ON push_subscriptions(tenant_id);
