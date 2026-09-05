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
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    let businessDays = [1, 2, 3, 4, 5];
    let startHour = 9;
    let endHour = 18;

    if (config?.openai_key) {
      try {
        const parsed = JSON.parse(config.openai_key);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.business_days)) {
            businessDays = parsed.business_days;
          }
          if (typeof parsed.business_start_hour === 'string') {
            const parsedStart = parseInt(parsed.business_start_hour.split(':')[0], 10);
            if (Number.isSafeInteger(parsedStart) && parsedStart >= 0 && parsedStart <= 23) {
              startHour = parsedStart;
            }
          }
          if (typeof parsed.business_end_hour === 'string') {
            const parsedEnd = parseInt(parsed.business_end_hour.split(':')[0], 10);
            if (Number.isSafeInteger(parsedEnd) && parsedEnd > startHour && parsedEnd <= 24) {
              endHour = parsedEnd;
            }
          }
        }
      } catch {}
    }

    // Comprobar si el día de la semana es laborable según la configuración
    const [y, m, d] = dateParam.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
    if (!businessDays.includes(dayOfWeek)) {
      return NextResponse.json({
        available: [],
        isNonWorkingDay: true,
        message: 'Día no laborable según tu horario comercial.',
      }, {
        headers: { 'Cache-Control': 'private, no-store' }
      });
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
