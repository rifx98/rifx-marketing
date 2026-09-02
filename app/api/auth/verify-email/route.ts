import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { attachSessionCookie, signToken, PLAN_LIMITS } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail, rateLimitKey } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { checkMemoryStore } from '@/lib/memory-store';

/**
 * Verify email OTP code and create the tenant account.
 * The pending registration data is stored in Upstash Redis by the register endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const ipLimit = await checkRateLimit(
      rateLimitKey('email-verify-ip', clientIp),
      5,
      10 * 60 * 1000, // 5 attempts per 10 minutes
    );
    if (ipLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(ipLimit.retryAfterMs / 1000)} segundos.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
      );
    }

    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, code } = parsedBody.body;

    if (typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Email y código son requeridos' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    // Validate code format
    if (!/^\d{6}$/.test(code.trim())) {
      return NextResponse.json({ error: 'El código debe ser de 6 dígitos' }, { status: 400 });
    }

    // Rate limit per email
    const emailLimit = await checkRateLimit(
      rateLimitKey('email-verify-account', normalizedEmail),
      5,
      10 * 60 * 1000,
    );
    if (emailLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos para este email' },
        { status: 429 },
      );
    }

    // Retrieve pending registration from Redis
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      // Fallback for development: check in-memory store
      const memoryResult = checkMemoryStore(normalizedEmail, code.trim());
      if (memoryResult.error) {
        return NextResponse.json({ error: memoryResult.error }, { status: memoryResult.status });
      }
      // Create the account with memory store data
      return await createAccountAndRespond(memoryResult.data!, normalizedEmail);
    }

    const parsedUrl = new URL(upstashUrl.startsWith('http') ? upstashUrl : `https://${upstashUrl}`);
    const redisKey = `email-verify:${normalizedEmail}`;

    // GET the pending data
    const getResponse = await fetch(new URL(`/get/${redisKey}`, parsedUrl), {
      headers: { Authorization: `Bearer ${upstashToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!getResponse.ok) {
      console.error('Redis GET failed for email verification');
      return NextResponse.json({ error: 'Error verificando código' }, { status: 500 });
    }

    const getData = await getResponse.json();
    if (!getData.result) {
      return NextResponse.json({ error: 'Código expirado o no encontrado. Solicita uno nuevo.' }, { status: 410 });
    }

    let pendingData: {
      code: string;
      passwordHash: string;
      companyName: string;
      ownerName: string;
      acceptedTerms: boolean;
    };

    try {
      pendingData = JSON.parse(getData.result);
    } catch {
      return NextResponse.json({ error: 'Error interno de verificación' }, { status: 500 });
    }

    // Check the code
    if (pendingData.code !== code.trim()) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
    }

    // Delete the code from Redis (one-time use)
    await fetch(new URL(`/del/${redisKey}`, parsedUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${upstashToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    }).catch(() => {
      // Non-critical: TTL will clean it up anyway
    });

    return await createAccountAndRespond(pendingData, normalizedEmail);
  } catch (error) {
    console.error('Email verification failed:', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function createAccountAndRespond(
  pendingData: {
    passwordHash: string;
    companyName: string;
    ownerName: string;
    acceptedTerms: boolean;
  },
  normalizedEmail: string,
) {
  const supabase = createSupabaseAdmin();

  // Double-check email doesn't exist (race condition guard)
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 });
  }

  // Create tenant
  const trialLimits = PLAN_LIMITS.trial;
  const { data: tenant, error: insertError } = await supabase
    .from('tenants')
    .insert({
      email: normalizedEmail,
      password_hash: pendingData.passwordHash,
      company_name: pendingData.companyName || 'Mi Empresa',
      owner_name: pendingData.ownerName || '',
      plan: 'trial',
      plan_status: 'active',
      plan_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      storage_limit_bytes: trialLimits.storage,
      contact_limit: trialLimits.contacts,
      is_admin: false,
      terms_accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('Tenant creation after email verify failed:', insertError.code || 'database_error');
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 });
    }
    return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 });
  }

  // Create default config
  await supabase.from('config').insert({
    tenant_id: tenant.id,
    ai_prompt: 'Eres un asesor de ventas profesional. Tu objetivo es ayudar al cliente y cerrar ventas. Sé amigable, persuasivo y responde en español.',
  });

  // Generate JWT
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
      phone: tenant.phone || null,
      phoneVerified: tenant.phone_verified || false,
    },
  });
  return attachSessionCookie(response, token);
}

