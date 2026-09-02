import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { enforceTenantRateLimit, internalApiError } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/panel/templates - Obtener plantillas activas para el tenant (globales + específicas)
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'banners');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('template-list', tenant.tenantId, 90, 60_000);
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();
    
    // Obtener plantillas donde is_active sea true
    // y (tenant_id IS NULL o tenant_id = tenant.tenantId)
    // Supabase JS no tiene or directo fácil para null y valor, pero podemos usar query filter o RPC.
    // O podemos hacer un select y filtrar en JS, o usar .or('tenant_id.is.null,tenant_id.eq.' + tenant.tenantId)
    const { data, error } = await supabase
      .from('templates')
      .select('id,name,category,preview_image_url,config_json,tenant_id,created_at,updated_at')
      .eq('is_active', true)
      .or(`tenant_id.is.null,tenant_id.eq.${tenant.tenantId}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Panel template lookup failed:', error.code || 'database_error');
      return internalApiError();
    }

    return NextResponse.json(
      { success: true, templates: data || [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    console.error('Panel template request failed');
    return internalApiError();
  }
}
