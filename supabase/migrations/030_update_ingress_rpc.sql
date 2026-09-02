-- ============================================================================
-- RIFX Marketing - 030: Update WhatsApp Ingress for Multi-Account
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

-- 1. Modify the return type of claim_whatsapp_ingress to include destination_phone_id
-- We must DROP and RECREATE the function because changing the return type signature
-- of a table-returning function is not allowed with simply CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.claim_whatsapp_ingress(uuid, integer);

CREATE FUNCTION public.claim_whatsapp_ingress(
  p_processing_token uuid,
  p_lease_seconds integer DEFAULT 600
)
RETURNS TABLE (
  ingress_id uuid,
  tenant_id uuid,
  provider_message_id text,
  destination_phone_id text,
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
  WITH claim AS (
    SELECT w.id
      FROM public.whatsapp_ingress AS w
     WHERE w.status IN ('queued', 'retry', 'processing')
       AND (w.status <> 'processing' OR w.lease_until <= clock_timestamp())
       AND w.attempt_count < w.max_attempts
     ORDER BY w.status DESC, w.created_at ASC
     LIMIT 1
       FOR NO KEY UPDATE OF w SKIP LOCKED
  )
  UPDATE public.whatsapp_ingress AS target
     SET status = 'processing',
         lease_token = p_processing_token,
         lease_until = clock_timestamp() + make_interval(secs := lease_seconds),
         attempt_count = target.attempt_count + 1,
         updated_at = clock_timestamp()
    FROM claim
   WHERE target.id = claim.id
  RETURNING target.id, target.tenant_id, target.provider_message_id, target.destination_phone_id, target.payload, target.attempt_count;
END
$claim_ingress_function$;


-- 2. Update the enqueue function to map based on whatsapp_accounts instead of config
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
  matched_account_count integer;
  inserted_rows integer;
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

    -- Lookup tenant from the new whatsapp_accounts table
    SELECT count(wa.tenant_id)::integer,
           (array_agg(wa.tenant_id ORDER BY wa.tenant_id))[1]
      INTO matched_account_count, matched_tenant_id
      FROM public.whatsapp_accounts AS wa
     WHERE wa.phone_number_id = event_phone_id;

    -- We allow it if we can uniquely identify the tenant
    IF matched_account_count <> 1 OR matched_tenant_id IS NULL THEN
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
    ELSE
      -- Need to determine if it was a duplicate payload or a conflict
      IF EXISTS (
        SELECT 1 FROM public.whatsapp_ingress
         WHERE provider_message_id = event_message_id
           AND payload_sha256 = event_payload_hash
      ) THEN
        duplicate_count := duplicate_count + 1;
      ELSE
        conflict_count := conflict_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN NEXT;
END
$enqueue_function$;


DO $grant_service_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_ingress_batch(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_whatsapp_ingress(uuid, integer) TO service_role';
  END IF;
END
$grant_service_role$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_ingress(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_whatsapp_ingress_batch(jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
