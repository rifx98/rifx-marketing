import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { attachSessionCookie, signToken, PLAN_LIMITS } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail, rateLimitKey, validatePassword } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { sendVerificationEmail } from '@/lib/email';
import { setMemoryVerification } from '@/lib/memory-store';
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

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store pending registration data in Redis (or memory) with 10 min TTL
    const pendingData = {
      code,
      passwordHash,
      companyName: typeof companyName === 'string' ? companyName.trim().slice(0, 160) : 'Mi Empresa',
      ownerName: typeof ownerName === 'string' ? ownerName.trim().slice(0, 160) : '',
      acceptedTerms,
    };

    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const ttlMs = 10 * 60 * 1000;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    if (upstashUrl && upstashToken) {
      const parsedUrl = new URL(upstashUrl.startsWith('http') ? upstashUrl : `https://${upstashUrl}`);
      const redisKey = `email-verify:${normalizedEmail}`;
      
      const response = await fetch(new URL('/pipeline', parsedUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['SET', redisKey, JSON.stringify(pendingData)],
          ['EXPIRE', redisKey, ttlSeconds],
        ]),
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        console.error('Failed to store pending registration in Redis');
        return NextResponse.json({ error: 'Error interno guardando la solicitud' }, { status: 500 });
      }
    } else {
      // Fallback to memory store for dev
      setMemoryVerification(normalizedEmail, JSON.stringify(pendingData), ttlMs);
    }

    // Send the verification email
    const emailSent = await sendVerificationEmail(normalizedEmail, code);
    if (!emailSent) {
      return NextResponse.json({ error: 'Error enviando el código de verificación al email' }, { status: 500 });
    }

    // Return success indicating verification is pending
    return NextResponse.json({
      success: true,
      pendingVerification: true,
      message: 'Código de verificación enviado al email',
    });
  } catch (error) {
    console.error('Registration failed:', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
