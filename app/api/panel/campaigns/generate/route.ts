import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { denyUnlessFeature } from '@/lib/feature-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MAX_REQUEST_BYTES = 32 * 1024;

async function readRequestObject(req: NextRequest): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null;
  if (!req.body) return null;
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) return null;
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

const MARKETING_SYSTEM_PROMPT = `Eres "RIFX AdGenius" — un director creativo de agencia de publicidad digital de clase mundial con 15+ años de experiencia en Meta Ads, Google Ads, y campañas virales.

Dominas los siguientes frameworks de copywriting:
- **AIDA**: Atención → Interés → Deseo → Acción
- **PAS**: Problema → Agitación → Solución
- **FAB**: Features → Advantages → Benefits
- **4U**: Urgente, Único, Útil, Ultra-específico
- **Before-After-Bridge**: Antes → Después → Puente

Tu especialidad es crear campañas que:
1. Detienen el scroll en 0.5 segundos (hooks irresistibles)
2. Generan conexión emocional inmediata
3. Usan gatillos mentales: escasez, prueba social, autoridad, reciprocidad, FOMO
4. Incluyen CTAs claros y urgentes
5. Optimizan para el algoritmo de Meta (engagement > reach)

REGLAS ESTRICTAS:
- Siempre responde en español latinoamericano (informal pero profesional)
- Usa emojis estratégicamente (no más de 5-7 por caption)
- Incluye números y datos específicos cuando sea posible
- Cada hook debe ser < 50 caracteres y provocar curiosidad
- El caption debe tener estructura: Hook → Storytelling → Beneficios → CTA → Hashtags
- Genera 5 variaciones de hooks para A/B testing
- Sugiere la audiencia ideal (edad, intereses, comportamientos)
- Sugiere el tipo de objetivo de campaña ideal para Meta Ads
- Sugiere presupuesto diario recomendado en USD

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "hook": "El mejor hook principal (máx 50 chars)",
  "hook_variants": ["Hook alternativo 1", "Hook alternativo 2", "Hook alternativo 3", "Hook alternativo 4"],
  "caption": "Caption completo con emojis, storytelling, beneficios bullet points y CTA final. Mínimo 150 palabras. Debe ser una obra maestra de copywriting.",
  "carousel_slides": [
    "Slide 1: Hook visual + dato impactante",
    "Slide 2: Problema que resuelve",
    "Slide 3: Beneficio principal con prueba",
    "Slide 4: Testimonio o dato social",
    "Slide 5: CTA urgente"
  ],
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5 #tag6 #tag7 #tag8 #tag9 #tag10",
  "target_audience": {
    "age_min": 25,
    "age_max": 45,
    "interests": ["interés 1", "interés 2", "interés 3"],
    "behaviors": ["comportamiento 1", "comportamiento 2"],
    "gender": "all"
  },
  "campaign_config": {
    "objective": "OUTCOME_TRAFFIC",
    "daily_budget_usd": 10,
    "call_to_action": "LEARN_MORE",
    "ad_format": "carousel",
    "placement_recommendation": "feed + stories"
  },
  "copy_framework": "AIDA",
  "emotional_triggers": ["escasez", "prueba social"],
  "a_b_test_suggestion": "Probar hook 1 vs hook 3 con mismo creative, medir CTR después de 48h"
}`;

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'campaigns');
    if (featureDenied) return featureDenied;

    const limit = await checkRateLimit(
      rateLimitKey('campaign-generate', tenant.tenantId),
      10,
      60_000,
    );
    if (limit.unavailable) {
      return NextResponse.json({ error: 'Generación temporalmente no disponible' }, { status: 503 });
    }
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de generación' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil(limit.retryAfterMs / 1_000))) },
        },
      );
    }

    const body = await readRequestObject(req);
    if (!body) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4_000) : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const dailyBudget = Number(body.daily_budget);
    const hasReferenceImage = body.has_reference_image === true;
    const hasProductImage = body.has_product_image === true;
    if (!description && !title) {
      return NextResponse.json({ error: 'Titulo o descripcion requerida' }, { status: 400 });
    }
    if (body.daily_budget !== undefined && (!Number.isFinite(dailyBudget) || dailyBudget < 1 || dailyBudget > 1_000_000)) {
      return NextResponse.json({ error: 'Presupuesto diario inválido' }, { status: 400 });
    }

    // Obtener la API Key del tenant o del sistema
    let aiKey = process.env.GROQ_API_KEY || '';
    
    if (!aiKey) {
      const supabase = createSupabaseAdmin();
      const { data: config, error: configError } = await supabase
        .from('config')
        .select('openai_key')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();
      if (configError) {
        return NextResponse.json({ error: 'No se pudo cargar la configuración de IA' }, { status: 500 });
      }

      try {
        const parsed = JSON.parse(config?.openai_key || '{}');
        aiKey = typeof parsed.groq_key === 'string' ? parsed.groq_key : '';
      } catch {
        aiKey = '';
      }
    }

    if (!aiKey || aiKey.length < 10) {
      return NextResponse.json({ error: 'No hay API Key configurada para generar campañas. Ve a Configuraciones > IA.' }, { status: 500 });
    }

    // Configurar cliente de Groq
    const groq = new OpenAI({
      apiKey: aiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 30_000,
      maxRetries: 1,
    });

    const userContext = [
      title ? `TITULO del anuncio: "${title}"` : '',
      description ? `DESCRIPCION del producto/servicio: "${description}"` : '',
      Number.isFinite(dailyBudget) ? `PRESUPUESTO del usuario: $${dailyBudget}/dia` : '',
      hasReferenceImage ? 'El usuario subió una PANCARTA DE REFERENCIA - genera recomendaciones de diseño basadas en banners profesionales similares.' : '',
      hasProductImage ? 'El usuario subió una FOTO DEL PRODUCTO - incorpora eso en las sugerencias de creative y recomienda composición visual.' : '',
    ].filter(Boolean).join('\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: MARKETING_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Crea una campaña publicitaria profesional completa optimizada para Facebook/Instagram Ads basándote en estos datos del usuario:

${userContext}

Aplica el framework de copywriting más efectivo. Usa el titulo como base para el hook principal si fue proporcionado. Ajusta las recomendaciones de presupuesto según lo que el usuario indicó. Genera un caption que provoque acción inmediata.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 2000,
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim() || '';
    
    let campaign = null;
    try {
      campaign = JSON.parse(rawResponse);
    } catch {
      console.warn("Error parseando JSON directo, intentando extraer bloque JSON");
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         campaign = JSON.parse(jsonMatch[0]);
      } else {
         throw new Error("Respuesta no válida de la IA");
      }
    }

    // Asegurar que todos los campos existen con fallbacks
    campaign = {
      hook: campaign.hook || 'Tu producto, al siguiente nivel',
      hook_variants: campaign.hook_variants || [],
      caption: campaign.caption || description,
      carousel_slides: campaign.carousel_slides || [],
      hashtags: campaign.hashtags || '',
      target_audience: campaign.target_audience || { age_min: 18, age_max: 55, interests: [], behaviors: [], gender: 'all' },
      campaign_config: campaign.campaign_config || { objective: 'OUTCOME_TRAFFIC', daily_budget_usd: 5, call_to_action: 'LEARN_MORE', ad_format: 'single_image', placement_recommendation: 'feed + stories' },
      copy_framework: campaign.copy_framework || 'AIDA',
      emotional_triggers: campaign.emotional_triggers || [],
      a_b_test_suggestion: campaign.a_b_test_suggestion || '',
    };

    return NextResponse.json({ success: true, campaign });

  } catch {
    console.error('Campaign generation failed');
    return NextResponse.json({ error: 'No se pudo generar la campaña' }, { status: 502 });
  }
}
