-- ============================================
-- RIFX Marketing — Supabase pg_cron Setup
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase para programar las llamadas a Vercel.

-- 1. Habilitar la extensión para hacer peticiones HTTP (obligatorio)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Eliminar el cron si ya existía (opcional, para poder re-crearlo)
-- SELECT cron.unschedule('invoke-appointments-cron');

-- 3. Crear el cron de Citas (cada 15 minutos)
SELECT cron.schedule(
  'invoke-appointments-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
      url := 'https://rifx-marketinggithubio-main.vercel.app/api/cron/appointments',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer rifx_cron_2026_xK9mP3qL7nVwZtYb"}'::jsonb,
      body := '{}'::jsonb
  )
  $$
);

-- ============================================================
-- EJEMPLOS ADICIONALES (descomenta según necesites los demás):
-- ============================================================

/*
-- Cron para Cold Leads (ejecutar todos los días a las 10:00 AM)
SELECT cron.schedule(
  'invoke-cold-leads-cron',
  '0 10 * * *',
  $$
  SELECT net.http_post(
      url := 'https://rifx-marketinggithubio-main.vercel.app/api/cron/cold-leads',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer rifx_cron_2026_xK9mP3qL7nVwZtYb"}'::jsonb,
      body := '{}'::jsonb
  )
  $$
);

-- Cron para Cleanup Media (ejecutar una vez al día a medianoche)
SELECT cron.schedule(
  'invoke-cleanup-media-cron',
  '0 0 * * *',
  $$
  SELECT net.http_post(
      url := 'https://rifx-marketinggithubio-main.vercel.app/api/cron/cleanup-media',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer rifx_cron_2026_xK9mP3qL7nVwZtYb"}'::jsonb,
      body := '{}'::jsonb
  )
  $$
);
*/

-- 4. Para verificar que los jobs se crearon correctamente, puedes ejecutar:
-- SELECT * FROM cron.job;
