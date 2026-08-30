import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
  readLimitedResponseJson,
} from '@/lib/request-guards';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'banners');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('generate-prompt', tenant.tenantId, 10, 60_000);
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, 32 * 1024);
    if (!bodyResult.ok) return bodyResult.response;
    const productDetails = typeof bodyResult.body.productDetails === 'string'
      ? bodyResult.body.productDetails.trim()
      : '';
    const mode = bodyResult.body.mode === 'dropshipping' ? 'dropshipping' : 'services';
    if (!productDetails || productDetails.length > 8_000) {
      return NextResponse.json({ error: 'Detalles del producto inválidos' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();
    if (configError) return internalApiError();

    let apiKey = '';
    let isGroq = false;
    let isGemini = false;
    let modelName = 'gpt-4o';

    if (config) {
      try {
        const p = JSON.parse(config.openai_key || '{}');
        if (p.openai_key) {
          apiKey = p.openai_key;
          modelName = 'gpt-4o';
        } else if (p.gemini_key) {
          apiKey = p.gemini_key;
          modelName = 'gemini-2.5-flash';
          isGemini = true;
        } else if (p.groq_key) {
          apiKey = p.groq_key;
          modelName = 'qwen/qwen3.8-27b';
          isGroq = true;
        }
      } catch {
        apiKey = config.openai_key || '';
      }
    }

    // Fallbacks to environment keys
    if (!apiKey) {
      if (process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
        modelName = 'gpt-4o';
      } else if (process.env.GROQ_API_KEY) {
        apiKey = process.env.GROQ_API_KEY;
        modelName = 'qwen/qwen3.8-27b';
        isGroq = true;
      } else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
        modelName = 'gemini-2.5-flash';
        isGemini = true;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'No se configuró ninguna API Key de IA.' }, { status: 500 });
    }

    const systemPrompt = mode === 'dropshipping'
      ? `Eres un Ingeniero de Prompts de IA experto y especialista en redactar instrucciones del sistema para Chatbots de WhatsApp (Dropshipping).
Tu objetivo es redactar un PROMPT DEL SISTEMA altamente optimizado para que el chatbot de WhatsApp venda el producto especificado por el usuario.

El prompt del sistema que generes debe:
1. Definir la personalidad del bot: un asesor de ventas entusiasta, cercano y carismático.
2. Describir detalladamente el producto provisto (características clave, beneficios emocionales, dolores que resuelve).
3. Establecer un flujo conversacional persuasivo:
   - Conectar y asesorar al cliente primero, resolviendo sus dudas y destacando los beneficios.
   - Confirmar explícitamente el deseo de compra antes de pedir los datos de envío.
   - Solicitar los datos de envío ordenadamente (Nombre completo, Teléfono, Dirección de entrega exacta con referencias, Ciudad y Departamento).
4. No incluir referencias técnicas sobre códigos o la etiqueta [CREAR_ORDEN_DROPI] en las instrucciones base.
5. Estar en idioma español.

Responde únicamente con el prompt generado, listo para copiar y pegar en el sistema. No agregues introducciones, explicaciones, saludos ni bloques de código de markdown.`
      : `Eres un Ingeniero de Prompts de IA experto y especialista en redactar instrucciones del sistema para Chatbots de WhatsApp de Servicios (Agendamiento de Citas/Reuniones).
Tu objetivo es redactar un PROMPT DEL SISTEMA altamente optimizado para que el chatbot de WhatsApp promueva y venda los servicios especificados por el usuario.

El prompt del sistema que generes debe:
1. Definir la personalidad del bot: un closer de ventas profesional, empático, consultivo y con gran liderazgo comercial.
2. Describir detalladamente el servicio provisto (beneficios principales, valor aportado, dolores que resuelve).
3. Establecer un flujo conversacional persuasivo:
   - Conectar y asesorar al cliente primero, resolviendo sus dudas de forma clara e interactiva.
   - No saltar a ofrecer horarios de inmediato ni dar enlaces estáticos de agendamiento.
   - Solo cuando el cliente muestre claro interés en avanzar, coordinar o agendar una cita/reunión, guiarlo amablemente a proponer su día y hora de preferencia.
4. No incluir referencias técnicas sobre códigos de Google Calendar o etiquetas como [VERIFICAR_DISPONIBILIDAD] o [AGENDAR_CITA] en las instrucciones base.
5. Estar en idioma español.

Responde únicamente con el prompt generado, listo para copiar y pegar en el sistema. No agregues introducciones, explicaciones, saludos ni bloques de código de markdown.`;

    let generatedPrompt = '';

    if (isGemini) {
      // Google Gemini via REST API
      const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nDetalles del Producto del usuario:\n${productDetails}` }]
            }
          ],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
        }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(25_000),
      });
      const gemData = await readLimitedResponseJson(gemRes, 256 * 1024) as any;
      if (!gemRes.ok) throw new Error('provider_request_failed');
      generatedPrompt = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // OpenAI / Groq SDK
      const client = new OpenAI({
        apiKey,
        baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
        timeout: 25_000,
        maxRetries: 1,
      });
      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Detalles del Producto:\n${productDetails}` }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      generatedPrompt = completion.choices[0]?.message?.content || '';
    }

    if (!generatedPrompt || !generatedPrompt.trim()) {
      return NextResponse.json({ error: 'La IA devolvió una respuesta vacía' }, { status: 500 });
    }

    return NextResponse.json({ prompt: generatedPrompt.trim().slice(0, 16_000) });
  } catch (error: any) {
    console.error('❌ Error generating sales prompt:', error);
    return internalApiError();
  }
}
