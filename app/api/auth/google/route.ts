import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { attachSessionCookie, signToken, PLAN_LIMITS } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail, rateLimitKey } from '@/lib/security';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readLimitedJsonObject } from '@/lib/request-guards';

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
  { timeoutDuration: 5_000, cooldownDuration: 30_000 },
);

export async function POST(req: NextRequest) {
  try {
    const ipLimit = await checkRateLimit(
      rateLimitKey('google-ip', getClientIp(req.headers)),
      AUTH_RATE_LIMITS.google.maxAttempts,
      AUTH_RATE_LIMITS.google.windowMs
    );
    if (ipLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio de autenticación temporalmente no disponible' }, { status: 503 });
    }
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Demasiados intentos de autenticación' }, { status: 429 });
    }

    const parsedBody = await readLimitedJsonObject(req, 24 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { idToken, acceptedTerms } = parsedBody.body;

    if (typeof idToken !== 'string' || !idToken || idToken.length > 16_384) {
      return NextResponse.json({ error: 'Token de Google requerido' }, { status: 400 });
    }

    const expectedAudience = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    if (!expectedAudience) {
      console.error('Google authentication is not configured');
      return NextResponse.json({ error: 'Servicio de autenticación temporalmente no disponible' }, { status: 503 });
    }
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        algorithms: ['RS256'],
        audience: expectedAudience,
        issuer: ['accounts.google.com', 'https://accounts.google.com'],
        clockTolerance: 5,
      }));
    } catch {
      return NextResponse.json({ error: 'Token de Google inválido' }, { status: 401 });
    }

    if (payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub) {
      return NextResponse.json({ error: 'Token de Google inválido' }, { status: 401 });
    }

    const email = normalizeEmail(payload.email);
    const name = payload.name || '';
    const givenName = payload.given_name || name;

    if (!email) {
      return NextResponse.json({ error: 'No se pudo obtener el correo de Google' }, { status: 400 });
    }

    const accountLimit = await checkRateLimit(
      rateLimitKey('google-account', String(payload.sub)),
      AUTH_RATE_LIMITS.google.maxAttempts,
      AUTH_RATE_LIMITS.google.windowMs
    );
    if (accountLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio de autenticación temporalmente no disponible' }, { status: 503 });
    }
    if (!accountLimit.allowed) {
      return NextResponse.json({ error: 'Demasiados intentos de autenticación' }, { status: 429 });
    }

    const supabase = createSupabaseAdmin();

    // Check if tenant already exists
    const { data: existingTenant, error: selectError } = await supabase
      .from('tenants')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    let tenant = existingTenant;

    if (selectError) {
      console.error('Google tenant lookup failed:', selectError.code || 'database_error');
      return NextResponse.json({ error: 'No se pudo completar la autenticación' }, { status: 500 });
    }

    if (tenant && (tenant.is_active === false || tenant.deleted_at)) {
      return NextResponse.json({ error: 'La cuenta no está disponible' }, { status: 403 });
    }

    if (!tenant) {
      if (acceptedTerms !== true) {
        return NextResponse.json({ error: 'Debes aceptar el Aviso Legal y la Política de Privacidad para crear una cuenta.' }, { status: 403 });
      }
      // Create new tenant automatically (Google Registration)
      const trialLimits = PLAN_LIMITS.trial;
      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert({
          email,
          password_hash: '', // No password hash for OAuth users
          company_name: `${String(givenName).slice(0, 120)} Workspaces`,
          owner_name: String(name).slice(0, 160),
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
        console.error('Google tenant insert failed:', insertError.code || 'database_error');
        return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 });
      }

      tenant = newTenant;

      // Create default config for this tenant
      await supabase.from('config').insert({
        tenant_id: tenant.id,
        ai_prompt: 'Eres un asesor de ventas profesional. Tu objetivo es ayudar al cliente y cerrar ventas. Sé amigable, persuasivo y responde en español.',
      });

    } else {
      // Verify/refresh plan expiration
      const isExpired = tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date();
      if (isExpired) {
        if (tenant.plan_status === 'active' || tenant.plan_status === null) {
          // A pending or abandoned checkout is not proof of payment. Only a
          // signature-verified payment webhook may activate a paid plan.
          const { data: updatedTenant } = await supabase
            .from('tenants')
            .update({ plan_status: 'expired' })
            .eq('id', tenant.id)
            .select()
            .single();
          if (updatedTenant) {
            tenant = updatedTenant;
          }
        } else if (tenant.plan_status === 'cancelled') {
          // Cancelled plan has now expired -> Downgrade to trial!
          const { data: updatedTenant } = await supabase.from('tenants').update({
            plan: 'trial',
            plan_status: 'expired',
            plan_expires_at: null,
            contact_limit: 200,
            storage_limit_bytes: 100 * 1024 * 1024,
            pending_plan: null,
          }).eq('id', tenant.id).select().single();
          if (updatedTenant) {
            tenant = updatedTenant;
          }
        }
      }
    }

    // Generate JWT token
    const token = await signToken({
      tenantId: tenant.id,
      email: tenant.email,
      plan: tenant.plan,
      isAdmin: tenant.is_admin,
      adminRole: tenant.admin_role || 'full',
      adminCanEditPlans: tenant.admin_can_edit_plans !== false,
      sessionVersion: Number(tenant.session_version || 0),
    });

    // Fetch global plan permissions from platform_settings
    let planPermissions: any = {
      trial: ["dashboard", "settings", "billing"],
      start: ["dashboard", "crm", "settings", "billing", "playground", "conversations", "orders"],
      plus: ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments", "analytics", "social", "appointments", "conversations", "orders"],
      master: ["dashboard", "crm", "settings", "billing", "playground", "campaigns", "banners", "segments", "analytics", "social", "appointments", "conversations", "orders"]
    };

    try {
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('plan_permissions')
        .limit(1)
        .maybeSingle();
      if (settingsData?.plan_permissions) {
        planPermissions = settingsData.plan_permissions;
      }
    } catch {
      console.warn('Could not load plan_permissions from database; using defaults');
    }

    const userPlan = tenant.plan || 'trial';
    const baseAllowedTabs = planPermissions[userPlan] || planPermissions.trial;
    const overrides = tenant.permission_overrides || {};
    const activeOverrides: string[] = [];
    const now = Date.now();

    for (const [tab, expiry] of Object.entries(overrides)) {
      if (expiry) {
        const expiryDate = new Date(expiry as string);
        if (!isNaN(expiryDate.getTime()) && expiryDate.getTime() > now) {
          activeOverrides.push(tab);
        }
      }
    }

    const allowedTabsSet = new Set([...baseAllowedTabs, ...activeOverrides]);
    if (tenant.is_admin) {
      allowedTabsSet.add('admin');
    }
    allowedTabsSet.add('dashboard');
    allowedTabsSet.add('billing');

    const allowedTabs = Array.from(allowedTabsSet);

    const response = NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        email: tenant.email,
        companyName: tenant.company_name,
        ownerName: tenant.owner_name,
        plan: tenant.plan,
        planStatus: tenant.plan_status,
        planStartedAt: tenant.plan_started_at,
        planExpiresAt: tenant.plan_expires_at,
        pendingPlan: tenant.pending_plan || null,
        storageLimitBytes: tenant.storage_limit_bytes,
        storageUsedBytes: tenant.storage_used_bytes,
        contactLimit: tenant.contact_limit,
        isAdmin: tenant.is_admin,
        adminRole: tenant.admin_role || 'full',
        createdAt: tenant.created_at,
        allowedTabs,
        permissionOverrides: overrides,
      },
    });
    return attachSessionCookie(response, token);
  } catch (error) {
    console.error('Google authentication failed:', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
