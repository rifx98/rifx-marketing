import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { CREATIVE_TEMPLATES } from '@/app/panel/templates';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación de administrador
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    // 2. Obtener todas las plantillas existentes en la base de datos
    const { data: existingTemplates, error: fetchError } = await supabase
      .from('templates')
      .select('*');

    if (fetchError) {
      console.error('❌ Error obteniendo plantillas existentes para seeder:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    // 3. Iterar sobre las plantillas base estáticas y realizar upsert por lógica
    for (const tpl of CREATIVE_TEMPLATES) {
      // Intentar encontrar coincidencia por nombre o por template_id dentro de config_json
      const existing = existingTemplates?.find(
        (dbTpl: any) =>
          dbTpl.name === tpl.name ||
          dbTpl.config_json?.template_id === tpl.template_id ||
          dbTpl.config_json?.id === tpl.id
      );

      // Formatear el config_json con toda la data
      const configJson = {
        template_id: tpl.template_id || tpl.id,
        prompt: tpl.prompt,
        backgroundPrompt: tpl.backgroundPrompt,
        colors: tpl.colors,
        layout: tpl.layout,
        defaultText: tpl.defaultText,
        skipProductOverlay: tpl.skipProductOverlay || false,
        style_identity: tpl.style_identity || '',
        composition_rules: tpl.composition_rules || '',
        visual_hierarchy: tpl.visual_hierarchy || '',
        lighting_rules: tpl.lighting_rules || '',
        camera_rules: tpl.camera_rules || '',
        color_behavior: tpl.color_behavior || '',
        branding_style: tpl.branding_style || '',
        text_behavior: tpl.text_behavior || '',
        render_rules: tpl.render_rules || '',
        ai_direction_rules: tpl.ai_direction_rules,
        template_structure_lock: (tpl as any).template_structure_lock || undefined
      };

      const templateData = {
        name: tpl.name,
        category: tpl.category || 'general',
        preview_image_url: tpl.preview_image_url || '',
        config_json: configJson,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        // Si existe, actualizar por ID
        const { error: updateError } = await supabase
          .from('templates')
          .update(templateData)
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ Error actualizando plantilla ${tpl.name}:`, updateError);
          return NextResponse.json({ error: `Error actualizando ${tpl.name}: ${updateError.message}` }, { status: 500 });
        }
        updatedCount++;
      } else {
        // Si no existe, insertar una nueva global
        const { error: insertError } = await supabase
          .from('templates')
          .insert([{
            ...templateData,
            tenant_id: null // Global
          }]);

        if (insertError) {
          console.error(`❌ Error insertando plantilla ${tpl.name}:`, insertError);
          return NextResponse.json({ error: `Error insertando ${tpl.name}: ${insertError.message}` }, { status: 500 });
        }
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      count: CREATIVE_TEMPLATES.length,
      created: createdCount,
      updated: updatedCount,
      message: `Sincronización exitosa: ${createdCount} creadas, ${updatedCount} actualizadas.`
    });
  } catch (error: any) {
    console.error('❌ Error interno en seeder de plantillas:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
