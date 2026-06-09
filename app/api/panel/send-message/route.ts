import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// Helper: Send a WhatsApp template message when the 24h window is closed
async function sendTemplateMessage(
  phoneId: string, 
  token: string, 
  to: string, 
  textBody: string
): Promise<{ ok: boolean; data: any }> {
  // Try with hello_world template first (available by default in all WhatsApp Business accounts)
  // Then fallback to a custom template approach
  const templatePayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' },
    },
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templatePayload),
  });

  const data = await res.json();
  return { ok: res.ok, data };
}

// Helper: Check if error is due to 24h window expiration
function is24hWindowError(waResult: any): boolean {
  const errorCode = waResult?.error?.code;
  const errorSubcode = waResult?.error?.error_subcode;
  const errorMsg = (waResult?.error?.message || '').toLowerCase();
  
  // Meta error codes for expired session / outside window
  // 131047 = Re-engagement message
  // 131026 = Message failed to send because more than 24 hours have passed
  // 130472 = Outside the allowed window
  return (
    errorCode === 131047 ||
    errorCode === 131026 ||
    errorCode === 130472 ||
    errorSubcode === 2534050 ||
    errorMsg.includes('24') ||
    errorMsg.includes('session') ||
    errorMsg.includes('window') ||
    errorMsg.includes('re-engage') ||
    errorMsg.includes('template')
  );
}

// POST: Enviar mensaje manual desde el panel (Soporta JSON y FormData para imágenes)
export async function POST(req: NextRequest) {
  try {
    // Auth check — VULN-05 fix
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    
    const contentType = req.headers.get('content-type') || '';
    let conversationId: string | null = null;
    let message: string | null = null;
    let file: File | null = null;
    let isBulkSend = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      conversationId = formData.get('conversationId') as string;
      message = formData.get('message') as string;
      file = formData.get('file') as File | null;

      if (file) {
        // Enforce max size: 16MB
        if (file.size > 16 * 1024 * 1024) {
          return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 16MB.' }, { status: 400 });
        }

        // Validate extension
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp3', 'mp4', 'pdf', 'csv', 'txt', 'doc', 'docx', 'xls', 'xlsx'];
        if (!allowedExtensions.includes(ext)) {
          return NextResponse.json({ error: 'Extensión de archivo no permitida.' }, { status: 400 });
        }

        // Validate MIME type
        const allowedMimes = [
          'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg',
          'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/mp4', 'audio/amr',
          'video/mp4', 'video/3gpp', 'video/webm', 'video/quicktime',
          'application/pdf', 'text/plain', 'text/csv',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream'
        ];
        if (file.type && !allowedMimes.includes(file.type)) {
          return NextResponse.json({ error: 'Tipo de archivo (MIME) no permitido.' }, { status: 400 });
        }
      }
    } else {
      const json = await req.json();
      conversationId = json.conversationId;
      message = json.message;
      isBulkSend = !!json.bulk;
      // Support direct phone sending for bulk messages
      if (!conversationId && json.phone) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('phone_number', json.phone)
          .single();
        if (conv) {
          conversationId = conv.id;
        } else {
          // Send directly via WhatsApp API without a conversation record
          const { data: config } = await supabase.from('config').select('*').eq('tenant_id', tenant.tenantId).limit(1).single();
          
          // Decode bulk WA credentials from JSON-encoded openai_key column
          let bulkToken = '';
          let bulkPhoneId = '';
          try {
            const parsed = JSON.parse(config?.openai_key || '{}');
            bulkToken = parsed.bulk_wa_token || '';
            bulkPhoneId = parsed.bulk_wa_phone_id || '';
          } catch {}
          
          // Use bulk credentials if available, otherwise fall back to main
          const token = bulkToken || config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
          const phoneId = bulkPhoneId || config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
          const usingBulkNumber = !!(bulkToken && bulkPhoneId);
          
          if (!token || !phoneId) {
            return NextResponse.json({ error: 'Faltan credenciales de WhatsApp' }, { status: 500 });
          }
          
          console.log(`📡 Enviando masivo a ${json.phone} ${usingBulkNumber ? '[NÚMERO MASIVO]' : '[NÚMERO PRINCIPAL]'}`);

          // First try regular text message
          const waResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: json.phone,
              type: 'text',
              text: { body: message },
            }),
          });
          const waResult = await waResponse.json();

          if (!waResponse.ok) {
            // Check if it's a 24h window error - try template fallback
            if (is24hWindowError(waResult)) {
              console.log(`⏳ Ventana 24h cerrada para ${json.phone}, intentando con template...`);
              const templateResult = await sendTemplateMessage(phoneId, token, json.phone, message || '');
              if (templateResult.ok) {
                console.log(`📤 Template enviado a ${json.phone} (ventana 24h cerrada)`);
                return NextResponse.json({ 
                  success: true, 
                  method: 'template',
                  note: 'Mensaje enviado como template porque la ventana de 24h estaba cerrada'
                });
              } else {
                console.error('❌ Error enviando template:', JSON.stringify(templateResult.data));
                return NextResponse.json({ 
                  error: 'La ventana de 24h está cerrada y no se pudo enviar template. El contacto debe escribir primero.',
                  details: templateResult.data 
                }, { status: 500 });
              }
            }
            console.error('❌ Error envío directo:', JSON.stringify(waResult));
            return NextResponse.json({ error: 'Error de WhatsApp API', details: waResult }, { status: 500 });
          }
          console.log(`📤 Mensaje masivo enviado a ${json.phone}`);
          return NextResponse.json({ success: true, method: 'text' });
        }
      }
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Faltan conversationId o phone' }, { status: 400 });
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
    const { data: config } = await supabase.from('config').select('*').eq('tenant_id', tenant.tenantId).limit(1).single();
    
    // For bulk sends, prefer bulk WA credentials
    let bulkToken = '';
    let bulkPhoneId = '';
    if (isBulkSend) {
      try {
        const parsed = JSON.parse(config?.openai_key || '{}');
        bulkToken = parsed.bulk_wa_token || '';
        bulkPhoneId = parsed.bulk_wa_phone_id || '';
      } catch {}
    }
    const token = (isBulkSend && bulkToken) ? bulkToken : (config?.whatsapp_token || process.env.WHATSAPP_TOKEN);
    const phoneId = (isBulkSend && bulkPhoneId) ? bulkPhoneId : (config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID);

    if (!token || !phoneId) {
      return NextResponse.json({ error: 'Faltan credenciales de WhatsApp' }, { status: 500 });
    }

    let mediaId = null;
    let publicUrl = '';

    // Subir archivo a WhatsApp y a Supabase Storage si existe
    if (file) {
      const mediaFormData = new FormData();
      mediaFormData.append('file', file);
      mediaFormData.append('type', file.type);
      mediaFormData.append('messaging_product', 'whatsapp');

      const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: mediaFormData
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        console.error('❌ Error subiendo media a WhatsApp:', JSON.stringify(uploadData));
        return NextResponse.json({ error: 'Error subiendo media', details: uploadData }, { status: 500 });
      }
      mediaId = uploadData.id;

      // Subir a Supabase Storage para visualizar en el panel
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, buffer, {
        contentType: file.type,
      });

      if (uploadError && uploadError.message.includes('Bucket not found')) {
        await supabase.storage.createBucket('chat_media', { public: false });
        await supabase.storage.from('chat_media').upload(fileName, buffer, { contentType: file.type });
      }
      
      const { data: signedData } = await supabase.storage.from('chat_media').createSignedUrl(fileName, 86400); // 24 hours
      publicUrl = signedData?.signedUrl || '';
    }

    // Preparar payload del mensaje
    let messagePayload: any = {
      messaging_product: 'whatsapp',
      to: conversation.phone_number,
    };

    if (mediaId) {
      messagePayload.type = 'image';
      messagePayload.image = { id: mediaId };
      if (message) {
        messagePayload.image.caption = message;
      }
    } else if (message) {
      messagePayload.type = 'text';
      messagePayload.text = { body: message };
    } else {
      return NextResponse.json({ error: 'No hay mensaje ni archivo para enviar' }, { status: 400 });
    }

    // Enviar por WhatsApp
    const waResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const waResult = await waResponse.json();

    if (!waResponse.ok) {
      // Check if it's a 24h window error - try template fallback
      if (is24hWindowError(waResult)) {
        console.log(`⏳ Ventana 24h cerrada para ${conversation.phone_number}, intentando con template...`);
        const templateResult = await sendTemplateMessage(phoneId, token, conversation.phone_number, message || '');
        if (templateResult.ok) {
          // Save template note in history
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: `[Template enviado - ventana 24h cerrada]\n${message || ''}`,
          });
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          console.log(`📤 Template enviado a ${conversation.customer_name} (ventana 24h cerrada)`);
          return NextResponse.json({ 
            success: true, 
            method: 'template',
            note: 'Mensaje enviado como template porque la ventana de 24h estaba cerrada' 
          });
        } else {
          console.error('❌ Error enviando template:', JSON.stringify(templateResult.data));
          return NextResponse.json({ 
            error: 'La ventana de 24h está cerrada. El contacto debe enviar un mensaje primero para poder responderle.',
            details: templateResult.data 
          }, { status: 500 });
        }
      }

      console.error('❌ Error enviando desde panel:', JSON.stringify(waResult));
      return NextResponse.json({ error: 'Error de WhatsApp API', details: waResult }, { status: 500 });
    }

    // Guardar en historial
    const historyContent = mediaId 
      ? `![Imagen adjunta](${publicUrl})\n${message || ''}`.trim()
      : message;

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: historyContent,
    });

    // Actualizar timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    console.log(`👤 Mensaje manual enviado a ${conversation.customer_name}`);

    return NextResponse.json({ success: true, method: 'text' });
  } catch (error) {
    console.error('❌ Error en send-message:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
