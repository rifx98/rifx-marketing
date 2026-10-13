import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { enhanceBannerCopywriting } from '@/lib/banner-copywriting';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Autorización del tenant
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json(
        { error: 'No autorizado o sesión expirada', session_expired: true },
        { status: 401 }
      );
    }

    const featureDenied = denyUnlessFeature(tenant, 'banners');
    if (featureDenied) return featureDenied;

    // 2. Control de frecuencia (30 solicitudes por minuto)
    const rateLimit = await checkRateLimit(
      rateLimitKey('banners-enhance-copy', tenant.tenantId),
      30,
      60_000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Límite de solicitudes alcanzado. Por favor, espera unos segundos.' },
        { status: 429 }
      );
    }

    // 3. Lectura de parámetros
    const parsedBody = await readLimitedJsonObject(req, 64 * 1024);
    if (!parsedBody.ok) return parsedBody.response;

    const body = parsedBody.body as Record<string, any>;
    const brandName = typeof body.brand_name === 'string' ? body.brand_name : body.store_name;
    const offerText = typeof body.offer_text === 'string' ? body.offer_text : body.headline_text;
    const storeDescription = typeof body.store_description === 'string' ? body.store_description : body.subheadline_text;
    const contactInfo = typeof body.contact_info === 'string' ? body.contact_info : undefined;
    const language = typeof body.language === 'string' ? body.language : 'es';

    // 4. Perfeccionamiento de la idea comercial con IA
    const enhanced = await enhanceBannerCopywriting({
      brandName,
      offerText,
      storeDescription,
      contactInfo,
      language,
    });

    return NextResponse.json({
      success: true,
      enhanced,
    });
  } catch (err: any) {
    console.error('❌ [Enhance Copy Route Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error al procesar la mejora de copywriting' },
      { status: 500 }
    );
  }
}
