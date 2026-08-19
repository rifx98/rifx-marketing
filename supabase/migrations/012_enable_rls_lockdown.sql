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
