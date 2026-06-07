-- ============================================
-- RIFX AdGenius - Tablas de Plantillas Dinámicas
-- Migración: 002_creative_templates
-- Fecha: 2026-05-20
-- ============================================

-- 1. Tabla de plantillas
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT, -- NULL para plantillas públicas globales creadas por el admin
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  preview_image_url TEXT,
  config_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDICES para rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_created ON templates(created_at DESC);

-- ============================================
-- RLS (Row Level Security) - Seguridad
-- ============================================
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Permitir acceso total al service_role (backend)
CREATE POLICY "Service role full access on templates" ON templates TO service_role
  FOR ALL USING (true) WITH CHECK (true);
