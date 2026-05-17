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
      .select('id, email, company_name, owner_name, plan, plan_status, plan_expires_at, storage_used_bytes, storage_limit_bytes, contact_limit, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (tenantsError) {
      return NextResponse.json({ error: tenantsError.message }, { status: 500 });
    }

    const tenants = allTenants || [];
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.plan_status === 'active').length;

    // Plan distribution
    const planCounts: Record<string, number> = { trial: 0, start: 0, advanced: 0, plus: 0, master: 0 };
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

    // Announcements
    const { data: announcements } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    // Payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      totalTenants,
      activeTenants,
      newThisWeek,
      planCounts,
      totalConversations: totalConversations || 0,
      totalMessages: totalMessages || 0,
      tenants: tenants.map(t => ({
        id: t.id,
        email: t.email,
        companyName: t.company_name,
        ownerName: t.owner_name,
        plan: t.plan,
        planStatus: t.plan_status,
        planExpiresAt: t.plan_expires_at,
        storageUsed: t.storage_used_bytes,
        storageLimit: t.storage_limit_bytes,
        contactLimit: t.contact_limit,
        isAdmin: t.is_admin,
        createdAt: t.created_at,
      })),
      announcements: announcements || [],
      payments: payments || [],
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
      const { targetTenantId, plan } = body;
      const validPlans = ['trial', 'start', 'advanced', 'plus', 'master'];
      if (!validPlans.includes(plan)) {
        return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
      }

      const LIMITS: Record<string, { contacts: number; storage: number }> = {
        trial:    { contacts: 200,   storage: 100 * 1024 * 1024 },
        start:    { contacts: 1000,  storage: 250 * 1024 * 1024 },
        advanced: { contacts: 10000, storage: 500 * 1024 * 1024 },
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
      const { targetTenantId, isAdmin } = body;
      const { error } = await supabase
        .from('tenants')
        .update({ is_admin: isAdmin })
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
