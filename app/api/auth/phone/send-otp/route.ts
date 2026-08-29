import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, rateLimitKey } from '@/lib/security';
import { normalizePhoneNumber, validatePhoneNumber } from '@/lib/phone';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { checkDailySmsLimit, incrementDailySmsCount } from '@/lib/sms-limiter';

async function sendOtp(phone: string): Promise<boolean> {
  try {
    // Supabase/Twilio owns generation, delivery, TTL and verification. A
    // serverless in-memory code store would diverge across instances and must
    // never expose a test code through a public route.
    const { error } = await createSupabaseAdmin().auth.signInWithOtp({ phone });
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabase OTP send failed:', error.status || 'provider_error');
      }
      return false;
    }
    return true;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase OTP send request failed');
    }
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 🛡️ PROTECCIÓN 1: Límite global diario de SMS (protege crédito gratis)
    const dailyLimit = await checkDailySmsLimit();
    if (!dailyLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Limite diario de SMS alcanzado. Intenta mañana.',
          resetAt: dailyLimit.resetAt,
        },
        { status: 429 }
      );
    }

    // 🛡️ PROTECCIÓN 2: Rate limit por IP
    const ipLimit = await checkRateLimit(
      rateLimitKey('phone-otp-ip', getClientIp(req.headers)),
      AUTH_RATE_LIMITS.otpSend.maxAttempts,
      AUTH_RATE_LIMITS.otpSend.windowMs,
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

    const parsedBody = await readLimitedJsonObject(req, 4 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const validation = validatePhoneNumber(parsedBody.body.phone as string);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const normalizedPhone = normalizePhoneNumber(parsedBody.body.phone as string);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Numero de telefono invalido' }, { status: 400 });
    }

    // 🛡️ PROTECCIÓN 3: Rate limit por número de teléfono
    const phoneLimit = await checkRateLimit(
      rateLimitKey('phone-otp-number', normalizedPhone),
      AUTH_RATE_LIMITS.otpSend.maxAttempts,
      AUTH_RATE_LIMITS.otpSend.windowMs,
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

    // Enviar OTP
    if (!await sendOtp(normalizedPhone)) {
      return NextResponse.json(
        { error: 'No se pudo enviar el codigo' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Incrementar contador global diario DESPUÉS de envío exitoso
    incrementDailySmsCount();

    return NextResponse.json(
      {
        success: true,
        message: 'Codigo enviado exitosamente',
        expiresIn: 600,
        dailySmsRemaining: dailyLimit.remaining - 1, // -1 porque acabamos de enviar uno
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.error('Send OTP request failed');
    }
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
