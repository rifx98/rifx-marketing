import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { normalizeEmail } from '@/lib/security';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const rateDenied = await enforceTenantRateLimit('profile-delete', tenant.tenantId, 3, 60 * 60_000);
    if (rateDenied) return rateDenied;
    if (!tenant.iat || Math.floor(Date.now() / 1000) - tenant.iat > 10 * 60) {
      return NextResponse.json(
        { error: 'Por seguridad, vuelve a iniciar sesión antes de eliminar la cuenta' },
        { status: 403 },
      );
    }

    const parsed = await readLimitedJsonObject(req, 4 * 1024);
    if (!parsed.ok) return parsed.response;
    const confirmationEmail = normalizeEmail(parsed.body.confirmationEmail);
    if (!confirmationEmail || confirmationEmail !== normalizeEmail(tenant.email)) {
      return NextResponse.json({ error: 'La confirmación de correo no coincide' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: account, error: accountError } = await supabase
      .from('tenants')
      .select('id, plan, plan_status, session_version')
      .eq('id', tenant.tenantId)
      .maybeSingle();
    if (accountError || !account) {
      return NextResponse.json({ error: 'No se pudo verificar la cuenta' }, { status: 503 });
    }
    if (account.plan !== 'trial' && account.plan_status === 'active') {
      return NextResponse.json(
        { error: 'Cancela primero la renovación y espera su confirmación antes de eliminar la cuenta' },
        { status: 409 },
      );
    }

    const currentSessionVersion = Number(account.session_version);
    if (!Number.isSafeInteger(currentSessionVersion) || currentSessionVersion < 0 || currentSessionVersion >= 2_147_483_647) {
      return NextResponse.json({ error: 'No se pudo verificar la cuenta' }, { status: 409 });
    }

    // Retain business records for the recovery window, but revoke every
    // session immediately. Purging is an explicit, separately audited job.
    const { data: deleted, error } = await supabase
      .from('tenants')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        session_version: currentSessionVersion + 1,
      })
      .eq('id', tenant.tenantId)
      .eq('session_version', currentSessionVersion)
      .select('id')
      .maybeSingle();

    if (error || !deleted) {
      console.error('Account soft-delete failed:', error?.code || 'concurrent_update');
      return NextResponse.json({ error: 'No se pudo eliminar la cuenta' }, { status: 409 });
    }

    const response = NextResponse.json({ success: true, message: 'Cuenta desactivada correctamente' });
    response.cookies.set('rifx_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    console.error('Account soft-delete failed');
    return internalApiError();
  }
}
