import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, rateLimitKey } from '@/lib/security';
import { normalizePhoneNumber, validatePhoneNumber } from '@/lib/phone';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { getTenantFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ipLimit = await checkRateLimit(
      rateLimitKey('phone-link-ip', getClientIp(req.headers)),
      AUTH_RATE_LIMITS.otpVerify.maxAttempts,
      AUTH_RATE_LIMITS.otpVerify.windowMs,
    );
    if (ipLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intenta de nuevo mas tarde.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil(ipLimit.retryAfterMs / 1_000))) },
        },
      );
    }

    // Authenticate user
    const tenantId = getTenantFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsedBody = await readLimitedJsonObject(req, 4 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { phone, code } = parsedBody.body;

    const validation = validatePhoneNumber(phone);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Codigo invalido' }, { status: 400 });
    }

    const phoneLimit = await checkRateLimit(
      rateLimitKey('phone-link-number', normalizedPhone),
      AUTH_RATE_LIMITS.otpVerify.maxAttempts,
      AUTH_RATE_LIMITS.otpVerify.windowMs,
    );
    if (phoneLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!phoneLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos para este numero' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil(phoneLimit.retryAfterMs / 1_000))) },
        },
      );
    }

    const supabase = createSupabaseAdmin();
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: code,
      type: 'sms',
    });
    
    if (verifyError || !verifyData.user) {
      return NextResponse.json({ error: 'Codigo incorrecto o expirado' }, { status: 401 });
    }

    // Attempt to update the tenant record
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update({
        phone: normalizedPhone,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select('phone, phone_verified')
      .single();

    if (updateError) {
      console.error('Phone link failed:', updateError.code || 'database_error');
      // 23505 is PostgreSQL unique violation error code
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'Este numero de telefono ya esta en uso por otra cuenta' }, { status: 409 });
      }
      return NextResponse.json({ error: 'No se pudo vincular el telefono' }, { status: 500 });
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Telefono verificado exitosamente',
        tenant: updatedTenant
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Link OTP exception:', error);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
