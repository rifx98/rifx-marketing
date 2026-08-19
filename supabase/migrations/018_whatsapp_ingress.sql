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
