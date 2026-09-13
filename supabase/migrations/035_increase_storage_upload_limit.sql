-- Migration: 035_increase_storage_upload_limit.sql
-- Ampliar el límite máximo de subida a 500 MB (524,288,000 bytes)

-- 1. Actualizar la restricción de tamaño en storage_upload_reservations
ALTER TABLE public.storage_upload_reservations 
  DROP CONSTRAINT IF EXISTS storage_upload_reservation_size_check;

ALTER TABLE public.storage_upload_reservations 
  ADD CONSTRAINT storage_upload_reservation_size_check 
  CHECK (size_bytes > 0 AND size_bytes <= 524288000);

-- 2. Actualizar función RPC reserve_tenant_storage_upload con nuevo límite de 500 MB
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
     OR p_size_bytes <= 0 OR p_size_bytes > 524288000
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

REVOKE ALL ON FUNCTION public.reserve_tenant_storage_upload(uuid, text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tenant_storage_upload(uuid, text, bigint, integer) TO service_role;

-- 3. Actualizar valor por defecto de storage_limit_bytes en la tabla tenants a 500 MB
ALTER TABLE public.tenants ALTER COLUMN storage_limit_bytes SET DEFAULT 524288000;

-- 4. Elevar cuota existente para tenants con el límite previo de 100 MB
UPDATE public.tenants 
   SET storage_limit_bytes = 524288000 
 WHERE storage_limit_bytes = 104857600;
