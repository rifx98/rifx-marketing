-- ============================================
-- RIFX Marketing — Registrar aceptación de Aviso Legal / Política de Privacidad
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
