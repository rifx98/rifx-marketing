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
