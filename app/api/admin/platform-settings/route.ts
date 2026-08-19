import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

const MAX_PLATFORM_NAME_LENGTH = 100;
const MAX_SIDEBAR_ITEMS = 30;

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireAdminPermission(request, 'platform_settings.read');
    if (!authorization.ok) return authorization.response;

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('platform_settings')
      .select('id,platform_name,platform_logo,sidebar_order,plan_permissions,updated_at')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Platform settings lookup failed:', error.code || 'database_error');
      return NextResponse.json({ error: 'No se pudo cargar la configuracion' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        platform_name: 'Sovereign',
        platform_logo: null,
        sidebar_order: ['dashboard', 'crm', 'settings', 'billing', 'playground', 'campaigns', 'segments', 'analytics', 'admin']
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la configuracion' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireAdminPermission(request, 'platform_settings.update');
    if (!authorization.ok) return authorization.response;
    const rateDenied = await enforceTenantRateLimit(
      'admin-platform-settings',
      authorization.admin.tenantId,
      20,
      60_000,
    );
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();
    const parsedBody = await readLimitedJsonObject(request, 64 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const { platform_name, platform_logo, sidebar_order } = body;

    if (
      typeof platform_name !== 'string'
      || !platform_name.trim()
      || platform_name.length > MAX_PLATFORM_NAME_LENGTH
      || (platform_logo !== null && platform_logo !== undefined && typeof platform_logo !== 'string')
      || !Array.isArray(sidebar_order)
      || sidebar_order.length > MAX_SIDEBAR_ITEMS
      || sidebar_order.some(item => typeof item !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(item))
    ) {
      return NextResponse.json({ error: 'Configuracion invalida' }, { status: 400 });
    }

    // Check if a row exists
    const { data: existing } = await supabase
      .from('platform_settings')
      .select('id')
      .limit(1)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('platform_settings')
        .update({ platform_name, platform_logo, sidebar_order, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select();
    } else {
      result = await supabase
        .from('platform_settings')
        .insert({ platform_name, platform_logo, sidebar_order })
        .select();
    }

    if (result.error) {
      return NextResponse.json({ error: 'No se pudo guardar la configuracion' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data[0] });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la configuracion' }, { status: 500 });
  }
}
