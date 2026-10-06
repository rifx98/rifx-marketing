import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { enforceTenantRateLimit, readLimitedFormData } from '@/lib/request-guards';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

function getPublicAppOrigin(req: NextRequest): string {
  const configuredOrigin =
    process.env.APP_URL ||
    (process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_APP_URL : undefined);

  if (process.env.NODE_ENV === 'production' && configuredOrigin) {
    return new URL(configuredOrigin).origin;
  }
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Inicia sesión en el panel.' }, { status: 401 });
    }

    const targetTenantId = process.env.RIFX_OUTREACH_TENANT_ID;
    if (targetTenantId && tenant.tenantId !== targetTenantId && !tenant.isAdmin) {
      return NextResponse.json(
        { error: 'El módulo de correos todavía no está habilitado para esta cuenta.' },
        { status: 403 }
      );
    }

    const rateDenied = await enforceTenantRateLimit(
      'outreach-upload',
      tenant.tenantId,
      20,
      60_000
    );
    if (rateDenied) return rateDenied;

    const parsedForm = await readLimitedFormData(req, MAX_MULTIPART_BYTES);
    if (!parsedForm.ok) return parsedForm.response;

    const file = parsedForm.body.get('image');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se seleccionó ninguna imagen.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato no compatible. Por favor sube una imagen JPG, PNG o WebP.' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: 'Extensión de archivo no permitida. Usa JPG, PNG o WebP.' },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'La foto no puede superar los 5 MB de tamaño.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = createSupabaseAdmin();
    const fileName = `outreach/${Date.now()}_${randomUUID().replace(/-/g, '')}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.warn('[Outreach Upload] Storage upload failed, using data URI fallback:', uploadError.message);
      // Fallback: si storage falla, responder con data URI si es pequeña, o notificar
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.type};base64,${base64}`;
      return NextResponse.json({
        success: true,
        imageUrl: dataUri,
        storageFallback: true,
      });
    }

    const publicOrigin = getPublicAppOrigin(req);
    const imageUrl = new URL(`/api/assets/uploads/${fileName}`, publicOrigin).toString();

    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error) {
    console.error('[Outreach Upload] General error:', error);
    return NextResponse.json(
      { error: 'No se pudo procesar la imagen seleccionada.' },
      { status: 500 }
    );
  }
}
