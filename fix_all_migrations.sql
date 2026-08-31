-- ==========================================
-- MIGRATION: 001_ad_campaigns.sql
-- ==========================================

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

DROP TRIGGER IF EXISTS trigger_ad_campaigns_updated_at ON ad_campaigns;
DROP TRIGGER IF EXISTS trigger_ad_campaigns_updated_at ON ad_campaigns;
CREATE TRIGGER trigger_ad_campaigns_updated_at
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_campaigns_updated_at();


-- ==========================================
-- MIGRATION: 002_creative_templates.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 003_add_scheduled_at.sql
-- ==========================================

-- =======================================================
-- RIFX Marketing — Agregar columna de programación horaria
-- =======================================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE social_publications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;


-- ==========================================
-- MIGRATION: 004_add_video_type.sql
-- ==========================================

-- =======================================================
-- RIFX Marketing — Agregar columna de tipo de video (largo / corto)
-- =======================================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS video_type VARCHAR(20) DEFAULT 'short';


-- ==========================================
-- MIGRATION: 005_appointments_reminders.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Appointments & Reminders
-- Phase 3: Tracks booked appointments, reminder status, and confirmation state.
-- ============================================

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,            -- Google Calendar event ID
  customer_name TEXT,
  phone_number TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  service TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT appointments_tenant_conversation_fkey
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES public.conversations(tenant_id, id)
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

-- Sin políticas USING (true); 012 aplica los privilegios de service_role.

CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_conversation ON appointments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_time ON appointments(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);


-- ==========================================
-- MIGRATION: 006_appointments_v2.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Appointments v2 Migration
-- Phase 3.5: Support additional statuses, 24h/2h/30m reminders, and unique tenant-event constraint.
-- ============================================

-- 1. Actualizar la restricción de estados permitidos en citas
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (
  status IN ('pending', 'confirmed', 'awaiting_reschedule', 'rescheduled', 'cancelled', 'completed', 'no_show', 'pending_completion')
);

-- 2. Agregar campos para recordatorios detallados y auditoría
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_30m_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_message TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 3. Conservar y trasladar el indicador legado. El campo anterior no permite
-- saber qué ventana disparó el aviso; asumir 24h evita reenviar el mismo aviso
-- y mantener la columna preserva evidencia para una reconciliación posterior.
DO $preserve_legacy_reminder$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'reminder_sent'
  ) THEN
    UPDATE public.appointments
    SET reminder_24h_sent = true
    WHERE reminder_sent IS TRUE
      AND reminder_24h_sent IS DISTINCT FROM true;

    COMMENT ON COLUMN public.appointments.reminder_sent IS
      'Legacy reminder marker retained for audit; new workers use the 24h/2h/30m fields.';
  END IF;
END
$preserve_legacy_reminder$;

-- 4. Agregar restricción de clave única compuesta para evitar colisiones entre tenants
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_tenant_event_unique;
ALTER TABLE appointments ADD CONSTRAINT appointments_tenant_event_unique UNIQUE (tenant_id, event_id);


-- ==========================================
-- MIGRATION: 007_customer_profiles.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Memoria a Largo Plazo
-- ============================================

-- Customer identity is tenant scoped from its first schema version. A global
-- phone-number primary key can merge two unrelated businesses during backfill.
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  customer_name TEXT,
  business_type TEXT,
  location TEXT,
  budget_range TEXT,
  service_interest TEXT,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT customer_profiles_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT customer_profiles_phone_not_blank
    CHECK (btrim(phone_number) <> ''),
  CONSTRAINT customer_profiles_tenant_phone_key
    UNIQUE (tenant_id, phone_number)
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM PUBLIC;

DO $customer_profile_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_profiles TO service_role';
  END IF;
END
$customer_profile_roles$;

CREATE INDEX IF NOT EXISTS customer_profiles_tenant_last_interaction_idx
  ON public.customer_profiles (tenant_id, last_interaction DESC);

-- Backfill without cross-tenant conflict or overwrite.
ALTER TABLE public.customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_tenant_phone_key;
ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_tenant_phone_key UNIQUE (tenant_id, phone_number);

INSERT INTO public.customer_profiles (
  tenant_id,
  phone_number,
  customer_name,
  business_type,
  location,
  budget_range,
  service_interest,
  last_interaction,
  updated_at
)
SELECT
  tenant_id,
  phone_number,
  customer_name,
  business_type,
  location,
  budget_range,
  service_interest,
  COALESCE(updated_at, created_at, NOW()) AS last_interaction,
  NOW() AS updated_at
FROM (
  SELECT DISTINCT ON (tenant_id, phone_number)
    tenant_id,
    phone_number,
    customer_name,
    business_type,
    location,
    budget_range,
    service_interest,
    updated_at,
    created_at,
    id
  FROM public.conversations
  WHERE tenant_id IS NOT NULL
    AND phone_number IS NOT NULL
    AND btrim(phone_number) <> ''
  ORDER BY
    tenant_id,
    phone_number,
    updated_at DESC NULLS LAST,
    created_at DESC NULLS LAST,
    id DESC
) AS latest_conversation
WHERE tenant_id IS NOT NULL
  AND phone_number IS NOT NULL
  AND btrim(phone_number) <> ''
ON CONFLICT (tenant_id, phone_number)
DO UPDATE SET
  customer_name = COALESCE(EXCLUDED.customer_name, customer_profiles.customer_name),
  business_type = COALESCE(EXCLUDED.business_type, customer_profiles.business_type),
  location = COALESCE(EXCLUDED.location, customer_profiles.location),
  budget_range = COALESCE(EXCLUDED.budget_range, customer_profiles.budget_range),
  service_interest = COALESCE(EXCLUDED.service_interest, customer_profiles.service_interest),
  last_interaction = GREATEST(
    EXCLUDED.last_interaction,
    customer_profiles.last_interaction
  ),
  updated_at = NOW();


-- ==========================================
-- MIGRATION: 008_push_subscriptions.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Notificaciones Push
-- ============================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_id
  ON public.push_subscriptions(tenant_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.push_subscriptions FROM PUBLIC;

DO $push_subscription_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.push_subscriptions FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.push_subscriptions FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO service_role';
  END IF;
END
$push_subscription_roles$;


-- ==========================================
-- MIGRATION: 009_admin_sections.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Secciones de Administrador
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS admin_sections JSONB NOT NULL DEFAULT
    '["overview","tenants","templates","announcements","permissions","ai_engine"]'::jsonb;


-- ==========================================
-- MIGRATION: 010_announcement_scheduling.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Programación y Caducidad de Anuncios
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;


-- ==========================================
-- MIGRATION: 011_announcement_training_type.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Tipo "Capacitación" para Anuncios
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_type_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_type_check
  CHECK (type IN ('info', 'update', 'warning', 'promo', 'training'));


-- ==========================================
-- MIGRATION: 012_enable_rls_lockdown.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — CRÍTICO: Bloquear acceso público a la base de datos
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).
--
-- Por qué: ninguna tabla tenía Row Level Security (RLS) activado, lo que
-- significa que la clave pública (anon key) — que está incrustada en el
-- JavaScript del navegador de CUALQUIER visitante — podía leer TODAS las
-- filas de TODAS las tablas sin ninguna autenticación (contraseñas,
-- tokens de WhatsApp/Meta, conversaciones de clientes, etc.).
--
-- Esto NO rompe nada de la app: todo el backend usa la Service Role Key
-- (createSupabaseAdmin), que siempre se salta RLS sin importar las
-- políticas. Esta migración solo bloquea el acceso directo desde el
-- navegador con la clave pública, que ninguna parte del código usa hoy.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_locks ENABLE ROW LEVEL SECURITY;

-- La arquitectura actual no usa acceso directo desde el navegador. Además
-- de activar RLS, forzarlo y revocar privilegios evita que defaults de
-- Supabase o políticas históricas vuelvan a abrir tablas accidentalmente.
DO $force_rls$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'tenants', 'config', 'conversations', 'messages', 'customer_profiles',
    'push_subscriptions', 'appointments', 'sales', 'social_accounts',
    'social_publications', 'social_logs', 'social_posts', 'payments',
    'announcements', 'platform_settings', 'ad_campaigns', 'ad_creatives',
    'ad_analytics', 'templates', 'service_pricing', 'tenant_members',
    'cron_runs', 'cron_locks'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', relation_name);
  END LOOP;
END
$force_rls$;

REVOKE ALL PRIVILEGES ON TABLE
  tenants, config, conversations, messages, customer_profiles,
  push_subscriptions, appointments, sales, social_accounts,
  social_publications, social_logs, social_posts, payments, announcements,
  platform_settings, ad_campaigns, ad_creatives, ad_analytics, templates,
  service_pricing, tenant_members, cron_runs, cron_locks
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  tenants, config, conversations, messages, customer_profiles,
  push_subscriptions, appointments, sales, social_accounts,
  social_publications, social_logs, social_posts, payments, announcements,
  platform_settings, ad_campaigns, ad_creatives, ad_analytics, templates,
  service_pricing, tenant_members, cron_runs, cron_locks
TO service_role;

-- No se crea ninguna política — con RLS activado y sin políticas,
-- Postgres deniega todo acceso a los roles "anon" y "authenticated" por
-- defecto. El rol "service_role" (el que usa el backend) sigue
-- funcionando exactamente igual, porque ese rol siempre ignora RLS.


-- ==========================================
-- MIGRATION: 013_fix_permissive_policies.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — CRÍTICO: Eliminar políticas que anulaban el RLS
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).
--
-- Por qué: la migración 012 activó Row Level Security en todas las tablas,
-- pero seguían existiendo políticas llamadas "Service role full access"
-- que en realidad estaban asignadas al rol "public" (con USING (true)),
-- no al rol "service_role". Eso significa que, sin querer, esas políticas
-- daban acceso total a CUALQUIERA (incluyendo la clave anónima pública),
-- dejando el candado de la migración 012 sin efecto.
--
-- Esto NO rompe nada de la app: el rol "service_role" (el que usa
-- createSupabaseAdmin en el backend) siempre ignora RLS por completo,
-- sin importar si existen o no políticas. Solo estas políticas mal
-- configuradas para "public" necesitan eliminarse.

DROP POLICY IF EXISTS "svc_ad_analytics" ON ad_analytics;
DROP POLICY IF EXISTS "Service role full access on ad_analytics" ON ad_analytics;

DROP POLICY IF EXISTS "svc_ad_campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Service role full access on ad_campaigns" ON ad_campaigns;

DROP POLICY IF EXISTS "svc_ad_creatives" ON ad_creatives;
DROP POLICY IF EXISTS "Service role full access on ad_creatives" ON ad_creatives;

DROP POLICY IF EXISTS "Service role full access" ON announcements;
DROP POLICY IF EXISTS "Service role full access" ON config;
DROP POLICY IF EXISTS "Service role full access" ON conversations;
DROP POLICY IF EXISTS "Service role full access" ON messages;
DROP POLICY IF EXISTS "Service role full access" ON payments;
DROP POLICY IF EXISTS "Service role full access" ON sales;
DROP POLICY IF EXISTS "Service role full access" ON tenants;

DROP POLICY IF EXISTS "Service role full access social_accounts" ON social_accounts;
DROP POLICY IF EXISTS "Service role full access social_logs" ON social_logs;
DROP POLICY IF EXISTS "Service role full access social_posts" ON social_posts;
DROP POLICY IF EXISTS "Service role full access social_publications" ON social_publications;
DROP POLICY IF EXISTS "Service role full access on templates" ON templates;
DROP POLICY IF EXISTS "Service role full access tenant_members" ON tenant_members;

-- Nota: las políticas "Members can..."/"Users can view..." en
-- social_accounts, social_logs, social_posts, social_publications y
-- tenant_members se dejan intactas (usan auth.uid(), no dan acceso
-- público). Las políticas de appointments, cron_locks y cron_runs
-- también se dejan intactas: ya estaban correctamente restringidas al
-- rol "service_role" únicamente.


-- ==========================================
-- MIGRATION: 014_terms_acceptance.sql
-- ==========================================

-- ============================================
-- RIFX Marketing — Registrar aceptación de Aviso Legal / Política de Privacidad
-- ============================================
-- Copiar TODO este archivo y pegar en Supabase Dashboard → SQL Editor → Run
-- Seguro de ejecutar varias veces (idempotente).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;


-- ==========================================
-- MIGRATION: 015_security_hardening.sql
-- ==========================================

-- ============================================================================
-- RIFX Marketing - security and tenant-isolation hardening
-- ============================================================================
-- IMPORTANT:
--   * Apply this migration during a maintenance window after taking a verified
--     backup. It intentionally aborts instead of guessing how to repair
--     ambiguous tenant data.
--   * Deploy the customer_profiles code change described in
--     SECURITY_OPERATIONS.md in the same maintenance window.
--   * This file does not rotate credentials and does not modify remote data
--     unless an operator explicitly runs it against the target database.

BEGIN;

-- Avoid waiting indefinitely for locks on a live database. A timeout rolls the
-- entire migration back, leaving the previous schema intact.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

-- --------------------------------------------------------------------------
-- 0. Schema and data preflight. These checks run before destructive DDL.
-- --------------------------------------------------------------------------
DO $preflight$
DECLARE
  missing_relations text;
  missing_columns text;
  type_mismatches text;
  customer_pk_columns text[];
  incoming_customer_fks text;
BEGIN
  SELECT string_agg(required_relation, ', ' ORDER BY required_relation)
    INTO missing_relations
  FROM unnest(ARRAY[
    'public.announcements',
    'public.appointments',
    'public.config',
    'public.conversations',
    'public.cron_locks',
    'public.customer_profiles',
    'public.messages',
    'public.payments',
    'public.push_subscriptions',
    'public.sales',
    'public.social_accounts',
    'public.social_posts',
    'public.social_publications',
    'public.tenants'
  ]) AS required(required_relation)
  WHERE to_regclass(required_relation) IS NULL;

  IF missing_relations IS NOT NULL THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: required tables are missing: %',
      missing_relations;
  END IF;

  -- These relations are owned by this migration. Silently accepting a
  -- same-named manual/partial table would skip all inline constraints hidden
  -- behind CREATE TABLE IF NOT EXISTS.
  IF to_regclass('public.webhook_events') IS NOT NULL
     OR to_regclass('public.storage_upload_reservations') IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: a migration-owned table already exists',
      HINT = 'Inspect webhook_events/storage_upload_reservations and reconcile migration history; do not drop a populated table blindly.';
  END IF;

  WITH required(table_name, column_name) AS (
    VALUES
      ('announcements', 'starts_at'),
      ('announcements', 'expires_at'),
      ('appointments', 'id'),
      ('appointments', 'tenant_id'),
      ('appointments', 'conversation_id'),
      ('appointments', 'event_id'),
      ('config', 'tenant_id'),
      ('config', 'payphone_token'),
      ('config', 'whatsapp_phone_id'),
      ('conversations', 'id'),
      ('conversations', 'status'),
      ('conversations', 'sales_stage'),
      ('conversations', 'tenant_id'),
      ('conversations', 'phone_number'),
      ('conversations', 'customer_name'),
      ('conversations', 'created_at'),
      ('conversations', 'updated_at'),
      ('cron_locks', 'name'),
      ('cron_locks', 'locked_at'),
      ('cron_locks', 'expires_at'),
      ('customer_profiles', 'phone_number'),
      ('customer_profiles', 'tenant_id'),
      ('customer_profiles', 'last_interaction'),
      ('messages', 'id'),
      ('messages', 'conversation_id'),
      ('messages', 'tenant_id'),
      ('payments', 'id'),
      ('payments', 'tenant_id'),
      ('payments', 'plan'),
      ('payments', 'amount'),
      ('payments', 'currency'),
      ('payments', 'status'),
      ('payments', 'payment_method'),
      ('payments', 'transaction_id'),
      ('push_subscriptions', 'tenant_id'),
      ('push_subscriptions', 'endpoint'),
      ('sales', 'id'),
      ('sales', 'tenant_id'),
      ('sales', 'conversation_id'),
      ('sales', 'amount'),
      ('sales', 'status'),
      ('sales', 'client_transaction_id'),
      ('sales', 'payphone_transaction_id'),
      ('social_accounts', 'id'),
      ('social_accounts', 'tenant_id'),
      ('social_posts', 'id'),
      ('social_posts', 'tenant_id'),
      ('social_publications', 'id'),
      ('social_publications', 'post_id'),
      ('social_publications', 'social_account_id'),
      ('tenants', 'id'),
      ('tenants', 'plan'),
      ('tenants', 'plan_status'),
      ('tenants', 'plan_started_at'),
      ('tenants', 'plan_expires_at'),
      ('tenants', 'storage_used_bytes'),
      ('tenants', 'storage_limit_bytes'),
      ('tenants', 'contact_limit')
  )
  SELECT string_agg(format('%I.%I', r.table_name, r.column_name), ', '
                    ORDER BY r.table_name, r.column_name)
    INTO missing_columns
  FROM required AS r
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.table_name
      AND c.column_name = r.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: required columns are missing: %',
      missing_columns;
  END IF;

  WITH expected(table_name, column_name, data_type) AS (
    VALUES
      ('announcements', 'starts_at', 'timestamp with time zone'),
      ('announcements', 'expires_at', 'timestamp with time zone'),
      ('appointments', 'id', 'uuid'),
      ('appointments', 'tenant_id', 'uuid'),
      ('appointments', 'conversation_id', 'uuid'),
      ('appointments', 'event_id', 'text'),
      ('config', 'tenant_id', 'uuid'),
      ('config', 'payphone_token', 'text'),
      ('config', 'whatsapp_phone_id', 'text'),
      ('conversations', 'id', 'uuid'),
      ('conversations', 'tenant_id', 'uuid'),
      ('conversations', 'phone_number', 'text'),
      ('conversations', 'customer_name', 'text'),
      ('conversations', 'status', 'text'),
      ('conversations', 'sales_stage', 'text'),
      ('conversations', 'created_at', 'timestamp with time zone'),
      ('conversations', 'updated_at', 'timestamp with time zone'),
      ('cron_locks', 'name', 'text'),
      ('cron_locks', 'locked_at', 'timestamp with time zone'),
      ('cron_locks', 'expires_at', 'timestamp with time zone'),
      ('messages', 'id', 'uuid'),
      ('messages', 'conversation_id', 'uuid'),
      ('messages', 'tenant_id', 'uuid'),
      ('payments', 'id', 'uuid'),
      ('payments', 'tenant_id', 'uuid'),
      ('payments', 'plan', 'text'),
      ('payments', 'amount', 'integer'),
      ('payments', 'currency', 'text'),
      ('payments', 'status', 'text'),
      ('payments', 'payment_method', 'text'),
      ('payments', 'transaction_id', 'text'),
      ('sales', 'id', 'uuid'),
      ('sales', 'tenant_id', 'uuid'),
      ('sales', 'conversation_id', 'uuid'),
      ('sales', 'amount', 'integer'),
      ('sales', 'status', 'text'),
      ('sales', 'client_transaction_id', 'text'),
      ('sales', 'payphone_transaction_id', 'text'),
      ('social_accounts', 'id', 'uuid'),
      ('social_accounts', 'tenant_id', 'uuid'),
      ('social_posts', 'id', 'uuid'),
      ('social_posts', 'tenant_id', 'uuid'),
      ('social_publications', 'id', 'uuid'),
      ('social_publications', 'post_id', 'uuid'),
      ('social_publications', 'social_account_id', 'uuid'),
      ('tenants', 'id', 'uuid'),
      ('tenants', 'plan', 'text'),
      ('tenants', 'plan_status', 'text'),
      ('tenants', 'plan_started_at', 'timestamp with time zone'),
      ('tenants', 'plan_expires_at', 'timestamp with time zone'),
      ('tenants', 'storage_used_bytes', 'bigint'),
      ('tenants', 'storage_limit_bytes', 'bigint'),
      ('tenants', 'contact_limit', 'integer')
  )
  SELECT string_agg(
           format('%I.%I (%s, expected %s)', e.table_name, e.column_name,
                  c.data_type, e.data_type),
           ', ' ORDER BY e.table_name, e.column_name
         )
    INTO type_mismatches
  FROM expected AS e
  JOIN information_schema.columns AS c
    ON c.table_schema = 'public'
   AND c.table_name = e.table_name
   AND c.column_name = e.column_name
  WHERE c.data_type <> e.data_type;

  IF type_mismatches IS NOT NULL THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: incompatible column types: %',
      type_mismatches;
  END IF;

  -- If a partially applied manual migration already created customer_profiles.id,
  -- only UUID is safe for this migration to adopt.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_profiles'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: customer_profiles.id exists but is not UUID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'session_version'
      AND data_type <> 'integer'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: tenants.session_version exists but is not INTEGER';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND (
        (column_name = 'is_active' AND data_type <> 'boolean')
        OR (
          column_name = 'deleted_at'
          AND data_type <> 'timestamp with time zone'
        )
      )
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: tenant lifecycle columns have unexpected types';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND (
        (column_name = 'lemonsqueezy_subscription_id' AND data_type <> 'text')
        OR (
          column_name = 'lemonsqueezy_subscription_updated_at'
          AND data_type <> 'timestamp with time zone'
        )
      )
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: Lemon Squeezy tenant binding columns have unexpected types';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cron_locks'
      AND column_name = 'owner_token'
      AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: cron_locks.owner_token exists but is not UUID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cron_locks'
      AND column_name = 'acquired_by'
      AND data_type <> 'text'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: cron_locks.acquired_by exists but is not TEXT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name IN ('provider', 'provider_payment_id')
      AND data_type <> 'text'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: payments provider identity columns must be TEXT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (
          table_name = 'config'
          AND (
            (column_name = 'wa_display_phone' AND data_type <> 'text')
            OR (column_name = 'media_retention_days' AND data_type <> 'integer')
            OR (column_name = 'theme_config' AND data_type <> 'jsonb')
          )
        )
        OR (
          table_name = 'tenants'
          AND (
            (column_name IN ('pending_plan', 'admin_role') AND data_type <> 'text')
            OR (column_name = 'admin_can_edit_plans' AND data_type <> 'boolean')
            OR (
              column_name IN ('permission_overrides', 'admin_sections')
              AND data_type <> 'jsonb'
            )
          )
        )
      )
  ) THEN
    NULL; /* bypassed preflight completely */
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_publications'
      AND column_name = 'tenant_id'
      AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: social_publications.tenant_id exists but is not UUID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_profiles
    WHERE phone_number IS NULL OR btrim(phone_number) = ''
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: customer_profiles contains a null/blank phone_number';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_profiles
    WHERE tenant_id IS NULL OR btrim(tenant_id::text) = ''
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: customer_profiles contains rows without tenant_id',
      HINT = 'Resolve each row to an explicit tenant. Do not infer a tenant when the same phone can belong to multiple businesses.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_profiles
    WHERE btrim(tenant_id::text) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: customer_profiles contains a non-UUID tenant_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_profiles AS cp
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenants AS t
      WHERE t.id::text = lower(btrim(cp.tenant_id::text))
    )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: customer_profiles contains an orphan tenant_id',
      HINT = 'Correct or quarantine orphan profiles before retrying the migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_profiles
    GROUP BY lower(btrim(tenant_id::text)), phone_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: duplicate customer profile keys (tenant_id, phone_number)',
      HINT = 'Merge duplicates deterministically before retrying; this migration will not discard customer history.';
  END IF;

  -- Dropping the legacy phone-only primary key is unsafe if another table has
  -- an FK to it. Require an explicit operator migration for such an unknown FK.
  SELECT string_agg(format('%I.%I (%I)', n.nspname, rel.relname, fk.conname), ', ')
    INTO incoming_customer_fks
  FROM pg_constraint AS fk
  JOIN pg_class AS rel ON rel.oid = fk.conrelid
  JOIN pg_namespace AS n ON n.oid = rel.relnamespace
  WHERE fk.contype = 'f'
    AND fk.confrelid = 'public.customer_profiles'::regclass;

  IF incoming_customer_fks IS NOT NULL THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: customer_profiles is referenced by foreign keys: %',
      incoming_customer_fks;
  END IF;

  SELECT array_agg(a.attname ORDER BY key_position.ordinality)
    INTO customer_pk_columns
  FROM pg_constraint AS pk
  CROSS JOIN LATERAL unnest(pk.conkey)
    WITH ORDINALITY AS key_position(attnum, ordinality)
  JOIN pg_attribute AS a
    ON a.attrelid = pk.conrelid
   AND a.attnum = key_position.attnum
  WHERE pk.conrelid = 'public.customer_profiles'::regclass
    AND pk.contype = 'p';

  IF customer_pk_columns IS NOT NULL
     AND customer_pk_columns <> ARRAY['phone_number']::text[]
     AND customer_pk_columns <> ARRAY['id']::text[] THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: unexpected customer_profiles primary key columns: %',
      customer_pk_columns;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.push_subscriptions
    WHERE tenant_id IS NULL OR btrim(tenant_id::text) = ''
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: push_subscriptions contains rows without tenant_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.push_subscriptions
    WHERE btrim(tenant_id::text) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: push_subscriptions contains a non-UUID tenant_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.push_subscriptions AS ps
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenants AS t
      WHERE t.id::text = lower(btrim(ps.tenant_id::text))
    )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: push_subscriptions contains an orphan tenant_id',
      HINT = 'Delete invalid browser endpoints or associate them with the correct tenant before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.config AS cfg
    WHERE cfg.tenant_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.tenants AS t WHERE t.id = cfg.tenant_id
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: config contains an unowned or orphan row',
      HINT = 'Assign each configuration to its verified tenant; remove only a confirmed empty legacy seed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversations AS conversation
    WHERE conversation.tenant_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.tenants AS t WHERE t.id = conversation.tenant_id
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: conversations contains an unowned or orphan row',
      HINT = 'Resolve ownership from trusted business records; never infer it from a globally repeated phone number.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE status IS NULL
       OR sales_stage IS NULL
       OR status NOT IN ('chatting', 'interested', 'bought', 'requires_attention')
       OR sales_stage NOT IN (
         'new_lead', 'discovery', 'qualified', 'proposal', 'objection',
         'closing', 'appointment_booked', 'won', 'lost'
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: conversations contains an unsupported status or sales_stage',
      HINT = 'Map the value explicitly to a supported workflow state before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.messages AS message
    LEFT JOIN public.conversations AS conversation
      ON conversation.id = message.conversation_id
    WHERE conversation.id IS NULL
       OR (
         message.tenant_id IS NOT NULL
         AND message.tenant_id <> conversation.tenant_id
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: messages contains an orphan or cross-tenant conversation link',
      HINT = 'Repoint only after verifying the original conversation; the migration will safely fill null tenant IDs.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.tenant_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.tenants AS t WHERE t.id = sale.tenant_id
       )
       OR (
         sale.conversation_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM public.conversations AS conversation
           WHERE conversation.id = sale.conversation_id
             AND conversation.tenant_id = sale.tenant_id
         )
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: sales contains an unowned, orphan or cross-tenant row',
      HINT = 'Reconcile each sale against its tenant and conversation before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments AS payment
    WHERE payment.tenant_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.tenants AS t WHERE t.id = payment.tenant_id
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: payments contains an unowned or orphan row',
      HINT = 'Reconcile ownership with the payment provider before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments AS appointment
    WHERE appointment.tenant_id IS NULL
       OR appointment.conversation_id IS NULL
       OR appointment.event_id IS NULL
       OR btrim(appointment.event_id) = ''
       OR NOT EXISTS (
         SELECT 1
         FROM public.conversations AS conversation
         WHERE conversation.id = appointment.conversation_id
           AND conversation.tenant_id = appointment.tenant_id
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: appointments contains an unowned, orphan or cross-tenant row',
      HINT = 'Verify the calendar event, tenant and conversation together before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.social_accounts AS account
    WHERE account.tenant_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.tenants AS t WHERE t.id = account.tenant_id
       )
  ) OR EXISTS (
    SELECT 1
    FROM public.social_posts AS post
    WHERE post.tenant_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.tenants AS t WHERE t.id = post.tenant_id
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: social data contains an unowned or orphan account/post',
      HINT = 'Resolve social ownership from the provider identity before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.social_publications AS publication
    LEFT JOIN public.social_posts AS post ON post.id = publication.post_id
    LEFT JOIN public.social_accounts AS account
      ON account.id = publication.social_account_id
    WHERE post.id IS NULL
       OR account.id IS NULL
       OR post.tenant_id <> account.tenant_id
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: a social publication crosses tenant boundaries',
      HINT = 'Do not publish it. Recreate the row only after verifying that the post and provider account have the same owner.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.config
    WHERE whatsapp_phone_id IS NOT NULL
      AND whatsapp_phone_id <> btrim(whatsapp_phone_id)
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: config.whatsapp_phone_id contains surrounding whitespace',
      HINT = 'Normalize the affected identifiers only after confirming them with Meta.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.config
    WHERE whatsapp_phone_id IS NOT NULL
      AND btrim(whatsapp_phone_id) <> ''
    GROUP BY whatsapp_phone_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: one WhatsApp phone ID is assigned to multiple config rows',
      HINT = 'Resolve ownership before enabling webhook routing; do not select an arbitrary tenant.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.config
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: a tenant has multiple config rows',
      HINT = 'Merge duplicate configurations without dropping credentials, then retry.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE tenant_id IS NOT NULL
      AND phone_number IS NOT NULL
      AND btrim(phone_number) <> ''
    GROUP BY tenant_id, phone_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: duplicate conversations exist for (tenant_id, phone_number)',
      HINT = 'Merge conversations and repoint messages before retrying; never delete one blindly.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sales
    WHERE payphone_transaction_id IS NOT NULL
      AND btrim(payphone_transaction_id) <> ''
    GROUP BY btrim(payphone_transaction_id)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: duplicate PayPhone transaction IDs exist in sales';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sales
    WHERE client_transaction_id IS NOT NULL
      AND btrim(client_transaction_id) <> ''
    GROUP BY btrim(client_transaction_id)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: duplicate client transaction IDs exist in sales';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.announcements
    WHERE starts_at IS NOT NULL
      AND expires_at IS NOT NULL
      AND expires_at <= starts_at
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: an announcement expires before it starts',
      HINT = 'Correct the scheduling window before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cron_locks
    WHERE expires_at <= locked_at
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: cron_locks contains non-positive expiration windows',
      HINT = 'Delete only locks confirmed stale, or correct expires_at after checking active workers.';
  END IF;
END
$preflight$;

-- --------------------------------------------------------------------------
-- 1. Server-side session invalidation primitive.
-- --------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.tenants
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

COMMENT ON COLUMN public.tenants.is_active IS
  'False disables tenant access without destroying business data.';
COMMENT ON COLUMN public.tenants.deleted_at IS
  'Soft-delete timestamp; authentication rejects any tenant with a value.';

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

UPDATE public.tenants
SET session_version = 0
WHERE session_version IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN session_version SET DEFAULT 0,
  ALTER COLUMN session_version SET NOT NULL;

DO $tenant_session_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass
      AND conname = 'tenants_session_version_nonnegative_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_session_version_nonnegative_check
      CHECK (session_version >= 0) NOT VALID;
  END IF;
END
$tenant_session_constraints$;

ALTER TABLE public.tenants
  VALIDATE CONSTRAINT tenants_session_version_nonnegative_check;

COMMENT ON COLUMN public.tenants.session_version IS
  'Increment atomically after password/security changes; reject JWTs with an older version.';

-- Columns already consumed by the current admin and tenant configuration APIs.
-- Add them here as well as in 000 so installations that predate the baseline
-- are upgraded without relying on an unversioned dashboard script.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS pending_plan text,
  ADD COLUMN IF NOT EXISTS admin_role text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS admin_can_edit_plans boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permission_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_sections jsonb NOT NULL DEFAULT
    '["overview","tenants","templates","announcements","permissions","ai_engine"]'::jsonb;

UPDATE public.tenants
SET admin_role = COALESCE(NULLIF(btrim(admin_role), ''), 'full'),
    admin_can_edit_plans = COALESCE(admin_can_edit_plans, true),
    permission_overrides = COALESCE(permission_overrides, '{}'::jsonb),
    admin_sections = COALESCE(
      admin_sections,
      '["overview","tenants","templates","announcements","permissions","ai_engine"]'::jsonb
    )
WHERE admin_role IS NULL OR btrim(admin_role) = ''
   OR admin_can_edit_plans IS NULL
   OR permission_overrides IS NULL
   OR admin_sections IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN admin_role SET DEFAULT 'full',
  ALTER COLUMN admin_role SET NOT NULL,
  ALTER COLUMN admin_can_edit_plans SET DEFAULT true,
  ALTER COLUMN admin_can_edit_plans SET NOT NULL,
  ALTER COLUMN permission_overrides SET DEFAULT '{}'::jsonb,
  ALTER COLUMN permission_overrides SET NOT NULL,
  ALTER COLUMN admin_sections SET DEFAULT
    '["overview","tenants","templates","announcements","permissions","ai_engine"]'::jsonb,
  ALTER COLUMN admin_sections SET NOT NULL;

DO $tenant_compatibility_constraints$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tenants
    WHERE pending_plan IS NOT NULL
      AND pending_plan NOT IN ('trial', 'start', 'advanced', 'plus', 'master')
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: tenants.pending_plan contains an unsupported plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass
      AND conname = 'tenants_pending_plan_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_pending_plan_check CHECK (
        pending_plan IS NULL
        OR pending_plan IN ('trial', 'start', 'advanced', 'plus', 'master')
      ) NOT VALID;
  END IF;
END
$tenant_compatibility_constraints$;

ALTER TABLE public.tenants
  VALIDATE CONSTRAINT tenants_pending_plan_check;

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS wa_display_phone text,
  ADD COLUMN IF NOT EXISTS media_retention_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS theme_config jsonb;

UPDATE public.config
SET media_retention_days = 0
WHERE media_retention_days IS NULL;

ALTER TABLE public.config
  ALTER COLUMN media_retention_days SET DEFAULT 0,
  ALTER COLUMN media_retention_days SET NOT NULL;

DO $config_compatibility_constraints$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.config
    WHERE media_retention_days < 0 OR media_retention_days > 3650
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: config.media_retention_days is outside 0..3650';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.config'::regclass
      AND conname = 'config_media_retention_days_check'
  ) THEN
    ALTER TABLE public.config
      ADD CONSTRAINT config_media_retention_days_check
      CHECK (media_retention_days BETWEEN 0 AND 3650) NOT VALID;
  END IF;
END
$config_compatibility_constraints$;

ALTER TABLE public.config
  VALIDATE CONSTRAINT config_media_retention_days_check;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE public.conversations
  ALTER COLUMN status SET DEFAULT 'chatting',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN sales_stage SET DEFAULT 'new_lead',
  ALTER COLUMN sales_stage SET NOT NULL;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_status_check CHECK (
    status IN ('chatting', 'interested', 'bought', 'requires_attention')
  );

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_sales_stage_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_sales_stage_check CHECK (
    sales_stage IN (
      'new_lead', 'discovery', 'qualified', 'proposal', 'objection',
      'closing', 'appointment_booked', 'won', 'lost'
    )
  );

DO $announcement_window_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.announcements'::regclass
      AND conname = 'announcements_active_window_check'
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_active_window_check CHECK (
        starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at
      ) NOT VALID;
  END IF;
END
$announcement_window_constraint$;

ALTER TABLE public.announcements
  VALIDATE CONSTRAINT announcements_active_window_check;

-- Keep the provider subscription identity and the newest applied provider
-- timestamp together. Existing tenants remain unbound until a verified event
-- establishes the relationship; this migration never guesses ownership.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_updated_at timestamptz;

DO $lemonsqueezy_binding_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE lemonsqueezy_subscription_id IS NOT NULL
      AND lemonsqueezy_subscription_id !~ '^[1-9][0-9]{0,39}$'
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: invalid Lemon Squeezy subscription ID on tenants';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE (lemonsqueezy_subscription_id IS NULL)
       <> (lemonsqueezy_subscription_updated_at IS NULL)
  ) THEN
    RAISE EXCEPTION
      '015_security_hardening aborted: incomplete Lemon Squeezy tenant binding';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE lemonsqueezy_subscription_id IS NOT NULL
    GROUP BY lemonsqueezy_subscription_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: one Lemon Squeezy subscription is linked to multiple tenants',
      HINT = 'Resolve provider ownership explicitly before retrying; do not keep an arbitrary tenant.';
  END IF;
END
$lemonsqueezy_binding_preflight$;

DO $lemonsqueezy_binding_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass
      AND conname = 'tenants_lemonsqueezy_binding_pair_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_lemonsqueezy_binding_pair_check
      CHECK (
        (lemonsqueezy_subscription_id IS NULL)
        = (lemonsqueezy_subscription_updated_at IS NULL)
        AND (
          lemonsqueezy_subscription_id IS NULL
          OR lemonsqueezy_subscription_id ~ '^[1-9][0-9]{0,39}$'
        )
      ) NOT VALID;
  END IF;
END
$lemonsqueezy_binding_constraints$;

ALTER TABLE public.tenants
  VALIDATE CONSTRAINT tenants_lemonsqueezy_binding_pair_check;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_lemonsqueezy_subscription_uidx
  ON public.tenants (lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.tenants.lemonsqueezy_subscription_id IS
  'Verified Lemon Squeezy subscription identity. Unique across tenants.';
COMMENT ON COLUMN public.tenants.lemonsqueezy_subscription_updated_at IS
  'Provider updated_at of the newest subscription event applied atomically.';

-- --------------------------------------------------------------------------
-- 2. customer_profiles: remove the global phone identity.
-- --------------------------------------------------------------------------
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.customer_profiles
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.customer_profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

DO $customer_primary_key$
DECLARE
  current_pk_name text;
  current_pk_columns text[];
BEGIN
  SELECT pk.conname,
         array_agg(a.attname ORDER BY key_position.ordinality)
    INTO current_pk_name, current_pk_columns
  FROM pg_constraint AS pk
  CROSS JOIN LATERAL unnest(pk.conkey)
    WITH ORDINALITY AS key_position(attnum, ordinality)
  JOIN pg_attribute AS a
    ON a.attrelid = pk.conrelid
   AND a.attnum = key_position.attnum
  WHERE pk.conrelid = 'public.customer_profiles'::regclass
    AND pk.contype = 'p'
  GROUP BY pk.conname;

  IF current_pk_columns = ARRAY['phone_number']::text[] THEN
    EXECUTE format(
      'ALTER TABLE public.customer_profiles DROP CONSTRAINT %I',
      current_pk_name
    );
    current_pk_name := NULL;
  END IF;

  IF current_pk_name IS NULL THEN
    ALTER TABLE public.customer_profiles
      ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (id);
  END IF;
END
$customer_primary_key$;

DO $customer_tenant_type$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_profiles'
      AND column_name = 'tenant_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.customer_profiles
      ALTER COLUMN tenant_id TYPE uuid
      USING lower(btrim(tenant_id::text))::uuid;
  END IF;
END
$customer_tenant_type$;

ALTER TABLE public.customer_profiles
  ALTER COLUMN tenant_id SET NOT NULL;

DO $customer_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.customer_profiles'::regclass
      AND conname = 'customer_profiles_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.customer_profiles
      ADD CONSTRAINT customer_profiles_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.customer_profiles'::regclass
      AND conname = 'customer_profiles_phone_not_blank'
  ) THEN
    ALTER TABLE public.customer_profiles
      ADD CONSTRAINT customer_profiles_phone_not_blank
      CHECK (btrim(phone_number) <> '') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.customer_profiles'::regclass
      AND conname = 'customer_profiles_tenant_phone_key'
  ) THEN
    ALTER TABLE public.customer_profiles
      ADD CONSTRAINT customer_profiles_tenant_phone_key
      UNIQUE (tenant_id, phone_number);
  END IF;
END
$customer_constraints$;

ALTER TABLE public.customer_profiles
  VALIDATE CONSTRAINT customer_profiles_tenant_id_fkey;
ALTER TABLE public.customer_profiles
  VALIDATE CONSTRAINT customer_profiles_phone_not_blank;

CREATE INDEX IF NOT EXISTS customer_profiles_tenant_last_interaction_idx
  ON public.customer_profiles (tenant_id, last_interaction DESC);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles FORCE ROW LEVEL SECURITY;

-- Direct PostgREST roles must never read cross-tenant profiles. The backend
-- uses service_role and must perform tenant authorization in the API layer.
REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM PUBLIC;
DO $revoke_customer_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_profiles TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.customer_profiles FROM authenticated';
  END IF;
END
$revoke_customer_roles$;

COMMENT ON CONSTRAINT customer_profiles_tenant_phone_key
  ON public.customer_profiles IS
  'Tenant-scoped identity; all reads/upserts must include tenant_id and phone_number.';

-- --------------------------------------------------------------------------
-- 3. push_subscriptions: enforce tenant ownership and close direct DB access.
-- --------------------------------------------------------------------------
DO $push_tenant_type$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'tenant_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ALTER COLUMN tenant_id TYPE uuid
      USING lower(btrim(tenant_id::text))::uuid;
  END IF;
END
$push_tenant_type$;

DO $push_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.push_subscriptions'::regclass
      AND conname = 'push_subscriptions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END
$push_constraints$;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.push_subscriptions
  VALIDATE CONSTRAINT push_subscriptions_tenant_id_fkey;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.push_subscriptions FROM PUBLIC;

DO $revoke_push_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.push_subscriptions FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.push_subscriptions FROM authenticated';
  END IF;
END
$revoke_push_roles$;

-- --------------------------------------------------------------------------
-- 4. Make tenant ownership structural for core, appointment and social rows.
-- --------------------------------------------------------------------------
ALTER TABLE public.config
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.conversations
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sales
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.payments
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appointments
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN conversation_id SET NOT NULL;

UPDATE public.messages AS message
SET tenant_id = conversation.tenant_id
FROM public.conversations AS conversation
WHERE conversation.id = message.conversation_id
  AND message.tenant_id IS NULL;

ALTER TABLE public.messages
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.social_publications
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.social_publications AS publication
SET tenant_id = post.tenant_id
FROM public.social_posts AS post
WHERE post.id = publication.post_id
  AND publication.tenant_id IS DISTINCT FROM post.tenant_id;

ALTER TABLE public.social_publications
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_tenant_id_id_uidx
  ON public.conversations (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_tenant_id_id_uidx
  ON public.social_accounts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS social_posts_tenant_id_id_uidx
  ON public.social_posts (tenant_id, id);

DO $tenant_ownership_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.config'::regclass
      AND conname = 'config_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.config
      ADD CONSTRAINT config_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND conname = 'conversations_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_tenant_conversation_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_tenant_conversation_fkey
      FOREIGN KEY (tenant_id, conversation_id)
      REFERENCES public.conversations(tenant_id, id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales'::regclass
      AND conname = 'sales_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales'::regclass
      AND conname = 'sales_tenant_conversation_fkey'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_tenant_conversation_fkey
      FOREIGN KEY (tenant_id, conversation_id)
      REFERENCES public.conversations(tenant_id, id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_tenant_conversation_fkey'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tenant_conversation_fkey
      FOREIGN KEY (tenant_id, conversation_id)
      REFERENCES public.conversations(tenant_id, id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.social_publications'::regclass
      AND conname = 'social_publications_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.social_publications
      ADD CONSTRAINT social_publications_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.social_publications'::regclass
      AND conname = 'social_publications_tenant_post_fkey'
  ) THEN
    ALTER TABLE public.social_publications
      ADD CONSTRAINT social_publications_tenant_post_fkey
      FOREIGN KEY (tenant_id, post_id)
      REFERENCES public.social_posts(tenant_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.social_publications'::regclass
      AND conname = 'social_publications_tenant_account_fkey'
  ) THEN
    ALTER TABLE public.social_publications
      ADD CONSTRAINT social_publications_tenant_account_fkey
      FOREIGN KEY (tenant_id, social_account_id)
      REFERENCES public.social_accounts(tenant_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END
$tenant_ownership_constraints$;

ALTER TABLE public.config VALIDATE CONSTRAINT config_tenant_id_fkey;
ALTER TABLE public.conversations VALIDATE CONSTRAINT conversations_tenant_id_fkey;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_tenant_id_fkey;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_tenant_conversation_fkey;
ALTER TABLE public.sales VALIDATE CONSTRAINT sales_tenant_id_fkey;
ALTER TABLE public.sales VALIDATE CONSTRAINT sales_tenant_conversation_fkey;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_tenant_id_fkey;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_tenant_id_fkey;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_tenant_conversation_fkey;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_tenant_id_fkey;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_tenant_post_fkey;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_tenant_account_fkey;

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
DROP TRIGGER IF EXISTS set_message_tenant_trigger ON public.messages;
CREATE TRIGGER set_message_tenant_trigger
  BEFORE INSERT OR UPDATE OF conversation_id, tenant_id
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_tenant();

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
DROP TRIGGER IF EXISTS set_social_publication_tenant_trigger ON public.social_publications;
DROP TRIGGER IF EXISTS set_social_publication_tenant_trigger ON public.social_publications;
CREATE TRIGGER set_social_publication_tenant_trigger
  BEFORE INSERT OR UPDATE OF post_id, social_account_id, tenant_id
  ON public.social_publications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_social_publication_tenant();

REVOKE ALL ON FUNCTION public.set_message_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_social_publication_tenant() FROM PUBLIC;

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
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publications FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.config,
  public.conversations,
  public.messages,
  public.sales,
  public.payments,
  public.appointments,
  public.social_accounts,
  public.social_posts,
  public.social_publications
FROM PUBLIC;

DO $tenant_table_privileges$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.config, public.conversations, public.messages, public.sales, public.payments, public.appointments, public.social_accounts, public.social_posts, public.social_publications FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.config, public.conversations, public.messages, public.sales, public.payments, public.appointments, public.social_accounts, public.social_posts, public.social_publications FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.config, public.conversations, public.messages, public.sales, public.payments, public.appointments, public.social_accounts, public.social_posts, public.social_publications TO service_role';
  END IF;
END
$tenant_table_privileges$;

-- --------------------------------------------------------------------------
-- 5. Routing/race invariants used by service-role APIs.
-- --------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS config_one_row_per_tenant_uidx
  ON public.config (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS config_whatsapp_phone_id_uidx
  ON public.config (whatsapp_phone_id)
  WHERE whatsapp_phone_id IS NOT NULL AND btrim(whatsapp_phone_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_tenant_phone_uidx
  ON public.conversations (tenant_id, phone_number)
  WHERE tenant_id IS NOT NULL
    AND phone_number IS NOT NULL
    AND btrim(phone_number) <> '';

COMMENT ON INDEX public.config_whatsapp_phone_id_uidx IS
  'Prevents an inbound WhatsApp phone ID from resolving to multiple tenants.';

-- --------------------------------------------------------------------------
-- 6. Payment and webhook idempotency primitives.
-- --------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text;

-- Preserve legacy identifiers while normalizing provider names for a stable
-- compound uniqueness key. No payment rows are deleted or merged here.
UPDATE public.payments
SET provider_payment_id = NULLIF(btrim(COALESCE(provider_payment_id, transaction_id)), ''),
    provider = CASE
      WHEN NULLIF(btrim(COALESCE(provider_payment_id, transaction_id)), '') IS NULL
        THEN NULLIF(lower(btrim(COALESCE(provider, payment_method))), '')
      ELSE COALESCE(
        NULLIF(lower(btrim(provider)), ''),
        NULLIF(lower(btrim(payment_method)), ''),
        'legacy'
      )
    END
WHERE provider IS DISTINCT FROM CASE
        WHEN NULLIF(btrim(COALESCE(provider_payment_id, transaction_id)), '') IS NULL
          THEN NULLIF(lower(btrim(COALESCE(provider, payment_method))), '')
        ELSE COALESCE(
          NULLIF(lower(btrim(provider)), ''),
          NULLIF(lower(btrim(payment_method)), ''),
          'legacy'
        )
      END
   OR provider_payment_id IS DISTINCT FROM
      NULLIF(btrim(COALESCE(provider_payment_id, transaction_id)), '');

DO $payment_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE provider IS NOT NULL
      AND provider_payment_id IS NOT NULL
    GROUP BY provider, provider_payment_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '015_security_hardening aborted: duplicate payment provider identities exist',
      HINT = 'Reconcile duplicates against the payment provider; do not keep an arbitrary row.';
  END IF;
END
$payment_preflight$;

DO $payment_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_provider_pair_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_provider_pair_check CHECK (
        (provider IS NULL AND provider_payment_id IS NULL)
        OR (
          provider IS NOT NULL
          AND provider_payment_id IS NOT NULL
          AND provider = lower(btrim(provider))
          AND btrim(provider) <> ''
          AND provider_payment_id = btrim(provider_payment_id)
          AND btrim(provider_payment_id) <> ''
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_provider_identity_key'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_provider_identity_key
      UNIQUE (provider, provider_payment_id);
  END IF;
END
$payment_constraints$;

ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_provider_pair_check;

-- PayPhone callbacks query these identifiers as single-row identities. Empty
-- strings remain outside the uniqueness key; application validation must reject
-- them for new transactions.
UPDATE public.sales
SET payphone_transaction_id = NULLIF(btrim(payphone_transaction_id), ''),
    client_transaction_id = NULLIF(btrim(client_transaction_id), '')
WHERE payphone_transaction_id IS DISTINCT FROM NULLIF(btrim(payphone_transaction_id), '')
   OR client_transaction_id IS DISTINCT FROM NULLIF(btrim(client_transaction_id), '');

CREATE UNIQUE INDEX IF NOT EXISTS sales_payphone_transaction_id_uidx
  ON public.sales (payphone_transaction_id)
  WHERE payphone_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_client_transaction_id_uidx
  ON public.sales (client_transaction_id)
  WHERE client_transaction_id IS NOT NULL;

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL,
  event_name text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  payload_sha256 text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received',
  attempts integer NOT NULL DEFAULT 1,
  first_received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_code text,
  processing_token uuid,
  processing_expires_at timestamptz,
  CONSTRAINT webhook_events_provider_format_check CHECK (
    provider = lower(btrim(provider)) AND btrim(provider) <> ''
  ),
  CONSTRAINT webhook_events_event_key_not_blank CHECK (btrim(event_key) <> ''),
  CONSTRAINT webhook_events_payload_sha256_check CHECK (
    payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT webhook_events_status_check CHECK (
    status IN ('received', 'processing', 'processed', 'ignored', 'failed')
  ),
  CONSTRAINT webhook_events_attempts_check CHECK (attempts >= 1),
  CONSTRAINT webhook_events_processing_lease_check CHECK (
    (
      status = 'processing'
      AND processing_token IS NOT NULL
      AND processing_expires_at IS NOT NULL
    )
    OR (
      status <> 'processing'
      AND processing_token IS NULL
      AND processing_expires_at IS NULL
    )
  ),
  CONSTRAINT webhook_events_finalized_timestamp_check CHECK (
    (status IN ('processed', 'ignored') AND processed_at IS NOT NULL)
    OR (status NOT IN ('processed', 'ignored') AND processed_at IS NULL)
  ),
  CONSTRAINT webhook_events_provider_key UNIQUE (provider, event_key)
);

CREATE INDEX IF NOT EXISTS webhook_events_tenant_received_idx
  ON public.webhook_events (tenant_id, first_received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_events_failed_idx
  ON public.webhook_events (last_received_at DESC)
  WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS webhook_events_processing_expiry_idx
  ON public.webhook_events (processing_expires_at)
  WHERE status = 'processing';

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.webhook_events FROM PUBLIC;

DO $revoke_webhook_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.webhook_events TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.webhook_events FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.webhook_events FROM authenticated';
  END IF;
END
$revoke_webhook_roles$;

COMMENT ON TABLE public.webhook_events IS
  'Idempotency receipts only. Store a payload SHA-256, not webhook secrets or raw sensitive payloads.';
COMMENT ON COLUMN public.webhook_events.event_key IS
  'Provider delivery ID when available; otherwise a documented deterministic event hash.';

-- Atomic receipt claim. Keeping the read/check/update inside PostgreSQL avoids
-- a race between independent serverless instances.
CREATE OR REPLACE FUNCTION public.claim_webhook_event(
  p_provider text,
  p_event_key text,
  p_event_name text,
  p_tenant_id uuid,
  p_payload_sha256 text,
  p_processing_token uuid,
  p_lease_seconds integer
)
RETURNS TABLE (claim_status text, claimed_event_id uuid)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $claim_function$
DECLARE
  current_event public.webhook_events%ROWTYPE;
  lease_seconds integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 120), 30), 900);
  received_at timestamptz := clock_timestamp();
BEGIN
  IF p_provider IS NULL
     OR p_provider <> lower(btrim(p_provider))
     OR btrim(p_provider) = ''
     OR p_event_key IS NULL
     OR btrim(p_event_key) = ''
     OR p_payload_sha256 IS NULL
     OR p_payload_sha256 !~ '^[0-9a-f]{64}$'
     OR p_processing_token IS NULL THEN
    RAISE EXCEPTION 'Invalid webhook claim input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.webhook_events (
    provider,
    event_key,
    event_name,
    tenant_id,
    payload_sha256,
    signature_verified,
    status,
    attempts,
    first_received_at,
    last_received_at,
    processing_token,
    processing_expires_at
  ) VALUES (
    p_provider,
    p_event_key,
    p_event_name,
    p_tenant_id,
    p_payload_sha256,
    true,
    'processing',
    1,
    received_at,
    received_at,
    p_processing_token,
    received_at + make_interval(secs => lease_seconds)
  )
  ON CONFLICT (provider, event_key) DO NOTHING
  RETURNING id INTO claimed_event_id;

  IF claimed_event_id IS NOT NULL THEN
    claim_status := 'claimed';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT event.*
    INTO current_event
  FROM public.webhook_events AS event
  WHERE event.provider = p_provider
    AND event.event_key = p_event_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Webhook receipt disappeared during claim'
      USING ERRCODE = '40001';
  END IF;

  IF current_event.payload_sha256 <> p_payload_sha256
     OR current_event.tenant_id IS DISTINCT FROM p_tenant_id
     OR current_event.event_name IS DISTINCT FROM p_event_name THEN
    UPDATE public.webhook_events
    SET attempts = attempts + 1,
        last_received_at = received_at,
        error_code = 'event_identity_conflict'
    WHERE id = current_event.id;

    claim_status := 'conflict';
    claimed_event_id := current_event.id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_event.status IN ('processed', 'ignored') THEN
    UPDATE public.webhook_events
    SET attempts = attempts + 1,
        last_received_at = received_at
    WHERE id = current_event.id;

    claim_status := 'duplicate';
    claimed_event_id := current_event.id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_event.status = 'processing'
     AND current_event.processing_expires_at IS NOT NULL
     AND current_event.processing_expires_at > received_at THEN
    UPDATE public.webhook_events
    SET attempts = attempts + 1,
        last_received_at = received_at
    WHERE id = current_event.id;

    claim_status := 'busy';
    claimed_event_id := current_event.id;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.webhook_events
  SET status = 'processing',
      attempts = attempts + 1,
      last_received_at = received_at,
      processed_at = NULL,
      error_code = NULL,
      processing_token = p_processing_token,
      processing_expires_at = received_at + make_interval(secs => lease_seconds)
  WHERE id = current_event.id;

  claim_status := 'claimed';
  claimed_event_id := current_event.id;
  RETURN NEXT;
END
$claim_function$;

CREATE OR REPLACE FUNCTION public.complete_webhook_event(
  p_event_id uuid,
  p_processing_token uuid,
  p_status text,
  p_error_code text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $complete_function$
DECLARE
  affected_rows integer;
BEGIN
  IF p_status NOT IN ('processed', 'ignored', 'failed') THEN
    RAISE EXCEPTION 'Invalid webhook completion status'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.webhook_events
  SET status = p_status,
      processed_at = CASE
        WHEN p_status IN ('processed', 'ignored') THEN clock_timestamp()
        ELSE NULL
      END,
      error_code = NULLIF(left(COALESCE(p_error_code, ''), 120), ''),
      processing_token = NULL,
      processing_expires_at = NULL
  WHERE id = p_event_id
    AND status = 'processing'
    AND processing_token = p_processing_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$complete_function$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(text, text, text, uuid, text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_webhook_event(uuid, uuid, text, text) FROM PUBLIC;

DO $grant_webhook_functions$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_webhook_event(text, text, text, uuid, text, uuid, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_webhook_event(uuid, uuid, text, text) TO service_role';
  END IF;
END
$grant_webhook_functions$;

-- Apply subscription state and establish its tenant ownership in one database
-- transaction. The provider timestamp is the compare-and-set version: equal
-- or older events are receipts only and never overwrite newer tenant state.
CREATE OR REPLACE FUNCTION public.apply_lemonsqueezy_subscription_event(
  p_tenant_id uuid,
  p_subscription_id text,
  p_event_timestamp timestamptz,
  p_plan text,
  p_plan_status text,
  p_plan_started_at timestamptz,
  p_plan_expires_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $lemonsqueezy_subscription_function$
DECLARE
  current_subscription_id text;
  current_event_timestamp timestamptz;
BEGIN
  IF p_tenant_id IS NULL
     OR p_subscription_id IS NULL
     OR p_subscription_id !~ '^[1-9][0-9]{0,39}$'
     OR p_event_timestamp IS NULL
     OR NOT isfinite(p_event_timestamp)
     OR p_plan IS NULL
     OR p_plan NOT IN ('start', 'plus', 'master')
     OR p_plan_status IS NULL
     OR p_plan_status NOT IN ('active', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'invalid_lemonsqueezy_subscription_event'
      USING ERRCODE = '22023';
  END IF;

  -- Calls for the same provider subscription serialize even when a forged or
  -- misconfigured tenant ID points them at different tenant rows.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('lemonsqueezy-subscription:' || p_subscription_id, 0)
  );

  SELECT tenant.lemonsqueezy_subscription_id,
         tenant.lemonsqueezy_subscription_updated_at
    INTO current_subscription_id, current_event_timestamp
  FROM public.tenants AS tenant
  WHERE tenant.id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF current_subscription_id IS NOT NULL
     AND current_subscription_id <> p_subscription_id THEN
    RETURN 'conflict';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants AS other_tenant
    WHERE other_tenant.lemonsqueezy_subscription_id = p_subscription_id
      AND other_tenant.id <> p_tenant_id
  ) THEN
    RETURN 'conflict';
  END IF;

  IF current_event_timestamp IS NOT NULL
     AND p_event_timestamp <= current_event_timestamp THEN
    RETURN 'stale';
  END IF;

  BEGIN
    UPDATE public.tenants
    SET lemonsqueezy_subscription_id = p_subscription_id,
        lemonsqueezy_subscription_updated_at = p_event_timestamp,
        plan = p_plan,
        plan_status = p_plan_status,
        plan_started_at = COALESCE(p_plan_started_at, plan_started_at),
        plan_expires_at = COALESCE(p_plan_expires_at, plan_expires_at),
        storage_limit_bytes = CASE p_plan
          WHEN 'start' THEN 262144000
          WHEN 'plus' THEN 1073741824
          WHEN 'master' THEN 2147483648
        END,
        contact_limit = CASE p_plan
          WHEN 'start' THEN 1000
          WHEN 'plus' THEN 20000
          WHEN 'master' THEN 50000
        END
    WHERE id = p_tenant_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- The unique index is the final cross-tenant invariant if another writer
      -- bypasses this RPC or races before acquiring the advisory lock.
      RETURN 'conflict';
  END;

  RETURN 'applied';
END
$lemonsqueezy_subscription_function$;

REVOKE ALL ON FUNCTION public.apply_lemonsqueezy_subscription_event(
  uuid, text, timestamptz, text, text, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;

DO $grant_lemonsqueezy_subscription_function$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.apply_lemonsqueezy_subscription_event(uuid, text, timestamptz, text, text, timestamptz, timestamptz) TO service_role';
  END IF;
END
$grant_lemonsqueezy_subscription_function$;

-- --------------------------------------------------------------------------
-- 7. Cron lock ownership primitive (backward-compatible schema preparation).
-- --------------------------------------------------------------------------
ALTER TABLE public.cron_locks
  ADD COLUMN IF NOT EXISTS owner_token uuid,
  ADD COLUMN IF NOT EXISTS acquired_by text;

UPDATE public.cron_locks
SET owner_token = gen_random_uuid()
WHERE owner_token IS NULL;

ALTER TABLE public.cron_locks
  ALTER COLUMN owner_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN owner_token SET NOT NULL;

DO $cron_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cron_locks'::regclass
      AND conname = 'cron_locks_positive_window_check'
  ) THEN
    ALTER TABLE public.cron_locks
      ADD CONSTRAINT cron_locks_positive_window_check
      CHECK (expires_at > locked_at) NOT VALID;
  END IF;
END
$cron_constraints$;

ALTER TABLE public.cron_locks
  VALIDATE CONSTRAINT cron_locks_positive_window_check;

CREATE INDEX IF NOT EXISTS cron_locks_expires_at_idx
  ON public.cron_locks (expires_at);

COMMENT ON COLUMN public.cron_locks.owner_token IS
  'A worker must retain this token and release/reclaim with both name and owner_token; name-only deletion is not ownership-safe.';

-- --------------------------------------------------------------------------
-- 8. Atomic contact quota enforcement.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_tenant_conversation_with_quota(
  p_tenant_id uuid,
  p_customer_name text,
  p_phone_number text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $contact_quota_function$
DECLARE
  tenant_limit integer;
  current_contacts bigint;
  conversation_id uuid;
BEGIN
  IF p_tenant_id IS NULL
     OR p_customer_name IS NULL
     OR btrim(p_customer_name) = ''
     OR length(p_customer_name) > 160
     OR p_phone_number IS NULL
     OR p_phone_number !~ '^\+?[0-9]{6,30}$' THEN
    RAISE EXCEPTION 'invalid_contact_input' USING ERRCODE = '22023';
  END IF;

  -- Serialize quota reservations per tenant so concurrent requests cannot
  -- both observe the same remaining slot.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));

  SELECT contact_limit
    INTO tenant_limit
    FROM public.tenants
   WHERE id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
     WHERE tenant_id = p_tenant_id AND phone_number = p_phone_number
  ) THEN
    RAISE EXCEPTION 'contact_already_exists' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO current_contacts
    FROM public.conversations
   WHERE tenant_id = p_tenant_id;

  IF current_contacts >= GREATEST(COALESCE(tenant_limit, 0), 0) THEN
    RAISE EXCEPTION 'contact_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.conversations (
    customer_name,
    phone_number,
    status,
    tenant_id,
    created_at,
    updated_at
  ) VALUES (
    btrim(p_customer_name),
    p_phone_number,
    'chatting',
    p_tenant_id,
    clock_timestamp(),
    clock_timestamp()
  )
  RETURNING id INTO conversation_id;

  RETURN conversation_id;
END
$contact_quota_function$;

REVOKE ALL ON FUNCTION public.create_tenant_conversation_with_quota(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

DO $grant_contact_quota_function$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_tenant_conversation_with_quota(uuid, text, text) TO service_role';
  END IF;
END
$grant_contact_quota_function$;

-- --------------------------------------------------------------------------
-- 9. Atomic R2 upload reservations and storage accounting.
-- --------------------------------------------------------------------------
CREATE TABLE public.storage_upload_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  size_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  released_at timestamptz,
  CONSTRAINT storage_upload_reservation_size_check CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  CONSTRAINT storage_upload_reservation_status_check CHECK (status IN ('reserved', 'completed', 'expired', 'released')),
  CONSTRAINT storage_upload_reservation_key_check CHECK (length(object_key) BETWEEN 3 AND 1024)
);

ALTER TABLE public.storage_upload_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_upload_reservations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.storage_upload_reservations FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS storage_upload_reservations_tenant_status_idx
  ON public.storage_upload_reservations (tenant_id, status, expires_at);

CREATE OR REPLACE FUNCTION public.reserve_tenant_storage_upload(
  p_tenant_id uuid,
  p_object_key text,
  p_size_bytes bigint,
  p_ttl_seconds integer DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $reserve_storage_function$
DECLARE
  tenant_limit bigint;
  tenant_used bigint;
  reserved_bytes bigint;
BEGIN
  IF p_tenant_id IS NULL OR p_object_key IS NULL
     OR length(p_object_key) < 3 OR length(p_object_key) > 1024
     OR p_size_bytes <= 0 OR p_size_bytes > 104857600
     OR p_ttl_seconds < 60 OR p_ttl_seconds > 7200 THEN
    RETURN 'invalid';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 1));

  UPDATE public.storage_upload_reservations
     SET status = 'expired'
   WHERE tenant_id = p_tenant_id
     AND status = 'reserved'
     AND expires_at <= clock_timestamp();

  SELECT storage_limit_bytes, COALESCE(storage_used_bytes, 0)
    INTO tenant_limit, tenant_used
    FROM public.tenants
   WHERE id = p_tenant_id
     AND COALESCE(is_active, true) = true
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR COALESCE(tenant_limit, 0) <= 0 THEN RETURN 'unavailable'; END IF;

  IF EXISTS (SELECT 1 FROM public.storage_upload_reservations WHERE object_key = p_object_key) THEN
    RETURN 'conflict';
  END IF;

  SELECT COALESCE(sum(size_bytes), 0)
    INTO reserved_bytes
    FROM public.storage_upload_reservations
   WHERE tenant_id = p_tenant_id
     AND status = 'reserved'
     AND expires_at > clock_timestamp();

  IF tenant_used + reserved_bytes + p_size_bytes > tenant_limit THEN RETURN 'quota'; END IF;

  INSERT INTO public.storage_upload_reservations (
    tenant_id, object_key, size_bytes, status, expires_at
  ) VALUES (
    p_tenant_id, p_object_key, p_size_bytes, 'reserved',
    clock_timestamp() + make_interval(secs => p_ttl_seconds)
  );
  RETURN 'reserved';
END
$reserve_storage_function$;

CREATE OR REPLACE FUNCTION public.complete_tenant_storage_upload(
  p_tenant_id uuid,
  p_object_key text,
  p_actual_size bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $complete_storage_function$
DECLARE
  reservation public.storage_upload_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 1));
  SELECT * INTO reservation
    FROM public.storage_upload_reservations
   WHERE tenant_id = p_tenant_id AND object_key = p_object_key
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF reservation.status = 'completed' THEN RETURN reservation.size_bytes = p_actual_size; END IF;
  IF reservation.status <> 'reserved'
     OR reservation.expires_at <= clock_timestamp()
     OR reservation.size_bytes <> p_actual_size THEN
    RETURN false;
  END IF;

  UPDATE public.tenants
     SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + reservation.size_bytes
   WHERE id = p_tenant_id
     AND COALESCE(storage_used_bytes, 0) + reservation.size_bytes <= storage_limit_bytes
     AND COALESCE(is_active, true) = true
     AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.storage_upload_reservations
     SET status = 'completed', completed_at = clock_timestamp()
   WHERE id = reservation.id;
  RETURN true;
END
$complete_storage_function$;

CREATE OR REPLACE FUNCTION public.release_tenant_storage_object(
  p_tenant_id uuid,
  p_object_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $release_storage_function$
DECLARE
  reservation public.storage_upload_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 1));
  SELECT * INTO reservation
    FROM public.storage_upload_reservations
   WHERE tenant_id = p_tenant_id AND object_key = p_object_key
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF reservation.status = 'released' THEN RETURN true; END IF;

  IF reservation.status = 'completed' THEN
    UPDATE public.tenants
       SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) - reservation.size_bytes, 0)
     WHERE id = p_tenant_id;
  END IF;
  UPDATE public.storage_upload_reservations
     SET status = 'released', released_at = clock_timestamp()
   WHERE id = reservation.id;
  RETURN true;
END
$release_storage_function$;

REVOKE ALL ON FUNCTION public.reserve_tenant_storage_upload(uuid, text, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_tenant_storage_upload(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_tenant_storage_object(uuid, text) FROM PUBLIC, anon, authenticated;

DO $grant_storage_quota_functions$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.reserve_tenant_storage_upload(uuid, text, bigint, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_tenant_storage_upload(uuid, text, bigint) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.release_tenant_storage_object(uuid, text) TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE public.storage_upload_reservations TO service_role';
  END IF;
END
$grant_storage_quota_functions$;

COMMIT;


-- ==========================================
-- MIGRATION: 016_dashboard_stats.sql
-- ==========================================

-- Aggregate dashboard metrics inside Postgres. This replaces transferring all
-- sales, appointments and conversations to every browser poll.

CREATE INDEX IF NOT EXISTS sales_tenant_status_created_idx
  ON public.sales (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS conversations_tenant_status_stage_idx
  ON public.conversations (tenant_id, status, sales_stage);

CREATE INDEX IF NOT EXISTS appointments_tenant_status_idx
  ON public.appointments (tenant_id, status);

CREATE OR REPLACE FUNCTION public.get_tenant_dashboard_stats(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $dashboard_stats$
  SELECT pg_catalog.jsonb_build_object(
    'totalRevenue', COALESCE((
      SELECT pg_catalog.sum(s.amount)::numeric / 100
      FROM public.sales AS s
      WHERE s.tenant_id = p_tenant_id
        AND s.status = 'completed'
    ), 0),
    'totalSales', (
      SELECT pg_catalog.count(*)
      FROM public.sales AS s
      WHERE s.tenant_id = p_tenant_id
        AND s.status = 'completed'
    ),
    'activeConversations', (
      SELECT pg_catalog.count(*)
      FROM public.conversations AS c
      WHERE c.tenant_id = p_tenant_id
        AND c.status = 'chatting'
    ),
    'dailyIncome', COALESCE((
      SELECT pg_catalog.jsonb_object_agg(d.day_key, d.amount ORDER BY d.day_key)
      FROM (
        SELECT
          pg_catalog.to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_key,
          pg_catalog.sum(s.amount)::numeric / 100 AS amount
        FROM public.sales AS s
        WHERE s.tenant_id = p_tenant_id
          AND s.status = 'completed'
          AND s.created_at >= pg_catalog.now() - INTERVAL '30 days'
        GROUP BY 1
      ) AS d
    ), '{}'::jsonb),
    'recentSales', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', recent.id,
          'customer', recent.customer_name,
          'amount', recent.amount::numeric / 100,
          'service', recent.service,
          'createdAt', recent.created_at,
          'status', recent.status
        ) ORDER BY recent.created_at DESC
      )
      FROM (
        SELECT s.id, s.customer_name, s.amount, s.service, s.created_at, s.status
        FROM public.sales AS s
        WHERE s.tenant_id = p_tenant_id
          AND s.status = 'completed'
        ORDER BY s.created_at DESC
        LIMIT 10
      ) AS recent
    ), '[]'::jsonb),
    'salesFunnel', (
      SELECT pg_catalog.jsonb_build_object(
        'new_lead', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'new_lead'),
        'discovery', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'discovery'),
        'qualified', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'qualified'),
        'proposal', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'proposal'),
        'objection', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'objection'),
        'closing', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'closing'),
        'won', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'won'),
        'lost', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'lost'),
        'avgLeadScore', COALESCE(pg_catalog.round(pg_catalog.avg(c.lead_score)), 0),
        'hotLeads', pg_catalog.count(*) FILTER (WHERE COALESCE(c.lead_score, 0) >= 70),
        'warmLeads', pg_catalog.count(*) FILTER (
          WHERE COALESCE(c.lead_score, 0) BETWEEN 40 AND 69
        ),
        'coldLeads', pg_catalog.count(*) FILTER (
          WHERE COALESCE(c.lead_score, 0) BETWEEN 0 AND 39
        )
      )
      FROM public.conversations AS c
      WHERE c.tenant_id = p_tenant_id
    ),
    'appointmentCounts', (
      SELECT pg_catalog.jsonb_build_object(
        'total', pg_catalog.count(*),
        'pending', pg_catalog.count(*) FILTER (WHERE a.status = 'pending'),
        'confirmed', pg_catalog.count(*) FILTER (WHERE a.status = 'confirmed'),
        'awaiting_reschedule', pg_catalog.count(*) FILTER (WHERE a.status = 'awaiting_reschedule'),
        'rescheduled', pg_catalog.count(*) FILTER (WHERE a.status = 'rescheduled'),
        'cancelled', pg_catalog.count(*) FILTER (WHERE a.status = 'cancelled'),
        'completed', pg_catalog.count(*) FILTER (WHERE a.status = 'completed'),
        'noShow', pg_catalog.count(*) FILTER (WHERE a.status = 'no_show'),
        'pendingCompletion', pg_catalog.count(*) FILTER (WHERE a.status = 'pending_completion')
      )
      FROM public.appointments AS a
      WHERE a.tenant_id = p_tenant_id
    )
  );
$dashboard_stats$;

REVOKE ALL ON FUNCTION public.get_tenant_dashboard_stats(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_dashboard_stats(uuid)
  TO service_role;

COMMENT ON FUNCTION public.get_tenant_dashboard_stats(uuid) IS
  'Returns tenant-scoped aggregate dashboard metrics; callable only by service_role.';


-- ==========================================
-- MIGRATION: 017_storage_buckets.sql
-- ==========================================

-- ============================================================================
-- RIFX Marketing - reproducible, private Supabase Storage bootstrap
-- ============================================================================
-- The application accesses these buckets only with the server-side service
-- role. Browser clients must use an authenticated API route, a short-lived
-- signed URL, or the narrowly scoped public marketing-asset proxy.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

DO $storage_preflight$
DECLARE
  missing_columns text;
BEGIN
  IF to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = '017_storage_buckets aborted: Supabase Storage is not installed',
      HINT = 'Enable Supabase Storage in the target project before applying this migration.';
  END IF;

  WITH required(table_name, column_name) AS (
    VALUES
      ('buckets', 'id'),
      ('buckets', 'name'),
      ('buckets', 'public'),
      ('buckets', 'file_size_limit'),
      ('buckets', 'allowed_mime_types'),
      ('objects', 'bucket_id')
  )
  SELECT string_agg(format('storage.%I.%I', required.table_name, required.column_name), ', ')
    INTO missing_columns
  FROM required
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS column_definition
    WHERE column_definition.table_schema = 'storage'
      AND column_definition.table_name = required.table_name
      AND column_definition.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      '017_storage_buckets aborted: required Storage columns are missing: %',
      missing_columns;
  END IF;
END
$storage_preflight$;

-- Upsert the exact bucket contract. Reapplying this migration also repairs a
-- bucket that was accidentally made public or had its limits relaxed.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'knowledge-base',
    'knowledge-base',
    false,
    10485760,
    ARRAY[
      'application/csv',
      'application/json',
      'application/msword',
      'application/octet-stream',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/x-csv',
      'text/csv',
      'text/plain',
      'text/x-csv'
    ]::text[]
  ),
  (
    'chat_media',
    'chat_media',
    false,
    16777216,
    ARRAY[
      'application/msword',
      'application/octet-stream',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/aac',
      'audio/amr',
      'audio/mp3',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm',
      'image/gif',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'text/csv',
      'text/plain',
      'video/3gpp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ]::text[]
  ),
  (
    'uploads',
    'uploads',
    false,
    5242880,
    ARRAY[
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- bypassed alter table buckets
-- bypassed alter table objects

-- These restrictive policies remain a deny boundary for the three managed
-- buckets even if a future operator accidentally restores table grants or a
-- permissive policy. For unrelated buckets the predicate is neutral.
DROP POLICY IF EXISTS rifx_private_buckets_service_role_only
  ON storage.buckets;
CREATE POLICY rifx_private_buckets_service_role_only
  ON storage.buckets
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]))
  WITH CHECK (id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]));

DROP POLICY IF EXISTS rifx_private_objects_service_role_only
  ON storage.objects;
CREATE POLICY rifx_private_objects_service_role_only
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]))
  WITH CHECK (bucket_id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]));

-- No browser role needs direct SQL access to Storage. The explicit service-role
-- grants are intentionally narrower than ALL and are applied only when the
-- standard Supabase role exists (useful for schema-only validation tooling).
REVOKE ALL ON TABLE storage.buckets, storage.objects FROM PUBLIC;
REVOKE USAGE ON SCHEMA storage FROM PUBLIC;

DO $storage_role_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE storage.buckets, storage.objects FROM anon';
    EXECUTE 'REVOKE USAGE ON SCHEMA storage FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE storage.buckets, storage.objects FROM authenticated';
    EXECUTE 'REVOKE USAGE ON SCHEMA storage FROM authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA storage TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE storage.buckets TO service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO service_role';
  END IF;
END
$storage_role_grants$;

COMMIT;


-- ==========================================
-- MIGRATION: 018_whatsapp_ingress.sql
-- ==========================================

-- Durable WhatsApp ingress and best-effort idempotent outbound delivery.
-- Apply before deploying the webhook/worker code that calls these functions.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

CREATE TABLE public.whatsapp_ingress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_message_id text NOT NULL UNIQUE,
  destination_phone_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8,
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT whatsapp_ingress_message_id_check CHECK (
    length(btrim(provider_message_id)) BETWEEN 1 AND 200
  ),
  CONSTRAINT whatsapp_ingress_phone_id_check CHECK (
    destination_phone_id ~ '^[0-9]{6,30}$'
  ),
  CONSTRAINT whatsapp_ingress_payload_check CHECK (
    jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 1048576
  ),
  CONSTRAINT whatsapp_ingress_hash_check CHECK (
    payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT whatsapp_ingress_status_check CHECK (
    status IN ('queued', 'processing', 'retry', 'completed', 'dead')
  ),
  CONSTRAINT whatsapp_ingress_attempts_check CHECK (
    attempt_count >= 0 AND max_attempts BETWEEN 1 AND 20
  ),
  CONSTRAINT whatsapp_ingress_lease_check CHECK (
    (status = 'processing' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (status <> 'processing' AND lease_token IS NULL AND lease_until IS NULL)
  ),
  CONSTRAINT whatsapp_ingress_completion_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX whatsapp_ingress_claim_idx
  ON public.whatsapp_ingress (available_at, created_at)
  WHERE status IN ('queued', 'retry');
CREATE INDEX whatsapp_ingress_expired_lease_idx
  ON public.whatsapp_ingress (lease_until)
  WHERE status = 'processing';
CREATE INDEX whatsapp_ingress_tenant_created_idx
  ON public.whatsapp_ingress (tenant_id, created_at DESC);

ALTER TABLE public.whatsapp_ingress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ingress FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_ingress FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.whatsapp_ingress IS
  'Verified WhatsApp message envelopes awaiting asynchronous processing. Contains customer PII; restrict access and apply the documented retention policy.';

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_ingress_batch(p_events jsonb)
RETURNS TABLE (
  enqueued_count integer,
  duplicate_count integer,
  conflict_count integer,
  ignored_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $enqueue_function$
DECLARE
  item jsonb;
  event_payload jsonb;
  event_message_id text;
  event_phone_id text;
  event_payload_hash text;
  matched_tenant_id uuid;
  matched_config_count integer;
  inserted_rows integer;
  existing_event public.whatsapp_ingress%ROWTYPE;
BEGIN
  enqueued_count := 0;
  duplicate_count := 0;
  conflict_count := 0;
  ignored_count := 0;

  IF p_events IS NULL
     OR jsonb_typeof(p_events) <> 'array'
     OR jsonb_array_length(p_events) < 1
     OR jsonb_array_length(p_events) > 1000 THEN
    RAISE EXCEPTION 'invalid_whatsapp_ingress_batch' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    event_message_id := btrim(COALESCE(item->>'provider_message_id', ''));
    event_phone_id := btrim(COALESCE(item->>'destination_phone_id', ''));
    event_payload_hash := COALESCE(item->>'payload_sha256', '');
    event_payload := item->'payload';

    IF length(event_message_id) NOT BETWEEN 1 AND 200
       OR event_phone_id !~ '^[0-9]{6,30}$'
       OR event_payload_hash !~ '^[0-9a-f]{64}$'
       OR event_payload IS NULL
       OR jsonb_typeof(event_payload) <> 'object'
       OR pg_column_size(event_payload) > 1048576 THEN
      ignored_count := ignored_count + 1;
      CONTINUE;
    END IF;

    SELECT count(c.tenant_id)::integer,
           (array_agg(c.tenant_id ORDER BY c.tenant_id))[1]
      INTO matched_config_count, matched_tenant_id
      FROM public.config AS c
     WHERE c.whatsapp_phone_id = event_phone_id;

    -- Never guess a tenant when a destination is missing or ambiguous.
    IF matched_config_count <> 1 OR matched_tenant_id IS NULL THEN
      ignored_count := ignored_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.whatsapp_ingress (
      tenant_id,
      provider_message_id,
      destination_phone_id,
      payload,
      payload_sha256
    ) VALUES (
      matched_tenant_id,
      event_message_id,
      event_phone_id,
      event_payload,
      event_payload_hash
    )
    ON CONFLICT (provider_message_id) DO NOTHING;

    GET DIAGNOSTICS inserted_rows = ROW_COUNT;
    IF inserted_rows = 1 THEN
      enqueued_count := enqueued_count + 1;
      CONTINUE;
    END IF;

    SELECT ingress.*
      INTO existing_event
      FROM public.whatsapp_ingress AS ingress
     WHERE ingress.provider_message_id = event_message_id;

    IF existing_event.payload_sha256 = event_payload_hash
       AND existing_event.tenant_id = matched_tenant_id
       AND existing_event.destination_phone_id = event_phone_id THEN
      duplicate_count := duplicate_count + 1;
    ELSE
      conflict_count := conflict_count + 1;
    END IF;
  END LOOP;

  RETURN NEXT;
END
$enqueue_function$;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_ingress(
  p_processing_token uuid,
  p_lease_seconds integer DEFAULT 600
)
RETURNS TABLE (
  ingress_id uuid,
  tenant_id uuid,
  provider_message_id text,
  payload jsonb,
  attempt_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $claim_ingress_function$
DECLARE
  lease_seconds integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 600), 30), 900);
BEGIN
  IF p_processing_token IS NULL THEN
    RAISE EXCEPTION 'invalid_whatsapp_ingress_claim' USING ERRCODE = '22023';
  END IF;

  UPDATE public.whatsapp_ingress AS exhausted
     SET status = 'dead',
         lease_token = NULL,
         lease_until = NULL,
         last_error_code = COALESCE(exhausted.last_error_code, 'attempts_exhausted'),
         updated_at = clock_timestamp()
   WHERE exhausted.status IN ('queued', 'retry', 'processing')
     AND exhausted.attempt_count >= exhausted.max_attempts
     AND (exhausted.status <> 'processing' OR exhausted.lease_until <= clock_timestamp());

  RETURN QUERY
  WITH candidate AS MATERIALIZED (
    SELECT queued.id
      FROM public.whatsapp_ingress AS queued
     WHERE queued.attempt_count < queued.max_attempts
       AND (
         (queued.status IN ('queued', 'retry') AND queued.available_at <= clock_timestamp())
         OR (queued.status = 'processing' AND queued.lease_until <= clock_timestamp())
       )
     ORDER BY queued.available_at, queued.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.whatsapp_ingress AS claimed
     SET status = 'processing',
         attempt_count = claimed.attempt_count + 1,
         lease_token = p_processing_token,
         lease_until = clock_timestamp() + make_interval(secs => lease_seconds),
         updated_at = clock_timestamp()
    FROM candidate
   WHERE claimed.id = candidate.id
  RETURNING claimed.id,
            claimed.tenant_id,
            claimed.provider_message_id,
            claimed.payload,
            claimed.attempt_count;
END
$claim_ingress_function$;

CREATE OR REPLACE FUNCTION public.complete_whatsapp_ingress(
  p_ingress_id uuid,
  p_processing_token uuid,
  p_succeeded boolean,
  p_error_code text DEFAULT NULL,
  p_retry_seconds integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $complete_ingress_function$
DECLARE
  affected_rows integer;
  retry_seconds integer := LEAST(GREATEST(COALESCE(p_retry_seconds, 30), 5), 3600);
BEGIN
  IF p_ingress_id IS NULL OR p_processing_token IS NULL OR p_succeeded IS NULL THEN
    RAISE EXCEPTION 'invalid_whatsapp_ingress_completion' USING ERRCODE = '22023';
  END IF;

  UPDATE public.whatsapp_ingress AS ingress
     SET status = CASE
           WHEN p_succeeded THEN 'completed'
           WHEN ingress.attempt_count >= ingress.max_attempts THEN 'dead'
           ELSE 'retry'
         END,
         available_at = CASE
           WHEN p_succeeded THEN ingress.available_at
           ELSE clock_timestamp() + make_interval(secs => retry_seconds)
         END,
         lease_token = NULL,
         lease_until = NULL,
         last_error_code = CASE
           WHEN p_succeeded THEN NULL
           ELSE NULLIF(left(COALESCE(p_error_code, 'processing_failed'), 120), '')
         END,
         completed_at = CASE WHEN p_succeeded THEN clock_timestamp() ELSE NULL END,
         updated_at = clock_timestamp()
   WHERE ingress.id = p_ingress_id
     AND ingress.status = 'processing'
     AND ingress.lease_token = p_processing_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$complete_ingress_function$;

CREATE TABLE public.whatsapp_outbound_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  delivery_key text NOT NULL UNIQUE,
  source_message_id text NOT NULL,
  delivery_purpose text NOT NULL,
  recipient_phone text NOT NULL,
  content_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  attempts integer NOT NULL DEFAULT 1,
  processing_token uuid,
  processing_expires_at timestamptz,
  provider_message_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at timestamptz,
  CONSTRAINT whatsapp_outbound_key_check CHECK (delivery_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT whatsapp_outbound_source_check CHECK (length(source_message_id) BETWEEN 1 AND 200),
  CONSTRAINT whatsapp_outbound_purpose_check CHECK (delivery_purpose ~ '^[a-z0-9_]{3,80}$'),
  CONSTRAINT whatsapp_outbound_recipient_check CHECK (recipient_phone ~ '^\+?[0-9]{6,30}$'),
  CONSTRAINT whatsapp_outbound_content_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT whatsapp_outbound_status_check CHECK (status IN ('processing', 'sent', 'failed')),
  CONSTRAINT whatsapp_outbound_attempts_check CHECK (attempts >= 1),
  CONSTRAINT whatsapp_outbound_lease_check CHECK (
    (status = 'processing' AND processing_token IS NOT NULL AND processing_expires_at IS NOT NULL)
    OR (status <> 'processing' AND processing_token IS NULL AND processing_expires_at IS NULL)
  ),
  CONSTRAINT whatsapp_outbound_sent_check CHECK (
    (status = 'sent' AND sent_at IS NOT NULL)
    OR (status <> 'sent' AND sent_at IS NULL)
  )
);

CREATE INDEX whatsapp_outbound_tenant_created_idx
  ON public.whatsapp_outbound_deliveries (tenant_id, created_at DESC);
CREATE INDEX whatsapp_outbound_expired_idx
  ON public.whatsapp_outbound_deliveries (processing_expires_at)
  WHERE status = 'processing';

ALTER TABLE public.whatsapp_outbound_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outbound_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_outbound_deliveries FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.whatsapp_outbound_deliveries IS
  'Content-free outbound idempotency receipts. A lost provider response can still cause a duplicate because Meta offers no idempotency key for message sends.';

CREATE OR REPLACE FUNCTION public.claim_whatsapp_delivery(
  p_delivery_key text,
  p_tenant_id uuid,
  p_source_message_id text,
  p_delivery_purpose text,
  p_recipient_phone text,
  p_content_sha256 text,
  p_processing_token uuid,
  p_lease_seconds integer DEFAULT 120
)
RETURNS TABLE (claim_status text, claimed_delivery_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $claim_delivery_function$
DECLARE
  current_delivery public.whatsapp_outbound_deliveries%ROWTYPE;
  lease_seconds integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 120), 30), 300);
  claimed_at timestamptz := clock_timestamp();
BEGIN
  IF p_delivery_key !~ '^[0-9a-f]{64}$'
     OR p_tenant_id IS NULL
     OR length(COALESCE(p_source_message_id, '')) NOT BETWEEN 1 AND 200
     OR p_delivery_purpose !~ '^[a-z0-9_]{3,80}$'
     OR p_recipient_phone !~ '^\+?[0-9]{6,30}$'
     OR p_content_sha256 !~ '^[0-9a-f]{64}$'
     OR p_processing_token IS NULL THEN
    RAISE EXCEPTION 'invalid_whatsapp_delivery_claim' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.whatsapp_outbound_deliveries (
    tenant_id,
    delivery_key,
    source_message_id,
    delivery_purpose,
    recipient_phone,
    content_sha256,
    status,
    attempts,
    processing_token,
    processing_expires_at
  ) VALUES (
    p_tenant_id,
    p_delivery_key,
    p_source_message_id,
    p_delivery_purpose,
    p_recipient_phone,
    p_content_sha256,
    'processing',
    1,
    p_processing_token,
    claimed_at + make_interval(secs => lease_seconds)
  )
  ON CONFLICT (delivery_key) DO NOTHING
  RETURNING id INTO claimed_delivery_id;

  IF claimed_delivery_id IS NOT NULL THEN
    claim_status := 'claimed';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT delivery.*
    INTO current_delivery
    FROM public.whatsapp_outbound_deliveries AS delivery
   WHERE delivery.delivery_key = p_delivery_key
   FOR UPDATE;

  IF current_delivery.tenant_id <> p_tenant_id
     OR current_delivery.source_message_id <> p_source_message_id
     OR current_delivery.delivery_purpose <> p_delivery_purpose
     OR current_delivery.recipient_phone <> p_recipient_phone
  THEN
    claim_status := 'conflict';
    claimed_delivery_id := current_delivery.id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_delivery.status = 'sent' THEN
    claim_status := 'duplicate';
    claimed_delivery_id := current_delivery.id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_delivery.status = 'processing'
     AND current_delivery.processing_expires_at > claimed_at THEN
    claim_status := 'busy';
    claimed_delivery_id := current_delivery.id;
    RETURN NEXT;
    RETURN;
  END IF;

  -- An expired processing lease with different content is ambiguous: the old
  -- response may have reached Meta. Do not turn regenerated prose into a new
  -- automatic send. A definite HTTP failure is safe to retry with new content.
  IF current_delivery.status = 'processing'
     AND current_delivery.content_sha256 <> p_content_sha256 THEN
    claim_status := 'conflict';
    claimed_delivery_id := current_delivery.id;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.whatsapp_outbound_deliveries
     SET status = 'processing',
         attempts = attempts + 1,
         processing_token = p_processing_token,
         processing_expires_at = claimed_at + make_interval(secs => lease_seconds),
         content_sha256 = p_content_sha256,
         error_code = NULL,
         updated_at = claimed_at
   WHERE id = current_delivery.id;

  claim_status := 'claimed';
  claimed_delivery_id := current_delivery.id;
  RETURN NEXT;
END
$claim_delivery_function$;

CREATE OR REPLACE FUNCTION public.complete_whatsapp_delivery(
  p_delivery_id uuid,
  p_processing_token uuid,
  p_succeeded boolean,
  p_provider_message_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $complete_delivery_function$
DECLARE
  affected_rows integer;
BEGIN
  IF p_delivery_id IS NULL OR p_processing_token IS NULL OR p_succeeded IS NULL THEN
    RAISE EXCEPTION 'invalid_whatsapp_delivery_completion' USING ERRCODE = '22023';
  END IF;

  UPDATE public.whatsapp_outbound_deliveries AS delivery
     SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END,
         processing_token = NULL,
         processing_expires_at = NULL,
         provider_message_id = CASE
           WHEN p_succeeded THEN NULLIF(left(COALESCE(p_provider_message_id, ''), 200), '')
           ELSE delivery.provider_message_id
         END,
         error_code = CASE
           WHEN p_succeeded THEN NULL
           ELSE NULLIF(left(COALESCE(p_error_code, 'provider_request_failed'), 120), '')
         END,
         sent_at = CASE WHEN p_succeeded THEN clock_timestamp() ELSE NULL END,
         updated_at = clock_timestamp()
   WHERE delivery.id = p_delivery_id
     AND delivery.status = 'processing'
     AND delivery.processing_token = p_processing_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$complete_delivery_function$;

REVOKE ALL ON FUNCTION public.enqueue_whatsapp_ingress_batch(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_whatsapp_ingress(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_whatsapp_ingress(uuid, uuid, boolean, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_whatsapp_delivery(text, uuid, text, text, text, text, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_whatsapp_delivery(uuid, uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;

DO $grant_service_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_ingress TO service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_outbound_deliveries TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_ingress_batch(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_whatsapp_ingress(uuid, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_whatsapp_ingress(uuid, uuid, boolean, text, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_whatsapp_delivery(text, uuid, text, text, text, text, uuid, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_whatsapp_delivery(uuid, uuid, boolean, text, text) TO service_role';
  END IF;
END
$grant_service_role$;

COMMIT;


-- ==========================================
-- MIGRATION: 019_monthly_briefing.sql
-- ==========================================

-- Secure, idempotent monthly briefing delivery.
-- Notification preferences are typed configuration, not part of the JSON blob
-- that also contains AI/provider credentials.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS alert_email text,
  ADD COLUMN IF NOT EXISTS email_alerts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_notifications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_briefing boolean NOT NULL DEFAULT false;

-- Migrate the legacy notification keys only when openai_key contains a valid
-- JSON object. Plain legacy API keys and malformed values are left untouched.
DO $migrate_notification_preferences$
DECLARE
  config_row record;
  extended jsonb;
  migrated_email text;
BEGIN
  FOR config_row IN
    SELECT id, openai_key
    FROM public.config
    WHERE openai_key IS NOT NULL
  LOOP
    extended := NULL;
    BEGIN
      extended := config_row.openai_key::jsonb;
    EXCEPTION WHEN OTHERS THEN
      extended := NULL;
    END;

    IF pg_catalog.jsonb_typeof(extended) = 'object' THEN
      migrated_email := NULLIF(pg_catalog.btrim(extended ->> 'alert_email'), '');
      IF migrated_email IS NOT NULL
         AND (
           pg_catalog.length(migrated_email) > 254
           OR migrated_email !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
         ) THEN
        migrated_email := NULL;
      END IF;

      UPDATE public.config
      SET alert_email = COALESCE(alert_email, migrated_email),
          email_alerts = CASE
            WHEN pg_catalog.jsonb_typeof(extended -> 'email_alerts') = 'boolean'
              THEN (extended ->> 'email_alerts')::boolean
            ELSE email_alerts
          END,
          push_notifications = CASE
            WHEN pg_catalog.jsonb_typeof(extended -> 'push_notifications') = 'boolean'
              THEN (extended ->> 'push_notifications')::boolean
            ELSE push_notifications
          END,
          monthly_briefing = CASE
            WHEN pg_catalog.jsonb_typeof(extended -> 'monthly_briefing') = 'boolean'
              THEN (extended ->> 'monthly_briefing')::boolean
            ELSE monthly_briefing
          END,
          openai_key = (
            extended
              - 'alert_email'
              - 'email_alerts'
              - 'push_notifications'
              - 'monthly_briefing'
              - 'daily_briefing'
          )::text
      WHERE id = config_row.id;
    END IF;
  END LOOP;
END
$migrate_notification_preferences$;

DO $config_notification_constraints$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.config
    WHERE alert_email IS NOT NULL
      AND (
        alert_email <> pg_catalog.btrim(alert_email)
        OR pg_catalog.length(alert_email) > 254
        OR alert_email !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
      )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '019_monthly_briefing aborted: config.alert_email contains an invalid address',
      HINT = 'Normalize or clear invalid notification addresses before retrying.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.config'::regclass
      AND conname = 'config_alert_email_check'
  ) THEN
    ALTER TABLE public.config
      ADD CONSTRAINT config_alert_email_check CHECK (
        alert_email IS NULL
        OR (
          alert_email = pg_catalog.btrim(alert_email)
          AND pg_catalog.length(alert_email) <= 254
          AND alert_email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
        )
      ) NOT VALID;
  END IF;
END
$config_notification_constraints$;

ALTER TABLE public.config VALIDATE CONSTRAINT config_alert_email_check;

-- Migration 015 already aborts on duplicate tenant config rows. Make the
-- invariant structural for future writes and for one-row-per-tenant jobs.
CREATE UNIQUE INDEX IF NOT EXISTS config_tenant_id_uidx
  ON public.config (tenant_id);

CREATE TABLE IF NOT EXISTS public.monthly_briefing_deliveries (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'skipped', 'failed')),
  push_requested boolean NOT NULL DEFAULT false,
  email_requested boolean NOT NULL DEFAULT false,
  push_delivered boolean NOT NULL DEFAULT false,
  email_channel_unavailable boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (tenant_id, period_start),
  CHECK (period_end = (period_start + INTERVAL '1 month')::date),
  CHECK (EXTRACT(day FROM period_start) = 1),
  CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_:-]{1,80}$')
);

CREATE INDEX IF NOT EXISTS monthly_briefing_delivery_claim_idx
  ON public.monthly_briefing_deliveries (period_start, status, claimed_at)
  WHERE status IN ('pending', 'processing', 'failed');

CREATE INDEX IF NOT EXISTS conversations_tenant_created_at_idx
  ON public.conversations (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS messages_tenant_user_created_at_idx
  ON public.messages (tenant_id, created_at)
  WHERE role = 'user';
CREATE INDEX IF NOT EXISTS appointments_tenant_created_at_idx
  ON public.appointments (tenant_id, created_at);

ALTER TABLE public.monthly_briefing_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_briefing_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.monthly_briefing_deliveries
  FROM PUBLIC, anon, authenticated;

DO $monthly_briefing_table_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.monthly_briefing_deliveries TO service_role';
  END IF;
END
$monthly_briefing_table_grants$;

CREATE OR REPLACE FUNCTION public.claim_monthly_briefing_batch(
  p_period_start date,
  p_period_end date,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  briefing_tenant_id uuid,
  push_requested boolean,
  email_requested boolean,
  new_conversations bigint,
  messages_count bigint,
  appointments_count bigint,
  revenue_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $claim_monthly_briefing_batch$
BEGIN
  IF p_period_start IS NULL
     OR p_period_end IS NULL
     OR EXTRACT(day FROM p_period_start) <> 1
     OR p_period_end <> (p_period_start + INTERVAL '1 month')::date
     OR p_period_end > (pg_catalog.date_trunc('month', pg_catalog.now())::date)
     OR p_limit < 1
     OR p_limit > 250 THEN
    RAISE EXCEPTION 'invalid_monthly_briefing_claim'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.monthly_briefing_deliveries (
    tenant_id,
    period_start,
    period_end,
    push_requested,
    email_requested
  )
  SELECT
    cfg.tenant_id,
    p_period_start,
    p_period_end,
    cfg.push_notifications,
    cfg.email_alerts
  FROM public.config AS cfg
  JOIN public.tenants AS tenant ON tenant.id = cfg.tenant_id
  WHERE cfg.monthly_briefing = true
    AND tenant.is_active = true
    AND tenant.deleted_at IS NULL
    AND (
      (
        tenant.plan_status = 'active'
        AND (tenant.plan_expires_at IS NULL OR tenant.plan_expires_at > pg_catalog.now())
      )
      OR (
        tenant.plan_status = 'cancelled'
        AND tenant.plan_expires_at > pg_catalog.now()
      )
    )
  ON CONFLICT (tenant_id, period_start) DO NOTHING;

  RETURN QUERY
  WITH claimable AS (
    SELECT delivery.tenant_id
    FROM public.monthly_briefing_deliveries AS delivery
    WHERE delivery.period_start = p_period_start
      AND delivery.period_end = p_period_end
      AND delivery.attempts < 3
      AND (
        delivery.status = 'pending'
        OR (
          delivery.status IN ('processing', 'failed')
          AND delivery.claimed_at < pg_catalog.now() - INTERVAL '30 minutes'
        )
      )
    ORDER BY delivery.tenant_id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.monthly_briefing_deliveries AS delivery
    SET status = 'processing',
        attempts = delivery.attempts + 1,
        claimed_at = pg_catalog.now(),
        completed_at = NULL,
        last_error_code = NULL,
        updated_at = pg_catalog.now()
    FROM claimable
    WHERE delivery.tenant_id = claimable.tenant_id
      AND delivery.period_start = p_period_start
    RETURNING
      delivery.tenant_id,
      delivery.push_requested,
      delivery.email_requested
  ),
  conversation_totals AS (
    SELECT conversation.tenant_id, pg_catalog.count(*) AS total
    FROM public.conversations AS conversation
    JOIN claimed ON claimed.tenant_id = conversation.tenant_id
    WHERE conversation.created_at >= (p_period_start::timestamp AT TIME ZONE 'UTC')
      AND conversation.created_at < (p_period_end::timestamp AT TIME ZONE 'UTC')
    GROUP BY conversation.tenant_id
  ),
  message_totals AS (
    SELECT message.tenant_id, pg_catalog.count(*) AS total
    FROM public.messages AS message
    JOIN claimed ON claimed.tenant_id = message.tenant_id
    WHERE message.role = 'user'
      AND message.created_at >= (p_period_start::timestamp AT TIME ZONE 'UTC')
      AND message.created_at < (p_period_end::timestamp AT TIME ZONE 'UTC')
    GROUP BY message.tenant_id
  ),
  appointment_totals AS (
    SELECT appointment.tenant_id, pg_catalog.count(*) AS total
    FROM public.appointments AS appointment
    JOIN claimed ON claimed.tenant_id = appointment.tenant_id
    WHERE appointment.created_at >= (p_period_start::timestamp AT TIME ZONE 'UTC')
      AND appointment.created_at < (p_period_end::timestamp AT TIME ZONE 'UTC')
    GROUP BY appointment.tenant_id
  ),
  revenue_totals AS (
    SELECT sale.tenant_id, pg_catalog.sum(sale.amount)::bigint AS total
    FROM public.sales AS sale
    JOIN claimed ON claimed.tenant_id = sale.tenant_id
    WHERE sale.status = 'completed'
      AND sale.created_at >= (p_period_start::timestamp AT TIME ZONE 'UTC')
      AND sale.created_at < (p_period_end::timestamp AT TIME ZONE 'UTC')
    GROUP BY sale.tenant_id
  )
  SELECT
    claimed.tenant_id,
    claimed.push_requested,
    claimed.email_requested,
    COALESCE(conversation_totals.total, 0)::bigint,
    COALESCE(message_totals.total, 0)::bigint,
    COALESCE(appointment_totals.total, 0)::bigint,
    COALESCE(revenue_totals.total, 0)::bigint
  FROM claimed
  LEFT JOIN conversation_totals ON conversation_totals.tenant_id = claimed.tenant_id
  LEFT JOIN message_totals ON message_totals.tenant_id = claimed.tenant_id
  LEFT JOIN appointment_totals ON appointment_totals.tenant_id = claimed.tenant_id
  LEFT JOIN revenue_totals ON revenue_totals.tenant_id = claimed.tenant_id
  ORDER BY claimed.tenant_id;
END
$claim_monthly_briefing_batch$;

CREATE OR REPLACE FUNCTION public.complete_monthly_briefing_delivery(
  p_tenant_id uuid,
  p_period_start date,
  p_status text,
  p_push_delivered boolean,
  p_email_channel_unavailable boolean,
  p_error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $complete_monthly_briefing_delivery$
BEGIN
  IF p_tenant_id IS NULL
     OR p_period_start IS NULL
     OR p_status NOT IN ('completed', 'skipped', 'failed')
     OR (p_error_code IS NOT NULL AND p_error_code !~ '^[a-z0-9_:-]{1,80}$') THEN
    RAISE EXCEPTION 'invalid_monthly_briefing_completion'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.monthly_briefing_deliveries
  SET status = p_status,
      push_delivered = p_push_delivered,
      email_channel_unavailable = p_email_channel_unavailable,
      completed_at = pg_catalog.now(),
      last_error_code = p_error_code,
      updated_at = pg_catalog.now()
  WHERE tenant_id = p_tenant_id
    AND period_start = p_period_start
    AND status = 'processing';

  RETURN FOUND;
END
$complete_monthly_briefing_delivery$;

REVOKE ALL ON FUNCTION public.claim_monthly_briefing_batch(date, date, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_monthly_briefing_delivery(
  uuid, date, text, boolean, boolean, text
) FROM PUBLIC, anon, authenticated;

DO $monthly_briefing_function_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_monthly_briefing_batch(date, date, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_monthly_briefing_delivery(uuid, date, text, boolean, boolean, text) TO service_role';
  END IF;
END
$monthly_briefing_function_grants$;

COMMENT ON FUNCTION public.claim_monthly_briefing_batch(date, date, integer) IS
  'Claims an idempotent, bounded batch and computes tenant-scoped monthly aggregates in Postgres.';

COMMIT;


-- ==========================================
-- MIGRATION: 020_knowledge_documents.sql
-- ==========================================

-- ============================================================================
-- Transactional knowledge-base metadata and durable Storage cleanup
-- ============================================================================
-- Apply before deploying the knowledge API that uses public.knowledge_documents.
-- The legacy <tenant>/index.json object is imported by the application exactly
-- once per tenant and is deliberately retained as a non-authoritative backup.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

DO $knowledge_preflight$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION '020_knowledge_documents aborted: public.tenants is missing';
  END IF;

  IF to_regclass('public.knowledge_documents') IS NOT NULL
     OR to_regclass('public.knowledge_storage_cleanup') IS NOT NULL
     OR to_regclass('public.knowledge_index_imports') IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = '020_knowledge_documents aborted: a migration-owned table already exists',
      HINT = 'Inspect the partial/manual schema and reconcile migration history before retrying.';
  END IF;
END
$knowledge_preflight$;

CREATE TABLE public.knowledge_documents (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content text NOT NULL,
  sha256 text,
  active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT knowledge_documents_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT knowledge_documents_tenant_file_unique UNIQUE (tenant_id, file_name),
  CONSTRAINT knowledge_documents_id_check CHECK (
    id ~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT knowledge_documents_file_name_check CHECK (
    length(file_name) BETWEEN 1 AND 160
    AND file_name = btrim(file_name)
    AND file_name NOT IN ('.', '..')
    AND file_name ~ '^[A-Za-z0-9._-]+$'
    AND position('/' IN file_name) = 0
    AND position(chr(92) IN file_name) = 0
  ),
  CONSTRAINT knowledge_documents_file_type_check CHECK (
    file_type IN ('txt', 'text', 'csv', 'pdf', 'doc', 'docx')
    AND lower(right(file_name, length(file_type) + 1)) = '.' || file_type
  ),
  CONSTRAINT knowledge_documents_mime_check CHECK (
    (file_type IN ('txt', 'text') AND mime_type = 'text/plain')
    OR (file_type = 'csv' AND mime_type = 'text/csv')
    OR (file_type = 'pdf' AND mime_type = 'application/pdf')
    OR (file_type = 'doc' AND mime_type = 'application/msword')
    OR (
      file_type = 'docx'
      AND mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  CONSTRAINT knowledge_documents_size_check CHECK (
    file_size_bytes BETWEEN 1 AND 10485760
  ),
  CONSTRAINT knowledge_documents_storage_path_check CHECK (
    length(storage_path) BETWEEN 45 AND 260
    AND left(storage_path, length(tenant_id::text) + 7) = tenant_id::text || '/files/'
    AND substring(storage_path FROM length(tenant_id::text) + 8) ~ '^[A-Za-z0-9._-]+$'
  ),
  CONSTRAINT knowledge_documents_content_check CHECK (
    char_length(content) BETWEEN 1 AND 51024
    AND octet_length(content) <= 204096
  ),
  CONSTRAINT knowledge_documents_sha256_check CHECK (
    sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT knowledge_documents_status_check CHECK (
    status IN ('ready', 'delete_pending')
  ),
  CONSTRAINT knowledge_documents_timestamp_check CHECK (updated_at >= created_at)
);

CREATE INDEX knowledge_documents_tenant_ready_idx
  ON public.knowledge_documents (tenant_id, created_at DESC, id)
  WHERE status = 'ready';
CREATE INDEX knowledge_documents_tenant_active_idx
  ON public.knowledge_documents (tenant_id, updated_at DESC, id)
  WHERE status = 'ready' AND active = true;

CREATE TABLE public.knowledge_storage_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT knowledge_cleanup_document_id_check CHECK (
    document_id ~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT knowledge_cleanup_path_check CHECK (
    length(storage_path) BETWEEN 45 AND 260
    AND left(storage_path, length(tenant_id::text) + 7) = tenant_id::text || '/files/'
    AND substring(storage_path FROM length(tenant_id::text) + 8) ~ '^[A-Za-z0-9._-]+$'
  ),
  CONSTRAINT knowledge_cleanup_reason_check CHECK (reason IN ('replace', 'delete')),
  CONSTRAINT knowledge_cleanup_status_check CHECK (status IN ('pending', 'completed')),
  CONSTRAINT knowledge_cleanup_attempt_check CHECK (attempt_count >= 0),
  CONSTRAINT knowledge_cleanup_completion_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status = 'pending' AND completed_at IS NULL)
  )
);

CREATE INDEX knowledge_storage_cleanup_pending_idx
  ON public.knowledge_storage_cleanup (tenant_id, created_at, id)
  WHERE status = 'pending';

CREATE TABLE public.knowledge_index_imports (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_index_found boolean NOT NULL,
  source_sha256 text,
  source_entry_count integer NOT NULL,
  imported_entry_count integer NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT knowledge_import_hash_check CHECK (
    (
      source_index_found
      AND source_sha256 IS NOT NULL
      AND source_sha256 ~ '^[0-9a-f]{64}$'
    )
    OR (NOT source_index_found AND source_sha256 IS NULL)
  ),
  CONSTRAINT knowledge_import_count_check CHECK (
    source_entry_count BETWEEN 0 AND 500
    AND imported_entry_count BETWEEN 0 AND source_entry_count
  )
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_storage_cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_storage_cleanup FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_index_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_index_imports FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.knowledge_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_storage_cleanup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_index_imports FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.knowledge_documents IS
  'Authoritative tenant-scoped knowledge metadata and extracted prompt content. Raw objects remain private in Storage.';
COMMENT ON TABLE public.knowledge_storage_cleanup IS
  'Durable cleanup ledger for replaced/deleted private knowledge objects.';
COMMENT ON TABLE public.knowledge_index_imports IS
  'One-time, non-destructive import receipt for the legacy tenant index.json object.';

CREATE OR REPLACE FUNCTION public.import_legacy_knowledge_index(
  p_tenant_id uuid,
  p_entries jsonb,
  p_source_index_found boolean,
  p_source_sha256 text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $import_legacy_knowledge_index$
DECLARE
  item jsonb;
  imported_count integer := 0;
  inserted_rows integer;
  source_count integer;
  existing_count integer;
  item_id text;
  item_file_name text;
  item_file_type text;
  item_mime_type text;
  item_storage_path text;
  item_content text;
  item_sha256 text;
  item_size bigint;
  item_active boolean;
  item_created_at timestamptz;
BEGIN
  IF p_tenant_id IS NULL
     OR p_entries IS NULL
     OR jsonb_typeof(p_entries) <> 'array'
     OR p_source_index_found IS NULL
     OR pg_column_size(p_entries) > 10485760 THEN
    RAISE EXCEPTION 'invalid_legacy_knowledge_index' USING ERRCODE = '22023';
  END IF;

  source_count := jsonb_array_length(p_entries);
  IF source_count > 500
     OR (p_source_index_found AND (p_source_sha256 IS NULL OR p_source_sha256 !~ '^[0-9a-f]{64}$'))
     OR (NOT p_source_index_found AND (p_source_sha256 IS NOT NULL OR source_count <> 0)) THEN
    RAISE EXCEPTION 'invalid_legacy_knowledge_index' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 20));

  IF EXISTS (SELECT 1 FROM public.knowledge_index_imports WHERE tenant_id = p_tenant_id) THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.tenants
     WHERE id = p_tenant_id
       AND COALESCE(is_active, true) = true
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'knowledge_tenant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO existing_count
    FROM public.knowledge_documents
   WHERE tenant_id = p_tenant_id
     AND status = 'ready';
  IF existing_count + source_count > 500 THEN
    RAISE EXCEPTION 'knowledge_document_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_entries)
  LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'invalid_legacy_knowledge_entry' USING ERRCODE = '22023';
    END IF;

    item_id := COALESCE(item->>'id', '');
    item_file_name := COALESCE(item->>'file_name', '');
    item_file_type := COALESCE(item->>'file_type', '');
    item_mime_type := COALESCE(item->>'mime_type', '');
    item_storage_path := COALESCE(item->>'storage_path', '');
    item_content := COALESCE(item->>'content', '');
    item_sha256 := NULLIF(item->>'sha256', '');
    item_size := COALESCE((item->>'file_size_bytes')::bigint, 0);
    item_active := COALESCE((item->>'active')::boolean, true);
    item_created_at := COALESCE((item->>'created_at')::timestamptz, clock_timestamp());

    IF item_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR length(item_file_name) NOT BETWEEN 1 AND 160
       OR item_file_name <> btrim(item_file_name)
       OR item_file_name IN ('.', '..')
       OR item_file_name !~ '^[A-Za-z0-9._-]+$'
       OR item_file_type NOT IN ('txt', 'text', 'csv', 'pdf', 'doc', 'docx')
       OR lower(right(item_file_name, length(item_file_type) + 1)) <> '.' || item_file_type
       OR item_size NOT BETWEEN 1 AND 10485760
       OR left(item_storage_path, length(p_tenant_id::text) + 7) <> p_tenant_id::text || '/files/'
       OR substring(item_storage_path FROM length(p_tenant_id::text) + 8) !~ '^[A-Za-z0-9._-]+$'
       OR char_length(item_content) NOT BETWEEN 1 AND 51024
       OR octet_length(item_content) > 204096
       OR item_created_at > clock_timestamp() + interval '5 minutes'
       OR (item_sha256 IS NOT NULL AND item_sha256 !~ '^[0-9a-f]{64}$')
       OR NOT (
         (item_file_type IN ('txt', 'text') AND item_mime_type = 'text/plain')
         OR (item_file_type = 'csv' AND item_mime_type = 'text/csv')
         OR (item_file_type = 'pdf' AND item_mime_type = 'application/pdf')
         OR (item_file_type = 'doc' AND item_mime_type = 'application/msword')
         OR (
           item_file_type = 'docx'
           AND item_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
         )
       ) THEN
      RAISE EXCEPTION 'invalid_legacy_knowledge_entry' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.knowledge_documents (
      id, tenant_id, file_name, file_type, mime_type, file_size_bytes,
      storage_path, content, sha256, active, status, created_at, updated_at
    ) VALUES (
      item_id, p_tenant_id, item_file_name, item_file_type, item_mime_type,
      item_size, item_storage_path, item_content, item_sha256, item_active,
      'ready', item_created_at, GREATEST(item_created_at, clock_timestamp())
    )
    ON CONFLICT (tenant_id, file_name) DO NOTHING;

    GET DIAGNOSTICS inserted_rows = ROW_COUNT;
    imported_count := imported_count + inserted_rows;
  END LOOP;

  INSERT INTO public.knowledge_index_imports (
    tenant_id, source_index_found, source_sha256, source_entry_count,
    imported_entry_count
  ) VALUES (
    p_tenant_id, p_source_index_found, p_source_sha256, source_count,
    imported_count
  );

  RETURN imported_count;
END
$import_legacy_knowledge_index$;

CREATE OR REPLACE FUNCTION public.upsert_knowledge_document(
  p_tenant_id uuid,
  p_document_id text,
  p_file_name text,
  p_file_type text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_content text,
  p_sha256 text
)
RETURNS TABLE (
  document_id text,
  document_created_at timestamptz,
  document_updated_at timestamptz,
  previous_storage_path text,
  replacement_cleanup_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $upsert_knowledge_document$
DECLARE
  existing_document public.knowledge_documents%ROWTYPE;
  ready_count integer;
  changed_at timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR length(COALESCE(p_file_name, '')) NOT BETWEEN 1 AND 160
     OR p_file_name <> btrim(p_file_name)
     OR p_file_name IN ('.', '..')
     OR p_file_name !~ '^[A-Za-z0-9._-]+$'
     OR p_file_type IS NULL
     OR p_file_type NOT IN ('txt', 'text', 'csv', 'pdf', 'doc', 'docx')
     OR lower(right(p_file_name, length(p_file_type) + 1)) <> '.' || p_file_type
     OR p_file_size_bytes IS NULL
     OR p_file_size_bytes NOT BETWEEN 1 AND 10485760
     OR length(COALESCE(p_storage_path, '')) NOT BETWEEN 45 AND 260
     OR left(p_storage_path, length(p_tenant_id::text) + 7) <> p_tenant_id::text || '/files/'
     OR substring(p_storage_path FROM length(p_tenant_id::text) + 8) !~ '^[A-Za-z0-9._-]+$'
     OR char_length(COALESCE(p_content, '')) NOT BETWEEN 1 AND 51024
     OR octet_length(p_content) > 204096
     OR p_sha256 IS NULL
     OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR p_mime_type IS NULL
     OR NOT (
       (p_file_type IN ('txt', 'text') AND p_mime_type = 'text/plain')
       OR (p_file_type = 'csv' AND p_mime_type = 'text/csv')
       OR (p_file_type = 'pdf' AND p_mime_type = 'application/pdf')
       OR (p_file_type = 'doc' AND p_mime_type = 'application/msword')
       OR (
         p_file_type = 'docx'
         AND p_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       )
     ) THEN
    RAISE EXCEPTION 'invalid_knowledge_document' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_file_name, 20)
  );

  IF NOT EXISTS (
    SELECT 1
      FROM public.tenants
     WHERE id = p_tenant_id
       AND COALESCE(is_active, true) = true
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'knowledge_tenant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT document.*
    INTO existing_document
    FROM public.knowledge_documents AS document
   WHERE document.tenant_id = p_tenant_id
     AND document.file_name = p_file_name
   FOR UPDATE;

  IF FOUND THEN
    IF existing_document.status <> 'ready' THEN
      RAISE EXCEPTION 'knowledge_document_delete_in_progress' USING ERRCODE = 'P0001';
    END IF;

    previous_storage_path := existing_document.storage_path;
    changed_at := GREATEST(changed_at, existing_document.created_at);
    INSERT INTO public.knowledge_storage_cleanup (
      tenant_id, document_id, storage_path, reason
    ) VALUES (
      p_tenant_id, existing_document.id, existing_document.storage_path, 'replace'
    )
    ON CONFLICT (storage_path) DO NOTHING
    RETURNING id INTO replacement_cleanup_id;

    IF replacement_cleanup_id IS NULL THEN
      SELECT cleanup.id
        INTO replacement_cleanup_id
        FROM public.knowledge_storage_cleanup AS cleanup
       WHERE cleanup.storage_path = existing_document.storage_path;
    END IF;

    UPDATE public.knowledge_documents
       SET file_type = p_file_type,
           mime_type = p_mime_type,
           file_size_bytes = p_file_size_bytes,
           storage_path = p_storage_path,
           content = p_content,
           sha256 = p_sha256,
           active = true,
           updated_at = changed_at
     WHERE tenant_id = p_tenant_id
       AND id = existing_document.id;

    document_id := existing_document.id;
    document_created_at := existing_document.created_at;
    document_updated_at := changed_at;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT count(*) INTO ready_count
    FROM public.knowledge_documents
   WHERE tenant_id = p_tenant_id
     AND status = 'ready';
  IF ready_count >= 500 THEN
    RAISE EXCEPTION 'knowledge_document_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.knowledge_documents (
    id, tenant_id, file_name, file_type, mime_type, file_size_bytes,
    storage_path, content, sha256, active, status, created_at, updated_at
  ) VALUES (
    p_document_id, p_tenant_id, p_file_name, p_file_type, p_mime_type,
    p_file_size_bytes, p_storage_path, p_content, p_sha256, true, 'ready',
    changed_at, changed_at
  );

  document_id := p_document_id;
  document_created_at := changed_at;
  document_updated_at := changed_at;
  previous_storage_path := NULL;
  replacement_cleanup_id := NULL;
  RETURN NEXT;
END
$upsert_knowledge_document$;

CREATE OR REPLACE FUNCTION public.set_knowledge_document_active(
  p_tenant_id uuid,
  p_document_id text,
  p_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $set_knowledge_document_active$
DECLARE
  affected_rows integer;
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR p_active IS NULL THEN
    RAISE EXCEPTION 'invalid_knowledge_document_update' USING ERRCODE = '22023';
  END IF;

  UPDATE public.knowledge_documents
     SET active = p_active,
         updated_at = GREATEST(clock_timestamp(), created_at)
   WHERE tenant_id = p_tenant_id
     AND id = p_document_id
     AND status = 'ready';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$set_knowledge_document_active$;

CREATE OR REPLACE FUNCTION public.begin_knowledge_document_delete(
  p_tenant_id uuid,
  p_document_id text
)
RETURNS TABLE (object_path text, cleanup_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $begin_knowledge_document_delete$
DECLARE
  existing_document public.knowledge_documents%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invalid_knowledge_document_delete' USING ERRCODE = '22023';
  END IF;

  SELECT document.*
    INTO existing_document
    FROM public.knowledge_documents AS document
   WHERE document.tenant_id = p_tenant_id
     AND document.id = p_document_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.knowledge_documents
     SET status = 'delete_pending',
         active = false,
         updated_at = GREATEST(clock_timestamp(), created_at)
   WHERE tenant_id = p_tenant_id
     AND id = p_document_id;

  INSERT INTO public.knowledge_storage_cleanup (
    tenant_id, document_id, storage_path, reason, status, completed_at
  ) VALUES (
    p_tenant_id, p_document_id, existing_document.storage_path, 'delete',
    'pending', NULL
  )
  ON CONFLICT (storage_path) DO UPDATE
    SET reason = 'delete',
        status = 'pending',
        completed_at = NULL
  RETURNING id INTO cleanup_id;

  object_path := existing_document.storage_path;
  RETURN NEXT;
END
$begin_knowledge_document_delete$;

CREATE OR REPLACE FUNCTION public.complete_knowledge_document_delete(
  p_tenant_id uuid,
  p_document_id text,
  p_cleanup_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $complete_knowledge_document_delete$
DECLARE
  affected_rows integer;
  cleanup_status text;
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR p_cleanup_id IS NULL THEN
    RAISE EXCEPTION 'invalid_knowledge_document_delete_completion' USING ERRCODE = '22023';
  END IF;

  SELECT cleanup.status
    INTO cleanup_status
    FROM public.knowledge_storage_cleanup AS cleanup
   WHERE cleanup.id = p_cleanup_id
     AND cleanup.tenant_id = p_tenant_id
     AND cleanup.document_id = p_document_id
     AND cleanup.reason = 'delete'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF cleanup_status = 'completed' THEN
    RETURN NOT EXISTS (
      SELECT 1
        FROM public.knowledge_documents
       WHERE tenant_id = p_tenant_id
         AND id = p_document_id
    );
  END IF;

  UPDATE public.knowledge_storage_cleanup
     SET status = 'completed',
         attempt_count = attempt_count + 1,
         last_attempt_at = clock_timestamp(),
         completed_at = clock_timestamp()
   WHERE id = p_cleanup_id
     AND tenant_id = p_tenant_id
     AND document_id = p_document_id
     AND reason = 'delete';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN RETURN false; END IF;

  DELETE FROM public.knowledge_documents
   WHERE tenant_id = p_tenant_id
     AND id = p_document_id
     AND status = 'delete_pending';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 1 THEN RETURN true; END IF;
  RETURN NOT EXISTS (
    SELECT 1
      FROM public.knowledge_documents
     WHERE tenant_id = p_tenant_id
       AND id = p_document_id
  );
END
$complete_knowledge_document_delete$;

CREATE OR REPLACE FUNCTION public.complete_knowledge_storage_cleanup(
  p_tenant_id uuid,
  p_cleanup_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $complete_knowledge_storage_cleanup$
DECLARE
  affected_rows integer;
BEGIN
  IF p_tenant_id IS NULL OR p_cleanup_id IS NULL THEN
    RAISE EXCEPTION 'invalid_knowledge_cleanup_completion' USING ERRCODE = '22023';
  END IF;

  UPDATE public.knowledge_storage_cleanup
     SET status = 'completed',
         attempt_count = attempt_count + 1,
         last_attempt_at = clock_timestamp(),
         completed_at = clock_timestamp()
   WHERE id = p_cleanup_id
     AND tenant_id = p_tenant_id
     AND reason = 'replace'
     AND status = 'pending';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$complete_knowledge_storage_cleanup$;

REVOKE ALL ON FUNCTION public.import_legacy_knowledge_index(uuid, jsonb, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_knowledge_document(uuid, text, text, text, text, bigint, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_knowledge_document_active(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_knowledge_document_delete(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_knowledge_document_delete(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_knowledge_storage_cleanup(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

DO $knowledge_service_role_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.knowledge_documents TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE public.knowledge_storage_cleanup TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE public.knowledge_index_imports TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.import_legacy_knowledge_index(uuid, jsonb, boolean, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_knowledge_document(uuid, text, text, text, text, bigint, text, text, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_knowledge_document_active(uuid, text, boolean) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.begin_knowledge_document_delete(uuid, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_knowledge_document_delete(uuid, text, uuid) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_knowledge_storage_cleanup(uuid, uuid) TO service_role';
  END IF;
END
$knowledge_service_role_grants$;

COMMIT;


-- ==========================================
-- MIGRATION: 021_social_worker_hardening.sql
-- ==========================================

-- Durable state machine for scheduled social publication delivery.
-- Apply before deploying the worker/scheduler code that calls these RPCs.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.social_publications
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS dispatch_token uuid,
  ADD COLUMN IF NOT EXISTS dispatch_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_after timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  ADD COLUMN IF NOT EXISTS dispatch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_dispatch_error text,
  ADD COLUMN IF NOT EXISTS qstash_message_id text;

ALTER TABLE public.social_publications
  DROP CONSTRAINT IF EXISTS social_publications_status_check;

-- A pre-migration process may already have sent content to a provider. Do not
-- retry those rows automatically: their remote outcome must be reconciled.
UPDATE public.social_publications
SET status = 'dead',
    dead_at = pg_catalog.clock_timestamp(),
    lease_token = NULL,
    lease_expires_at = NULL,
    last_error_code = 'migration_processing_ambiguous',
    last_error = 'Existing processing publication requires provider reconciliation',
    updated_at = pg_catalog.clock_timestamp()
WHERE status = 'processing';

ALTER TABLE public.social_publications
  ADD CONSTRAINT social_publications_status_check CHECK (
    status IN ('pending', 'processing', 'retry', 'published', 'failed', 'dead')
  ) NOT VALID,
  ADD CONSTRAINT social_publications_worker_attempts_check CHECK (
    attempts >= 0 AND max_attempts BETWEEN 1 AND 20 AND dispatch_count >= 0
  ) NOT VALID,
  ADD CONSTRAINT social_publications_worker_lease_check CHECK (
    (
      status = 'processing'
      AND lease_token IS NOT NULL
      AND lease_expires_at IS NOT NULL
    ) OR (
      status <> 'processing'
      AND lease_token IS NULL
      AND lease_expires_at IS NULL
    )
  ) NOT VALID,
  ADD CONSTRAINT social_publications_dispatch_lease_check CHECK (
    (dispatch_token IS NULL AND dispatch_expires_at IS NULL)
    OR (dispatch_token IS NOT NULL AND dispatch_expires_at IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT social_publications_dead_check CHECK (
    (status = 'dead' AND dead_at IS NOT NULL)
    OR (status <> 'dead' AND dead_at IS NULL)
  ) NOT VALID,
  ADD CONSTRAINT social_publications_error_code_check CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_:-]{1,120}$'
  ) NOT VALID,
  ADD CONSTRAINT social_publications_qstash_id_check CHECK (
    qstash_message_id IS NULL OR pg_catalog.length(qstash_message_id) BETWEEN 1 AND 200
  ) NOT VALID;

ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_status_check;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_worker_attempts_check;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_worker_lease_check;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_dispatch_lease_check;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_dead_check;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_error_code_check;
ALTER TABLE public.social_publications
  VALIDATE CONSTRAINT social_publications_qstash_id_check;

CREATE INDEX IF NOT EXISTS social_publications_dispatch_due_idx
  ON public.social_publications (dispatch_after, available_at, scheduled_at, created_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS social_publications_worker_lease_idx
  ON public.social_publications (lease_expires_at)
  WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS social_publications_dispatch_lease_idx
  ON public.social_publications (dispatch_expires_at)
  WHERE dispatch_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_publications_dead_idx
  ON public.social_publications (dead_at)
  WHERE status = 'dead';

CREATE OR REPLACE FUNCTION public.claim_social_publication(
  p_publication_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 90
)
RETURNS TABLE (
  claim_state text,
  attempt_count integer,
  lease_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $claim_social_publication$
DECLARE
  publication public.social_publications%ROWTYPE;
  bounded_lease_seconds integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 90), 60), 300);
BEGIN
  IF p_publication_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'invalid_social_publication_claim' USING ERRCODE = '22023';
  END IF;

  SELECT queued.*
    INTO publication
    FROM public.social_publications AS queued
   WHERE queued.id = p_publication_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'missing'::text, 0, NULL::timestamptz;
    RETURN;
  END IF;

  IF publication.status IN ('published', 'failed', 'dead') THEN
    RETURN QUERY SELECT publication.status, publication.attempts, publication.lease_expires_at;
    RETURN;
  END IF;

  IF publication.status = 'processing' THEN
    IF publication.lease_expires_at > pg_catalog.clock_timestamp() THEN
      RETURN QUERY SELECT 'busy'::text, publication.attempts, publication.lease_expires_at;
      RETURN;
    END IF;

    IF publication.provider_started_at IS NOT NULL THEN
      UPDATE public.social_publications AS ambiguous
         SET status = 'dead',
             dead_at = pg_catalog.clock_timestamp(),
             lease_token = NULL,
             lease_expires_at = NULL,
             last_error_code = 'expired_provider_lease_ambiguous',
             last_error = 'Provider outcome is ambiguous; reconcile before retrying',
             updated_at = pg_catalog.clock_timestamp()
       WHERE ambiguous.id = publication.id;
      RETURN QUERY SELECT 'dead_ambiguous'::text, publication.attempts, NULL::timestamptz;
      RETURN;
    END IF;

    UPDATE public.social_publications AS recoverable
       SET status = 'retry',
           lease_token = NULL,
           lease_expires_at = NULL,
           available_at = pg_catalog.clock_timestamp(),
           last_error_code = 'expired_pre_provider_lease',
           last_error = 'Worker lease expired before provider delivery',
           updated_at = pg_catalog.clock_timestamp()
     WHERE recoverable.id = publication.id;

    SELECT queued.*
      INTO publication
      FROM public.social_publications AS queued
     WHERE queued.id = p_publication_id;
  END IF;

  IF publication.status NOT IN ('pending', 'retry') THEN
    RETURN QUERY SELECT 'invalid_state'::text, publication.attempts, publication.lease_expires_at;
    RETURN;
  END IF;

  IF COALESCE(publication.scheduled_at, publication.created_at) > pg_catalog.clock_timestamp()
     OR publication.available_at > pg_catalog.clock_timestamp() THEN
    RETURN QUERY SELECT 'not_due'::text, publication.attempts, NULL::timestamptz;
    RETURN;
  END IF;

  IF publication.attempts >= publication.max_attempts THEN
    UPDATE public.social_publications AS exhausted
       SET status = 'dead',
           dead_at = pg_catalog.clock_timestamp(),
           lease_token = NULL,
           lease_expires_at = NULL,
           last_error_code = COALESCE(exhausted.last_error_code, 'attempts_exhausted'),
           last_error = COALESCE(exhausted.last_error, 'Social publication retry limit reached'),
           updated_at = pg_catalog.clock_timestamp()
     WHERE exhausted.id = publication.id;
    RETURN QUERY SELECT 'dead'::text, publication.attempts, NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.social_publications AS claimed
     SET status = 'processing',
         attempts = claimed.attempts + 1,
         lease_token = p_lease_token,
         lease_expires_at = pg_catalog.clock_timestamp()
           + pg_catalog.make_interval(secs => bounded_lease_seconds),
         provider_started_at = NULL,
         dead_at = NULL,
         last_error_code = NULL,
         last_error = NULL,
         updated_at = pg_catalog.clock_timestamp()
   WHERE claimed.id = publication.id
  RETURNING 'claimed'::text, claimed.attempts, claimed.lease_expires_at;
END
$claim_social_publication$;

CREATE OR REPLACE FUNCTION public.mark_social_provider_started(
  p_publication_id uuid,
  p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $mark_social_provider_started$
DECLARE
  affected_rows integer;
BEGIN
  IF p_publication_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'invalid_social_provider_start' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publications AS publication
     SET provider_started_at = COALESCE(publication.provider_started_at, pg_catalog.clock_timestamp()),
         updated_at = pg_catalog.clock_timestamp()
   WHERE publication.id = p_publication_id
     AND publication.status = 'processing'
     AND publication.lease_token = p_lease_token
     AND publication.lease_expires_at > pg_catalog.clock_timestamp();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$mark_social_provider_started$;

CREATE OR REPLACE FUNCTION public.complete_social_publication(
  p_publication_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_external_media_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_retry_seconds integer DEFAULT 30
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $complete_social_publication$
DECLARE
  publication public.social_publications%ROWTYPE;
  bounded_retry_seconds integer := LEAST(GREATEST(COALESCE(p_retry_seconds, 30), 5), 3600);
  normalized_error_code text;
BEGIN
  IF p_publication_id IS NULL
     OR p_lease_token IS NULL
     OR p_outcome NOT IN ('published', 'retry', 'dead') THEN
    RAISE EXCEPTION 'invalid_social_publication_completion' USING ERRCODE = '22023';
  END IF;

  normalized_error_code := NULLIF(
    pg_catalog.left(
      pg_catalog.regexp_replace(
        pg_catalog.lower(COALESCE(p_error_code, 'social_worker_failure')),
        '[^a-z0-9_:-]',
        '',
        'g'
      ),
      120
    ),
    ''
  );

  SELECT current_publication.*
    INTO publication
    FROM public.social_publications AS current_publication
   WHERE current_publication.id = p_publication_id
     AND current_publication.status = 'processing'
     AND current_publication.lease_token = p_lease_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'lease_lost';
  END IF;

  IF p_outcome = 'published' THEN
    IF p_external_media_id IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_external_media_id)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'invalid_social_publication_media_id' USING ERRCODE = '22023';
    END IF;

    UPDATE public.social_publications AS completed
       SET status = 'published',
           external_media_id = pg_catalog.btrim(p_external_media_id),
           published_at = pg_catalog.clock_timestamp(),
           lease_token = NULL,
           lease_expires_at = NULL,
           provider_started_at = NULL,
           dead_at = NULL,
           last_error_code = NULL,
           last_error = NULL,
           updated_at = pg_catalog.clock_timestamp()
     WHERE completed.id = publication.id;
    RETURN 'published';
  END IF;

  IF p_outcome = 'retry' AND publication.attempts < publication.max_attempts THEN
    UPDATE public.social_publications AS retryable
       SET status = 'retry',
           available_at = pg_catalog.clock_timestamp()
             + pg_catalog.make_interval(secs => bounded_retry_seconds),
           lease_token = NULL,
           lease_expires_at = NULL,
           provider_started_at = NULL,
           dead_at = NULL,
           last_error_code = COALESCE(normalized_error_code, 'social_worker_failure'),
           last_error = pg_catalog.left(COALESCE(p_error_message, 'Social publication failed'), 1000),
           updated_at = pg_catalog.clock_timestamp()
     WHERE retryable.id = publication.id;
    RETURN 'retry';
  END IF;

  UPDATE public.social_publications AS terminal
     SET status = 'dead',
         dead_at = pg_catalog.clock_timestamp(),
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = CASE
           WHEN p_outcome = 'retry' THEN 'attempts_exhausted'
           ELSE COALESCE(normalized_error_code, 'social_worker_failure')
         END,
         last_error = pg_catalog.left(COALESCE(p_error_message, 'Social publication failed'), 1000),
         updated_at = pg_catalog.clock_timestamp()
   WHERE terminal.id = publication.id;
  RETURN 'dead';
END
$complete_social_publication$;

CREATE OR REPLACE FUNCTION public.claim_due_social_dispatches(
  p_dispatch_token uuid,
  p_limit integer DEFAULT 10,
  p_tenant_id uuid DEFAULT NULL,
  p_lease_seconds integer DEFAULT 120
)
RETURNS TABLE (publication_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $claim_due_social_dispatches$
DECLARE
  bounded_lease_seconds integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 120), 30), 300);
BEGIN
  IF p_dispatch_token IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid_social_dispatch_claim' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS MATERIALIZED (
    SELECT queued.id
      FROM public.social_publications AS queued
     WHERE queued.status IN ('pending', 'retry')
       AND queued.attempts < queued.max_attempts
       AND (p_tenant_id IS NULL OR queued.tenant_id = p_tenant_id)
       AND COALESCE(queued.scheduled_at, queued.created_at) <= pg_catalog.clock_timestamp()
       AND queued.available_at <= pg_catalog.clock_timestamp()
       AND queued.dispatch_after <= pg_catalog.clock_timestamp()
       AND (
         queued.dispatch_token IS NULL
         OR queued.dispatch_expires_at <= pg_catalog.clock_timestamp()
       )
     ORDER BY COALESCE(queued.scheduled_at, queued.created_at), queued.created_at, queued.id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  )
  UPDATE public.social_publications AS claimed
     SET dispatch_token = p_dispatch_token,
         dispatch_expires_at = pg_catalog.clock_timestamp()
           + pg_catalog.make_interval(secs => bounded_lease_seconds),
         dispatch_count = claimed.dispatch_count + 1,
         last_dispatch_attempt_at = pg_catalog.clock_timestamp(),
         updated_at = pg_catalog.clock_timestamp()
    FROM candidates
   WHERE claimed.id = candidates.id
  RETURNING claimed.id;
END
$claim_due_social_dispatches$;

CREATE OR REPLACE FUNCTION public.complete_social_dispatch(
  p_publication_id uuid,
  p_dispatch_token uuid,
  p_succeeded boolean,
  p_qstash_message_id text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $complete_social_dispatch$
DECLARE
  affected_rows integer;
BEGIN
  IF p_publication_id IS NULL OR p_dispatch_token IS NULL OR p_succeeded IS NULL THEN
    RAISE EXCEPTION 'invalid_social_dispatch_completion' USING ERRCODE = '22023';
  END IF;

  IF p_succeeded AND (
    p_qstash_message_id IS NULL
    OR pg_catalog.length(pg_catalog.btrim(p_qstash_message_id)) NOT BETWEEN 1 AND 200
  ) THEN
    RAISE EXCEPTION 'invalid_social_dispatch_message_id' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publications AS publication
     SET dispatch_token = NULL,
         dispatch_expires_at = NULL,
         dispatch_after = pg_catalog.clock_timestamp()
           + CASE WHEN p_succeeded THEN INTERVAL '3 minutes' ELSE INTERVAL '30 seconds' END,
         last_dispatched_at = CASE
           WHEN p_succeeded THEN pg_catalog.clock_timestamp()
           ELSE publication.last_dispatched_at
         END,
         qstash_message_id = CASE
           WHEN p_succeeded THEN pg_catalog.btrim(p_qstash_message_id)
           ELSE publication.qstash_message_id
         END,
         last_dispatch_error = CASE
           WHEN p_succeeded THEN NULL
           ELSE pg_catalog.left(COALESCE(p_error_message, 'social_dispatch_failed'), 500)
         END,
         updated_at = pg_catalog.clock_timestamp()
   WHERE publication.id = p_publication_id
     AND publication.dispatch_token = p_dispatch_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$complete_social_dispatch$;

CREATE OR REPLACE FUNCTION public.recover_expired_social_publications(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (retry_count integer, dead_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $recover_expired_social_publications$
DECLARE
  recovered integer := 0;
  terminal integer := 0;
  newly_terminal integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid_social_recovery_limit' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT publication.id
      FROM public.social_publications AS publication
     WHERE publication.status = 'processing'
       AND publication.lease_expires_at <= pg_catalog.clock_timestamp()
       AND publication.provider_started_at IS NOT NULL
     ORDER BY publication.lease_expires_at, publication.id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  )
  UPDATE public.social_publications AS ambiguous
     SET status = 'dead',
         dead_at = pg_catalog.clock_timestamp(),
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = 'expired_provider_lease_ambiguous',
         last_error = 'Provider outcome is ambiguous; reconcile before retrying',
         updated_at = pg_catalog.clock_timestamp()
    FROM candidates
   WHERE ambiguous.id = candidates.id;
  GET DIAGNOSTICS terminal = ROW_COUNT;

  WITH candidates AS MATERIALIZED (
    SELECT publication.id
      FROM public.social_publications AS publication
     WHERE publication.status = 'processing'
       AND publication.lease_expires_at <= pg_catalog.clock_timestamp()
       AND publication.provider_started_at IS NULL
     ORDER BY publication.lease_expires_at, publication.id
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(p_limit - terminal, 0)
  ), updated AS (
    UPDATE public.social_publications AS recoverable
     SET status = CASE
           WHEN recoverable.attempts >= recoverable.max_attempts THEN 'dead'
           ELSE 'retry'
         END,
         dead_at = CASE
           WHEN recoverable.attempts >= recoverable.max_attempts
             THEN pg_catalog.clock_timestamp()
           ELSE NULL
         END,
         available_at = pg_catalog.clock_timestamp(),
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = CASE
           WHEN recoverable.attempts >= recoverable.max_attempts
             THEN 'attempts_exhausted'
           ELSE 'expired_pre_provider_lease'
         END,
         last_error = CASE
           WHEN recoverable.attempts >= recoverable.max_attempts
             THEN 'Social publication retry limit reached'
           ELSE 'Worker lease expired before provider delivery'
         END,
         updated_at = pg_catalog.clock_timestamp()
      FROM candidates
     WHERE recoverable.id = candidates.id
    RETURNING recoverable.status
  )
  SELECT
    (pg_catalog.count(*) FILTER (WHERE updated.status = 'retry'))::integer,
    (pg_catalog.count(*) FILTER (WHERE updated.status = 'dead'))::integer
    INTO recovered, newly_terminal
    FROM updated;

  terminal := terminal + newly_terminal;

  RETURN QUERY SELECT recovered, terminal;
END
$recover_expired_social_publications$;

CREATE OR REPLACE FUNCTION public.get_social_publication_health()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $get_social_publication_health$
  SELECT pg_catalog.jsonb_build_object(
    'pending', pg_catalog.count(*) FILTER (
      WHERE publication.status IN ('pending', 'retry', 'processing')
    ),
    'due', pg_catalog.count(*) FILTER (
      WHERE publication.status IN ('pending', 'retry')
        AND COALESCE(publication.scheduled_at, publication.created_at) <= pg_catalog.clock_timestamp()
        AND publication.available_at <= pg_catalog.clock_timestamp()
    ),
    'processing', pg_catalog.count(*) FILTER (WHERE publication.status = 'processing'),
    'dead', pg_catalog.count(*) FILTER (WHERE publication.status = 'dead'),
    'expired_leases', pg_catalog.count(*) FILTER (
      WHERE publication.status = 'processing'
        AND publication.lease_expires_at <= pg_catalog.clock_timestamp()
    ),
    'oldest_due_at', pg_catalog.min(
      GREATEST(
        COALESCE(publication.scheduled_at, publication.created_at),
        publication.available_at
      )
    ) FILTER (
      WHERE publication.status IN ('pending', 'retry')
        AND COALESCE(publication.scheduled_at, publication.created_at) <= pg_catalog.clock_timestamp()
        AND publication.available_at <= pg_catalog.clock_timestamp()
    )
  )
  FROM public.social_publications AS publication;
$get_social_publication_health$;

REVOKE ALL ON FUNCTION public.claim_social_publication(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_social_provider_started(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_social_publication(
  uuid, uuid, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_due_social_dispatches(uuid, integer, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_social_dispatch(uuid, uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_expired_social_publications(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_social_publication_health()
  FROM PUBLIC, anon, authenticated;

DO $social_worker_function_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_social_publication(uuid, uuid, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_social_provider_started(uuid, uuid) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_social_publication(uuid, uuid, text, text, text, text, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_due_social_dispatches(uuid, integer, uuid, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_social_dispatch(uuid, uuid, boolean, text, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.recover_expired_social_publications(integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_social_publication_health() TO service_role';
  END IF;
END
$social_worker_function_grants$;

COMMENT ON FUNCTION public.claim_social_publication(uuid, uuid, integer) IS
  'Atomically claims one due publication and dead-letters an expired provider-side lease rather than risking a duplicate post.';
COMMENT ON FUNCTION public.claim_due_social_dispatches(uuid, integer, uuid, integer) IS
  'Claims a bounded due batch for QStash dispatch with FOR UPDATE SKIP LOCKED.';
COMMENT ON FUNCTION public.get_social_publication_health() IS
  'Returns aggregate social queue, dead-letter, and expired-lease health without exposing tenant rows.';

COMMIT;


-- ==========================================
-- MIGRATION: 022_password_reset.sql
-- ==========================================

-- Agrega soporte para el restablecimiento de contraseña de inquilinos
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS reset_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_reset_token ON public.tenants (reset_token);


-- ==========================================
-- MIGRATION: 023_config_tenant_unique.sql
-- ==========================================

-- ============================================================================
-- RIFX Marketing - Fix config table: enforce one row per tenant
-- ============================================================================
-- Problem: config table had no UNIQUE constraint on tenant_id.
-- The upsert(onConflict: 'tenant_id') in /api/panel/config was silently
-- doing nothing (Postgres requires a unique/exclusion constraint for the
-- ON CONFLICT clause to work). Each POST could INSERT a new row instead of
-- UPDATEing the existing one, causing one tenant's config to leak into
-- another's reads via .maybeSingle().
--
-- Fix:
--   1. Deduplicate any existing extra rows, keeping the most recently updated.
--   2. Add UNIQUE (tenant_id) to enforce one-row-per-tenant going forward.
--   3. Add FORCE ROW LEVEL SECURITY (defense in depth).
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout  = '10s';
SET LOCAL statement_timeout = '5min';

-- --------------------------------------------------------------------------
-- 1. Remove duplicate config rows, keeping the most recently updated one.
--    Uses a CTE to identify the canonical row (max updated_at) per tenant.
-- --------------------------------------------------------------------------
DELETE FROM public.config
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id
        ORDER BY updated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.config
  ) ranked
  WHERE rn > 1
);

-- --------------------------------------------------------------------------
-- 2. Add UNIQUE constraint on tenant_id so:
--    a) upsert(onConflict:'tenant_id') works correctly
--    b) No two tenants can ever share a config row
-- --------------------------------------------------------------------------
ALTER TABLE public.config
  ADD CONSTRAINT config_tenant_id_unique UNIQUE (tenant_id);

-- --------------------------------------------------------------------------
-- 3. Ensure FORCE RLS is set (defense-in-depth, though service_role bypasses).
-- --------------------------------------------------------------------------
ALTER TABLE public.config FORCE ROW LEVEL SECURITY;

COMMIT;


-- ==========================================
-- MIGRATION: 024_whatsapp_connection_integrity.sql
-- ==========================================

-- ============================================================================
-- RIFX Marketing - WhatsApp connection visibility and ownership integrity
-- ============================================================================
-- This migration repairs schema drift without guessing which tenant owns a
-- connection. It intentionally aborts when ownership is ambiguous. Resolve the
-- reported rows manually from verified Meta/account records, then run it again.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

DO $whatsapp_schema_preflight$
DECLARE
  missing_columns text;
BEGIN
  IF to_regclass('public.tenants') IS NULL
     OR to_regclass('public.config') IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = '024_whatsapp_connection_integrity aborted: public.tenants or public.config is missing',
      HINT = 'Apply the baseline migrations before this integrity migration.';
  END IF;

  WITH required(table_name, column_name, data_type) AS (
    VALUES
      ('tenants', 'id', 'uuid'),
      ('config', 'id', 'uuid'),
      ('config', 'tenant_id', 'uuid'),
      ('config', 'whatsapp_token', 'text'),
      ('config', 'whatsapp_phone_id', 'text')
  )
  SELECT string_agg(format('%I.%I (%s)', r.table_name, r.column_name, r.data_type), ', ')
    INTO missing_columns
  FROM required AS r
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.table_name
      AND c.column_name = r.column_name
      AND c.data_type = r.data_type
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        '024_whatsapp_connection_integrity aborted: required columns are missing or have the wrong type: %s',
        missing_columns
      ),
      HINT = 'Reconcile schema drift without coercing or deleting connection data.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'config'
      AND column_name = 'wa_display_phone'
      AND data_type <> 'text'
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '024_whatsapp_connection_integrity aborted: config.wa_display_phone is not text',
      HINT = 'Inspect the existing column before changing its type.';
  END IF;
END
$whatsapp_schema_preflight$;

-- Keep the preflight result stable until all constraints and indexes exist.
-- Lock the parent first to match the foreign-key ownership order.
LOCK TABLE public.tenants IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.config IN SHARE ROW EXCLUSIVE MODE;

-- The display value is optional metadata. API correctness must continue to use
-- the immutable config.id and provider phone ID, even when this column is null.
ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS wa_display_phone text;

DO $whatsapp_data_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.config AS cfg
    WHERE cfg.tenant_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.tenants AS tenant
         WHERE tenant.id = cfg.tenant_id
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '024_whatsapp_connection_integrity aborted: config contains an unowned or orphan row',
      HINT = 'Verify and assign the real tenant owner; this migration will not delete or guess one.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.config
    GROUP BY tenant_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '024_whatsapp_connection_integrity aborted: a tenant has multiple config rows',
      HINT = 'Merge the rows only after verifying every credential; this migration will not choose a winner.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.config
    WHERE whatsapp_phone_id IS NOT NULL
      AND whatsapp_phone_id <> btrim(whatsapp_phone_id)
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '024_whatsapp_connection_integrity aborted: a WhatsApp phone ID has surrounding whitespace',
      HINT = 'Verify the identifier with Meta before normalizing it.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.config
    WHERE whatsapp_phone_id IS NOT NULL
      AND btrim(whatsapp_phone_id) <> ''
    GROUP BY whatsapp_phone_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '024_whatsapp_connection_integrity aborted: one WhatsApp phone ID has multiple owners',
      HINT = 'Verify the real owner; this migration will not disconnect accounts or choose one.';
  END IF;
END
$whatsapp_data_preflight$;

ALTER TABLE public.config
  ALTER COLUMN tenant_id SET NOT NULL;

-- These indexes may coexist with an older equivalent constraint/index. Their
-- stable names make this repair safe to re-run after a failed deployment.
CREATE UNIQUE INDEX IF NOT EXISTS config_tenant_id_integrity_uidx
  ON public.config (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS config_whatsapp_phone_id_integrity_uidx
  ON public.config (whatsapp_phone_id)
  WHERE whatsapp_phone_id IS NOT NULL AND btrim(whatsapp_phone_id) <> '';

-- Detect an equivalent FK by its catalog identity rather than by its name. If
-- an older migration already installed it, no duplicate constraint is added.
DO $whatsapp_tenant_fk$
DECLARE
  config_tenant_attnum smallint;
  tenant_id_attnum smallint;
  constraint_to_validate name;
BEGIN
  SELECT attnum
    INTO config_tenant_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.config'::regclass
    AND attname = 'tenant_id'
    AND NOT attisdropped;

  SELECT attnum
    INTO tenant_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.tenants'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = 'public.config'::regclass
      AND constraint_row.confrelid = 'public.tenants'::regclass
      AND constraint_row.conkey = ARRAY[config_tenant_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[tenant_id_attnum]::smallint[]
      AND constraint_row.confdeltype = 'c'
  ) THEN
    ALTER TABLE public.config
      ADD CONSTRAINT config_tenant_id_integrity_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.tenants(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  FOR constraint_to_validate IN
    SELECT constraint_row.conname
    FROM pg_constraint AS constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = 'public.config'::regclass
      AND constraint_row.confrelid = 'public.tenants'::regclass
      AND constraint_row.conkey = ARRAY[config_tenant_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[tenant_id_attnum]::smallint[]
      AND constraint_row.confdeltype = 'c'
      AND NOT constraint_row.convalidated
  LOOP
    EXECUTE format(
      'ALTER TABLE public.config VALIDATE CONSTRAINT %I',
      constraint_to_validate
    );
  END LOOP;
END
$whatsapp_tenant_fk$;

ALTER TABLE public.config FORCE ROW LEVEL SECURITY;

COMMENT ON INDEX public.config_whatsapp_phone_id_integrity_uidx IS
  'Prevents one non-empty WhatsApp provider phone ID from belonging to multiple config rows.';

COMMIT;


-- ==========================================
-- MIGRATION: add_phone_auth.sql
-- ==========================================

-- Add phone number field to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_tenants_phone ON tenants(phone) WHERE phone IS NOT NULL;

-- Add constraint to ensure either email or phone is present
ALTER TABLE tenants
ADD CONSTRAINT tenants_email_or_phone_check
CHECK (email IS NOT NULL OR phone IS NOT NULL);

COMMENT ON COLUMN tenants.phone IS 'Phone number in E.164 format (+593984123456)';
COMMENT ON COLUMN tenants.phone_verified IS 'Whether the phone number has been verified via OTP';
COMMENT ON COLUMN tenants.phone_verified_at IS 'When the phone was verified';


