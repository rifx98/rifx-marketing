import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// GET: Obtener configuración de tema
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    const { data: config, error } = await supabase
      .from('config')
      .select('theme_config')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (error) {
      // If theme_config column doesn't exist yet, return empty
      if (error.message?.includes('theme_config') || error.code === '42703') {
        return NextResponse.json({});
      }
      console.error('Error obteniendo theme:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!config || !config.theme_config) {
      return NextResponse.json({});
    }

    try {
      const themeData = typeof config.theme_config === 'string'
        ? JSON.parse(config.theme_config)
        : config.theme_config;
      return NextResponse.json(themeData);
    } catch {
      return NextResponse.json({});
    }
  } catch (error: any) {
    console.error('Error en theme GET:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// POST: Guardar configuración de tema
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const supabase = createSupabaseAdmin();

    // Serialize theme config as JSON string
    const themeJson = JSON.stringify(body);

    // Check if config row exists
    const { data: existing, error: fetchError } = await supabase
      .from('config')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error consultando config:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('config')
        .update({ theme_config: themeJson, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('tenant_id', tenant.tenantId);

      if (updateError) {
        // If column doesn't exist, silently succeed (theme stored in localStorage only)
        if (updateError.message?.includes('theme_config') || updateError.code === '42703') {
          console.warn('⚠️ theme_config column not found in DB, theme saved only in localStorage');
          return NextResponse.json({ success: true, storage: 'localStorage' });
        }
        console.error('Error actualizando theme:', updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase
        .from('config')
        .insert({
          tenant_id: tenant.tenantId,
          theme_config: themeJson,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        if (insertError.message?.includes('theme_config') || insertError.code === '42703') {
          console.warn('⚠️ theme_config column not found in DB, theme saved only in localStorage');
          return NextResponse.json({ success: true, storage: 'localStorage' });
        }
        console.error('Error insertando theme:', insertError.message);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    console.log(`✅ Theme config saved for tenant ${tenant.tenantId} (preset: ${body.preset || 'custom'})`);
    return NextResponse.json({ success: true, storage: 'database' });
  } catch (error: any) {
    console.error('Error en theme POST:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
