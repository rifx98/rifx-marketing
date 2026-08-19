-- ============================================================================
-- RIFX Marketing - empty-database baseline
-- ============================================================================
-- This migration contains only schema prerequisites for migrations 001-015.
-- It is safe to rerun against the schema it creates, never seeds credentials,
-- and deliberately creates no RLS policies. Direct API roles remain denied;
-- the server-side service_role is granted only the table operations it needs.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- --------------------------------------------------------------------------
-- Core tenant and CRM tables. Migrations 005, 007, 009 and 014 depend on
-- these relations and columns already existing.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  company_name text NOT NULL DEFAULT 'Mi Empresa',
  owner_name text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'start', 'advanced', 'plus', 'master')),
  pending_plan text
    CHECK (pending_plan IS NULL OR pending_plan IN ('trial', 'start', 'advanced', 'plus', 'master')),
  plan_status text NOT NULL DEFAULT 'active'
    CHECK (plan_status IN ('active', 'expired', 'cancelled')),
  plan_started_at timestamptz NOT NULL DEFAULT now(),
  plan_expires_at timestamptz DEFAULT (now() + interval '14 days'),
  storage_used_bytes bigint NOT NULL DEFAULT 0 CHECK (storage_used_bytes >= 0),
  storage_limit_bytes bigint NOT NULL DEFAULT 104857600 CHECK (storage_limit_bytes >= 0),
  contact_limit integer NOT NULL DEFAULT 200 CHECK (contact_limit >= 0),
  is_admin boolean NOT NULL DEFAULT false,
  admin_role text NOT NULL DEFAULT 'full',
  admin_can_edit_plans boolean NOT NULL DEFAULT true,
  permission_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_token text,
  whatsapp_phone_id text,
  wa_display_phone text,
  openai_key text,
  payphone_token text,
  payphone_store_id text,
  ai_prompt text NOT NULL DEFAULT
    'Eres un asesor de ventas profesional. Ayuda al cliente con claridad y protege sus datos.',
  media_retention_days integer NOT NULL DEFAULT 0
    CHECK (media_retention_days BETWEEN 0 AND 3650),
  theme_config jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  customer_name text NOT NULL DEFAULT 'Sin nombre',
  status text NOT NULL DEFAULT 'chatting'
    CHECK (status IN ('chatting', 'interested', 'bought', 'requires_attention')),
  intent text NOT NULL DEFAULT 'general_chat',
  sales_stage text NOT NULL DEFAULT 'new_lead'
    CHECK (sales_stage IN (
      'new_lead', 'discovery', 'qualified', 'proposal',
      'objection', 'closing', 'appointment_booked', 'won', 'lost'
    )),
  lead_score integer NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  last_objection text,
  next_action text,
  business_type text,
  location text,
  budget_range text,
  service_interest text,
  urgency_level text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  -- A trigger derives this value for callers that only send conversation_id.
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_tenant_conversation_fkey
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES public.conversations(tenant_id, id)
);

CREATE OR REPLACE FUNCTION public.set_message_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $message_tenant$
DECLARE
  owning_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO owning_tenant_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF owning_tenant_id IS NULL THEN
    RAISE EXCEPTION 'message references a missing conversation'
      USING ERRCODE = '23503';
  END IF;

  NEW.tenant_id := owning_tenant_id;
  RETURN NEW;
END
$message_tenant$;

DROP TRIGGER IF EXISTS set_message_tenant_trigger ON public.messages;
CREATE TRIGGER set_message_tenant_trigger
  BEFORE INSERT OR UPDATE OF conversation_id, tenant_id
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_tenant();

REVOKE ALL ON FUNCTION public.set_message_tenant() FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  phone_number text NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  service text NOT NULL,
  payphone_transaction_id text,
  client_transaction_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_tenant_conversation_fkey
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES public.conversations(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan text NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL DEFAULT 'manual',
  transaction_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- Platform-wide configuration and pricing. Migration 012 enables RLS on all
-- of these names, so they must exist before it runs.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'update', 'warning', 'promo')),
  image_url text,
  button_text text,
  button_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL DEFAULT 'Sovereign',
  platform_logo text,
  sidebar_order jsonb NOT NULL DEFAULT
    '["dashboard","crm","settings","billing","playground","campaigns","segments","analytics","admin"]'::jsonb,
  plan_permissions jsonb NOT NULL DEFAULT '{
    "trial": ["dashboard", "settings", "billing"],
    "start": ["dashboard", "crm", "settings", "billing", "playground"],
    "advanced": ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments"],
    "plus": ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments", "analytics"],
    "master": ["dashboard", "crm", "settings", "billing", "playground", "campaigns", "banners", "segments", "analytics"]
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  base_price numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  billing_type text NOT NULL DEFAULT 'one_time'
    CHECK (billing_type IN ('one_time', 'monthly', 'hourly', 'per_project', 'custom')),
  included_items text[] NOT NULL DEFAULT '{}'::text[],
  optional_addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_price numeric(10,2),
  max_price numeric(10,2),
  is_custom_quote boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_price IS NULL OR max_price IS NULL OR min_price <= max_price)
);

-- --------------------------------------------------------------------------
-- Social publishing prerequisites for migrations 003 and 004.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL
    CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'google_calendar')),
  platform_user_id text NOT NULL,
  platform_username text,
  profile_picture_url text,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text,
  encryption_iv text NOT NULL,
  encryption_tag text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform, platform_user_id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text,
  caption text NOT NULL,
  video_storage_path text NOT NULL,
  video_public_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.social_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Filled and verified by the trigger below so existing application inserts
  -- only need post_id and social_account_id.
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  post_id uuid NOT NULL,
  social_account_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  external_media_id text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, social_account_id),
  CONSTRAINT social_publications_tenant_post_fkey
    FOREIGN KEY (tenant_id, post_id)
    REFERENCES public.social_posts(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT social_publications_tenant_account_fkey
    FOREIGN KEY (tenant_id, social_account_id)
    REFERENCES public.social_accounts(tenant_id, id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.set_social_publication_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $social_publication_tenant$
DECLARE
  post_tenant_id uuid;
  account_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO post_tenant_id
  FROM public.social_posts
  WHERE id = NEW.post_id;

  SELECT tenant_id INTO account_tenant_id
  FROM public.social_accounts
  WHERE id = NEW.social_account_id;

  IF post_tenant_id IS NULL OR account_tenant_id IS NULL THEN
    RAISE EXCEPTION 'social publication references a missing post or account'
      USING ERRCODE = '23503';
  END IF;

  IF post_tenant_id <> account_tenant_id THEN
    RAISE EXCEPTION 'social publication cannot cross tenant boundaries'
      USING ERRCODE = '23514';
  END IF;

  NEW.tenant_id := post_tenant_id;
  RETURN NEW;
END
$social_publication_tenant$;

DROP TRIGGER IF EXISTS set_social_publication_tenant_trigger
  ON public.social_publications;
CREATE TRIGGER set_social_publication_tenant_trigger
  BEFORE INSERT OR UPDATE OF post_id, social_account_id, tenant_id
  ON public.social_publications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_social_publication_tenant();

REVOKE ALL ON FUNCTION public.set_social_publication_tenant() FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.social_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.social_publications(id) ON DELETE CASCADE,
  log_level text NOT NULL DEFAULT 'info'
    CHECK (log_level IN ('info', 'warning', 'error')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- Cron primitives referenced by migration 012 and hardened by migration 015.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cron_locks (
  name text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_seconds numeric,
  found_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  processed_ids text[] NOT NULL DEFAULT '{}'::text[],
  success boolean NOT NULL DEFAULT false,
  CHECK (found_count >= 0 AND processed_count >= 0 AND skipped_count >= 0 AND error_count >= 0)
);

-- --------------------------------------------------------------------------
-- Performance indexes used by API and cron access paths.
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS tenants_created_at_idx ON public.tenants (created_at DESC);
CREATE INDEX IF NOT EXISTS config_tenant_idx ON public.config (tenant_id);
CREATE INDEX IF NOT EXISTS conversations_tenant_updated_idx
  ON public.conversations (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_phone_idx ON public.conversations (phone_number);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_tenant_idx ON public.messages (tenant_id);
CREATE INDEX IF NOT EXISTS sales_tenant_created_idx ON public.sales (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_status_idx ON public.sales (status);
CREATE INDEX IF NOT EXISTS payments_tenant_created_idx ON public.payments (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_active_window_idx
  ON public.announcements (is_active, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS platform_settings_singleton_uidx
  ON public.platform_settings ((true));
CREATE INDEX IF NOT EXISTS service_pricing_tenant_active_idx
  ON public.service_pricing (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS tenant_members_user_idx ON public.tenant_members (user_id);
CREATE INDEX IF NOT EXISTS social_accounts_tenant_idx ON public.social_accounts (tenant_id);
CREATE INDEX IF NOT EXISTS social_posts_tenant_idx ON public.social_posts (tenant_id);
CREATE INDEX IF NOT EXISTS social_publications_tenant_idx
  ON public.social_publications (tenant_id);
CREATE INDEX IF NOT EXISTS social_publications_status_idx
  ON public.social_publications (status, updated_at);
CREATE INDEX IF NOT EXISTS social_logs_publication_idx ON public.social_logs (publication_id);
CREATE INDEX IF NOT EXISTS cron_runs_name_started_idx
  ON public.cron_runs (cron_name, started_at DESC);
-- RLS is fail-closed from the first migration. No policy is intentionally
-- created here; later migrations must not rely on browser-direct table access.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pricing FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_locks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE
  public.tenants,
  public.config,
  public.conversations,
  public.messages,
  public.sales,
  public.payments,
  public.announcements,
  public.platform_settings,
  public.service_pricing,
  public.tenant_members,
  public.social_accounts,
  public.social_posts,
  public.social_publications,
  public.social_logs,
  public.cron_locks,
  public.cron_runs
FROM PUBLIC;

DO $baseline_roles$
DECLARE
  application_tables text :=
    'public.tenants, public.config, public.conversations, public.messages, '
    'public.sales, public.payments, public.announcements, public.platform_settings, '
    'public.service_pricing, public.tenant_members, '
    'public.social_accounts, public.social_posts, public.social_publications, '
    'public.social_logs, public.cron_locks, public.cron_runs';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE ' || application_tables || ' FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE ' || application_tables || ' FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE '
      || application_tables || ' TO service_role';
  END IF;
END
$baseline_roles$;

COMMIT;
