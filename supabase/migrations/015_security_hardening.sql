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
    RAISE EXCEPTION
      '015_security_hardening aborted: application compatibility columns have unexpected types';
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
