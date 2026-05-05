import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// ============================================
// CONFIGURACIÓN DEL BOT (APIs & Prompt)
// ============================================

// GET: Obtener configuración actual
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data: config } = await supabase.from('config').select('*').limit(1).single();

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

    // Enmascarar las claves para seguridad (solo mostrar últimos 4 caracteres)
    return NextResponse.json({
      hasWhatsappToken: !!config.whatsapp_token,
      hasOpenaiKey: !!config.openai_key,
      hasPayphoneToken: !!config.payphone_token,
      whatsapp_token: config.whatsapp_token || '',
      openai_key: config.openai_key || '',
      whatsapp_phone_id: config.whatsapp_phone_id || '',
      payphone_store_id: config.payphone_store_id || '',
      ai_prompt: config.ai_prompt || '',
    });
  } catch (error) {
    console.error('❌ Error obteniendo config:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST: Guardar/actualizar configuración
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createSupabaseAdmin();

    // Obtener config existente
    const { data: existing } = await supabase.from('config').select('id').limit(1).single();

    const updateData: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };

    // Solo actualizar campos que se enviaron (no vacíos)
    if (body.whatsapp_token) updateData.whatsapp_token = body.whatsapp_token;
    if (body.whatsapp_phone_id) updateData.whatsapp_phone_id = body.whatsapp_phone_id;
    if (body.openai_key) updateData.openai_key = body.openai_key;
    if (body.payphone_token) updateData.payphone_token = body.payphone_token;
    if (body.payphone_store_id) updateData.payphone_store_id = body.payphone_store_id;
    if (body.ai_prompt) updateData.ai_prompt = body.ai_prompt;

    if (existing) {
      await supabase.from('config').update(updateData).eq('id', existing.id);
    } else {
      await supabase.from('config').insert(updateData);
    }

    return NextResponse.json({ success: true, message: 'Configuración guardada correctamente' });
  } catch (error) {
    console.error('❌ Error guardando config:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
