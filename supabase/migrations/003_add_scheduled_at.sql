-- =======================================================
-- RIFX Marketing — Agregar columna de programación horaria
-- =======================================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE social_publications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
