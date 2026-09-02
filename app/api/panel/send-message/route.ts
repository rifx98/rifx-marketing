import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
  readLimitedResponseJson,
} from '@/lib/request-guards';

const MAX_MULTIPART_BYTES = 17 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^[1-9][0-9]{6,14}$/;

function hasAllowedFileSignature(extension: string, buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  if (['txt', 'csv'].includes(extension)) {
    if (buffer.includes(0)) return false;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      return true;
    } catch {
      return false;
    }
  }
  if (['jpg', 'jpeg'].includes(extension)) {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (extension === 'png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === 'webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (extension === 'gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (extension === 'pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (['doc', 'xls'].includes(extension)) return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (['docx', 'xlsx'].includes(extension)) return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (extension === 'mp3') {
    return buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  if (extension === 'mp4') return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  return false;
}

// Helper: Send a WhatsApp template message when the 24h window is closed
async function sendTemplateMessage(
  phoneId: string, 
  token: string, 
  to: string,
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
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });

  const data = await readLimitedResponseJson(res, 256 * 1024);
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
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('send-message', tenant.tenantId, 40, 60_000);
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();
    
    const contentType = req.headers.get('content-type') || '';
    let conversationId: string | null = null;
    let message: string | null = null;
    let file: File | null = null;
    let fileBuffer: Buffer | null = null;
    let isBulkSend = false;
    let directPhone: string | null = null;
    let accountId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const declaredLength = Number(req.headers.get('content-length'));
      if (!Number.isFinite(declaredLength) || declaredLength <= 0 || declaredLength > MAX_MULTIPART_BYTES) {
        return NextResponse.json({ error: 'Carga multipart inválida o demasiado grande' }, { status: 413 });
      }
      const formData = await req.formData();
      const conversationValue = formData.get('conversationId');
      const messageValue = formData.get('message');
      const fileValue = formData.get('file');
      const accountValue = formData.get('accountId');
      conversationId = typeof conversationValue === 'string' ? conversationValue.trim() : null;
      message = typeof messageValue === 'string' ? messageValue.trim() : null;
      accountId = typeof accountValue === 'string' ? accountValue.trim() : null;
      file = fileValue instanceof File ? fileValue : null;

      if (file) {
        // Enforce max size: 16MB
        if (file.size > 16 * 1024 * 1024) {
          return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 16MB.' }, { status: 400 });
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const allowedMimeByExtension: Record<string, readonly string[]> = {
          jpg: ['image/jpeg', 'image/jpg'],
          jpeg: ['image/jpeg', 'image/jpg'],
          png: ['image/png'],
          webp: ['image/webp'],
          gif: ['image/gif'],
          mp3: ['audio/mpeg', 'audio/mp3'],
          mp4: ['audio/mp4', 'video/mp4'],
          pdf: ['application/pdf'],
          csv: ['text/csv'],
          txt: ['text/plain'],
          doc: ['application/msword'],
          docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          xls: ['application/vnd.ms-excel'],
          xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        };
        if (!file.type || !allowedMimeByExtension[ext]?.includes(file.type)) {
          return NextResponse.json({ error: 'Extensión o tipo de archivo no permitido.' }, { status: 400 });
        }
        fileBuffer = Buffer.from(await file.arrayBuffer());
        if (!hasAllowedFileSignature(ext, fileBuffer)) {
          return NextResponse.json({ error: 'El contenido del archivo no coincide con su tipo.' }, { status: 400 });
        }
      }
    } else {
      const bodyResult = await readLimitedJsonObject(req, 32 * 1024);
      if (!bodyResult.ok) return bodyResult.response;
      const json = bodyResult.body;
      conversationId = typeof json.conversationId === 'string' ? json.conversationId.trim() : null;
      message = typeof json.message === 'string' ? json.message.trim() : null;
      accountId = typeof json.accountId === 'string' ? json.accountId.trim() : null;
      isBulkSend = json.bulk === true;
      directPhone = typeof json.phone === 'string' ? json.phone.trim().replace(/^\+/, '') : null;
      if (!message || message.length > 4_096) {
        return NextResponse.json({ error: 'Mensaje inválido o demasiado largo' }, { status: 400 });
      }
      // Support direct phone sending for bulk messages
      if (!conversationId && directPhone) {
        if (!PHONE_PATTERN.test(directPhone)) {
          return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 });
        }
        let query = supabase
          .from('conversations')
          .select('id')
          .eq('phone_number', directPhone)
          .eq('tenant_id', tenant.tenantId);
        
        if (accountId) query = query.eq('whatsapp_account_id', accountId);

        const { data: conv, error: convLookupError } = await query.maybeSingle();
        if (convLookupError) return internalApiError();
        if (conv) {
          conversationId = conv.id;
        } else {
          // Send directly via WhatsApp API without a conversation record
          let accountQuery = supabase
            .from('whatsapp_accounts')
            .select('access_token, phone_number_id')
            .eq('tenant_id', tenant.tenantId)
            .eq('status', 'active');
            
          if (accountId) {
            accountQuery = accountQuery.eq('id', accountId);
          } else {
            accountQuery = accountQuery.eq('is_default', true);
          }
          
          const { data: matchedAccount, error: accountError } = await accountQuery.limit(1).maybeSingle();
          if (accountError) return internalApiError();
          if (!matchedAccount) return NextResponse.json({ error: 'Faltan credenciales de WhatsApp' }, { status: 500 });
          
          const token = matchedAccount.access_token;
          const phoneId = matchedAccount.phone_number_id;
          
          // First try regular text message
          const waResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: directPhone,
              type: 'text',
              text: { body: message },
            }),
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(15_000),
          });
          const waResult = await readLimitedResponseJson(waResponse, 256 * 1024);

          if (!waResponse.ok) {
            // Check if it's a 24h window error - try template fallback
            if (is24hWindowError(waResult)) {
              const templateResult = await sendTemplateMessage(phoneId, token, directPhone);
              if (templateResult.ok) {
                return NextResponse.json({ 
                  success: true, 
                  method: 'template',
                  note: 'Mensaje enviado como template porque la ventana de 24h estaba cerrada'
                });
              } else {
                return NextResponse.json({ 
                  error: 'La ventana de 24h está cerrada y el contacto debe escribir primero.'
                }, { status: 502 });
              }
            }
            console.error('Direct WhatsApp send failed');
            return NextResponse.json({ error: 'No se pudo enviar el mensaje' }, { status: 502 });
          }
          return NextResponse.json({ success: true, method: 'text' });
        }
      }
    }

    if (conversationId && !UUID_PATTERN.test(conversationId)) {
      return NextResponse.json({ error: 'conversationId inválido' }, { status: 400 });
    }
    if (message && message.length > (file ? 1_024 : 4_096)) {
      return NextResponse.json({ error: 'El mensaje excede el tamaño permitido' }, { status: 400 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Faltan conversationId o phone' }, { status: 400 });
    }

    // Obtener la conversación (VULN fix: solo del tenant autenticado, evita IDOR entre tenants)
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, phone_number, whatsapp_account_id')
      .eq('id', conversationId)
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    if (conversationError) return internalApiError();
    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    // Obtener config para credenciales de WhatsApp
    let accountQuery = supabase
      .from('whatsapp_accounts')
      .select('access_token, phone_number_id')
      .eq('tenant_id', tenant.tenantId)
      .eq('status', 'active');
      
    if (conversation.whatsapp_account_id) {
      accountQuery = accountQuery.eq('id', conversation.whatsapp_account_id);
    } else if (accountId) {
      accountQuery = accountQuery.eq('id', accountId);
    } else {
      accountQuery = accountQuery.eq('is_default', true);
    }

    const { data: matchedAccount, error: accountError } = await accountQuery.limit(1).maybeSingle();
    if (accountError) return internalApiError();
    
    if (!matchedAccount) {
      return NextResponse.json({ error: 'Faltan credenciales de WhatsApp' }, { status: 500 });
    }
    
    const token = matchedAccount.access_token;
    const phoneId = matchedAccount.phone_number_id;

    let mediaId = null;
    let panelMediaUrl = '';

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
        body: mediaFormData,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });

      const uploadData = await readLimitedResponseJson(uploadRes, 256 * 1024) as Record<string, unknown>;
      if (!uploadRes.ok) {
        console.error('WhatsApp media upload failed');
        return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 502 });
      }
      mediaId = typeof uploadData.id === 'string' ? uploadData.id : null;
      if (!mediaId) return NextResponse.json({ error: 'Respuesta inválida del proveedor' }, { status: 502 });

      // Subir a Supabase Storage para visualizar en el panel
      const buffer = fileBuffer || Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(-120) || 'attachment';
      const fileName = `${tenant.tenantId}/${Date.now()}_${safeName}`;
      const storageContentType = file.type || 'application/octet-stream';
      
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, buffer, {
        contentType: storageContentType,
        upsert: false,
      });

      if (uploadError) {
        console.error('Chat media storage upload failed:', uploadError.name || 'storage_error');
        return NextResponse.json(
          { error: 'El almacenamiento de archivos no está disponible' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      
      panelMediaUrl = `/api/panel/media/${fileName.split('/').map(encodeURIComponent).join('/')}`;
    }

    // Preparar payload del mensaje
    const messagePayload: any = {
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
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });

    const waResult = await readLimitedResponseJson(waResponse, 256 * 1024);

    if (!waResponse.ok) {
      // Check if it's a 24h window error - try template fallback
      if (is24hWindowError(waResult)) {
        const templateResult = await sendTemplateMessage(phoneId, token, conversation.phone_number);
        if (templateResult.ok) {
          // Save template note in history
          const [{ error: historyError }, { error: updateError }] = await Promise.all([
            supabase.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: `[Template enviado - ventana 24h cerrada]\n${message || ''}`,
            }),
            supabase
              .from('conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', conversationId)
              .eq('tenant_id', tenant.tenantId),
          ]);
          if (historyError || updateError) {
            console.error('WhatsApp template sent but local history update failed');
            return NextResponse.json({ success: true, method: 'template', historySaved: false }, { status: 202 });
          }
          return NextResponse.json({ 
            success: true, 
            method: 'template',
            note: 'Mensaje enviado como template porque la ventana de 24h estaba cerrada' 
          });
        } else {
          return NextResponse.json({ 
            error: 'La ventana de 24h está cerrada. El contacto debe enviar un mensaje primero para poder responderle.'
          }, { status: 502 });
        }
      }

      console.error('Panel WhatsApp send failed');
      return NextResponse.json({ error: 'No se pudo enviar el mensaje' }, { status: 502 });
    }

    // Guardar en historial
    const attachmentMarkup = file?.type.startsWith('image/')
      ? `![Imagen adjunta](${panelMediaUrl})`
      : `[Archivo adjunto](${panelMediaUrl})`;
    const historyContent = mediaId 
      ? `${attachmentMarkup}\n${message || ''}`.trim()
      : message;

    const [{ error: historyError }, { error: updateError }] = await Promise.all([
      supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: historyContent,
      }),
      supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('tenant_id', tenant.tenantId),
    ]);
    if (historyError || updateError) {
      console.error('WhatsApp message sent but local history update failed');
      return NextResponse.json({ success: true, method: 'text', historySaved: false }, { status: 202 });
    }

    return NextResponse.json({ success: true, method: 'text' });
  } catch {
    console.error('Send-message request failed');
    return internalApiError();
  }
}
