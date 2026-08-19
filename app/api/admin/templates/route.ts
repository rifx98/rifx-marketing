import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { requireAdminPermission } from '@/lib/admin-rbac';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 1. GET /api/admin/templates - Listar todas las plantillas para administración
export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminPermission(req, 'templates.read');
    if (!authorization.ok) return authorization.response;

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('templates')
      .select('id,name,category,preview_image_url,config_json,is_active,tenant_id,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Admin template lookup failed:', error.code || 'database_error');
      return internalApiError();
    }

    return NextResponse.json({ success: true, templates: data });
  } catch {
    console.error('Admin template request failed');
    return internalApiError();
  }
}

// 2. POST /api/admin/templates - Crear o actualizar una plantilla
export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminPermission(req, 'templates.manage');
    if (!authorization.ok) return authorization.response;

    const rateDenied = await enforceTenantRateLimit(
      'admin-template-mutation',
      authorization.admin.tenantId,
      20,
      60_000,
    );
    if (rateDenied) return rateDenied;

    const parsedBody = await readLimitedJsonObject(req, 512 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const { id, name, category, preview_image_url, config_json, is_active } = body;

    if (typeof name !== 'string' || !name.trim() || name.length > 160) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    if (!config_json) {
      return NextResponse.json({ error: 'El JSON de configuración es obligatorio' }, { status: 400 });
    }

    if (id !== undefined && (typeof id !== 'string' || !UUID_PATTERN.test(id))) {
      return NextResponse.json({ error: 'ID de plantilla invalido' }, { status: 400 });
    }
    if (category !== undefined && (typeof category !== 'string' || category.length > 80)) {
      return NextResponse.json({ error: 'Categoria invalida' }, { status: 400 });
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
    }
    if (
      preview_image_url !== undefined
      && preview_image_url !== null
      && (typeof preview_image_url !== 'string' || preview_image_url.length > 2_048)
    ) {
      return NextResponse.json({ error: 'URL de vista previa invalida' }, { status: 400 });
    }

    // Validar que config_json sea un JSON válido
    let parsedConfig: unknown = config_json;
    if (typeof config_json === 'string') {
      try {
        parsedConfig = JSON.parse(config_json);
      } catch {
        return NextResponse.json({ error: 'El JSON de configuración tiene un formato inválido' }, { status: 400 });
      }
    }

    if (!parsedConfig || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) {
      return NextResponse.json({ error: 'El JSON de configuracion debe ser un objeto' }, { status: 400 });
    }
    const normalizedConfig = parsedConfig as Record<string, unknown>;

    // Auto-compute template_readiness
    const hasProductSlot = !!normalizedConfig.product_slot;
    const hasTextSlots = Array.isArray(normalizedConfig.text_slots) && normalizedConfig.text_slots.length > 0;
    const hasSemanticIsolation = normalizedConfig.template_semantic_isolation === true;
    
    if (hasProductSlot && hasTextSlots && hasSemanticIsolation) {
      normalizedConfig.template_readiness = 'ready';
    } else if (hasProductSlot) {
      normalizedConfig.template_readiness = 'draft';
    } else {
      normalizedConfig.template_readiness = 'legacy';
    }

    const supabase = createSupabaseAdmin();
    const templateData = {
      name,
      category: category || 'general',
      preview_image_url,
      config_json: normalizedConfig,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString()
    };

    if (id) {
      // Actualización
      const { data, error } = await supabase
        .from('templates')
        .update(templateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Admin template update failed:', error.code || 'database_error');
        return internalApiError();
      }

      return NextResponse.json({ success: true, template: data });
    } else {
      // Creación
      const { data, error } = await supabase
        .from('templates')
        .insert([{
          ...templateData,
          tenant_id: null // Plantillas públicas globales
        }])
        .select()
        .single();

      if (error) {
        console.error('Admin template insert failed:', error.code || 'database_error');
        return internalApiError();
      }

      return NextResponse.json({ success: true, template: data });
    }
  } catch {
    console.error('Admin template mutation failed');
    return internalApiError();
  }
}

// 3. DELETE /api/admin/templates - Eliminar una plantilla
export async function DELETE(req: NextRequest) {
  try {
    const authorization = await requireAdminPermission(req, 'templates.manage');
    if (!authorization.ok) return authorization.response;

    const rateDenied = await enforceTenantRateLimit(
      'admin-template-mutation',
      authorization.admin.tenantId,
      20,
      60_000,
    );
    if (rateDenied) return rateDenied;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || !UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'ID de plantilla requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Admin template deletion failed:', error.code || 'database_error');
      return internalApiError();
    }

    return NextResponse.json({ success: true, message: 'Plantilla eliminada correctamente' });
  } catch {
    console.error('Admin template deletion request failed');
    return internalApiError();
  }
}
