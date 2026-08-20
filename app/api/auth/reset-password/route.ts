import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail, rateLimitKey, validatePassword } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { attachSessionCookie, signToken } from '@/lib/auth';
import { checkMemoryStore } from '../verify-email/route';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    
    // Prevent abuse of the reset endpoint
    const ipLimit = await checkRateLimit(
      rateLimitKey('reset-submit-ip', clientIp),
      5, 
      15 * 60 * 1000
    );
    if (ipLimit.unavailable) return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    if (!ipLimit.allowed) return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 });

    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, code, newPassword } = parsedBody.body;

    if (!email || !code || !newPassword || typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const validationError = validatePassword(newPassword, normalizedEmail);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Verify code
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redisKey = `password-reset:${normalizedEmail}`;

    let isValid = false;

    if (upstashUrl && upstashToken) {
      const parsedUrl = new URL(upstashUrl.startsWith('http') ? upstashUrl : `https://${upstashUrl}`);
      const response = await fetch(new URL(`/get/${redisKey}`, parsedUrl), {
        headers: { Authorization: `Bearer ${upstashToken}` },
        cache: 'no-store',
      });

      if (!response.ok) {
        return NextResponse.json({ error: 'Error interno del servidor verificando código' }, { status: 500 });
      }

      const result = await response.json();
      if (!result.result) {
        return NextResponse.json({ error: 'Código expirado o inválido' }, { status: 410 });
      }

      let data;
      try {
        data = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
      } catch {
        return NextResponse.json({ error: 'Error interno leyendo código' }, { status: 500 });
      }

      if (data.code !== code) {
        return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
      }
      
      isValid = true;
      // Delete key after use
      await fetch(new URL(`/del/${redisKey}`, parsedUrl), {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
    } else {
      const memoryCheck = checkMemoryStore(normalizedEmail, code, 'password-reset:');
      if (memoryCheck.error) {
        return NextResponse.json({ error: memoryCheck.error }, { status: memoryCheck.status });
      }
      isValid = true;
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    
    // Find tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, email, plan, is_admin, session_version')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error || !tenant) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        password_hash: passwordHash,
        reset_token: null, // clear it just in case
        reset_token_expires_at: null
      })
      .eq('id', tenant.id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }

    // Automatically log the user in after successful reset
    const token = await signToken({
      tenantId: tenant.id,
      email: tenant.email,
      plan: tenant.plan,
      isAdmin: tenant.is_admin,
      adminRole: 'full',
      adminCanEditPlans: true,
      sessionVersion: Number(tenant.session_version || 0),
    });

    const res = NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    return attachSessionCookie(res, token);
  } catch (err) {
    console.error('Password reset apply error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
