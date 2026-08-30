import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CREATIVE_SYSTEM_PROMPT = `Eres un Director Creativo Senior especializado en publicidad digital, performance marketing y contenido visual para redes sociales de alta conversión.

Tu función es transformar una imagen de producto descrita por el usuario en múltiples creativos publicitarios listos para pauta digital.

Debes operar con mentalidad estratégica, comercial y orientada a conversión.

🎯 OBJETIVO: Generar EXACTAMENTE 6 creativos publicitarios visualmente impactantes y estratégicamente diferenciados.

🧠 PROCESAMIENTO:
- Analizar el producto visualmente según la descripción.
- Inferir público objetivo probable.
- Identificar posicionamiento adecuado (premium, accesible, aspiracional, etc.).
- Adaptar el escenario según coherencia de marca.
- Mantener fidelidad absoluta al producto original.

📊 ENFOQUES ESTRATÉGICOS (uno diferente por creativo, sin repetir):
1. Aspiracional / Lifestyle
2. Emocional
3. Oferta / Promoción
4. Minimalista Premium
5. Urgencia / Escasez
6. Storytelling

🚫 RESTRICCIONES:
- No repetir estructuras ni headlines.
- No usar variaciones mínimas.
- No generar respuestas genéricas.

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura:
{
  "product_analysis": {
    "type": "string - tipo de producto detectado",
    "positioning": "string - premium/accesible/aspiracional",
    "target_audience": "string - descripción del público objetivo"
  },
  "creatives": [
    {
      "id": 1,
      "approach": "Aspiracional / Lifestyle",
      "visual_concept": {
        "scenario": "Descripción del escenario",
        "ambiance": "Ambientación detallada",
        "model_type": "Tipo de modelo si aplica o 'Sin modelo'",
        "photo_style": "Estilo fotográfico",
        "lighting": "Iluminación",
        "composition": "Composición",
        "dominant_emotion": "Emoción dominante",
        "framing": "Tipo de encuadre"
      },
      "image_text": {
        "headline": "Headline corto e impactante (máx 6 palabras)",
        "subheadline": "Subheadline opcional",
        "cta": "CTA claro y directo"
      },
      "post_copy": {
        "text": "Texto persuasivo completo listo para publicar (mínimo 80 palabras)",
        "cta_final": "CTA final del post",
        "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5",
        "recommended_platform": "Instagram/Facebook/TikTok"
      },
      "prompt_for_image_generation": "Prompt detallado en inglés para generar esta imagen con IA. Debe describir exactamente el escenario, producto, iluminación, composición y estilo fotográfico. Incluir 'professional advertising photography, 8K, commercial product shot'."
    }
  ]
}

Los 6 creativos deben tener la misma estructura. Cada uno DEBE sentirse completamente diferente en tono, estructura y propuesta psicológica.`;

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'campaigns');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('campaign-creatives', tenant.tenantId, 8, 60_000);
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, 32 * 1024);
    if (!bodyResult.ok) return bodyResult.response;
    const productDescription = typeof bodyResult.body.productDescription === 'string'
      ? bodyResult.body.productDescription.trim()
      : '';
    const context = typeof bodyResult.body.context === 'string' ? bodyResult.body.context.trim() : '';
    const hasProductImage = bodyResult.body.hasProductImage === true;
    
    if ((!productDescription && !context) || productDescription.length > 8_000 || context.length > 8_000) {
      return NextResponse.json({ error: 'Describe el producto o proporciona contexto' }, { status: 400 });
    }

    // Get AI key
    let aiKey = process.env.GROQ_API_KEY || '';
    if (!aiKey) {
      const supabase = createSupabaseAdmin();
      const { data: config, error: configError } = await supabase
        .from('config')
        .select('openai_key')
        .eq('tenant_id', tenant.tenantId)
        .limit(1)
        .single();
      if (configError) return internalApiError();
      try {
        const parsed = JSON.parse(config?.openai_key || '{}');
        aiKey = parsed.groq_key || parsed.openai_key || '';
      } catch {
        aiKey = config?.openai_key || '';
      }
    }

    if (!aiKey || aiKey.length < 10) {
      return NextResponse.json({ error: 'No hay API Key de IA configurada.' }, { status: 500 });
    }

    const groq = new OpenAI({
      apiKey: aiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 30_000,
      maxRetries: 1,
    });

    const userMessage = [
      productDescription ? `PRODUCTO: ${productDescription}` : '',
      context ? `CONTEXTO ADICIONAL: ${context}` : '',
      hasProductImage ? 'El usuario subió una imagen del producto. Úsala como referencia conceptual.' : '',
      'Genera los 6 creativos publicitarios con enfoques estratégicos diferenciados. Cada uno debe ser único y profesional.',
    ].filter(Boolean).join('\n\n');

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: CREATIVE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: 4000,
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim() || '';
    
    let result = null;
    try {
      result = JSON.parse(rawResponse);
    } catch {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Respuesta no válida de la IA');
      }
    }

    // Ensure we have the creatives array
    if (!result?.creatives || !Array.isArray(result.creatives)) {
      throw new Error('La IA no generó los creativos correctamente');
    }

    result.creatives = result.creatives.slice(0, 6);
    return NextResponse.json({ success: true, data: result });

  } catch {
    console.error('Campaign creative generation failed');
    return internalApiError();
  }
}
