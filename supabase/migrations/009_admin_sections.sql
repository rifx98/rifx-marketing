-- ============================================
-- RIFX Marketing — Secciones de Administrador
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS admin_sections JSONB DEFAULT '["overview","tenants","templates","announcements"]'::jsonb;
