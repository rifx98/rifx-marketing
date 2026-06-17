import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { signToken } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMITS } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

// POST: Login de tenant
export async function POST(req: NextRequest) {
  try {
    // VULN-09 fix: Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed, retryAfterMs } = await checkRateLimit(
      `login:${clientIp}`,
      AUTH_RATE_LIMITS.login.maxAttempts,
      AUTH_RATE_LIMITS.login.windowMs
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(retryAfterMs / 1000)} segundos.` },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    let loginEmail = email.toLowerCase().trim();
    if (loginEmail === 'admin') {
      loginEmail = 'admin@rifx.com';
    }

    const supabase = createSupabaseAdmin();

    // Find tenant by email
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('email', loginEmail)
      .single();

    if (error || !tenant) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    // Verify password
    let isValid = await bcrypt.compare(password, tenant.password_hash);

    if (!isValid) {
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
    });

    console.log('✅ Login exitoso:', tenant.email);

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
    } catch (e) {
      console.warn("Could not load plan_permissions from database, using defaults:", e);
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

    return NextResponse.json({
      success: true,
      token,
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
  } catch (error: any) {
    console.error('❌ Error en login:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
