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
  } catch (err: any) {
    console.error('Error en GET /api/panel/templates:', err);
    return internalApiError();
  }
}

// POST /api/panel/templates - Crear o subir una nueva pancarta publicitaria para el tenant
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'banners');
    if (featureDenied) return featureDenied;

    const rateDenied = await enforceTenantRateLimit('template-create', tenant.tenantId, 30, 60_000);
    if (rateDenied) return rateDenied;

    const body = await req.json().catch(() => ({}));
    const { name, category, preview_image_url, config_json, description } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El título o nombre de la pancarta es obligatorio' }, { status: 400 });
    }

    if (!preview_image_url || typeof preview_image_url !== 'string' || !preview_image_url.trim()) {
      return NextResponse.json({ error: 'La imagen de la pancarta es obligatoria' }, { status: 400 });
    }

    const cleanCategory = typeof category === 'string' && category.trim() ? category.trim() : 'Streetwear & Moda';

    // Generar configuración por defecto automáticamente (sin exigir JSON manual)
    let parsedConfig: Record<string, unknown> = {
      name: name.trim(),
      category: cleanCategory,
      description: description || `Pancarta publicitaria especializada para ${cleanCategory}.`,
      template_visual_dna_lock: true,
      template_semantic_isolation: true,
      template_structure_lock: { canvas_ratio: '1:1', preserve_layout_similarity: 'high' }
    };

    if (config_json) {
      if (typeof config_json === 'string' && config_json.trim()) {
        try {
          const parsed = JSON.parse(config_json);
          if (parsed && typeof parsed === 'object') {
            parsedConfig = { ...parsedConfig, ...parsed };
          }
        } catch {
          // Si el JSON no es válido, ignorar y usar la configuración por defecto
        }
      } else if (typeof config_json === 'object') {
        parsedConfig = { ...parsedConfig, ...config_json };
      }
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('templates')
      .insert({
        tenant_id: tenant.tenantId,
        name: name.trim(),
        category: cleanCategory,
        preview_image_url: preview_image_url.trim(),
        config_json: parsedConfig,
        is_active: true,
      })
      .select('id,name,category,preview_image_url,config_json,tenant_id,created_at,updated_at')
      .single();

    if (error) {
      console.error('Error insertando plantilla en panel:', error);
      return internalApiError();
    }

    return NextResponse.json({
      success: true,
      template: data,
      message: 'Pancarta agregada correctamente al catálogo'
    });
  } catch (err: any) {
    console.error('Error en POST /api/panel/templates:', err);
    return internalApiError();
  }
}

// DELETE /api/panel/templates - Eliminar una plantilla creada por el tenant
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de pancarta requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant.tenantId);

    if (error) {
      console.error('Error eliminando plantilla de panel:', error);
      return internalApiError();
    }

    return NextResponse.json({ success: true, message: 'Pancarta eliminada' });
  } catch (err: any) {
    console.error('Error en DELETE /api/panel/templates:', err);
    return internalApiError();
  }
}
