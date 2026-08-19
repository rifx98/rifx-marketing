import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { CREATIVE_TEMPLATES } from '@/app/panel/templates';
import { enforceTenantRateLimit, internalApiError } from '@/lib/request-guards';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación de administrador
    const authorization = await requireAdminPermission(req, 'templates.seed');
    if (!authorization.ok) return authorization.response;
    const rateDenied = await enforceTenantRateLimit(
      'admin-template-seed',
      authorization.admin.tenantId,
      2,
      5 * 60_000,
    );
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();

    // 2. Obtener todas las plantillas existentes en la base de datos
    const { data: existingTemplates, error: fetchError } = await supabase
      .from('templates')
      .select('id,name,config_json');

    if (fetchError) {
      console.error('Template seed lookup failed:', fetchError.code || 'database_error');
      return internalApiError();
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
          console.error('Template seed update failed:', updateError.code || 'database_error');
          return internalApiError();
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
          console.error('Template seed insert failed:', insertError.code || 'database_error');
          return internalApiError();
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
  } catch {
    console.error('Template seed request failed');
    return internalApiError();
  }
}
