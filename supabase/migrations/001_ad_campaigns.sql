-- ============================================
-- RIFX AdGenius - Tablas de Pautas Publicitarias
-- Migración: 001_ad_campaigns
-- Fecha: 2026-05-17
-- ============================================

-- 1. Campañas publicitarias
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  hook TEXT,
  caption TEXT,
  hashtags TEXT,
  daily_budget DECIMAL(10,2) DEFAULT 5.00,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  target_audience JSONB DEFAULT '{}',
  copy_framework TEXT,
  hook_variants JSONB DEFAULT '[]',
  campaign_config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'completed', 'archived')),
  facebook_campaign_id TEXT,
  facebook_adset_id TEXT,
  facebook_ad_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Creativos (banners/imágenes generadas)
CREATE TABLE IF NOT EXISTS ad_creatives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  banner_url TEXT,
  reference_image_url TEXT,
  product_image_url TEXT,
  ai_prompt TEXT,
  ai_score DECIMAL(3,1) DEFAULT 0.0,
  ai_feedback TEXT,
  width INT DEFAULT 1080,
  height INT DEFAULT 1080,
  format TEXT DEFAULT 'png',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Métricas de rendimiento
CREATE TABLE IF NOT EXISTS ad_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  clicks INT DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0.00,
  conversions INT DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0.0000,
  cpc DECIMAL(10,2) DEFAULT 0.00,
  cpm DECIMAL(10,2) DEFAULT 0.00,
  roas DECIMAL(10,2) DEFAULT 0.00,
  platform TEXT DEFAULT 'facebook',
  source_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDICES para rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_tenant ON ad_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_created ON ad_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign ON ad_creatives(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_tenant ON ad_creatives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_campaign ON ad_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_tenant ON ad_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_date ON ad_analytics(date DESC);

-- ============================================
-- RLS (Row Level Security) - Seguridad
-- ============================================
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_analytics ENABLE ROW LEVEL SECURITY;

-- No se crean políticas USING (true). La migración 012 revoca los roles
-- directos y concede privilegios de tabla solamente a service_role.

-- ============================================
-- FUNCIÓN para actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_ad_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ad_campaigns_updated_at
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_campaigns_updated_at();
