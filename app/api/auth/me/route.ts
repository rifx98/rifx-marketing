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

    if (tenant.tenantId === 'admin-local-master') {
      const allowedTabs = [
        'dashboard', 'crm', 'brain', 'voice_agent', 'voice', 'settings',
        'billing', 'playground', 'campaigns', 'wa_campaigns', 'banners',
        'analytics', 'social', 'appointments', 'conversations', 'orders',
        'team', 'admin', 'basic_bot'
      ];
      return NextResponse.json({
        id: 'admin-local-master',
        email: tenant.email || 'admin@rifx.com',
        companyName: 'RIFX Marketing (Admin)',
        ownerName: 'Administrador',
        plan: 'master',
        planStatus: 'active',
        planStartedAt: new Date().toISOString(),
        planExpiresAt: null,
        pendingPlan: null,
        ai_credits_balance: 999999,
        storageLimitBytes: 10 * 1024 * 1024 * 1024,
        storageUsedBytes: 0,
        contactLimit: 100000,
        isAdmin: true,
        adminRole: 'full',
        createdAt: new Date().toISOString(),
        phone: null,
        phoneVerified: true,
        allowedTabs,
        permissionOverrides: {},
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const supabase = createSupabaseAdmin();
    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant.tenantId)
        .single();
      data = res.data;
      error = res.error;
    } catch (e: any) {
      error = e;
    }

    if (error || !data) {
      if (tenant.isAdmin) {
        const allowedTabs = [
          'dashboard', 'crm', 'brain', 'voice_agent', 'voice', 'settings',
          'billing', 'playground', 'campaigns', 'wa_campaigns', 'banners',
          'analytics', 'social', 'appointments', 'conversations', 'orders',
          'team', 'admin', 'basic_bot'
        ];
        return NextResponse.json({
          id: tenant.tenantId,
          email: tenant.email,
          companyName: 'RIFX Marketing (Admin)',
          ownerName: 'Administrador',
          plan: 'master',
          planStatus: 'active',
          planStartedAt: new Date().toISOString(),
          planExpiresAt: null,
          pendingPlan: null,
          ai_credits_balance: 999999,
          storageLimitBytes: 10 * 1024 * 1024 * 1024,
          storageUsedBytes: 0,
          contactLimit: 100000,
          isAdmin: true,
          adminRole: 'full',
          createdAt: new Date().toISOString(),
          phone: null,
          phoneVerified: true,
          allowedTabs,
          permissionOverrides: {},
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
      console.error('/api/auth/me tenant lookup failed:', error?.code || 'not_found');
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
          storage_limit_bytes: 500 * 1024 * 1024,
        }).eq('id', data.id);
        data.plan = 'trial';
        data.plan_status = 'expired';
        data.plan_expires_at = null;
        data.contact_limit = 200;
        data.storage_limit_bytes = 500 * 1024 * 1024;
      }
    }

    // Fetch global plan permissions from platform_settings
    let planPermissions: any = {
      trial: ["dashboard", "settings", "billing", "brain", "voice_agent"],
      start: ["dashboard", "crm", "brain", "voice_agent", "voice", "settings", "billing", "playground", "conversations", "orders"],
      plus: ["dashboard", "crm", "brain", "voice_agent", "voice", "settings", "billing", "playground", "banners", "analytics", "social", "appointments", "conversations", "orders"],
      master: ["dashboard", "crm", "brain", "voice_agent", "voice", "settings", "billing", "playground", "campaigns", "wa_campaigns", "banners", "analytics", "social", "appointments", "conversations", "orders", "team"]
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

    const userPlan = data.plan || 'trial';
    const isPlanExpired = data.plan_status === 'expired' || (data.plan_expires_at && new Date(data.plan_expires_at).getTime() < Date.now());
    const effectivePlan = isPlanExpired ? 'trial' : userPlan;
    const baseAllowedTabs = planPermissions[effectivePlan] || planPermissions.trial;
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
    // Always include core modules brain and voice_agent
    allowedTabsSet.add('brain');
    allowedTabsSet.add('voice_agent');
    allowedTabsSet.add('dashboard');
    allowedTabsSet.add('billing');

    if (data.is_admin) {
      allowedTabsSet.add('admin');
      allowedTabsSet.add('campaigns');
      allowedTabsSet.add('wa_campaigns');
      allowedTabsSet.add('crm');
      allowedTabsSet.add('conversations');
      allowedTabsSet.add('orders');
      allowedTabsSet.add('team');
      allowedTabsSet.add('basic_bot');
      allowedTabsSet.add('appointments');
      allowedTabsSet.add('banners');
      allowedTabsSet.add('social');
      allowedTabsSet.add('analytics');
      allowedTabsSet.add('settings');
    }

    const allowedTabs = Array.from(allowedTabsSet);

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
      ai_credits_balance: data.ai_credits_balance || 0,
      storageLimitBytes: data.storage_limit_bytes,
      storageUsedBytes: data.storage_used_bytes,
      contactLimit: data.contact_limit,
      isAdmin: data.is_admin,
      adminRole: data.admin_role || 'full',
      createdAt: data.created_at,
      phone: data.phone || null,
      phoneVerified: data.phone_verified || false,
      allowedTabs,
      permissionOverrides: overrides,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('/api/auth/me failed:', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
