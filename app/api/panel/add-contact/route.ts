import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
  readLimitedResponseJson,
} from '@/lib/request-guards';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_NAME_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_AI_PROMPT_LENGTH = 8_000;
const MAX_API_KEY_LENGTH = 2_048;
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;

function jsonResponse(body: JsonRecord, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function parseConfiguredApiKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw || raw.length > MAX_API_KEY_LENGTH) return '';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
    const config = parsed as JsonRecord;
    const candidate = typeof config.groq_key === 'string'
      ? config.groq_key.trim()
      : typeof config.openai_key === 'string'
        ? config.openai_key.trim()
        : '';
    return candidate.length <= MAX_API_KEY_LENGTH ? candidate : '';
  } catch {
    return raw;
  }
}

function providerError(payload: unknown): { code: number | null; message: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { code: null, message: '' };
  }
  const error = (payload as JsonRecord).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) {
    return { code: null, message: '' };
  }
  const details = error as JsonRecord;
  const numericCode = Number(details.code);
  return {
    code: Number.isFinite(numericCode) ? numericCode : null,
    message: typeof details.message === 'string'
      ? details.message.toLowerCase().slice(0, 1_000)
      : '',
  };
}

async function sendWhatsAppRequest(
  phoneId: string,
  token: string,
  payload: JsonRecord,
): Promise<{ ok: boolean; payload: unknown }> {
  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  let responsePayload: unknown = {};
  try {
    responsePayload = await readLimitedResponseJson(response, MAX_PROVIDER_RESPONSE_BYTES);
  } catch {
    if (response.ok) throw new Error('invalid_provider_response');
  }
  return { ok: response.ok, payload: responsePayload };
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return jsonResponse({ error: 'No autorizado' }, 401);

    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('add-contact', tenant.tenantId, 12, 60_000);
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, 16 * 1024);
    if (!bodyResult.ok) return bodyResult.response;

    const rawName = bodyResult.body.name;
    const rawPhone = bodyResult.body.phone;
    const rawMessage = bodyResult.body.message;
    const rawTestMode = bodyResult.body.testMode;
    if (
      (rawName !== undefined && rawName !== null && typeof rawName !== 'string') ||
      typeof rawPhone !== 'string' ||
      (rawMessage !== undefined && rawMessage !== null && typeof rawMessage !== 'string') ||
      (rawTestMode !== undefined && typeof rawTestMode !== 'boolean')
    ) {
      return jsonResponse({ error: 'Solicitud inválida' }, 400);
    }

    const safePhone = rawPhone.trim();
    const safeName = typeof rawName === 'string' ? rawName.trim() : '';
    const safeMessage = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    const testMode = rawTestMode === true;
    if (!/^\+?[0-9]{6,30}$/.test(safePhone)) {
      return jsonResponse({ error: 'Teléfono inválido' }, 400);
    }
    if (
      safeName.length > MAX_NAME_LENGTH ||
      safeMessage.length > MAX_MESSAGE_LENGTH ||
      (typeof rawMessage === 'string' && rawMessage.length > MAX_MESSAGE_LENGTH)
    ) {
      return jsonResponse({ error: 'Solicitud inválida' }, 400);
    }
    if (!testMode && !safeName) {
      return jsonResponse({ error: 'Nombre y teléfono son requeridos' }, 400);
    }

    const supabase = createSupabaseAdmin();
    let convId: string | null = null;

    // In test mode: skip contact creation entirely.
    if (!testMode) {
      const { data: newConversationId, error: convError } = await supabase.rpc(
        'create_tenant_conversation_with_quota',
        {
          p_tenant_id: tenant.tenantId,
          p_customer_name: safeName,
          p_phone_number: safePhone,
        },
      );

      if (convError) {
        if (convError.message?.includes('contact_already_exists')) {
          return jsonResponse({ error: 'Este número ya existe en la base de datos' }, 409);
        }
        if (convError.message?.includes('contact_limit_reached')) {
          return jsonResponse({ error: 'Límite de contactos alcanzado' }, 429);
        }
        console.error('Contact quota reservation failed');
        return internalApiError();
      }
      convId = typeof newConversationId === 'string' ? newConversationId : null;
      if (!convId) return internalApiError();
    }

    if (!safeMessage) {
      if (testMode) {
        return jsonResponse({ error: 'En modo prueba debes escribir un mensaje' }, 400);
      }
      return jsonResponse({ success: true, id: convId, messageSent: false });
    }

    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key,whatsapp_token,whatsapp_phone_id,ai_prompt')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();
    if (configError) return internalApiError();

    const groqKey = parseConfiguredApiKey(config?.openai_key);
    const token = typeof config?.whatsapp_token === 'string' ? config.whatsapp_token.trim() : '';
    const phoneId = typeof config?.whatsapp_phone_id === 'string'
      ? config.whatsapp_phone_id.trim()
      : '';
    const aiPrompt = typeof config?.ai_prompt === 'string'
      ? config.ai_prompt.slice(0, MAX_AI_PROMPT_LENGTH)
      : '';

    if (
      !/^\d{5,40}$/.test(phoneId) ||
      token.length < 10 ||
      token.length > 4_096
    ) {
      return jsonResponse(
        { error: 'WhatsApp no está configurado. Configure el token y phone ID.' },
        400,
      );
    }

    let finalMessage = safeMessage;
    const contactName = testMode ? 'estimado cliente' : safeName;

    if (groqKey.length >= 10) {
      try {
        const groq = new OpenAI({
          apiKey: groqKey,
          baseURL: 'https://api.groq.com/openai/v1',
          timeout: 20_000,
          maxRetries: 1,
        });
        const completion = await groq.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
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
- Responde SOLO con el mensaje, nada más`,
            },
            {
              role: 'user',
              content: `Redacta un primer mensaje para ${contactName}. Contexto de lo que quiero comunicar: "${safeMessage}"`,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        });

        const generated = completion.choices[0]?.message?.content?.trim() || '';
        if (generated) finalMessage = generated.slice(0, MAX_MESSAGE_LENGTH);
      } catch {
        // The original bounded message remains a safe provider-independent fallback.
        console.warn('AI message crafting failed');
      }
    }

    let whatsappResult: { ok: boolean; payload: unknown };
    try {
      whatsappResult = await sendWhatsAppRequest(phoneId, token, {
        messaging_product: 'whatsapp',
        to: safePhone,
        type: 'text',
        text: { body: finalMessage },
      });
    } catch {
      console.error('WhatsApp provider request failed');
      return jsonResponse({ error: 'Error de conexión con WhatsApp' }, 500);
    }

    let historyContent = finalMessage;
    if (!whatsappResult.ok) {
      const details = providerError(whatsappResult.payload);
      const is24hError = details.code === 131047 || details.code === 131026 ||
        details.code === 130472 || details.message.includes('24') ||
        details.message.includes('session') || details.message.includes('window') ||
        details.message.includes('template');

      if (!is24hError) {
        return jsonResponse({ error: 'Error al enviar por WhatsApp' }, 502);
      }

      let templateResult: { ok: boolean; payload: unknown };
      try {
        templateResult = await sendWhatsAppRequest(phoneId, token, {
          messaging_product: 'whatsapp',
          to: safePhone,
          type: 'template',
          template: { name: 'hello_world', language: { code: 'en_US' } },
        });
      } catch {
        console.error('WhatsApp template request failed');
        return jsonResponse({ error: 'No se pudo enviar el mensaje de WhatsApp' }, 502);
      }
      if (!templateResult.ok) {
        return jsonResponse({ error: 'No se pudo enviar el mensaje de WhatsApp' }, 502);
      }
      historyContent = `[Template enviado - ventana 24h cerrada]\n${finalMessage}`;
    }

    if (convId) {
      const { error: historyError } = await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: historyContent,
        tenant_id: tenant.tenantId,
      });
      if (historyError) console.error('Sent message history write failed');
    }

    return jsonResponse({
      success: true,
      id: convId,
      messageSent: true,
      finalMessage,
      testMode,
    });
  } catch {
    console.error('Add contact request failed');
    return internalApiError();
  }
}
