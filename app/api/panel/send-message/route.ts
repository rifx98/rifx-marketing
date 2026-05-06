import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// POST: Enviar mensaje manual desde el panel
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const { conversationId, message } = await req.json();

    if (!conversationId || !message) {
      return NextResponse.json({ error: 'Faltan conversationId o message' }, { status: 400 });
    }

    // Obtener la conversación
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    // Obtener config para credenciales de WhatsApp
    const { data: config } = await supabase.from('config').select('*').limit(1).single();
    const token = config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
    const phoneId = config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return NextResponse.json({ error: 'Faltan credenciales de WhatsApp' }, { status: 500 });
    }

    // Enviar por WhatsApp
    const waResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: conversation.phone_number,
        type: 'text',
        text: { body: message },
      }),
    });

    const waResult = await waResponse.json();

    if (!waResponse.ok) {
      console.error('❌ Error enviando desde panel:', JSON.stringify(waResult));
      return NextResponse.json({ error: 'Error de WhatsApp API', details: waResult }, { status: 500 });
    }

    // Guardar en historial como 'assistant' (viene del humano pero el cliente no distingue)
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: message,
    });

    // Actualizar timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    console.log(`👤 Mensaje manual enviado a ${conversation.customer_name}: ${message.substring(0, 60)}...`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error en send-message:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
