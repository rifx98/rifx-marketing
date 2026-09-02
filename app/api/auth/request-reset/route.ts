import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail, rateLimitKey } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { sendVerificationEmail } from '@/lib/email';
import { setMemoryVerification } from '@/lib/memory-store';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    
    // Prevent abuse
    const ipLimit = await checkRateLimit(
      rateLimitKey('reset-ip', clientIp),
      10, // max 10 reset requests per IP per window (increased for testing)
      15 * 60 * 1000 // 15 mins window
    );
    if (ipLimit.unavailable) return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    if (!ipLimit.allowed) return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 });

    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { email } = parsedBody.body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    // Limit by account to avoid spamming a single user
    const emailLimit = await checkRateLimit(
      rateLimitKey('reset-account', normalizedEmail),
      6, // max 6 reset requests per hour (increased)
      60 * 60 * 1000 // 1 hr window
    );
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Demasiados intentos para esta cuenta. Intenta más tarde.' }, { status: 429 });
    }

    const supabase = createSupabaseAdmin();
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error || !tenant) {
      // Don't leak whether the account exists
      return NextResponse.json({ success: true, pendingVerification: true, message: 'Si el correo existe, recibirás un enlace pronto.' });
    }

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const pendingData = { code };
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const ttlMs = 15 * 60 * 1000;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    if (upstashUrl && upstashToken) {
      const parsedUrl = new URL(upstashUrl.startsWith('http') ? upstashUrl : `https://${upstashUrl}`);
      const redisKey = `password-reset:${normalizedEmail}`;
      
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
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
      }
    } else {
      setMemoryVerification(normalizedEmail, JSON.stringify(pendingData), ttlMs, 'password-reset:');
    }

    // Send email with OTP
    const emailSent = await sendVerificationEmail(normalizedEmail, code);
    
    if (!emailSent) {
      return NextResponse.json({ error: 'Error al enviar el correo. Intenta de nuevo.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, pendingVerification: true, message: 'Código enviado al correo.' });
  } catch (err) {
    console.error('Password reset request error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
