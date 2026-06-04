import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { getUploadPresignedUrl, getDownloadPresignedUrl, deleteFiles } from '@/lib/r2';

// GET /api/panel/social/storage - Obtener URL firmada de subida o descarga
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'upload') {
      const filename = searchParams.get('filename');
      const contentType = searchParams.get('contentType');

      if (!filename || !contentType) {
        return NextResponse.json({ error: 'Faltan parámetros: filename y contentType' }, { status: 400 });
      }

      const fileExt = filename.split('.').pop() || 'mp4';
      const uniqueId = Math.random().toString(36).substring(2, 15);
      // Estructura: tenant_id/unique_id-timestamp.ext
      const key = `${tenant.tenantId}/${uniqueId}-${Date.now()}.${fileExt}`;

      console.log(`[R2 Storage API] Generando URL de subida para: ${key} (${contentType})`);
      const uploadUrl = await getUploadPresignedUrl(key, contentType);

      return NextResponse.json({ uploadUrl, key });
    }

    if (action === 'sign') {
      const key = searchParams.get('key');
      if (!key) {
        return NextResponse.json({ error: 'Falta el parámetro: key' }, { status: 400 });
      }

      // Asegurar que el tenant no pueda firmar claves de otros tenants
      if (!key.startsWith(`${tenant.tenantId}/`)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      console.log(`[R2 Storage API] Generando URL firmada de lectura para: ${key}`);
      const signedUrl = await getDownloadPresignedUrl(key, 86400); // 24 horas

      return NextResponse.json({ signedUrl });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error: any) {
    console.error('❌ [R2 Storage API] GET Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/panel/social/storage - Borrar archivos de R2
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { keys } = await req.json();
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ error: 'Falta el parámetro keys (array de strings)' }, { status: 400 });
    }

    // Validar que todas las claves pertenezcan al tenant actual por seguridad
    const unauthorizedKeys = keys.filter(key => !key.startsWith(`${tenant.tenantId}/`));
    if (unauthorizedKeys.length > 0) {
      return NextResponse.json({ error: 'No autorizado para borrar estas claves' }, { status: 403 });
    }

    console.log(`[R2 Storage API] Eliminando archivos:`, keys);
    await deleteFiles(keys);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ [R2 Storage API] DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
