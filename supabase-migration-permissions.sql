-- ============================================
-- RIFX Marketing — Migración de Permisos y Accesos
-- ============================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

-- 1. Agregar columna de permisos de planes en platform_settings
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS plan_permissions JSONB DEFAULT '{
  "trial": ["dashboard", "settings", "billing"],
  "start": ["dashboard", "crm", "settings", "billing", "playground"],
  "advanced": ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments"],
  "plus": ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments", "analytics"],
  "master": ["dashboard", "crm", "settings", "billing", "playground", "campaigns", "banners", "segments", "analytics"]
}'::jsonb;

-- 2. Agregar columna de overrides de permisos en tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS permission_overrides JSONB DEFAULT '{}'::jsonb;
