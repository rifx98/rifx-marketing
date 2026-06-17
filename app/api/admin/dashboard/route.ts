import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
// ============================================
// PANEL DE ADMINISTRADOR — Solo accesible por is_admin=true
// ============================================

// GET: Obtener datos del dashboard admin
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    // Total tenants
    const { data: allTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantsError) {
      return NextResponse.json({ error: tenantsError.message }, { status: 500 });
    }

    const tenants = allTenants || [];
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.plan_status === 'active').length;

    // Plan distribution
    const planCounts: Record<string, number> = { trial: 0, start: 0, plus: 0, master: 0 };
    tenants.forEach(t => { planCounts[t.plan] = (planCounts[t.plan] || 0) + 1; });

    // Recent registrations (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newThisWeek = tenants.filter(t => t.created_at >= weekAgo).length;

    // Total conversations across all tenants
    const { count: totalConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true });

    // Total messages across all tenants
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Announcements (safe — table might not exist)
    let announcements: any[] = [];
    try {
      const { data: annData } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      announcements = annData || [];
    } catch {}

    // Payments (safe — table might not exist)
    let allPayments: any[] = [];
    try {
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      allPayments = payData || [];
    } catch {}

    const payments = allPayments;

    // Group payments by tenant_id
    const paymentsByTenant: Record<string, any[]> = {};
    for (const p of payments) {
      if (!paymentsByTenant[p.tenant_id]) paymentsByTenant[p.tenant_id] = [];
      paymentsByTenant[p.tenant_id].push(p);
    }

    // Global subscription metrics
    const totalRevenue = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const activeSubscriptions = tenants.filter(t => t.plan_status === 'active' && t.plan !== 'trial').length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const monthlyRevenue = payments
      .filter((p: any) => p.created_at >= thirtyDaysAgo)
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

    // Recent payments with tenant info attached
    const tenantMap: Record<string, any> = {};
    for (const t of tenants) tenantMap[t.id] = t;
    const recentPayments = payments.slice(0, 10).map((p: any) => ({
      ...p,
      tenantEmail: tenantMap[p.tenant_id]?.email || null,
      tenantCompany: tenantMap[p.tenant_id]?.company_name || null,
    }));

    // Load global plan permissions from platform_settings
    let planPermissions = {
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
      console.error('Error fetching plan_permissions in dashboard:', e);
    }

    return NextResponse.json({
      totalTenants,
      activeTenants,
      newThisWeek,
      planCounts,
      totalConversations: totalConversations || 0,
      totalMessages: totalMessages || 0,
      totalRevenue,
      activeSubscriptions,
      monthlyRevenue,
      recentPayments,
      planPermissions,
      tenants: tenants.map(t => {
        const tenantPayments = paymentsByTenant[t.id] || [];
        const totalSpent = tenantPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        const lastPaymentDate = tenantPayments.length > 0 ? tenantPayments[0].created_at : null;
        const daysRemaining = t.plan_expires_at
          ? Math.max(0, Math.ceil((new Date(t.plan_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;
        return {
          id: t.id,
          email: t.email,
          companyName: t.company_name,
          ownerName: t.owner_name,
          plan: t.plan,
          planStatus: t.plan_status,
          planStartedAt: t.plan_started_at,
          planExpiresAt: t.plan_expires_at,
          storageUsed: t.storage_used_bytes,
          storageLimit: t.storage_limit_bytes,
          contactLimit: t.contact_limit,
          isAdmin: t.is_admin,
          adminRole: t.admin_role || 'full',
          adminCanEditPlans: t.admin_can_edit_plans !== false,
          adminSections: t.admin_sections || ['overview', 'tenants', 'templates', 'announcements'],
          createdAt: t.created_at,
          payments: tenantPayments,
          totalSpent,
          lastPaymentDate,
          daysRemaining,
          permissionOverrides: t.permission_overrides || {},
        };
      }),
      announcements: announcements || [],
      payments,
    });
  } catch (error: any) {
    console.error('❌ Error en admin dashboard:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}

// POST: Acciones del admin (crear anuncio, cambiar plan, etc.)
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const supabase = createSupabaseAdmin();

    // Action: create_announcement
    if (body.action === 'create_announcement') {
      const { title, message, type, image_url, button_text, button_url } = body;
      if (!title || !message) {
        return NextResponse.json({ error: 'Título y mensaje son requeridos' }, { status: 400 });
      }
      const insertData: any = { title, message, type: type || 'info', is_active: true };
      if (image_url) insertData.image_url = image_url;
      if (button_text) insertData.button_text = button_text;
      if (button_url) insertData.button_url = button_url;
      
      const { data, error } = await supabase
        .from('announcements')
        .insert(insertData)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, announcement: data });
    }

    // Action: delete_announcement
    if (body.action === 'delete_announcement') {
      const { announcementId } = body;
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: toggle_announcement
    if (body.action === 'toggle_announcement') {
      const { announcementId, isActive } = body;
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: isActive })
        .eq('id', announcementId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: update_tenant_plan
    if (body.action === 'update_tenant_plan') {
      if (tenant.adminCanEditPlans === false) {
        return NextResponse.json({ error: 'No tienes permisos para modificar planes.' }, { status: 403 });
      }

      const { targetTenantId, plan } = body;
      const validPlans = ['trial', 'start', 'plus', 'master'];
      if (!validPlans.includes(plan)) {
        return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
      }

      const LIMITS: Record<string, { contacts: number; storage: number }> = {
        trial:    { contacts: 200,   storage: 100 * 1024 * 1024 },
        start:    { contacts: 1000,  storage: 250 * 1024 * 1024 },
        plus:     { contacts: 20000, storage: 1024 * 1024 * 1024 },
        master:   { contacts: 50000, storage: 2048 * 1024 * 1024 },
      };

      const limits = LIMITS[plan];
      const { error } = await supabase
        .from('tenants')
        .update({
          plan,
          plan_status: 'active',
          plan_started_at: new Date().toISOString(),
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          storage_limit_bytes: limits.storage,
          contact_limit: limits.contacts,
        })
        .eq('id', targetTenantId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: toggle_admin
    if (body.action === 'toggle_admin') {
      // Solo un admin full puede cambiar permisos de administrador
      if (tenant.adminRole !== 'full' && tenant.adminRole !== undefined) {
        return NextResponse.json({ error: 'Solo un Administrador Total puede asignar o quitar roles.' }, { status: 403 });
      }

      const { targetTenantId, isAdmin, adminRole, adminCanEditPlans } = body;
      
      const updateData: any = { is_admin: isAdmin };
      if (isAdmin) {
        updateData.admin_role = adminRole || 'full';
        updateData.admin_can_edit_plans = adminCanEditPlans !== false;
        updateData.admin_sections = body.adminSections || ['overview', 'tenants', 'templates', 'announcements'];
      }

      const { error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', targetTenantId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: update_plan_permissions
    if (body.action === 'update_plan_permissions') {
      const { planPermissions } = body;
      if (!planPermissions) {
        return NextResponse.json({ error: 'Permisos de planes requeridos' }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from('platform_settings')
          .update({ plan_permissions: planPermissions, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        result = await supabase
          .from('platform_settings')
          .insert({ plan_permissions: planPermissions });
      }

      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: update_tenant_overrides
    if (body.action === 'update_tenant_overrides') {
      const { targetTenantId, permissionOverrides } = body;
      if (!targetTenantId || !permissionOverrides) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
      }

      const { error } = await supabase
        .from('tenants')
        .update({ permission_overrides: permissionOverrides })
        .eq('id', targetTenantId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: delete_tenant
    if (body.action === 'delete_tenant') {
      // Solo un admin con rol completo (o indefinido por defecto) puede eliminar
      if (tenant.adminRole !== 'full' && tenant.adminRole !== undefined) {
        return NextResponse.json({ error: 'Solo un Administrador Total puede eliminar usuarios.' }, { status: 403 });
      }

      const { targetTenantId } = body;
      if (!targetTenantId) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      // No permitir auto-eliminación desde aquí
      if (targetTenantId === tenant.tenantId) {
        return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta desde aquí.' }, { status: 400 });
      }

      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', targetTenantId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('❌ Error en admin action:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
