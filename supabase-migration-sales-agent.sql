-- ============================================
-- RIFX Marketing — Migration: Sales Agent
-- ============================================
-- Ejecuta en: Supabase Dashboard → SQL Editor → New Query
--
-- IMPORTANTE: NO modifica el constraint de status (chatting/interested/bought).
-- Los nuevos estados de venta viven exclusivamente en sales_stage.

-- 1. Nuevos campos en conversations (pipeline de ventas interno)
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

-- 2. CHECK constraint para sales_stage (separado de status)
-- Usamos DO block para evitar error si ya existe
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

-- 3. Índices para queries del panel y stats
CREATE INDEX IF NOT EXISTS idx_conversations_sales_stage ON conversations(sales_stage);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_score ON conversations(lead_score);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON conversations(intent);

-- 4. Migrar datos existentes → mapear status actual a sales_stage
UPDATE conversations SET sales_stage = 'new_lead'  WHERE sales_stage IS NULL AND status = 'chatting';
UPDATE conversations SET sales_stage = 'qualified' WHERE sales_stage IS NULL AND status = 'interested';
UPDATE conversations SET sales_stage = 'won'       WHERE sales_stage IS NULL AND status = 'bought';
