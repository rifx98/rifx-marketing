import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { randomUUID } from 'node:crypto';
import { enforceTenantRateLimit, readLimitedFormData } from '@/lib/request-guards';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

function getPublicAppOrigin(req: NextRequest): string {
  const configuredOrigin = process.env.APP_URL || (
    process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_APP_URL : undefined
  );
  if (process.env.NODE_ENV === 'production' && !configuredOrigin) {
    throw new Error('APP_URL is required in production');
  }
  const origin = new URL(configuredOrigin || req.nextUrl.origin);
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production');
  }
  return origin.origin;
}

function getAssetUrl(origin: string, objectPath: string): string {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  return new URL(`/api/assets/uploads/${encodedPath}`, origin).toString();
}

// POST: Subir imagen para anuncio (solo admin)
export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminPermission(req, 'assets.upload');
    if (!authorization.ok) return authorization.response;
    const rateDenied = await enforceTenantRateLimit(
      'admin-asset-upload',
      authorization.admin.tenantId,
      12,
      60_000,
    );
    if (rateDenied) return rateDenied;

    const parsedForm = await readLimitedFormData(req, MAX_MULTIPART_BYTES);
    if (!parsedForm.ok) return parsedForm.response;
    const file = parsedForm.body.get('image');
    
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se proporcionó imagen' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF.' }, { status: 400 });
    }

    // Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Extensión de archivo no permitida. Use JPG, PNG, WebP o GIF.' }, { status: 400 });
    }

    // Max 5MB. Migration 017 enforces the same limit in Storage.
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'La imagen no puede exceder 5MB' }, { status: 400 });
    }

    // Validate the canonical origin before storing an object so a production
    // configuration error cannot leave an unreachable orphan behind.
    const publicOrigin = getPublicAppOrigin(req);
    const supabase = createSupabaseAdmin();
    const fileName = `announcements/${Date.now()}_${randomUUID()}.${ext}`;
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const { error } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Admin asset upload failed:', error.name || 'storage_error');
      return NextResponse.json(
        { error: 'El almacenamiento de imágenes no está disponible' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl: getAssetUrl(publicOrigin, fileName),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admin asset upload request failed:', error instanceof Error ? error.name : 'unknown_error');
    return NextResponse.json(
      { error: 'No se pudo subir la imagen' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
