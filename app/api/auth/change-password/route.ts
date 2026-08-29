import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { attachSessionCookie, getTenantFromRequest, signToken } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, rateLimitKey, validatePassword } from '@/lib/security';
import { createSupabaseAdmin } from '@/lib/supabase';
import { readLimitedJsonObject } from '@/lib/request-guards';

export async function POST(req: NextRequest) {
  try {
    const tenantClaim = await getTenantFromRequest(req);
    if (!tenantClaim?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const limit = await checkRateLimit(
      rateLimitKey('password-change', `${tenantClaim.tenantId}:${getClientIp(req.headers)}`),
      AUTH_RATE_LIMITS.passwordChange.maxAttempts,
      AUTH_RATE_LIMITS.passwordChange.windowMs
    );
    if (limit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intenta más tarde.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }

    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { currentPassword, newPassword } = parsedBody.body;
    const passwordError = validatePassword(newPassword, tenantClaim.email);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
    if (typeof currentPassword !== 'string' || !currentPassword) {
      return NextResponse.json({ error: 'La contraseña actual es requerida' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, email, plan, password_hash, is_admin, admin_role, admin_can_edit_plans, session_version')
      .eq('id', tenantClaim.tenantId)
      .maybeSingle();

    if (error || !tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!tenant.password_hash) {
      return NextResponse.json({ error: 'Esta cuenta usa acceso con Google y no tiene una contraseña local.' }, { status: 409 });
    }

    const currentIsValid = await bcrypt.compare(currentPassword as string, tenant.password_hash);
    if (!currentIsValid) {
      return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 401 });
    }
    if (await bcrypt.compare(newPassword as string, tenant.password_hash)) {
      return NextResponse.json({ error: 'La nueva contraseña debe ser diferente' }, { status: 400 });
    }

    const currentSessionVersion = Number(tenant.session_version || 0);
    const nextSessionVersion = currentSessionVersion + 1;
    const passwordHash = await bcrypt.hash(newPassword as string, 12);
    const { data: updated, error: updateError } = await supabase
      .from('tenants')
      .update({ password_hash: passwordHash, session_version: nextSessionVersion })
      .eq('id', tenant.id)
      .eq('session_version', currentSessionVersion)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'La sesión cambió. Vuelve a iniciar sesión.' }, { status: 409 });
    }

    const token = await signToken({
      tenantId: tenant.id,
      email: tenant.email,
      plan: tenant.plan,
      isAdmin: tenant.is_admin === true,
      adminRole: tenant.admin_role || 'full',
      adminCanEditPlans: tenant.admin_can_edit_plans !== false,
      sessionVersion: nextSessionVersion,
    });
    return attachSessionCookie(NextResponse.json({ success: true }), token);
  } catch (error) {
    console.error('Password change failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
