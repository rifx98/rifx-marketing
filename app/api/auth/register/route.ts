import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { signToken, PLAN_LIMITS } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

// POST: Registrar nuevo tenant
export async function POST(req: NextRequest) {
  try {
    // VULN-09 fix: Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed, retryAfterMs } = await checkRateLimit(
      `register:${clientIp}`,
      AUTH_RATE_LIMITS.register.maxAttempts,
      AUTH_RATE_LIMITS.register.windowMs
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos de registro. Intenta de nuevo en ${Math.ceil(retryAfterMs / 1000)} segundos.` },
        { status: 429 }
      );
    }

    const { email, password, companyName, ownerName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

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
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        company_name: companyName || 'Mi Empresa',
        owner_name: ownerName || '',
        plan: 'trial',
        plan_status: 'active',
        plan_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
        storage_limit_bytes: trialLimits.storage,
        contact_limit: trialLimits.contacts,
        is_admin: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creando tenant:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
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
    });

    console.log('✅ Nuevo tenant registrado:', tenant.email);

    return NextResponse.json({
      success: true,
      token,
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
  } catch (error: any) {
    console.error('❌ Error en registro:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
