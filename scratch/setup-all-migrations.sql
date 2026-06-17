-- ============================================
-- RIFX — SETUP COMPLETO: Sales Agent + Pricing Guard
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

-- =====================
-- 1. SALES AGENT
-- =====================

ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS intent TEXT DEFAULT 'general_chat',
  ADD COLUMN IF NOT EXISTS sales_stage TEXT DEFAULT 'new_lead',
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_objection TEXT,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS budget_range TEXT,
  ADD COLUMN IF NOT EXISTS service_interest TEXT,
  ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_sales_stage_check'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_sales_stage_check
      CHECK (sales_stage IN (
        'new_lead', 'discovery', 'qualified', 'proposal',
        'objection', 'closing', 'won', 'lost'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_sales_stage ON conversations(sales_stage);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_score ON conversations(lead_score);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON conversations(intent);

UPDATE conversations SET sales_stage = 'new_lead'  WHERE sales_stage IS NULL AND status = 'chatting';
UPDATE conversations SET sales_stage = 'qualified' WHERE sales_stage IS NULL AND status = 'interested';
UPDATE conversations SET sales_stage = 'won'       WHERE sales_stage IS NULL AND status = 'bought';

-- =====================
-- 2. PRICING GUARD
-- =====================

CREATE TABLE IF NOT EXISTS service_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service_name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT,
  base_price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  billing_type TEXT DEFAULT 'one_time'
    CHECK (billing_type IN ('one_time','monthly','hourly','per_project','custom')),
  included_items TEXT[] DEFAULT '{}',
  optional_addons JSONB DEFAULT '[]',
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  is_custom_quote BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sp_tenant ON service_pricing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sp_active ON service_pricing(tenant_id, is_active);

-- =====================
-- 3. DATOS DE PRUEBA
-- =====================

INSERT INTO service_pricing (tenant_id, service_name, category, description, base_price, currency, billing_type, included_items, optional_addons, min_price, max_price, is_custom_quote)
SELECT 
  '26db5d82-84e2-4af5-9458-add284631021',
  'Diseño Web Profesional',
  'Diseño',
  'Sitio web responsive moderno con diseño personalizado',
  500, 'USD', 'one_time',
  ARRAY['Diseño responsive', '5 páginas', 'Hosting 1 año', 'SSL incluido'],
  '[{"name": "SEO básico", "price": 100}, {"name": "E-commerce", "price": 200}]'::jsonb,
  NULL, NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM service_pricing 
  WHERE tenant_id = '26db5d82-84e2-4af5-9458-add284631021' AND service_name = 'Diseño Web Profesional' AND is_active = true
);

INSERT INTO service_pricing (tenant_id, service_name, category, description, base_price, currency, billing_type, included_items, optional_addons, min_price, max_price, is_custom_quote)
SELECT 
  '26db5d82-84e2-4af5-9458-add284631021',
  'Marketing Digital',
  'Marketing',
  'Gestión integral de redes sociales y publicidad digital',
  NULL, 'USD', 'monthly',
  ARRAY['Gestión de 3 redes', 'Pauta publicitaria', 'Reportes mensuales'],
  '[]'::jsonb,
  300, 800, false
WHERE NOT EXISTS (
  SELECT 1 FROM service_pricing 
  WHERE tenant_id = '26db5d82-84e2-4af5-9458-add284631021' AND service_name = 'Marketing Digital' AND is_active = true
);

INSERT INTO service_pricing (tenant_id, service_name, category, description, base_price, currency, billing_type, included_items, optional_addons, min_price, max_price, is_custom_quote)
SELECT 
  '26db5d82-84e2-4af5-9458-add284631021',
  'Desarrollo de App Móvil',
  'Desarrollo',
  'Aplicación nativa o híbrida a medida',
  NULL, 'USD', 'per_project',
  ARRAY['Diseño UI/UX', 'Desarrollo', 'Publicación en stores'],
  '[]'::jsonb,
  NULL, NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM service_pricing 
  WHERE tenant_id = '26db5d82-84e2-4af5-9458-add284631021' AND service_name = 'Desarrollo de App Móvil' AND is_active = true
);

-- =====================
-- 4. VERIFICACIÓN
-- =====================

SELECT 'CONVERSATIONS' as tabla, column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('intent','sales_stage','lead_score','last_objection','next_action','business_type','location','budget_range','service_interest','urgency_level')
UNION ALL
SELECT 'SERVICE_PRICING' as tabla, service_name as column_name, 
  CASE WHEN base_price IS NOT NULL THEN '$' || base_price::text
       WHEN min_price IS NOT NULL THEN '$' || min_price::text || '-$' || max_price::text
       WHEN is_custom_quote THEN 'CUSTOM'
       ELSE 'N/A' END as data_type
FROM service_pricing
WHERE tenant_id = '26db5d82-84e2-4af5-9458-add284631021' AND is_active = true
ORDER BY 1, 2;
