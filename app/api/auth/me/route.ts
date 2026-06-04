import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// GET: Obtener info completa del tenant actual
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant.tenantId)
      .single();

    if (error || !data) {
      console.error('❌ /api/auth/me - Tenant not found:', { tenantId: tenant.tenantId, error: error?.message, code: error?.code });
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    // Live expiration check — update status if expired
    const isExpired = data.plan_expires_at && new Date(data.plan_expires_at) < new Date();
    if (isExpired) {
      if (data.plan_status === 'active' || data.plan_status === null) {
        await supabase.from('tenants').update({ plan_status: 'expired' }).eq('id', data.id);
        data.plan_status = 'expired';
      } else if (data.plan_status === 'cancelled') {
        // Cancelled plan has now expired -> Downgrade to trial!
        await supabase.from('tenants').update({
          plan: 'trial',
          plan_status: 'expired',
          plan_expires_at: null,
          contact_limit: 200,
          storage_limit_bytes: 100 * 1024 * 1024,
        }).eq('id', data.id);
        data.plan = 'trial';
        data.plan_status = 'expired';
        data.plan_expires_at = null;
        data.contact_limit = 200;
        data.storage_limit_bytes = 100 * 1024 * 1024;
      }
    }

    // Fetch global plan permissions from platform_settings
    let planPermissions: any = {
      trial: ["dashboard", "settings", "billing"],
      start: ["dashboard", "crm", "settings", "billing", "playground"],
      advanced: ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments"],
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
      console.warn("Could not load plan_permissions from database, using defaults:", e);
    }

    const userPlan = data.plan || 'trial';
    const baseAllowedTabs = planPermissions[userPlan] || planPermissions.trial;
    const overrides = data.permission_overrides || {};
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
    if (data.is_admin) {
      allowedTabsSet.add('admin');
    }
    allowedTabsSet.add('dashboard');
    allowedTabsSet.add('billing');

    const allowedTabs = Array.from(allowedTabsSet);

    console.log("DEBUG /api/auth/me:", {
      email: data.email,
      plan: data.plan,
      planStatus: data.plan_status,
      isExpired,
      allowedTabs
    });

    return NextResponse.json({
      id: data.id,
      email: data.email,
      companyName: data.company_name,
      ownerName: data.owner_name,
      plan: data.plan,
      planStatus: data.plan_status,
      planStartedAt: data.plan_started_at,
      planExpiresAt: data.plan_expires_at,
      pendingPlan: data.pending_plan || null,
      storageLimitBytes: data.storage_limit_bytes,
      storageUsedBytes: data.storage_used_bytes,
      contactLimit: data.contact_limit,
      isAdmin: data.is_admin,
      adminRole: data.admin_role || 'full',
      createdAt: data.created_at,
      allowedTabs,
      permissionOverrides: overrides,
    });
  } catch (error: any) {
    console.error('❌ Error obteniendo tenant:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
