-- ============================================================================
-- Transactional knowledge-base metadata and durable Storage cleanup
-- ============================================================================
-- Apply before deploying the knowledge API that uses public.knowledge_documents.
-- The legacy <tenant>/index.json object is imported by the application exactly
-- once per tenant and is deliberately retained as a non-authoritative backup.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

DO $knowledge_preflight$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION '020_knowledge_documents aborted: public.tenants is missing';
  END IF;

  IF to_regclass('public.knowledge_documents') IS NOT NULL
     OR to_regclass('public.knowledge_storage_cleanup') IS NOT NULL
     OR to_regclass('public.knowledge_index_imports') IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = '020_knowledge_documents aborted: a migration-owned table already exists',
      HINT = 'Inspect the partial/manual schema and reconcile migration history before retrying.';
  END IF;
END
$knowledge_preflight$;

CREATE TABLE public.knowledge_documents (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content text NOT NULL,
  sha256 text,
  active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT knowledge_documents_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT knowledge_documents_tenant_file_unique UNIQUE (tenant_id, file_name),
  CONSTRAINT knowledge_documents_id_check CHECK (
    id ~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT knowledge_documents_file_name_check CHECK (
    length(file_name) BETWEEN 1 AND 160
    AND file_name = btrim(file_name)
    AND file_name NOT IN ('.', '..')
    AND file_name ~ '^[A-Za-z0-9._-]+$'
    AND position('/' IN file_name) = 0
    AND position(chr(92) IN file_name) = 0
  ),
  CONSTRAINT knowledge_documents_file_type_check CHECK (
    file_type IN ('txt', 'text', 'csv', 'pdf', 'doc', 'docx')
    AND lower(right(file_name, length(file_type) + 1)) = '.' || file_type
  ),
  CONSTRAINT knowledge_documents_mime_check CHECK (
    (file_type IN ('txt', 'text') AND mime_type = 'text/plain')
    OR (file_type = 'csv' AND mime_type = 'text/csv')
    OR (file_type = 'pdf' AND mime_type = 'application/pdf')
    OR (file_type = 'doc' AND mime_type = 'application/msword')
    OR (
      file_type = 'docx'
      AND mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  CONSTRAINT knowledge_documents_size_check CHECK (
    file_size_bytes BETWEEN 1 AND 10485760
  ),
  CONSTRAINT knowledge_documents_storage_path_check CHECK (
    length(storage_path) BETWEEN 45 AND 260
    AND left(storage_path, length(tenant_id::text) + 7) = tenant_id::text || '/files/'
    AND substring(storage_path FROM length(tenant_id::text) + 8) ~ '^[A-Za-z0-9._-]+$'
  ),
  CONSTRAINT knowledge_documents_content_check CHECK (
    char_length(content) BETWEEN 1 AND 51024
    AND octet_length(content) <= 204096
  ),
  CONSTRAINT knowledge_documents_sha256_check CHECK (
    sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT knowledge_documents_status_check CHECK (
    status IN ('ready', 'delete_pending')
  ),
  CONSTRAINT knowledge_documents_timestamp_check CHECK (updated_at >= created_at)
);

CREATE INDEX knowledge_documents_tenant_ready_idx
  ON public.knowledge_documents (tenant_id, created_at DESC, id)
  WHERE status = 'ready';
CREATE INDEX knowledge_documents_tenant_active_idx
  ON public.knowledge_documents (tenant_id, updated_at DESC, id)
  WHERE status = 'ready' AND active = true;

CREATE TABLE public.knowledge_storage_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT knowledge_cleanup_document_id_check CHECK (
    document_id ~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT knowledge_cleanup_path_check CHECK (
    length(storage_path) BETWEEN 45 AND 260
    AND left(storage_path, length(tenant_id::text) + 7) = tenant_id::text || '/files/'
    AND substring(storage_path FROM length(tenant_id::text) + 8) ~ '^[A-Za-z0-9._-]+$'
  ),
  CONSTRAINT knowledge_cleanup_reason_check CHECK (reason IN ('replace', 'delete')),
  CONSTRAINT knowledge_cleanup_status_check CHECK (status IN ('pending', 'completed')),
  CONSTRAINT knowledge_cleanup_attempt_check CHECK (attempt_count >= 0),
  CONSTRAINT knowledge_cleanup_completion_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status = 'pending' AND completed_at IS NULL)
  )
);

CREATE INDEX knowledge_storage_cleanup_pending_idx
  ON public.knowledge_storage_cleanup (tenant_id, created_at, id)
  WHERE status = 'pending';

CREATE TABLE public.knowledge_index_imports (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_index_found boolean NOT NULL,
  source_sha256 text,
  source_entry_count integer NOT NULL,
  imported_entry_count integer NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT knowledge_import_hash_check CHECK (
    (
      source_index_found
      AND source_sha256 IS NOT NULL
      AND source_sha256 ~ '^[0-9a-f]{64}$'
    )
    OR (NOT source_index_found AND source_sha256 IS NULL)
  ),
  CONSTRAINT knowledge_import_count_check CHECK (
    source_entry_count BETWEEN 0 AND 500
    AND imported_entry_count BETWEEN 0 AND source_entry_count
  )
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_storage_cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_storage_cleanup FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_index_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_index_imports FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.knowledge_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_storage_cleanup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_index_imports FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.knowledge_documents IS
  'Authoritative tenant-scoped knowledge metadata and extracted prompt content. Raw objects remain private in Storage.';
COMMENT ON TABLE public.knowledge_storage_cleanup IS
  'Durable cleanup ledger for replaced/deleted private knowledge objects.';
COMMENT ON TABLE public.knowledge_index_imports IS
  'One-time, non-destructive import receipt for the legacy tenant index.json object.';

CREATE OR REPLACE FUNCTION public.import_legacy_knowledge_index(
  p_tenant_id uuid,
  p_entries jsonb,
  p_source_index_found boolean,
  p_source_sha256 text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $import_legacy_knowledge_index$
DECLARE
  item jsonb;
  imported_count integer := 0;
  inserted_rows integer;
  source_count integer;
  existing_count integer;
  item_id text;
  item_file_name text;
  item_file_type text;
  item_mime_type text;
  item_storage_path text;
  item_content text;
  item_sha256 text;
  item_size bigint;
  item_active boolean;
  item_created_at timestamptz;
BEGIN
  IF p_tenant_id IS NULL
     OR p_entries IS NULL
     OR jsonb_typeof(p_entries) <> 'array'
     OR p_source_index_found IS NULL
     OR pg_column_size(p_entries) > 10485760 THEN
    RAISE EXCEPTION 'invalid_legacy_knowledge_index' USING ERRCODE = '22023';
  END IF;

  source_count := jsonb_array_length(p_entries);
  IF source_count > 500
     OR (p_source_index_found AND (p_source_sha256 IS NULL OR p_source_sha256 !~ '^[0-9a-f]{64}$'))
     OR (NOT p_source_index_found AND (p_source_sha256 IS NOT NULL OR source_count <> 0)) THEN
    RAISE EXCEPTION 'invalid_legacy_knowledge_index' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 20));

  IF EXISTS (SELECT 1 FROM public.knowledge_index_imports WHERE tenant_id = p_tenant_id) THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.tenants
     WHERE id = p_tenant_id
       AND COALESCE(is_active, true) = true
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'knowledge_tenant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO existing_count
    FROM public.knowledge_documents
   WHERE tenant_id = p_tenant_id
     AND status = 'ready';
  IF existing_count + source_count > 500 THEN
    RAISE EXCEPTION 'knowledge_document_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_entries)
  LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'invalid_legacy_knowledge_entry' USING ERRCODE = '22023';
    END IF;

    item_id := COALESCE(item->>'id', '');
    item_file_name := COALESCE(item->>'file_name', '');
    item_file_type := COALESCE(item->>'file_type', '');
    item_mime_type := COALESCE(item->>'mime_type', '');
    item_storage_path := COALESCE(item->>'storage_path', '');
    item_content := COALESCE(item->>'content', '');
    item_sha256 := NULLIF(item->>'sha256', '');
    item_size := COALESCE((item->>'file_size_bytes')::bigint, 0);
    item_active := COALESCE((item->>'active')::boolean, true);
    item_created_at := COALESCE((item->>'created_at')::timestamptz, clock_timestamp());

    IF item_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR length(item_file_name) NOT BETWEEN 1 AND 160
       OR item_file_name <> btrim(item_file_name)
       OR item_file_name IN ('.', '..')
       OR item_file_name !~ '^[A-Za-z0-9._-]+$'
       OR item_file_type NOT IN ('txt', 'text', 'csv', 'pdf', 'doc', 'docx')
       OR lower(right(item_file_name, length(item_file_type) + 1)) <> '.' || item_file_type
       OR item_size NOT BETWEEN 1 AND 10485760
       OR left(item_storage_path, length(p_tenant_id::text) + 7) <> p_tenant_id::text || '/files/'
       OR substring(item_storage_path FROM length(p_tenant_id::text) + 8) !~ '^[A-Za-z0-9._-]+$'
       OR char_length(item_content) NOT BETWEEN 1 AND 51024
       OR octet_length(item_content) > 204096
       OR item_created_at > clock_timestamp() + interval '5 minutes'
       OR (item_sha256 IS NOT NULL AND item_sha256 !~ '^[0-9a-f]{64}$')
       OR NOT (
         (item_file_type IN ('txt', 'text') AND item_mime_type = 'text/plain')
         OR (item_file_type = 'csv' AND item_mime_type = 'text/csv')
         OR (item_file_type = 'pdf' AND item_mime_type = 'application/pdf')
         OR (item_file_type = 'doc' AND item_mime_type = 'application/msword')
         OR (
           item_file_type = 'docx'
           AND item_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
         )
       ) THEN
      RAISE EXCEPTION 'invalid_legacy_knowledge_entry' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.knowledge_documents (
      id, tenant_id, file_name, file_type, mime_type, file_size_bytes,
      storage_path, content, sha256, active, status, created_at, updated_at
    ) VALUES (
      item_id, p_tenant_id, item_file_name, item_file_type, item_mime_type,
      item_size, item_storage_path, item_content, item_sha256, item_active,
      'ready', item_created_at, GREATEST(item_created_at, clock_timestamp())
    )
    ON CONFLICT (tenant_id, file_name) DO NOTHING;

    GET DIAGNOSTICS inserted_rows = ROW_COUNT;
    imported_count := imported_count + inserted_rows;
  END LOOP;

  INSERT INTO public.knowledge_index_imports (
    tenant_id, source_index_found, source_sha256, source_entry_count,
    imported_entry_count
  ) VALUES (
    p_tenant_id, p_source_index_found, p_source_sha256, source_count,
    imported_count
  );

  RETURN imported_count;
END
$import_legacy_knowledge_index$;

CREATE OR REPLACE FUNCTION public.upsert_knowledge_document(
  p_tenant_id uuid,
  p_document_id text,
  p_file_name text,
  p_file_type text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_content text,
  p_sha256 text
)
RETURNS TABLE (
  document_id text,
  document_created_at timestamptz,
  document_updated_at timestamptz,
  previous_storage_path text,
  replacement_cleanup_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $upsert_knowledge_document$
DECLARE
  existing_document public.knowledge_documents%ROWTYPE;
  ready_count integer;
  changed_at timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR length(COALESCE(p_file_name, '')) NOT BETWEEN 1 AND 160
     OR p_file_name <> btrim(p_file_name)
     OR p_file_name IN ('.', '..')
     OR p_file_name !~ '^[A-Za-z0-9._-]+$'
     OR p_file_type IS NULL
     OR p_file_type NOT IN ('txt', 'text', 'csv', 'pdf', 'doc', 'docx')
     OR lower(right(p_file_name, length(p_file_type) + 1)) <> '.' || p_file_type
     OR p_file_size_bytes IS NULL
     OR p_file_size_bytes NOT BETWEEN 1 AND 10485760
     OR length(COALESCE(p_storage_path, '')) NOT BETWEEN 45 AND 260
     OR left(p_storage_path, length(p_tenant_id::text) + 7) <> p_tenant_id::text || '/files/'
     OR substring(p_storage_path FROM length(p_tenant_id::text) + 8) !~ '^[A-Za-z0-9._-]+$'
     OR char_length(COALESCE(p_content, '')) NOT BETWEEN 1 AND 51024
     OR octet_length(p_content) > 204096
     OR p_sha256 IS NULL
     OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR p_mime_type IS NULL
     OR NOT (
       (p_file_type IN ('txt', 'text') AND p_mime_type = 'text/plain')
       OR (p_file_type = 'csv' AND p_mime_type = 'text/csv')
       OR (p_file_type = 'pdf' AND p_mime_type = 'application/pdf')
       OR (p_file_type = 'doc' AND p_mime_type = 'application/msword')
       OR (
         p_file_type = 'docx'
         AND p_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       )
     ) THEN
    RAISE EXCEPTION 'invalid_knowledge_document' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_file_name, 20)
  );

  IF NOT EXISTS (
    SELECT 1
      FROM public.tenants
     WHERE id = p_tenant_id
       AND COALESCE(is_active, true) = true
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'knowledge_tenant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT document.*
    INTO existing_document
    FROM public.knowledge_documents AS document
   WHERE document.tenant_id = p_tenant_id
     AND document.file_name = p_file_name
   FOR UPDATE;

  IF FOUND THEN
    IF existing_document.status <> 'ready' THEN
      RAISE EXCEPTION 'knowledge_document_delete_in_progress' USING ERRCODE = 'P0001';
    END IF;

    previous_storage_path := existing_document.storage_path;
    changed_at := GREATEST(changed_at, existing_document.created_at);
    INSERT INTO public.knowledge_storage_cleanup (
      tenant_id, document_id, storage_path, reason
    ) VALUES (
      p_tenant_id, existing_document.id, existing_document.storage_path, 'replace'
    )
    ON CONFLICT (storage_path) DO NOTHING
    RETURNING id INTO replacement_cleanup_id;

    IF replacement_cleanup_id IS NULL THEN
      SELECT cleanup.id
        INTO replacement_cleanup_id
        FROM public.knowledge_storage_cleanup AS cleanup
       WHERE cleanup.storage_path = existing_document.storage_path;
    END IF;

    UPDATE public.knowledge_documents
       SET file_type = p_file_type,
           mime_type = p_mime_type,
           file_size_bytes = p_file_size_bytes,
           storage_path = p_storage_path,
           content = p_content,
           sha256 = p_sha256,
           active = true,
           updated_at = changed_at
     WHERE tenant_id = p_tenant_id
       AND id = existing_document.id;

    document_id := existing_document.id;
    document_created_at := existing_document.created_at;
    document_updated_at := changed_at;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT count(*) INTO ready_count
    FROM public.knowledge_documents
   WHERE tenant_id = p_tenant_id
     AND status = 'ready';
  IF ready_count >= 500 THEN
    RAISE EXCEPTION 'knowledge_document_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.knowledge_documents (
    id, tenant_id, file_name, file_type, mime_type, file_size_bytes,
    storage_path, content, sha256, active, status, created_at, updated_at
  ) VALUES (
    p_document_id, p_tenant_id, p_file_name, p_file_type, p_mime_type,
    p_file_size_bytes, p_storage_path, p_content, p_sha256, true, 'ready',
    changed_at, changed_at
  );

  document_id := p_document_id;
  document_created_at := changed_at;
  document_updated_at := changed_at;
  previous_storage_path := NULL;
  replacement_cleanup_id := NULL;
  RETURN NEXT;
END
$upsert_knowledge_document$;

CREATE OR REPLACE FUNCTION public.set_knowledge_document_active(
  p_tenant_id uuid,
  p_document_id text,
  p_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $set_knowledge_document_active$
DECLARE
  affected_rows integer;
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR p_active IS NULL THEN
    RAISE EXCEPTION 'invalid_knowledge_document_update' USING ERRCODE = '22023';
  END IF;

  UPDATE public.knowledge_documents
     SET active = p_active,
         updated_at = GREATEST(clock_timestamp(), created_at)
   WHERE tenant_id = p_tenant_id
     AND id = p_document_id
     AND status = 'ready';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$set_knowledge_document_active$;

CREATE OR REPLACE FUNCTION public.begin_knowledge_document_delete(
  p_tenant_id uuid,
  p_document_id text
)
RETURNS TABLE (object_path text, cleanup_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $begin_knowledge_document_delete$
DECLARE
  existing_document public.knowledge_documents%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invalid_knowledge_document_delete' USING ERRCODE = '22023';
  END IF;

  SELECT document.*
    INTO existing_document
    FROM public.knowledge_documents AS document
   WHERE document.tenant_id = p_tenant_id
     AND document.id = p_document_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.knowledge_documents
     SET status = 'delete_pending',
         active = false,
         updated_at = GREATEST(clock_timestamp(), created_at)
   WHERE tenant_id = p_tenant_id
     AND id = p_document_id;

  INSERT INTO public.knowledge_storage_cleanup (
    tenant_id, document_id, storage_path, reason, status, completed_at
  ) VALUES (
    p_tenant_id, p_document_id, existing_document.storage_path, 'delete',
    'pending', NULL
  )
  ON CONFLICT (storage_path) DO UPDATE
    SET reason = 'delete',
        status = 'pending',
        completed_at = NULL
  RETURNING id INTO cleanup_id;

  object_path := existing_document.storage_path;
  RETURN NEXT;
END
$begin_knowledge_document_delete$;

CREATE OR REPLACE FUNCTION public.complete_knowledge_document_delete(
  p_tenant_id uuid,
  p_document_id text,
  p_cleanup_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $complete_knowledge_document_delete$
DECLARE
  affected_rows integer;
  cleanup_status text;
BEGIN
  IF p_tenant_id IS NULL
     OR p_document_id IS NULL
     OR p_document_id !~ '^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR p_cleanup_id IS NULL THEN
    RAISE EXCEPTION 'invalid_knowledge_document_delete_completion' USING ERRCODE = '22023';
  END IF;

  SELECT cleanup.status
    INTO cleanup_status
    FROM public.knowledge_storage_cleanup AS cleanup
   WHERE cleanup.id = p_cleanup_id
     AND cleanup.tenant_id = p_tenant_id
     AND cleanup.document_id = p_document_id
     AND cleanup.reason = 'delete'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF cleanup_status = 'completed' THEN
    RETURN NOT EXISTS (
      SELECT 1
        FROM public.knowledge_documents
       WHERE tenant_id = p_tenant_id
         AND id = p_document_id
    );
  END IF;

  UPDATE public.knowledge_storage_cleanup
     SET status = 'completed',
         attempt_count = attempt_count + 1,
         last_attempt_at = clock_timestamp(),
         completed_at = clock_timestamp()
   WHERE id = p_cleanup_id
     AND tenant_id = p_tenant_id
     AND document_id = p_document_id
     AND reason = 'delete';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN RETURN false; END IF;

  DELETE FROM public.knowledge_documents
   WHERE tenant_id = p_tenant_id
     AND id = p_document_id
     AND status = 'delete_pending';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 1 THEN RETURN true; END IF;
  RETURN NOT EXISTS (
    SELECT 1
      FROM public.knowledge_documents
     WHERE tenant_id = p_tenant_id
       AND id = p_document_id
  );
END
$complete_knowledge_document_delete$;

CREATE OR REPLACE FUNCTION public.complete_knowledge_storage_cleanup(
  p_tenant_id uuid,
  p_cleanup_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $complete_knowledge_storage_cleanup$
DECLARE
  affected_rows integer;
BEGIN
  IF p_tenant_id IS NULL OR p_cleanup_id IS NULL THEN
    RAISE EXCEPTION 'invalid_knowledge_cleanup_completion' USING ERRCODE = '22023';
  END IF;

  UPDATE public.knowledge_storage_cleanup
     SET status = 'completed',
         attempt_count = attempt_count + 1,
         last_attempt_at = clock_timestamp(),
         completed_at = clock_timestamp()
   WHERE id = p_cleanup_id
     AND tenant_id = p_tenant_id
     AND reason = 'replace'
     AND status = 'pending';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END
$complete_knowledge_storage_cleanup$;

REVOKE ALL ON FUNCTION public.import_legacy_knowledge_index(uuid, jsonb, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_knowledge_document(uuid, text, text, text, text, bigint, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_knowledge_document_active(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_knowledge_document_delete(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_knowledge_document_delete(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_knowledge_storage_cleanup(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

DO $knowledge_service_role_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.knowledge_documents TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE public.knowledge_storage_cleanup TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE public.knowledge_index_imports TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.import_legacy_knowledge_index(uuid, jsonb, boolean, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_knowledge_document(uuid, text, text, text, text, bigint, text, text, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_knowledge_document_active(uuid, text, boolean) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.begin_knowledge_document_delete(uuid, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_knowledge_document_delete(uuid, text, uuid) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_knowledge_storage_cleanup(uuid, uuid) TO service_role';
  END IF;
END
$knowledge_service_role_grants$;

COMMIT;
