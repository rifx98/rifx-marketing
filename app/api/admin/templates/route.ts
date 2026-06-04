import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// 1. GET /api/admin/templates - Listar todas las plantillas para administración
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo plantillas en admin:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, templates: data });
  } catch (error: any) {
    console.error('❌ Error interno en admin templates:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}

// 2. POST /api/admin/templates - Crear o actualizar una plantilla
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, category, preview_image_url, config_json, is_active } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    if (!config_json) {
      return NextResponse.json({ error: 'El JSON de configuración es obligatorio' }, { status: 400 });
    }

    // Validar que config_json sea un JSON válido
    let parsedConfig = config_json;
    if (typeof config_json === 'string') {
      try {
        parsedConfig = JSON.parse(config_json);
      } catch (e) {
        return NextResponse.json({ error: 'El JSON de configuración tiene un formato inválido' }, { status: 400 });
      }
    }

    // Auto-compute template_readiness
    const hasProductSlot = !!parsedConfig.product_slot;
    const hasTextSlots = Array.isArray(parsedConfig.text_slots) && parsedConfig.text_slots.length > 0;
    const hasSemanticIsolation = parsedConfig.template_semantic_isolation === true;
    
    if (hasProductSlot && hasTextSlots && hasSemanticIsolation) {
      parsedConfig.template_readiness = 'ready';
    } else if (hasProductSlot) {
      parsedConfig.template_readiness = 'draft';
    } else {
      parsedConfig.template_readiness = 'legacy';
    }

    const supabase = createSupabaseAdmin();
    const templateData = {
      name,
      category: category || 'general',
      preview_image_url,
      config_json: parsedConfig,
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
        console.error('❌ Error actualizando plantilla:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
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
        console.error('❌ Error insertando plantilla:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, template: data });
    }
  } catch (error: any) {
    console.error('❌ Error guardando plantilla:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}

// 3. DELETE /api/admin/templates - Eliminar una plantilla
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de plantilla requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error eliminando plantilla:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Plantilla eliminada correctamente' });
  } catch (error: any) {
    console.error('❌ Error eliminando plantilla:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
