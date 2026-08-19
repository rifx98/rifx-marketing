import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { attachSessionCookie, signToken, PLAN_LIMITS } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, rateLimitKey } from '@/lib/security';
import { normalizePhoneNumber, validatePhoneNumber } from '@/lib/phone';
import { readLimitedJsonObject } from '@/lib/request-guards';

const TENANT_AUTH_FIELDS = [
  'id', 'email', 'phone', 'company_name', 'owner_name', 'plan', 'plan_status',
  'plan_expires_at', 'is_admin', 'admin_role', 'admin_can_edit_plans',
  'session_version', 'is_active', 'deleted_at', 'phone_verified',
].join(',');

function optionalName(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) return null;
  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const ipLimit = await checkRateLimit(
      rateLimitKey('phone-verify-ip', getClientIp(req.headers)),
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

    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { phone, code, acceptedTerms } = parsedBody.body;
    const companyName = optionalName(parsedBody.body.companyName);
    const ownerName = optionalName(parsedBody.body.ownerName);
    if (companyName === null || ownerName === null) {
      return NextResponse.json({ error: 'Datos de cuenta invalidos' }, { status: 400 });
    }

    const validation = validatePhoneNumber(phone);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Codigo invalido' }, { status: 400 });
    }

    const phoneLimit = await checkRateLimit(
      rateLimitKey('phone-verify-number', normalizedPhone),
      AUTH_RATE_LIMITS.otpVerify.maxAttempts,
      AUTH_RATE_LIMITS.otpVerify.windowMs,
    );
    if (phoneLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!phoneLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos de verificacion para este numero' },
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

    const { data: existingTenant, error: lookupError } = await supabase
      .from('tenants')
      .select(TENANT_AUTH_FIELDS)
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (lookupError) {
      console.error('Phone tenant lookup failed:', lookupError.code || 'database_error');
      return NextResponse.json({ error: 'No se pudo completar la autenticacion' }, { status: 500 });
    }
    if (existingTenant && (existingTenant.is_active === false || existingTenant.deleted_at)) {
      return NextResponse.json({ error: 'La cuenta no esta disponible' }, { status: 403 });
    }

    let tenant = existingTenant;
    const isNewAccount = !existingTenant;
    if (tenant) {
      const { data: updatedTenant, error: updateError } = await supabase
        .from('tenants')
        .update({
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
          ...(companyName !== undefined ? { company_name: companyName } : {}),
          ...(ownerName !== undefined ? { owner_name: ownerName } : {}),
        })
        .eq('id', tenant.id)
        .eq('phone', normalizedPhone)
        .select(TENANT_AUTH_FIELDS)
        .maybeSingle();
      if (updateError || !updatedTenant) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Phone tenant update failed:', updateError?.code || 'concurrent_update');
        }
        return NextResponse.json({ error: 'No se pudo completar la autenticacion' }, { status: 409 });
      }
      tenant = updatedTenant;
    } else {
      if (acceptedTerms !== true) {
        return NextResponse.json(
          { error: 'Debes aceptar el Aviso Legal y la Politica de Privacidad para crear una cuenta.' },
          { status: 400 },
        );
      }
      const trialLimits = PLAN_LIMITS.trial;
      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert({
          phone: normalizedPhone,
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
          company_name: companyName || 'Mi Empresa',
          owner_name: ownerName || '',
          plan: 'trial',
          plan_status: 'active',
          plan_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000).toISOString(),
          storage_limit_bytes: trialLimits.storage,
          contact_limit: trialLimits.contacts,
          is_admin: false,
          terms_accepted_at: new Date().toISOString(),
        })
        .select(TENANT_AUTH_FIELDS)
        .single();
      if (insertError || !newTenant) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Phone tenant creation failed:', insertError?.code || 'invalid_result');
        }
        return NextResponse.json(
          { error: insertError?.code === '23505' ? 'La cuenta cambio durante el registro' : 'No se pudo crear la cuenta' },
          { status: insertError?.code === '23505' ? 409 : 500 },
        );
      }
      tenant = newTenant;

      const { error: configError } = await supabase.from('config').insert({
        tenant_id: tenant.id,
        ai_prompt: 'Eres un asesor de ventas profesional. Tu objetivo es ayudar al cliente y cerrar ventas. Se amigable, persuasivo y responde en espanol.',
      });
      if (configError) {
        console.error('Phone tenant default configuration failed:', configError.code || 'database_error');
      }
    }

    const token = await signToken({
      tenantId: tenant.id,
      email: tenant.email || undefined,
      plan: tenant.plan,
      isAdmin: tenant.is_admin === true,
      adminRole: tenant.admin_role || 'full',
      adminCanEditPlans: tenant.admin_can_edit_plans !== false,
      sessionVersion: Number(tenant.session_version || 0),
    });
    const response = NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        phone: tenant.phone,
        email: tenant.email,
        companyName: tenant.company_name,
        ownerName: tenant.owner_name,
        plan: tenant.plan,
        planStatus: tenant.plan_status,
        planExpiresAt: tenant.plan_expires_at,
        isAdmin: tenant.is_admin,
        phoneVerified: tenant.phone_verified,
      },
      isNewAccount,
    });
    return attachSessionCookie(response, token);
  } catch {
    console.error('Phone verification request failed');
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
