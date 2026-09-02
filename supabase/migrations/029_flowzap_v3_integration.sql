-- ============================================================================
-- RIFX Marketing - 029: FlowZap V3 Integration & Multi-Number WhatsApp
-- ============================================================================
-- This migration extends the architecture to support multiple WhatsApp numbers
-- per tenant, FlowZap V3 AI integrations, robust WhatsApp campaigns,
-- team agent management, and security audit logs.
-- Data from the legacy config table is safely migrated to the new schema.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

-- 1. TEAM AGENTS
-- Links a real user to an agent role for a tenant
CREATE TABLE IF NOT EXISTS public.team_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid, -- Optional link to auth.users if they have a login
  name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'Asesor' CHECK (role IN ('Administrador','Supervisor','Asesor')),
  status text NOT NULL DEFAULT 'Disponible' CHECK (status IN ('Disponible','Ocupado','Desconectado')),
  departments text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_agents_tenant ON public.team_agents(tenant_id);

ALTER TABLE public.team_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_agents FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own agents" ON public.team_agents
  FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);
CREATE POLICY "Tenants can modify own agents" ON public.team_agents
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- 2. WHATSAPP ACCOUNTS (Multi-number architecture)
CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Cuenta Principal',
  phone_number text,
  phone_number_id text NOT NULL,
  business_account_id text,
  access_token text, -- Encrypted at rest ideally, but kept text for compatibility
  verify_token text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error')),
  provider text NOT NULL DEFAULT 'meta',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_tenant ON public.whatsapp_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_phone ON public.whatsapp_accounts(phone_number_id);

ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own whatsapp accounts" ON public.whatsapp_accounts
  FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);
CREATE POLICY "Tenants can modify own whatsapp accounts" ON public.whatsapp_accounts
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- SAFE MIGRATION OF EXISTING WHATSAPP CREDENTIALS
-- We extract existing whatsapp tokens from the config table to bootstrap whatsapp_accounts.
DO $$
BEGIN
  -- We only migrate configurations that actually have a phone ID and token
  INSERT INTO public.whatsapp_accounts (tenant_id, name, phone_number, phone_number_id, access_token, is_default)
  SELECT 
    tenant_id,
    COALESCE(wa_display_phone, 'Cuenta Migrada') as name,
    wa_display_phone as phone_number,
    whatsapp_phone_id,
    whatsapp_token,
    true as is_default
  FROM public.config
  WHERE whatsapp_phone_id IS NOT NULL 
    AND whatsapp_token IS NOT NULL
    AND whatsapp_phone_id != ''
  ON CONFLICT (tenant_id, phone_number_id) DO NOTHING;
END $$;


-- 3. FLOW VERSIONS
CREATE TABLE IF NOT EXISTS public.flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  flow_name text NOT NULL,
  flow_version integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'draft' CHECK (kind IN ('draft','published')),
  flow_data jsonb NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_versions_tenant ON public.flow_versions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_versions_wa_account ON public.flow_versions(whatsapp_account_id);

ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own flow versions" ON public.flow_versions
  FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);
CREATE POLICY "Tenants can modify own flow versions" ON public.flow_versions
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- 4. WHATSAPP CAMPAIGNS (Independent of Meta Ads)
CREATE TABLE IF NOT EXISTS public.wa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled')),
  template_name text,
  template_data jsonb,
  scheduled_at timestamptz,
  stats jsonb DEFAULT '{"sent":0,"delivered":0,"read":0,"replied":0,"failed":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_tenant ON public.wa_campaigns(tenant_id, created_at DESC);

ALTER TABLE public.wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaigns FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own wa campaigns" ON public.wa_campaigns
  FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);
CREATE POLICY "Tenants can modify own wa campaigns" ON public.wa_campaigns
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- 5. WHATSAPP CAMPAIGN RECIPIENTS
CREATE TABLE IF NOT EXISTS public.wa_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid, -- Reference to CRM contact if applicable
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','replied','failed')),
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  UNIQUE (campaign_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wa_recipients_campaign ON public.wa_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_recipients_provider_id ON public.wa_campaign_recipients(provider_message_id);

ALTER TABLE public.wa_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaign_recipients FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own wa recipients" ON public.wa_campaign_recipients
  FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);
CREATE POLICY "Tenants can modify own wa recipients" ON public.wa_campaign_recipients
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- 6. WHATSAPP OPT-OUTS
CREATE TABLE IF NOT EXISTS public.wa_opt_outs (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  reason text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, phone)
);

ALTER TABLE public.wa_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_opt_outs FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage opt-outs" ON public.wa_opt_outs
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- 7. FLOWZAP V3 AI PREMIUM (Credits & Ledgers)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ai_credits_balance numeric(12, 4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'anthropic', 'custom')),
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  api_key text, -- Tenant's custom API key (encrypted ideally)
  cost_margin_percent numeric(5, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_configs FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage AI configs" ON public.ai_provider_configs
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'usage', 'bonus', 'refund', 'adjustment')),
  amount numeric(12, 4) NOT NULL,
  balance_after numeric(12, 4) NOT NULL,
  reference text,
  created_by uuid, -- Reference to the user who triggered/adjusted
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_tenant ON public.ai_credit_ledger(tenant_id, created_at DESC);

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_ledger FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own credit ledger" ON public.ai_credit_ledger
  FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- 8. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid, -- Actor
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own audit logs" ON public.audit_logs
  FOR SELECT USING (tenant_id = (current_setting('request.jwt.claim.tenant_id', true))::uuid);


-- 9. EXTEND CONVERSATIONS TABLE
-- Safely add columns using IF NOT EXISTS logic
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.team_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unread_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_preview text;

-- Try to associate existing conversations with the default whatsapp account created above
DO $$
BEGIN
  UPDATE public.conversations c
  SET whatsapp_account_id = wa.id
  FROM public.whatsapp_accounts wa
  WHERE c.whatsapp_account_id IS NULL
    AND c.tenant_id = wa.tenant_id
    AND wa.is_default = true;
END $$;

-- Update unique constraint for conversations to include whatsapp_account_id
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_tenant_id_phone_number_key;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_tenant_id_account_id_phone_number_key UNIQUE (tenant_id, whatsapp_account_id, phone_number);

COMMIT;
