-- ========================================================
-- RIFX Marketing — Actualización OmniPublish V2: Plataformas
-- ========================================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query
-- para permitir vincular y registrar publicaciones en TikTok y YouTube.

-- 1. Actualizar el constraint de plataformas soportadas en social_accounts
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_platform_check CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'youtube'));
