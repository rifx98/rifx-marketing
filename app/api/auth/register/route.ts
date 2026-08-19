import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { attachSessionCookie, signToken, PLAN_LIMITS } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail, rateLimitKey, validatePassword } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import bcrypt from 'bcryptjs';

// POST: Registrar nuevo tenant
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const ipLimit = await checkRateLimit(
      rateLimitKey('register-ip', clientIp),
      AUTH_RATE_LIMITS.register.maxAttempts,
      AUTH_RATE_LIMITS.register.windowMs
    );
    if (ipLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio de registro temporalmente no disponible' }, { status: 503 });
    }
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos de registro. Intenta de nuevo en ${Math.ceil(ipLimit.retryAfterMs / 1000)} segundos.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
      );
    }

    const parsedBody = await readLimitedJsonObject(req, 16 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, password, companyName, ownerName, acceptedTerms } = parsedBody.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    const passwordError = validatePassword(password, normalizedEmail);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    if (acceptedTerms !== true) {
      return NextResponse.json({ error: 'Debes aceptar el Aviso Legal y la Política de Privacidad para crear una cuenta.' }, { status: 400 });
    }

    const emailLimit = await checkRateLimit(
      rateLimitKey('register-account', normalizedEmail),
      AUTH_RATE_LIMITS.register.maxAttempts,
      AUTH_RATE_LIMITS.register.windowMs
    );
    if (emailLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio de registro temporalmente no disponible' }, { status: 503 });
    }
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 429 });
    }

    const supabase = createSupabaseAdmin();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create tenant
    const trialLimits = PLAN_LIMITS.trial;
    const { data: tenant, error: insertError } = await supabase
      .from('tenants')
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        company_name: typeof companyName === 'string' ? companyName.trim().slice(0, 160) : 'Mi Empresa',
        owner_name: typeof ownerName === 'string' ? ownerName.trim().slice(0, 160) : '',
        plan: 'trial',
        plan_status: 'active',
        plan_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
        storage_limit_bytes: trialLimits.storage,
        contact_limit: trialLimits.contacts,
        is_admin: false,
        terms_accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Tenant registration insert failed:', insertError.code || 'database_error');
      return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 });
    }

    // Create default config for this tenant
    await supabase.from('config').insert({
      tenant_id: tenant.id,
      ai_prompt: 'Eres un asesor de ventas profesional. Tu objetivo es ayudar al cliente y cerrar ventas. Sé amigable, persuasivo y responde en español.',
    });

    // Generate JWT token
    const token = await signToken({
      tenantId: tenant.id,
      email: tenant.email,
      plan: tenant.plan,
      isAdmin: tenant.is_admin,
      adminRole: 'full',
      adminCanEditPlans: true,
      sessionVersion: Number(tenant.session_version || 0),
    });

    const response = NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        email: tenant.email,
        companyName: tenant.company_name,
        plan: tenant.plan,
        planStatus: tenant.plan_status,
        planExpiresAt: tenant.plan_expires_at,
        isAdmin: tenant.is_admin,
      },
    });
    return attachSessionCookie(response, token);
  } catch (error) {
    console.error('Registration failed:', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
