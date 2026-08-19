import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { denyUnlessFeature } from '@/lib/feature-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import { internalApiError, readLimitedJsonObject } from '@/lib/request-guards';

// POST /api/panel/social/generate-metadata - Optimizar título y descripción sugerida usando Groq IA
export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'social');
    if (featureDenied) return featureDenied;
    const limit = await checkRateLimit(rateLimitKey('social-metadata', tenant.tenantId), 20, 60_000);
    if (limit.unavailable) return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Límite de generación alcanzado' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
      });
    }

    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const { title, caption } = parsedBody.body;
    if ((typeof title !== 'string' && typeof caption !== 'string')
        || (typeof title === 'string' && title.length > 300)
        || (typeof caption === 'string' && caption.length > 4_000)
        || (!title?.trim() && !caption?.trim())) {
      return NextResponse.json({ error: 'Por favor, escribe un borrador o ideas en el título o descripción primero.' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 2. Obtener la clave de API de Groq de la configuración del Tenant o del .env
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();
    if (configError) {
      console.error('Social metadata configuration lookup failed:', configError.code || 'database_error');
      return internalApiError();
    }

    let extConfig = { groq_key: '' };
    if (config?.openai_key) {
      try {
        const parsed = JSON.parse(config.openai_key);
        extConfig = { ...extConfig, ...parsed };
      } catch {
        // En caso de que no sea JSON válido
      }
    }

    const apiKey = extConfig.groq_key || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Clave de Groq no configurada en el sistema. Asegúrate de configurar la clave de Groq.' }, { status: 500 });
    }

    // 3. Inicializar cliente OpenAI para Groq
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 15_000,
      maxRetries: 1,
    });

    const systemPrompt = `Eres un copywriter y estratega de contenido experto en redes sociales (Instagram, TikTok, YouTube Shorts y Facebook Reels).
Tu objetivo es tomar las ideas o el borrador de un usuario para su video y mejorarlo radicalmente para aumentar la retención, los clics y la interacción.

Debes generar un objeto JSON con exactamente estas dos propiedades:
1. "title": Un título super atractivo y corto (máximo 6 palabras) con 1-2 emojis, ideal para enganchar y usar como texto en el video o portada.
2. "caption": La descripción del video. Debe ser persuasiva, organizada, incluir un gancho inicial, desarrollar la idea clave de forma breve, tener un llamado a la acción (CTA) claro al final (ej. "¡Comenta abajo tu opinión!", "Guarda este reel si te sirvió", etc.) y terminar con 3-5 hashtags relevantes.

Responde ÚNICAMENTE con el objeto JSON crudo, sin bloques de código markdown de tipo \`\`\`json y sin textos introductorios.
El idioma de la respuesta debe ser estrictamente español.`;

    const userPrompt = `Borrador/Ideas del usuario:
- Título propuesto: "${title || '(Sin título)'}"
- Descripción/Ideas propuestas: "${caption || '(Sin descripción)'}"

Mejora y optimiza esta información para redes sociales.`;

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const resultText = completion.choices[0]?.message?.content;

    if (!resultText) {
      return NextResponse.json({ error: 'La respuesta de la IA fue vacía.' }, { status: 500 });
    }

    // 4. Parsear el resultado
    try {
      const parsed: unknown = JSON.parse(resultText.trim());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid_provider_result');
      }
      const result = parsed as Record<string, unknown>;
      const generatedTitle = typeof result.title === 'string' ? result.title.trim() : '';
      const generatedCaption = typeof result.caption === 'string' ? result.caption.trim() : '';
      if (!generatedTitle || generatedTitle.length > 160 || !generatedCaption || generatedCaption.length > 4_000) {
        throw new Error('invalid_provider_result');
      }
      return NextResponse.json({
        success: true,
        title: generatedTitle,
        caption: generatedCaption,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      console.error('Social metadata provider returned an invalid payload');
      return NextResponse.json({ error: 'La IA devolvio una respuesta invalida' }, { status: 502 });
    }

  } catch (error) {
    console.error('Social metadata request failed:', error instanceof Error ? error.name : 'unknown_error');
    return internalApiError();
  }
}
