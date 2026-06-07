import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest, signToken } from '@/lib/auth';

// ============================================
// ACTIVATE PLAN — Called after successful payment
// Serves as a safety net if webhook hasn't arrived yet
// ============================================

const LIMITS: Record<string, { contacts: number; storage: number }> = {
  trial:    { contacts: 200,   storage: 100 * 1024 * 1024 },
  start:    { contacts: 1000,  storage: 250 * 1024 * 1024 },
  plus:     { contacts: 20000, storage: 1024 * 1024 * 1024 },
  master:   { contacts: 50000, storage: 2048 * 1024 * 1024 },
};

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { plan } = await req.json();
    if (!plan || !LIMITS[plan]) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
    }

    if (plan !== 'trial') {
      return NextResponse.json({ error: 'No autorizado. Los planes de pago solo pueden activarse a través de la pasarela de pagos.' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    // Fetch current tenant data
    const { data: tenantData, error: fetchError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant.tenantId)
      .single();

    if (fetchError || !tenantData) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    // Check if plan is already active and not expired
    const isExpired = tenantData.plan_expires_at && new Date(tenantData.plan_expires_at) < new Date();
    const isAlreadyActive = tenantData.plan === plan && tenantData.plan_status === 'active' && !isExpired;

    if (isAlreadyActive) {
      return NextResponse.json({ 
        success: true, 
        message: 'Plan ya está activo',
        tenant: {
          id: tenantData.id,
          email: tenantData.email,
          plan: tenantData.plan,
          planStatus: tenantData.plan_status,
          planExpiresAt: tenantData.plan_expires_at,
        }
      });
    }

    // Activate the plan
    const limits = LIMITS[plan];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        plan,
        plan_status: 'active',
        plan_started_at: now.toISOString(),
        plan_expires_at: expiresAt.toISOString(),
        storage_limit_bytes: limits.storage,
        contact_limit: limits.contacts,
        pending_plan: null,
      })
      .eq('id', tenant.tenantId);

    if (updateError) {
      console.error('❌ Error activating plan:', updateError.message);
      return NextResponse.json({ error: 'Error al activar plan' }, { status: 500 });
    }

    // Generate new token with updated plan
    const newToken = await signToken({
      tenantId: tenant.tenantId,
      email: tenant.email,
      plan,
      isAdmin: tenant.isAdmin,
      adminRole: tenant.adminRole,
      adminCanEditPlans: tenant.adminCanEditPlans,
    });

    // Calculate allowedTabs to match auth/me format
    // Fetch global plan permissions from platform_settings
    let planPermissions: any = {
      trial: ["dashboard", "settings", "billing"],
      start: ["dashboard", "crm", "settings", "billing", "playground"],
      plus: ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments", "analytics", "social"],
      master: ["dashboard", "crm", "settings", "billing", "playground", "campaigns", "banners", "segments", "analytics", "social"]
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
      console.warn("Could not load plan_permissions from database in activate-plan, using defaults:", e);
    }

    const baseAllowedTabs = planPermissions[plan] || planPermissions.trial;
    const overrides = tenantData.permission_overrides || {};
    const activeOverrides: string[] = [];
    const nowMs = Date.now();

    for (const [tab, expiry] of Object.entries(overrides)) {
      if (expiry) {
        const expiryDate = new Date(expiry as string);
        if (!isNaN(expiryDate.getTime()) && expiryDate.getTime() > nowMs) {
          activeOverrides.push(tab);
        }
      }
    }

    const allowedTabsSet = new Set([...baseAllowedTabs, ...activeOverrides]);
    if (tenantData.is_admin) {
      allowedTabsSet.add('admin');
    }
    allowedTabsSet.add('dashboard');
    allowedTabsSet.add('billing');

    const allowedTabs = Array.from(allowedTabsSet);

    console.log(`✅ Plan activado: tenant ${tenant.tenantId} → ${plan} (30 días)`);

    return NextResponse.json({
      success: true,
      token: newToken,
      tenant: {
        id: tenantData.id,
        email: tenantData.email,
        companyName: tenantData.company_name,
        ownerName: tenantData.owner_name,
        plan,
        planStatus: 'active',
        planStartedAt: now.toISOString(),
        planExpiresAt: expiresAt.toISOString(),
        storageLimitBytes: limits.storage,
        storageUsedBytes: tenantData.storage_used_bytes,
        contactLimit: limits.contacts,
        isAdmin: tenantData.is_admin,
        adminRole: tenantData.admin_role || 'full',
        createdAt: tenantData.created_at,
        allowedTabs,
        permissionOverrides: overrides,
      },
    });
  } catch (error: any) {
    console.error('❌ Error en activate-plan:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
