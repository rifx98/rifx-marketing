-- ============================================
-- RIFX Marketing — Supabase pg_cron Setup
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase para programar las llamadas.
--
-- Antes de ejecutarlo, crea exactamente un secreto de cada nombre en Supabase
-- Vault (Dashboard > Project Settings > Vault). Nunca guardes sus valores aquí:
--   cron_secret   = el mismo CRON_SECRET configurado en el runtime de Next.js
--   cron_base_url = el origen HTTPS, sin path (por ejemplo, https://app.example.com)

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- La función centraliza la lectura de Vault y falla antes de realizar la
-- petición si la configuración falta, está duplicada o no es válida.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.invoke_cron_endpoint(p_path text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_cron_secret text;
  v_base_url text;
  v_request_id bigint;
BEGIN
  IF p_path IS NULL OR p_path !~ '^/api/cron/[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid cron endpoint path';
  END IF;

  -- STRICT rejects both a missing secret and duplicate names.
  SELECT decrypted_secret
    INTO STRICT v_cron_secret
    FROM vault.decrypted_secrets
   WHERE name = 'cron_secret';

  SELECT decrypted_secret
    INTO STRICT v_base_url
    FROM vault.decrypted_secrets
   WHERE name = 'cron_base_url';

  v_cron_secret := pg_catalog.btrim(v_cron_secret);
  v_base_url := pg_catalog.rtrim(pg_catalog.btrim(v_base_url), '/');

  IF pg_catalog.length(v_cron_secret) < 32 THEN
    RAISE EXCEPTION 'Vault secret cron_secret is missing or invalid';
  END IF;

  IF v_base_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' THEN
    RAISE EXCEPTION 'Vault secret cron_base_url must be an HTTPS origin without a path';
  END IF;

  SELECT net.http_post(
    url := v_base_url || p_path,
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    ),
    body := '{}'::jsonb
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

REVOKE ALL ON FUNCTION private.invoke_cron_endpoint(text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Re-crear el job de citas de forma idempotente.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'invoke-appointments-cron';

SELECT cron.schedule(
  'invoke-appointments-cron',
  '*/15 * * * *',
  $$SELECT private.invoke_cron_endpoint('/api/cron/appointments');$$
);

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'invoke-messages-cron';

-- Reconcile/enqueue scheduled social publications. The endpoint dispatches
-- long-running provider work to QStash; it does not perform uploads inline.
SELECT cron.schedule(
  'invoke-messages-cron',
  '*/5 * * * *',
  $$SELECT private.invoke_cron_endpoint('/api/cron/messages');$$
);

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'invoke-whatsapp-cron';

-- La cola usa leases y SKIP LOCKED; invocaciones solapadas no procesan el
-- mismo mensaje. Una frecuencia de un minuto reduce la latencia del ACK async.
SELECT cron.schedule(
  'invoke-whatsapp-cron',
  '* * * * *',
  $$SELECT private.invoke_cron_endpoint('/api/cron/whatsapp');$$
);

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'invoke-cold-leads-cron';

-- 10:00 UTC = 05:00 America/Bogota (pg_cron schedules are UTC by default).
SELECT cron.schedule(
  'invoke-cold-leads-cron',
  '0 10 * * *',
  $$SELECT private.invoke_cron_endpoint('/api/cron/cold-leads');$$
);

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'invoke-cleanup-media-cron';

SELECT cron.schedule(
  'invoke-cleanup-media-cron',
  '0 6 * * *',
  $$SELECT private.invoke_cron_endpoint('/api/cron/cleanup-media');$$
);

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'invoke-monthly-briefing-cron';

-- 12:00 UTC del primer día de cada mes. La entrega tiene una clave única por
-- tenant y período, por lo que una reejecución manual o de otro scheduler no
-- vuelve a enviar un briefing que ya fue completado.
SELECT cron.schedule(
  'invoke-monthly-briefing-cron',
  '0 12 1 * *',
  $$SELECT private.invoke_cron_endpoint('/api/cron/monthly-briefing');$$
);

-- Verificación (no muestra secretos):
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
