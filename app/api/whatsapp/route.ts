import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

// ============================================
// WHATSAPP WEBHOOK — El corazón del bot de IA
// ============================================

// GET: Verificación del webhook (Meta lo llama al registrar)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado correctamente');
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Token inválido' }, { status: 403 });
}

// POST: Recibir mensajes de WhatsApp
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extraer el mensaje del payload de Meta
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageData = value?.messages?.[0];

    // Ignorar si no es un mensaje de texto
    if (!messageData || messageData.type !== 'text') {
      return NextResponse.json({ status: 'ignored' });
    }

    const customerPhone = messageData.from; // ej: "593984111222"
    const customerMessage = messageData.text.body;
    const customerName = value?.contacts?.[0]?.profile?.name || 'Cliente';

    console.log(`📩 Mensaje de ${customerName} (${customerPhone}): ${customerMessage}`);

    const supabase = createSupabaseAdmin();

    // 1. Buscar o crear conversación
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', customerPhone)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ phone_number: customerPhone, customer_name: customerName, status: 'chatting' })
        .select()
        .single();
      conversation = newConv;
    } else {
      // Actualizar nombre y timestamp
      await supabase
        .from('conversations')
        .update({ customer_name: customerName, updated_at: new Date().toISOString() })
        .eq('id', conversation.id);
    }

    if (!conversation) {
      console.error('❌ No se pudo crear/encontrar conversación');
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    // 2. Guardar mensaje del cliente
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content: customerMessage,
    });

    // 3. Cargar historial de mensajes (últimos 20)
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20);

    // 4. Obtener configuración (prompt de la IA)
    const { data: config } = await supabase.from('config').select('*').limit(1).single();
    const aiPrompt = config?.ai_prompt || 'Eres un asesor de ventas amigable y profesional.';
    const groqKey = config?.openai_key || process.env.GROQ_API_KEY;

    if (!groqKey) {
      console.error('❌ No hay API Key de Groq configurada');
      await sendWhatsAppMessage(customerPhone, 'Estamos experimentando dificultades técnicas. Por favor intenta más tarde. 🙏');
      return NextResponse.json({ error: 'No Groq key' }, { status: 500 });
    }

    // 5. Enviar a Groq (compatible con SDK de OpenAI)
    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: aiPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: chatMessages,
      max_tokens: 500,
      temperature: 0.7,
    });

    let aiResponse = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';

    // 6. Detectar si la IA quiere generar un pago
    const paymentMatch = aiResponse.match(/\[GENERAR_PAGO:(\d+):(.+?)\]/);
    if (paymentMatch) {
      const amount = parseInt(paymentMatch[1]);
      const service = paymentMatch[2];

      // Limpiar el tag del mensaje
      aiResponse = aiResponse.replace(/\[GENERAR_PAGO:\d+:.+?\]/, '').trim();

      // Generar cobro con PayPhone
      const paymentResult = await generatePayPhonePayment(
        customerPhone,
        amount,
        service,
        conversation.id,
        customerName,
        config
      );

      if (paymentResult.success) {
        aiResponse += `\n\n💳 Te he enviado la solicitud de pago por $${amount} a tu app PayPhone. ¡Revisa tu notificación para completar el pago! 🚀`;

        // Actualizar estado de la conversación
        await supabase
          .from('conversations')
          .update({ status: 'interested' })
          .eq('id', conversation.id);
      } else {
        aiResponse += '\n\n⚠️ Hubo un problema al generar el link de pago. Nuestro equipo te contactará para ayudarte.';
      }
    }

    // 7. Guardar respuesta de la IA
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: aiResponse,
    });

    // 8. Enviar respuesta por WhatsApp
    await sendWhatsAppMessage(customerPhone, aiResponse, config);

    console.log(`🤖 Respuesta enviada a ${customerName}: ${aiResponse.substring(0, 80)}...`);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Error en webhook WhatsApp:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function sendWhatsAppMessage(to: string, text: string, config: Record<string, string> | null) {
  const token = config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
  const phoneId = config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error('❌ Faltan credenciales de WhatsApp');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      console.error('❌ Error de Meta API:', JSON.stringify(result, null, 2));
    } else {
      console.log('✅ WhatsApp enviado:', result);
    }
  } catch (err) {
    console.error('❌ Error en fetch WhatsApp:', err);
  }
}

async function generatePayPhonePayment(
  phone: string,
  amountDollars: number,
  service: string,
  conversationId: string,
  customerName: string,
  config: Record<string, string> | null
) {
  const token = config?.payphone_token || process.env.PAYPHONE_TOKEN;
  const storeId = config?.payphone_store_id || process.env.PAYPHONE_STORE_ID;

  if (!token || !storeId) {
    console.error('❌ Faltan credenciales de PayPhone');
    return { success: false };
  }

  const supabase = createSupabaseAdmin();
  const clientTransactionId = `RIFX-${Date.now()}`;
  const amountCents = amountDollars * 100; // PayPhone usa centavos

  try {
    const response = await fetch('https://pay.payphonetodoesposible.com/api/Sale', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phone.replace('593', '0'), // Convertir formato internacional a local
        countryCode: '593',
        amount: amountCents,
        amountWithoutTax: amountCents,
        clientTransactionId,
        reference: `RIFX - ${service}`,
        storeId,
        currency: 'USD',
        timeZone: -5,
      }),
    });

    const data = await response.json();

    if (data.transactionId) {
      // Guardar la venta como pendiente
      await supabase.from('sales').insert({
        conversation_id: conversationId,
        customer_name: customerName,
        phone_number: phone,
        amount: amountCents,
        service,
        payphone_transaction_id: String(data.transactionId),
        client_transaction_id: clientTransactionId,
        status: 'pending',
      });

      return { success: true, transactionId: data.transactionId };
    } else {
      console.error('❌ PayPhone error:', data);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Error al generar pago PayPhone:', error);
    return { success: false };
  }
}
