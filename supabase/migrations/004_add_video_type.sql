-- =======================================================
-- RIFX Marketing — Agregar columna de tipo de video (largo / corto)
-- =======================================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS video_type VARCHAR(20) DEFAULT 'short';
