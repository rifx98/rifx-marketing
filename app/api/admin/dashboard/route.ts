import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import {
  getDashboardAdminPermission,
  hasAdminPermission,
  hasAdminSection,
  requireAdminPermission,
} from '@/lib/admin-rbac';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const MAX_ANNOUNCEMENT_URL_LENGTH = 2_048;
const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WHATSAPP_PHONE_ID_PATTERN = /^\d{5,32}$/;
const ADMIN_TENANT_FIELDS = [
  'id', 'email', 'company_name', 'owner_name', 'plan', 'plan_status',
  'plan_started_at', 'plan_expires_at', 'storage_used_bytes',
  'storage_limit_bytes', 'contact_limit', 'is_admin', 'admin_role',
  'admin_can_edit_plans', 'admin_sections', 'created_at', 'permission_overrides',
].join(',');

interface WhatsAppConnectionDto {
  connectionId: string;
  tenantId: string | null;
  phoneNumberId: string;
  ownerEmail: string | null;
  ownerCompanyName: string | null;
  orphaned: boolean;
  updatedAt: string | null;
}

function normalizeAnnouncementButtonUrl(value: unknown): { value: string | null; error?: string } {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string') return { value: null, error: 'El enlace del boton no es valido' };
  const raw = value.trim();
  if (!raw) return { value: null };
  if (raw.length > MAX_ANNOUNCEMENT_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(raw)) {
    return { value: null, error: 'El enlace del boton es demasiado largo o contiene caracteres invalidos' };
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return { value: null, error: 'El enlace del boton debe ser una URL HTTPS sin credenciales' };
    }
    const normalized = url.toString();
    if (normalized.length > MAX_ANNOUNCEMENT_URL_LENGTH) {
      return { value: null, error: 'El enlace del boton es demasiado largo' };
    }
    return { value: normalized };
  } catch {
    return { value: null, error: 'El enlace del boton debe ser una URL HTTPS valida' };
  }
}
// ============================================
// PANEL DE ADMINISTRADOR — Solo accesible por is_admin=true
// ============================================

// GET: Obtener datos del dashboard admin
export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminPermission(req, 'dashboard.read');
    if (!authorization.ok) return authorization.response;
    const admin = authorization.admin;
    const canViewOverview = hasAdminSection(admin, 'overview');
    const canViewTenants = hasAdminSection(admin, 'tenants');
    const canViewAnnouncements = hasAdminSection(admin, 'announcements');
    const canManagePlanPermissions = hasAdminPermission(admin, 'plan_permissions.update');
    const canManageWhatsApp = hasAdminPermission(admin, 'tenants.whatsapp.disconnect');

    const supabase = createSupabaseAdmin();

    // Total tenants
    const { data: allTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(ADMIN_TENANT_FIELDS)
      .order('created_at', { ascending: false });

    if (tenantsError) {
      return NextResponse.json({ error: 'No se pudo cargar el dashboard' }, { status: 500 });
    }

    const tenants: any[] = allTenants || [];
    const tenantMap: Record<string, any> = {};
    for (const t of tenants) tenantMap[t.id] = t;

    let whatsappConnections: WhatsAppConnectionDto[] | null = canManageWhatsApp ? [] : null;
    let whatsappConnectionsError = false;
    if (canManageWhatsApp) {
      const { data: configs, error: configsError } = await supabase
        .from('config')
        .select('id,tenant_id,whatsapp_phone_id,updated_at')
        .not('whatsapp_phone_id', 'is', null);

      if (configsError) {
        console.error(
          'Admin WhatsApp connections fetch failed:',
          configsError.code || 'database_error',
        );
        whatsappConnections = null;
        whatsappConnectionsError = true;
      } else {
        whatsappConnections = (configs || []).flatMap((config): WhatsAppConnectionDto[] => {
          if (
            typeof config.id !== 'string' ||
            !TENANT_ID_PATTERN.test(config.id) ||
            typeof config.whatsapp_phone_id !== 'string' ||
            !WHATSAPP_PHONE_ID_PATTERN.test(config.whatsapp_phone_id)
          ) {
            return [];
          }

          const tenantId =
            typeof config.tenant_id === 'string' && TENANT_ID_PATTERN.test(config.tenant_id)
              ? config.tenant_id
              : null;
          const owner = tenantId ? tenantMap[tenantId] : null;
          return [{
            connectionId: config.id,
            tenantId,
            phoneNumberId: config.whatsapp_phone_id,
            ownerEmail: typeof owner?.email === 'string' ? owner.email : null,
            ownerCompanyName: typeof owner?.company_name === 'string' ? owner.company_name : null,
            orphaned: !owner,
            updatedAt: typeof config.updated_at === 'string' ? config.updated_at : null,
          }];
        });
      }
    }

    const whatsappConnectionsByTenant: Record<string, WhatsAppConnectionDto[]> = {};
    for (const connection of whatsappConnections || []) {
      if (!connection.tenantId) continue;
      if (!whatsappConnectionsByTenant[connection.tenantId]) {
        whatsappConnectionsByTenant[connection.tenantId] = [];
      }
      whatsappConnectionsByTenant[connection.tenantId].push(connection);
    }

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
      .select('id', { count: 'exact', head: true });

    // Total messages across all tenants
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true });

    // Announcements (safe — table might not exist)
    let announcements: any[] = [];
    try {
      const { data: annData, error: annError } = await supabase
        .from('announcements')
        .select('id,title,message,type,image_url,button_text,button_url,is_active,starts_at,expires_at,created_at')
        .order('created_at', { ascending: false });
      
      if (annError) {
        console.error('Admin announcements fetch error:', annError);
      }
      announcements = annData || [];
    } catch (e) {
      console.error('Admin announcements exception:', e);
    }

    // Payments (safe — table might not exist)
    let allPayments: any[] = [];
    try {
      const { data: payData } = await supabase
        .from('payments')
        .select('id,tenant_id,plan,amount,currency,payment_method,transaction_id,status,created_at')
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
    } catch {
      console.error('Admin plan permissions lookup failed');
    }

    const canViewTenantMetrics = canViewOverview || canViewTenants;
    const canViewPayments = canViewOverview || canViewTenants;

    return NextResponse.json({
      totalTenants: canViewTenantMetrics ? totalTenants : 0,
      activeTenants: canViewTenantMetrics ? activeTenants : 0,
      newThisWeek: canViewTenantMetrics ? newThisWeek : 0,
      planCounts: canViewTenantMetrics ? planCounts : {},
      totalConversations: canViewOverview ? totalConversations || 0 : 0,
      totalMessages: canViewOverview ? totalMessages || 0 : 0,
      totalRevenue: canViewOverview ? totalRevenue : 0,
      activeSubscriptions: canViewOverview ? activeSubscriptions : 0,
      monthlyRevenue: canViewOverview ? monthlyRevenue : 0,
      recentPayments: canViewOverview ? recentPayments : [],
      planPermissions: canManagePlanPermissions ? planPermissions : null,
      canManageWhatsApp,
      whatsappConnectionsError,
      whatsappConnections,
      tenants: (canViewTenants ? tenants : canViewOverview ? tenants.slice(0, 5) : []).map(t => {
        if (!canViewTenants) {
          return {
            id: t.id,
            email: t.email,
            companyName: t.company_name,
            ownerName: t.owner_name,
            plan: t.plan,
            createdAt: t.created_at,
          };
        }
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
          whatsappConnections: canManageWhatsApp
            ? whatsappConnections === null
              ? null
              : whatsappConnectionsByTenant[t.id] || []
            : null,
        };
      }),
      announcements: canViewAnnouncements ? announcements : [],
      payments: canViewPayments ? payments : [],
    });
  } catch {
    console.error('Admin dashboard load failed');
    return NextResponse.json({ error: 'No se pudo cargar el dashboard' }, { status: 500 });
  }
}

// POST: Acciones del admin (crear anuncio, cambiar plan, etc.)
export async function POST(req: NextRequest) {
  try {
    const parsedBody = await readLimitedJsonObject(req, 128 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const permission = getDashboardAdminPermission(body?.action);
    if (!permission) {
      return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 });
    }
    const authorization = await requireAdminPermission(req, permission);
    if (!authorization.ok) return authorization.response;
    const tenant = authorization.admin;
    const rateDenied = await enforceTenantRateLimit(
      'admin-dashboard-mutation',
      tenant.tenantId,
      30,
      60_000,
    );
    if (rateDenied) return rateDenied;
    const supabase = createSupabaseAdmin();

    // Action: create_announcement
    if (body.action === 'create_announcement') {
      const { title, message, type, image_url, button_text, button_url, starts_at, expires_at } = body;
      if (!title || !message) {
        return NextResponse.json({ error: 'Título y mensaje son requeridos' }, { status: 400 });
      }
      if (starts_at && expires_at && new Date(String(expires_at)) <= new Date(String(starts_at))) {
        return NextResponse.json({ error: 'La fecha de caducidad debe ser posterior a la de inicio' }, { status: 400 });
      }
      const normalizedButtonUrl = normalizeAnnouncementButtonUrl(button_url);
      if (normalizedButtonUrl.error) {
        return NextResponse.json({ error: normalizedButtonUrl.error }, { status: 400 });
      }
      const insertData: any = { title, message, type: type || 'info', is_active: true };
      if (image_url) insertData.image_url = image_url;
      if (button_text) insertData.button_text = button_text;
      if (normalizedButtonUrl.value) insertData.button_url = normalizedButtonUrl.value;
      if (starts_at) insertData.starts_at = new Date(String(starts_at)).toISOString();
      if (expires_at) insertData.expires_at = new Date(String(expires_at)).toISOString();

      const { data, error } = await supabase
        .from('announcements')
        .insert(insertData)
        .select()
        .single();

      if (error) return NextResponse.json({ error: 'No se pudo crear el anuncio' }, { status: 500 });
      return NextResponse.json({ success: true, announcement: data });
    }

    // Action: update_announcement
    if (body.action === 'update_announcement') {
      const { announcementId, title, message, type, image_url, button_text, button_url, starts_at, expires_at } = body;
      if (!announcementId) {
        return NextResponse.json({ error: 'announcementId es requerido' }, { status: 400 });
      }
      if (!title || !message) {
        return NextResponse.json({ error: 'Título y mensaje son requeridos' }, { status: 400 });
      }
      if (starts_at && expires_at && new Date(String(expires_at)) <= new Date(String(starts_at))) {
        return NextResponse.json({ error: 'La fecha de caducidad debe ser posterior a la de inicio' }, { status: 400 });
      }
      const normalizedButtonUrl = normalizeAnnouncementButtonUrl(button_url);
      if (normalizedButtonUrl.error) {
        return NextResponse.json({ error: normalizedButtonUrl.error }, { status: 400 });
      }
      const updateData: any = {
        title,
        message,
        type: type || 'info',
        image_url: image_url || null,
        button_text: button_text || null,
        button_url: normalizedButtonUrl.value,
        starts_at: starts_at ? new Date(String(starts_at)).toISOString() : null,
        expires_at: expires_at ? new Date(String(expires_at)).toISOString() : null,
      };

      const { data, error } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', announcementId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: 'No se pudo actualizar el anuncio' }, { status: 500 });
      return NextResponse.json({ success: true, announcement: data });
    }

    // Action: delete_announcement
    if (body.action === 'delete_announcement') {
      const { announcementId } = body;
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) return NextResponse.json({ error: 'No se pudo eliminar el anuncio' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: bulk_delete_announcements
    if (body.action === 'bulk_delete_announcements') {
      const { announcementIds } = body;
      if (!Array.isArray(announcementIds) || announcementIds.length === 0) {
        return NextResponse.json({ success: true });
      }
      
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < announcementIds.length; i += CHUNK_SIZE) {
        chunks.push(announcementIds.slice(i, i + CHUNK_SIZE));
      }

      const results = await Promise.all(
        chunks.map(chunk => supabase.from('announcements').delete().in('id', chunk))
      );

      const hasError = results.some(r => r.error);
      if (hasError) {
        console.error('Error en bulk_delete_announcements:', results.find(r => r.error)?.error);
        return NextResponse.json({ error: 'No se pudieron eliminar algunos anuncios' }, { status: 500 });
      }

      return NextResponse.json({ success: true, deleted: announcementIds.length });
    }

    // Action: toggle_announcement
    if (body.action === 'toggle_announcement') {
      const { announcementId, isActive } = body;
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: isActive })
        .eq('id', announcementId);

      if (error) return NextResponse.json({ error: 'No se pudo cambiar el estado del anuncio' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: update_tenant_plan
    if (body.action === 'update_tenant_plan') {
      const { targetTenantId, plan } = body;
      const validPlans = ['trial', 'start', 'plus', 'master'];
      if (!validPlans.includes(plan as string)) {
        return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
      }

      const LIMITS: Record<string, { contacts: number; storage: number }> = {
        trial:    { contacts: 200,   storage: 100 * 1024 * 1024 },
        start:    { contacts: 1000,  storage: 250 * 1024 * 1024 },
        plus:     { contacts: 20000, storage: 1024 * 1024 * 1024 },
        master:   { contacts: 50000, storage: 2048 * 1024 * 1024 },
      };

      const limits = LIMITS[plan as string];
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

      if (error) return NextResponse.json({ error: 'No se pudo actualizar el plan del tenant' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: toggle_admin
    if (body.action === 'toggle_admin') {
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

      if (error) return NextResponse.json({ error: 'No se pudo actualizar el rol administrativo' }, { status: 500 });
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

      if (result.error) return NextResponse.json({ error: 'No se pudieron actualizar los permisos de planes' }, { status: 500 });
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

      if (error) return NextResponse.json({ error: 'No se pudieron actualizar los permisos del tenant' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Action: delete_tenant
    if (body.action === 'delete_tenant') {
      const { targetTenantId } = body;
      if (typeof targetTenantId !== 'string' || !TENANT_ID_PATTERN.test(targetTenantId)) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      // No permitir auto-eliminación desde aquí
      if (targetTenantId === tenant.tenantId) {
        return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta desde aquí.' }, { status: 400 });
      }

      const { data: target, error: targetError } = await supabase
        .from('tenants')
        .select('id,is_active,deleted_at,session_version')
        .eq('id', targetTenantId)
        .maybeSingle();
      if (targetError) {
        return NextResponse.json({ error: 'No se pudo consultar el tenant' }, { status: 500 });
      }
      if (!target) {
        return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
      }
      // Reintentos del mismo soft-delete son seguros y no vuelven a incrementar
      // la versión de sesión de un tenant que ya estaba desactivado.
      if (target.deleted_at && target.is_active === false) {
        return NextResponse.json({ success: true, alreadyDeleted: true });
      }

      const currentSessionVersion = Number(target.session_version);
      const maxPostgresInteger = 2_147_483_647;
      if (
        !Number.isSafeInteger(currentSessionVersion)
        || currentSessionVersion < 0
        || currentSessionVersion >= maxPostgresInteger
      ) {
        return NextResponse.json({ error: 'No se pudo desactivar el tenant de forma segura' }, { status: 409 });
      }

      const { data: deactivated, error } = await supabase
        .from('tenants')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
          session_version: currentSessionVersion + 1,
        })
        .eq('id', targetTenantId)
        .eq('session_version', currentSessionVersion)
        .select('id')
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: 'No se pudo desactivar el tenant' }, { status: 500 });
      }
      if (!deactivated) {
        return NextResponse.json({ error: 'El tenant cambió mientras se procesaba la solicitud' }, { status: 409 });
      }
      return NextResponse.json({ success: true });
    }


    // Action: disconnect_whatsapp — clear one exact WhatsApp connection so
    // the phone number can be reassigned without affecting sibling config rows.
    if (body.action === 'disconnect_whatsapp') {
      const { connectionId, expectedPhoneNumberId } = body;
      if (typeof connectionId !== 'string' || !TENANT_ID_PATTERN.test(connectionId)) {
        return NextResponse.json({ error: 'ID de conexión inválido' }, { status: 400 });
      }
      if (
        typeof expectedPhoneNumberId !== 'string' ||
        !WHATSAPP_PHONE_ID_PATTERN.test(expectedPhoneNumberId)
      ) {
        return NextResponse.json({ error: 'Phone ID inválido' }, { status: 400 });
      }

      const { data: disconnected, error: clearError } = await supabase
        .from('config')
        .update({
          whatsapp_token: null,
          whatsapp_phone_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)
        .eq('whatsapp_phone_id', expectedPhoneNumberId)
        .select('id')
        .maybeSingle();

      if (clearError) {
        console.error('Admin disconnect_whatsapp failed:', clearError.code || 'database_error');
        return NextResponse.json({ error: 'No se pudo desconectar el número de WhatsApp' }, { status: 500 });
      }
      if (!disconnected) {
        return NextResponse.json(
          { error: 'La conexión de WhatsApp cambió; actualiza el panel' },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch {
    console.error('Admin dashboard action failed');
    return NextResponse.json({ error: 'No se pudo procesar la accion administrativa' }, { status: 500 });
  }
}
