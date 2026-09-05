import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { checkAvailability } from '@/lib/google-calendar';
import { enforceTenantRateLimit, internalApiError } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureDenied = denyUnlessFeature(tenant, 'appointments');
    if (featureDenied) return featureDenied;

    const rateDenied = await enforceTenantRateLimit('appointments-availability', tenant.tenantId, 60, 60_000);
    if (rateDenied) return rateDenied;

    const dateParam = req.nextUrl.searchParams.get('date');
    if (!dateParam || !DATE_PATTERN.test(dateParam)) {
      return NextResponse.json({ error: 'Fecha inválida. Formato requerido: YYYY-MM-DD' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: config } = await supabase
      .from('config')
      .select('business_start_hour,business_end_hour,business_days')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    let startHour = 9;
    let endHour = 18;
    if (config?.business_start_hour) {
      const parsed = parseInt(config.business_start_hour.split(':')[0], 10);
      if (Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 23) startHour = parsed;
    }
    if (config?.business_end_hour) {
      const parsed = parseInt(config.business_end_hour.split(':')[0], 10);
      if (Number.isSafeInteger(parsed) && parsed > startHour && parsed <= 24) endHour = parsed;
    }

    // Comprobar si el día de la semana es laborable según la configuración
    if (Array.isArray(config?.business_days) && config.business_days.length > 0) {
      const [y, m, d] = dateParam.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
      if (!config.business_days.includes(dayOfWeek)) {
        return NextResponse.json({ available: [], message: 'Día no laborable según tu horario comercial.' });
      }
    }

    const availabilityResult = await checkAvailability(
      tenant.tenantId,
      dateParam,
      startHour,
      endHour,
      60,
      'America/Guayaquil'
    );

    return NextResponse.json({
      available: availabilityResult.available || [],
      error: availabilityResult.error,
    }, {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (error) {
    console.error('[Availability API] Error:', error);
    return internalApiError();
  }
}
