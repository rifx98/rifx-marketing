-- ============================================
-- RIFX Marketing — Tipo "Capacitación" para Anuncios
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_type_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_type_check
  CHECK (type IN ('info', 'update', 'warning', 'promo', 'training'));
