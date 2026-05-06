import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// ============================================
// CONFIGURACIÓN DEL BOT (APIs & Prompt)
// ============================================

// GET: Obtener configuración actual
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data: config, error } = await supabase.from('config').select('*').limit(1).single();

    if (error) {
      console.error('⚠️ Error o tabla vacía al obtener config:', error.message);
      // PGRST116 = no rows found — no es un error real, simplemente no hay config aún
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          whatsapp_token: '',
          whatsapp_phone_id: '',
          openai_key: '',
          payphone_token: '',
          payphone_store_id: '',
          ai_prompt: '',
          panel_password: '',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!config) {
      return NextResponse.json({
        whatsapp_token: '',
        whatsapp_phone_id: '',
        openai_key: '',
        payphone_token: '',
        payphone_store_id: '',
        ai_prompt: '',
      });
    }

    return NextResponse.json({
      whatsapp_token: config.whatsapp_token || '',
      openai_key: config.openai_key || '',
      whatsapp_phone_id: config.whatsapp_phone_id || '',
      payphone_token: config.payphone_token || '',
      payphone_store_id: config.payphone_store_id || '',
      ai_prompt: config.ai_prompt || '',
      panel_password: config.panel_password || '',
    });
  } catch (error: any) {
    console.error('❌ Error obteniendo config:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// POST: Guardar/actualizar configuración
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createSupabaseAdmin();

    console.log('📝 Recibiendo datos para guardar config:', Object.keys(body));

    // Solo extraer los campos válidos de la tabla (ignorar cualquier campo extra del frontend)
    const updateData: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };

    const validFields = ['whatsapp_token', 'whatsapp_phone_id', 'openai_key', 'payphone_token', 'payphone_store_id', 'ai_prompt', 'panel_password'];
    for (const field of validFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    console.log('📝 Campos a guardar:', Object.keys(updateData));

    // Obtener config existente
    const { data: existing, error: fetchError } = await supabase.from('config').select('id').limit(1).single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error consultando config existente:', fetchError.message);
      return NextResponse.json({ error: `Error al consultar: ${fetchError.message}` }, { status: 500 });
    }

    if (existing) {
      // Actualizar registro existente
      const { error: updateError } = await supabase.from('config').update(updateData).eq('id', existing.id);
      if (updateError) {
        console.error('❌ Error actualizando config:', updateError.message, updateError.details, updateError.hint);
        return NextResponse.json({ error: `Error al actualizar: ${updateError.message}` }, { status: 500 });
      }
      console.log('✅ Config actualizada correctamente (id:', existing.id, ')');
    } else {
      // Insertar nuevo registro
      const { error: insertError } = await supabase.from('config').insert(updateData);
      if (insertError) {
        console.error('❌ Error insertando config:', insertError.message, insertError.details, insertError.hint);
        return NextResponse.json({ error: `Error al insertar: ${insertError.message}` }, { status: 500 });
      }
      console.log('✅ Config insertada por primera vez');
    }

    return NextResponse.json({ success: true, message: 'Configuración guardada correctamente' });
  } catch (error: any) {
    console.error('❌ Error guardando config:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
