import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { getUploadPresignedUrl, getDownloadPresignedUrl, deleteFiles, deleteFile, headFile, isTenantOwnedR2Key } from '@/lib/r2';
import { randomUUID } from 'node:crypto';
import { denyUnlessFeature } from '@/lib/feature-access';
import { createSupabaseAdmin } from '@/lib/supabase';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';

const MAX_SOCIAL_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_SOCIAL_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/mpeg', 'video/avi', 'video/x-msvideo',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg',
]);
const EXTENSION_MIMES: Readonly<Record<string, ReadonlySet<string>>> = {
  mp4: new Set(['video/mp4']),
  mov: new Set(['video/quicktime']),
  webm: new Set(['video/webm']),
  mkv: new Set(['video/x-matroska']),
  jpg: new Set(['image/jpeg', 'image/jpg']),
  jpeg: new Set(['image/jpeg', 'image/jpg']),
  png: new Set(['image/png']),
  webp: new Set(['image/webp']),
  gif: new Set(['image/gif']),
};

// GET /api/panel/social/storage - Obtener URL firmada de subida o descarga
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'social');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('social-storage-read', tenant.tenantId, 30, 60_000);
    if (rateDenied) return rateDenied;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'upload') {
      const filename = searchParams.get('filename');
      const contentType = searchParams.get('contentType');
      const size = Number(searchParams.get('size'));

      if (!filename || filename.length > 255 || !contentType || contentType.length > 100 || !Number.isSafeInteger(size) || size <= 0) {
        return NextResponse.json({ error: 'Faltan parámetros válidos: filename, contentType y size' }, { status: 400 });
      }
      if (size > MAX_SOCIAL_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'El archivo supera el límite de 100 MB' }, { status: 413 });
      }
      if (!Number.isSafeInteger(tenant.storageLimitBytes) || !Number.isSafeInteger(tenant.storageUsedBytes)
          || tenant.storageLimitBytes! <= 0 || tenant.storageUsedBytes! + size > tenant.storageLimitBytes!) {
        return NextResponse.json({ error: 'La subida supera la cuota de almacenamiento disponible' }, { status: 413 });
      }

      // Validate file extension
      const fileExt = filename.split('.').pop()?.toLowerCase() || '';
      const normalizedContentType = contentType.toLowerCase().split(';', 1)[0].trim();
      if (!EXTENSION_MIMES[fileExt]) {
        return NextResponse.json({ error: 'Extensión de archivo no permitida para redes sociales.' }, { status: 400 });
      }

      // Validate Content-Type
      if (!ALLOWED_SOCIAL_MIMES.has(normalizedContentType) || !EXTENSION_MIMES[fileExt].has(normalizedContentType)) {
        return NextResponse.json({ error: 'Tipo de contenido (MIME) no permitido para redes sociales.' }, { status: 400 });
      }

      const uniqueId = randomUUID();
      // Estructura: tenant_id/unique_id-timestamp.ext
      const key = `${tenant.tenantId}/${uniqueId}-${Date.now()}.${fileExt}`;

      const supabase = createSupabaseAdmin();
      const { data: reservation, error: reservationError } = await supabase.rpc('reserve_tenant_storage_upload', {
        p_tenant_id: tenant.tenantId,
        p_object_key: key,
        p_size_bytes: size,
        p_ttl_seconds: 1800,
      });
      if (reservationError) {
        return NextResponse.json({ error: 'No se pudo reservar almacenamiento' }, { status: 503 });
      }
      if (reservation !== 'reserved') {
        const status = reservation === 'quota' ? 413 : reservation === 'conflict' ? 409 : 400;
        return NextResponse.json({ error: reservation === 'quota' ? 'Cuota de almacenamiento agotada' : 'No se pudo reservar almacenamiento' }, { status });
      }

      let uploadUrl: string;
      try {
        uploadUrl = await getUploadPresignedUrl(key, normalizedContentType, size);
      } catch {
        await supabase.rpc('release_tenant_storage_object', {
          p_tenant_id: tenant.tenantId,
          p_object_key: key,
        });
        throw new Error('upload_signing_failed');
      }

      return NextResponse.json({ uploadUrl, key, maxBytes: MAX_SOCIAL_UPLOAD_BYTES });
    }

    if (action === 'sign') {
      const key = searchParams.get('key');
      if (!key) {
        return NextResponse.json({ error: 'Falta el parámetro: key' }, { status: 400 });
      }

      // Asegurar que el tenant no pueda firmar claves de otros tenants
      if (!isTenantOwnedR2Key(key, tenant.tenantId)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const { data: reservation, error: reservationError } = await createSupabaseAdmin()
        .from('storage_upload_reservations')
        .select('status')
        .eq('tenant_id', tenant.tenantId)
        .eq('object_key', key)
        .eq('status', 'completed')
        .maybeSingle();
      if (reservationError) return NextResponse.json({ error: 'No se pudo verificar el objeto' }, { status: 503 });
      if (!reservation) return NextResponse.json({ error: 'Objeto no disponible' }, { status: 404 });
      const signedUrl = await getDownloadPresignedUrl(key, 900);

      return NextResponse.json({ signedUrl });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch {
    console.error('[R2 Storage API] GET failed');
    return NextResponse.json({ error: 'No se pudo procesar la solicitud de almacenamiento' }, { status: 500 });
  }
}

// POST /api/panel/social/storage - Confirm an upload after R2 has received it.
// Only confirmed, size-matched objects count toward usage and can be published.
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const featureDenied = denyUnlessFeature(tenant, 'social');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('social-storage-confirm', tenant.tenantId, 30, 60_000);
    if (rateDenied) return rateDenied;

    const parsed = await readLimitedJsonObject(req, 4 * 1024);
    if (!parsed.ok) return parsed.response;
    const key = parsed.body.key;
    if (!isTenantOwnedR2Key(key, tenant.tenantId)) {
      return NextResponse.json({ error: 'Clave de objeto no válida' }, { status: 400 });
    }

    let metadata;
    try {
      metadata = await headFile(key);
    } catch {
      return NextResponse.json({ error: 'La subida no está disponible para confirmar' }, { status: 409 });
    }
    const actualSize = Number(metadata.ContentLength || 0);
    const actualType = String(metadata.ContentType || '').toLowerCase().split(';')[0];
    const extension = typeof key === 'string' ? key.split('.').pop()?.toLowerCase() || '' : '';
    if (!Number.isSafeInteger(actualSize) || actualSize <= 0 || actualSize > MAX_SOCIAL_UPLOAD_BYTES
        || !ALLOWED_SOCIAL_MIMES.has(actualType) || !EXTENSION_MIMES[extension]?.has(actualType)) {
      await deleteFile(key).catch(() => undefined);
      await createSupabaseAdmin().rpc('release_tenant_storage_object', {
        p_tenant_id: tenant.tenantId,
        p_object_key: key,
      });
      return NextResponse.json({ error: 'El objeto subido no coincide con la reserva' }, { status: 409 });
    }

    const supabase = createSupabaseAdmin();
    const { data: completed, error } = await supabase.rpc('complete_tenant_storage_upload', {
      p_tenant_id: tenant.tenantId,
      p_object_key: key,
      p_actual_size: actualSize,
    });
    if (error || completed !== true) {
      await deleteFile(key).catch(() => undefined);
      await supabase.rpc('release_tenant_storage_object', {
        p_tenant_id: tenant.tenantId,
        p_object_key: key,
      });
      return NextResponse.json({ error: 'No se pudo confirmar la cuota de la subida' }, { status: 409 });
    }
    return NextResponse.json({ success: true, key, size: actualSize });
  } catch {
    return NextResponse.json({ error: 'No se pudo confirmar la subida' }, { status: 500 });
  }
}

// DELETE /api/panel/social/storage - Borrar archivos de R2
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'social');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('social-storage-delete', tenant.tenantId, 20, 60_000);
    if (rateDenied) return rateDenied;

    const parsed = await readLimitedJsonObject(req, 64 * 1024);
    if (!parsed.ok) return parsed.response;
    const { keys } = parsed.body;
    if (!keys || !Array.isArray(keys) || keys.length === 0 || keys.length > 100 || !keys.every(key => typeof key === 'string')) {
      return NextResponse.json({ error: 'Falta el parámetro keys (array de strings)' }, { status: 400 });
    }

    // Validar que todas las claves pertenezcan al tenant actual por seguridad
    const unauthorizedKeys = keys.filter(key => !isTenantOwnedR2Key(key, tenant.tenantId));
    if (unauthorizedKeys.length > 0) {
      return NextResponse.json({ error: 'No autorizado para borrar estas claves' }, { status: 403 });
    }

    const deletion = await deleteFiles(keys);
    const failedKeys = new Set((deletion?.Errors || []).map(item => item.Key).filter((key): key is string => Boolean(key)));
    const deletedKeys = keys.filter(key => !failedKeys.has(key));
    const supabase = createSupabaseAdmin();
    await Promise.all(deletedKeys.map(key => supabase.rpc('release_tenant_storage_object', {
      p_tenant_id: tenant.tenantId,
      p_object_key: key,
    })));
    if (failedKeys.size > 0) {
      return NextResponse.json({ error: 'Algunos objetos no pudieron eliminarse' }, { status: 502 });
    }

    return NextResponse.json({ success: true, deleted: deletedKeys.length });
  } catch {
    console.error('[R2 Storage API] DELETE failed');
    return NextResponse.json({ error: 'No se pudieron eliminar los archivos solicitados' }, { status: 500 });
  }
}
