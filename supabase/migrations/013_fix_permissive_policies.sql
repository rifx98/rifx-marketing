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
