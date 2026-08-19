-- ============================================
-- RIFX AdGenius - Tablas de Plantillas Dinámicas
-- Migración: 002_creative_templates
-- Fecha: 2026-05-20
-- ============================================

-- 1. Tabla de plantillas
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL para plantillas públicas globales creadas por el admin
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

-- Sin políticas abiertas; 012 aplica FORCE RLS y los grants explícitos.
