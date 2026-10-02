-- Brain Knowledge: Custom knowledge injected by the user to make the AI brain smarter
-- This knowledge is retrieved and included in the LLM context for every brain chat interaction

CREATE TABLE IF NOT EXISTS brain_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','sales','objections','product','process','scripts','faq','competitor')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_brain_knowledge_tenant ON brain_knowledge(tenant_id, active);

-- RLS
ALTER TABLE brain_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY brain_knowledge_tenant_all ON brain_knowledge
  FOR ALL USING (tenant_id = auth.uid());
