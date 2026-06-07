import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { name, phone, message, testMode } = await req.json();
    
    if (!phone) {
      return NextResponse.json({ error: 'Teléfono es requerido' }, { status: 400 });
    }
    if (!testMode && !name) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    let convId: string | null = null;

    // In test mode: skip contact creation entirely
    if (!testMode) {
      // Check if contact already exists for this tenant
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('phone_number', phone)
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'Este número ya existe en la base de datos', id: existing.id }, { status: 409 });
      }

      // Create the conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          customer_name: name,
          phone_number: phone,
          status: 'chatting',
          tenant_id: tenant.tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        return NextResponse.json({ error: 'Error al crear el contacto' }, { status: 500 });
      }
      convId = newConv.id;
    }

    // If a message description is provided, use AI to craft and send it
    if (message && message.trim()) {
      const { data: config } = await supabase.from('config').select('*').eq('tenant_id', tenant.tenantId).maybeSingle();
      
      // Decode AI keys from JSON-encoded openai_key column
      let groqKey = '';
      try {
        const parsed = JSON.parse(config?.openai_key || '{}');
        groqKey = parsed.groq_key || parsed.openai_key || '';
      } catch {
        groqKey = config?.openai_key || '';
      }
      if (!groqKey) groqKey = process.env.GROQ_API_KEY || '';

      const token = config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
      const phoneId = config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const aiPrompt = config?.ai_prompt || '';

      let finalMessage = message;
      const contactName = testMode ? 'estimado cliente' : name;

      // Use AI to craft the message
      if (groqKey) {
        try {
          const groq = new OpenAI({
            apiKey: groqKey,
            baseURL: 'https://api.groq.com/openai/v1',
          });

          const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `Eres un asistente de ventas experto. Tu tarea es redactar un mensaje de WhatsApp para iniciar una conversación con un nuevo cliente potencial.

Contexto del negocio:
${aiPrompt}

REGLAS:
- El mensaje debe ser amigable, profesional y conversacional
- Usa el nombre del cliente para personalizar
- Máximo 3 líneas, corto y directo
- Incluye 1-2 emojis relevantes
- No uses listas ni formato complejo, es WhatsApp
- Debe motivar al cliente a responder
- Responde SOLO con el mensaje, nada más`
              },
              {
                role: 'user',
                content: `Redacta un primer mensaje para ${contactName}. Contexto de lo que quiero comunicar: "${message}"`
              }
            ],
            max_tokens: 200,
            temperature: 0.7,
          });

          finalMessage = completion.choices[0]?.message?.content || message;
        } catch (err) {
          console.error('AI message crafting error:', err);
          // Fallback to original message
        }
      }

      // Send via WhatsApp
      if (token && phoneId) {
        try {
          const waResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'text',
              text: { body: finalMessage },
            }),
          });

          const waResult = await waResponse.json();
          
          if (waResponse.ok) {
            // Save message to history only if not test mode
            if (convId) {
              await supabase.from('messages').insert({
                conversation_id: convId,
                role: 'assistant',
                content: finalMessage,
                tenant_id: tenant.tenantId,
              });
            }
            
            console.log(`📤 ${testMode ? '[TEST]' : ''} Mensaje enviado a ${contactName} (${phone})`);
          } else {
            // Check if 24h window is closed - try template fallback
            const errCode = waResult?.error?.code;
            const errMsg = (waResult?.error?.message || '').toLowerCase();
            const is24hError = errCode === 131047 || errCode === 131026 || errCode === 130472 ||
              errMsg.includes('24') || errMsg.includes('session') || errMsg.includes('window') || errMsg.includes('template');
            
            if (is24hError) {
              console.log(`⏳ Ventana 24h cerrada para ${phone}, intentando con template...`);
              const templateRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: phone,
                  type: 'template',
                  template: { name: 'hello_world', language: { code: 'en_US' } },
                }),
              });
              const templateData = await templateRes.json();
              if (templateRes.ok) {
                console.log(`📤 ${testMode ? '[TEST]' : ''} Template enviado a ${contactName} (${phone}) - ventana 24h cerrada`);
                if (convId) {
                  await supabase.from('messages').insert({
                    conversation_id: convId,
                    role: 'assistant',
                    content: `[Template enviado - ventana 24h cerrada]\n${finalMessage}`,
                    tenant_id: tenant.tenantId,
                  });
                }
              } else {
                console.error('Template send error:', templateData);
                return NextResponse.json({ error: 'La ventana de 24h está cerrada y no se pudo enviar template' }, { status: 500 });
              }
            } else {
              console.error('WhatsApp send error:', waResult);
              return NextResponse.json({ error: waResult.error?.message || 'Error al enviar por WhatsApp' }, { status: 500 });
            }
          }
        } catch (err) {
          console.error('WhatsApp send error:', err);
          return NextResponse.json({ error: 'Error de conexión con WhatsApp' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'WhatsApp no está configurado. Configure el token y phone ID.' }, { status: 400 });
      }

      return NextResponse.json({ success: true, id: convId, messageSent: true, finalMessage, testMode: !!testMode });
    }

    if (testMode) {
      return NextResponse.json({ error: 'En modo prueba debes escribir un mensaje' }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: convId, messageSent: false });

  } catch (error: any) {
    console.error('Add contact error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
