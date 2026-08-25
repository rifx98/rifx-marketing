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
