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
