import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { attachSessionCookie, signToken } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail, rateLimitKey } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import bcrypt from 'bcryptjs';

const DUMMY_PASSWORD_HASH = '$2b$12$ndXPLq.gpB2p6TOnaB71ROCAYv0l/2FtKBJFu8vQahhzrdUMoVMZm';

// POST: Login de tenant
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const ipLimit = await checkRateLimit(
      rateLimitKey('login-ip', clientIp),
      AUTH_RATE_LIMITS.login.maxAttempts,
      AUTH_RATE_LIMITS.login.windowMs
    );
    if (ipLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio de autenticación temporalmente no disponible' }, { status: 503 });
    }
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(ipLimit.retryAfterMs / 1000)} segundos.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
      );
    }

    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, password } = parsedBody.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    let loginEmail = normalizeEmail(email);
    if (loginEmail === 'admin') {
      loginEmail = 'admin@rifx.com';
    }

    const emailLimit = await checkRateLimit(
      rateLimitKey('login-account', loginEmail),
      AUTH_RATE_LIMITS.login.maxAttempts,
      AUTH_RATE_LIMITS.login.windowMs
    );
    if (emailLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio de autenticación temporalmente no disponible' }, { status: 503 });
    }
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Email o contraseña incorrectos' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(emailLimit.retryAfterMs / 1000)) } }
      );
    }

    const supabase = createSupabaseAdmin();

    // Find tenant by email
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('email', loginEmail)
      .single();

    // Always perform bcrypt work to reduce account-enumeration timing differences.
    const isValid = await bcrypt.compare(password, tenant?.password_hash || DUMMY_PASSWORD_HASH);

    if (
      error ||
      !tenant ||
      !isValid ||
      tenant.is_active === false ||
      Boolean(tenant.deleted_at)
    ) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    // Check plan expiration + auto-activate pending upgrades (includes trial)
    const isExpired = tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date();
    if (isExpired) {
      if (tenant.plan_status === 'active' || tenant.plan_status === null) {
        await supabase.from('tenants').update({ plan_status: 'expired' }).eq('id', tenant.id);
        tenant.plan_status = 'expired';
      } else if (tenant.plan_status === 'cancelled') {
        // Cancelled plan has now expired -> Downgrade to trial!
        await supabase.from('tenants').update({
          plan: 'trial',
          plan_status: 'expired',
          plan_expires_at: null,
          contact_limit: 200,
          storage_limit_bytes: 100 * 1024 * 1024,
        }).eq('id', tenant.id);
        tenant.plan = 'trial';
        tenant.plan_status = 'expired';
        tenant.plan_expires_at = null;
        tenant.contact_limit = 200;
        tenant.storage_limit_bytes = 100 * 1024 * 1024;
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
    const isPlanExpired = tenant.plan_status === 'expired' || (tenant.plan_expires_at && new Date(tenant.plan_expires_at).getTime() < Date.now());
    const effectivePlan = isPlanExpired ? 'trial' : userPlan;
    const baseAllowedTabs = planPermissions[effectivePlan] || planPermissions.trial;
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
        phone: tenant.phone || null,
        phoneVerified: tenant.phone_verified || false,
        allowedTabs,
        permissionOverrides: overrides,
      },
    });
    return attachSessionCookie(response, token);
  } catch (error) {
    console.error('Login failed:', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
