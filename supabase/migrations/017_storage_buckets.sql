-- ============================================================================
-- RIFX Marketing - reproducible, private Supabase Storage bootstrap
-- ============================================================================
-- The application accesses these buckets only with the server-side service
-- role. Browser clients must use an authenticated API route, a short-lived
-- signed URL, or the narrowly scoped public marketing-asset proxy.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

DO $storage_preflight$
DECLARE
  missing_columns text;
BEGIN
  IF to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = '017_storage_buckets aborted: Supabase Storage is not installed',
      HINT = 'Enable Supabase Storage in the target project before applying this migration.';
  END IF;

  WITH required(table_name, column_name) AS (
    VALUES
      ('buckets', 'id'),
      ('buckets', 'name'),
      ('buckets', 'public'),
      ('buckets', 'file_size_limit'),
      ('buckets', 'allowed_mime_types'),
      ('objects', 'bucket_id')
  )
  SELECT string_agg(format('storage.%I.%I', required.table_name, required.column_name), ', ')
    INTO missing_columns
  FROM required
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS column_definition
    WHERE column_definition.table_schema = 'storage'
      AND column_definition.table_name = required.table_name
      AND column_definition.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      '017_storage_buckets aborted: required Storage columns are missing: %',
      missing_columns;
  END IF;
END
$storage_preflight$;

-- Upsert the exact bucket contract. Reapplying this migration also repairs a
-- bucket that was accidentally made public or had its limits relaxed.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'knowledge-base',
    'knowledge-base',
    false,
    10485760,
    ARRAY[
      'application/csv',
      'application/json',
      'application/msword',
      'application/octet-stream',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/x-csv',
      'text/csv',
      'text/plain',
      'text/x-csv'
    ]::text[]
  ),
  (
    'chat_media',
    'chat_media',
    false,
    16777216,
    ARRAY[
      'application/msword',
      'application/octet-stream',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/aac',
      'audio/amr',
      'audio/mp3',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm',
      'image/gif',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'text/csv',
      'text/plain',
      'video/3gpp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ]::text[]
  ),
  (
    'uploads',
    'uploads',
    false,
    5242880,
    ARRAY[
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- These restrictive policies remain a deny boundary for the three managed
-- buckets even if a future operator accidentally restores table grants or a
-- permissive policy. For unrelated buckets the predicate is neutral.
DROP POLICY IF EXISTS rifx_private_buckets_service_role_only
  ON storage.buckets;
CREATE POLICY rifx_private_buckets_service_role_only
  ON storage.buckets
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]))
  WITH CHECK (id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]));

DROP POLICY IF EXISTS rifx_private_objects_service_role_only
  ON storage.objects;
CREATE POLICY rifx_private_objects_service_role_only
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]))
  WITH CHECK (bucket_id <> ALL (ARRAY['knowledge-base', 'chat_media', 'uploads']::text[]));

-- No browser role needs direct SQL access to Storage. The explicit service-role
-- grants are intentionally narrower than ALL and are applied only when the
-- standard Supabase role exists (useful for schema-only validation tooling).
REVOKE ALL ON TABLE storage.buckets, storage.objects FROM PUBLIC;
REVOKE USAGE ON SCHEMA storage FROM PUBLIC;

DO $storage_role_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE storage.buckets, storage.objects FROM anon';
    EXECUTE 'REVOKE USAGE ON SCHEMA storage FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE storage.buckets, storage.objects FROM authenticated';
    EXECUTE 'REVOKE USAGE ON SCHEMA storage FROM authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA storage TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE storage.buckets TO service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO service_role';
  END IF;
END
$storage_role_grants$;

COMMIT;
