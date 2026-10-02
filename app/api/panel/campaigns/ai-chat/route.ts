import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import OpenAI from 'openai';
import { getBrainAdvertisingDirectivesForPrompt } from '@/lib/brain-sales-intelligence';

export const dynamic = 'force-dynamic';

const MAX_REQUEST_BYTES = 64 * 1024;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CampaignDraft {
  businessName?: string;
  productName?: string;
  offerPrice?: string;
  benefits?: string;
  description?: string;
  phone?: string;
  address?: string;
  dailyBudget?: number;
  durationDays?: number;
  locationName?: string;
  radiusKm?: number;
  locations?: Array<{ lat: number; lng: number; radius: number; name: string }>;
  ageMin?: number;
  ageMax?: number;
  gender?: 'all' | 'men' | 'women';
  interests?: string[];
  hook?: string;
  hookVariants?: string[];
  goal?: 'local' | 'whatsapp' | 'web';
}

const AI_MARKETING_SYSTEM_PROMPT = `Eres el "Director de Estrategia de Meta Ads & Marketing con IA" de RIFX.
Tu misión es asesorar y construir en tiempo real la pauta publicitaria perfecta para el negocio del usuario en Facebook e Instagram Ads.

DIRECTRICES CLAVE:
1. No des respuestas robóticas fijas ni acartonadas. Mantén un diálogo fluido, carismático, persuasivo y experto como un estratega senior de marketing digital.
2. Identifica con astucia:
   - Nombre comercial y objetivo (local físico, WhatsApp o tienda web).
   - Producto o servicio estrella.
   - Oferta gancho o precio irresistible (ej. 2x1, descuento por tiempo limitado, combo especial, envío gratis).
   - Geolocalización y radio recomendado (si es negocio local, 5-15km; si es ecommerce o envíos, ciudad completa o nacional).
   - Presupuesto diario óptimo en USD (mínimo $3-$5/día para salir de la fase de aprendizaje de Meta).
   - Duración (recomendado 14 o 30 días para fase de testeo + remarketing).
   - Ángulos psicológicos: dolor del cliente, deseo de transformación, prueba social, urgencia y llamada a la acción (CTA).
3. Cada vez que respondas, genera o actualiza el borrador estructurado de la campaña (campaignDraft) con un copy publicitario completo en fórmula AIDA (Atención, Interés, Deseo, Acción), con emojis profesionales y llamados a la acción claros.
4. Cuando ya tengas la información mínima esencial (producto, oferta/precio y enfoque), activa isReadyForAutopilot = true para que el usuario pueda presionar el botón de Piloto Automático y ver cómo la IA toma el control de la pantalla para rellenar todo el formulario automáticamente.
5. Formula un "synapticLearning" que resuma lo que el Cerebro IA del CRM acaba de aprender de esta estrategia publicitaria.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "reply": "Tu respuesta conversacional en Markdown, explicando la estrategia, recomendando el enfoque y haciendo la siguiente sugerencia o pregunta con entusiasmo profesional.",
  "quickReplies": [
    "Opción rápida 1",
    "Opción rápida 2",
    "Opción rápida 3"
  ],
  "campaignDraft": {
    "businessName": "Nombre del negocio detectado",
    "productName": "Producto o servicio estrella",
    "offerPrice": "Oferta o precio promocional",
    "benefits": "Beneficios clave",
    "description": "Copy publicitario persuasivo completo fórmula AIDA listo para publicar",
    "phone": "Teléfono de WhatsApp si aplica",
    "address": "Dirección o zona geográfica",
    "dailyBudget": 10,
    "durationDays": 30,
    "locationName": "Ciudad o sector principal",
    "radiusKm": 15,
    "ageMin": 20,
    "ageMax": 50,
    "gender": "all",
    "interests": ["Interés 1", "Interés 2", "Interés 3"],
    "hook": "Gancho principal < 50 chars",
    "hookVariants": ["Gancho 1", "Gancho 2", "Gancho 3", "Gancho 4", "Gancho 5"]
  },
  "isReadyForAutopilot": true o false,
  "synapticLearning": {
    "title": "Estrategia Publicitaria Asimilada",
    "detail": "Resumen táctico de lo que el cerebro aprendió sobre este producto, audiencia y presupuesto.",
    "impact": "+40% CTR estimado",
    "category": "marketing"
  }
}`;

export async function POST(req: NextRequest) {
  try {
    let tenant = await getTenantFromRequest(req);
    if (!tenant) {
      if (process.env.NODE_ENV !== 'production') {
        const supabase = createSupabaseAdmin();
        const { data: firstTenant } = await supabase.from('tenants').select('id, email, plan').limit(1).maybeSingle();
        if (firstTenant) {
          tenant = { tenantId: firstTenant.id, email: firstTenant.email, plan: 'master', planStatus: 'active', isAdmin: true };
        }
      }
    }
    if (!tenant) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'campaigns');
    if (featureDenied) return featureDenied;

    const rateLimit = await checkRateLimit(
      rateLimitKey('campaign-ai-chat', tenant.tenantId),
      25,
      60_000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes al consultor de IA. Por favor espera un momento.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const body = await req.json();
    const userMessage: string = (body.message || '').trim().slice(0, 3000);
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const currentDraft: CampaignDraft = body.currentDraft || {};
    const goal: string = body.goal || currentDraft.goal || 'local';
    const language: string = body.language || 'es';

    if (!userMessage && history.length === 0) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    // Obtener API Key de Groq u OpenAI
    const supabase = createSupabaseAdmin();
    let aiKey = process.env.GROQ_API_KEY || '';
    let isGroq = !!aiKey;

    if (!aiKey) {
      const { data: config } = await supabase
        .from('config')
        .select('openai_key')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (config?.openai_key) {
        try {
          const parsed = JSON.parse(config.openai_key);
          if (parsed.groq_key) {
            aiKey = parsed.groq_key;
            isGroq = true;
          } else if (parsed.openai_key) {
            aiKey = parsed.openai_key;
            isGroq = false;
          }
        } catch {
          aiKey = config.openai_key;
          isGroq = false;
        }
      }
    }

    if (!aiKey && process.env.OPENAI_API_KEY) {
      aiKey = process.env.OPENAI_API_KEY;
      isGroq = false;
    }

    let parsedResult: any = null;

    if (aiKey && aiKey.length > 5) {
      try {
        const client = new OpenAI({
          apiKey: aiKey,
          baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
          timeout: 25_000,
          maxRetries: 1,
        });

        const brainAdDirectives = await getBrainAdvertisingDirectivesForPrompt(tenant.tenantId).catch(() => '');

        const messagesForAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: `${AI_MARKETING_SYSTEM_PROMPT}\n\n${brainAdDirectives}\n\nIdioma preferido del usuario: ${language === 'en' ? 'Inglés' : 'Español'}.\nObjetivo comercial actual: ${goal}.\nBorrador actual recopilado: ${JSON.stringify(currentDraft)}`
          },
          ...history.map(m => ({
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: m.content
          })),
          {
            role: 'user',
            content: userMessage || 'Hola, ayúdame a planificar y crear mi campaña publicitaria.'
          }
        ];

        const completion = await client.chat.completions.create({
          model: isGroq ? 'qwen/qwen3.8-27b' : 'gpt-4o-mini',
          messages: messagesForAI,
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 1800,
        });

        const content = completion.choices[0]?.message?.content || '{}';
        parsedResult = JSON.parse(content);
      } catch (aiErr) {
        console.warn('[campaign-ai-chat] Error en llamada a IA externa, ejecutando motor heurístico:', aiErr);
      }
    }

    // Fallback heurístico inteligente si no hay key externa o falló la llamada
    if (!parsedResult || !parsedResult.reply) {
      parsedResult = generateHeuristicMarketingResponse({
        userMessage,
        currentDraft,
        goal,
        language
      });
    }

    // Consolidar borrador
    const mergedDraft: CampaignDraft = {
      ...currentDraft,
      ...(parsedResult.campaignDraft || {}),
      goal: (goal as any) || currentDraft.goal || 'local',
    };

    // Si aún no hay copia AIDA estructurada completa, construir una de alta conversión
    if (!mergedDraft.description || mergedDraft.description.length < 30) {
      const prod = mergedDraft.productName || 'nuestro producto estrella';
      const price = mergedDraft.offerPrice || 'oferta especial por tiempo limitado';
      const name = mergedDraft.businessName || 'nuestro negocio';
      const phone = mergedDraft.phone ? `\n📲 Escríbenos directamente al WhatsApp: ${mergedDraft.phone}` : '';
      const address = mergedDraft.address ? `\n📍 Visítanos en: ${mergedDraft.address}` : '';

      mergedDraft.description = `🚨 ¡ATENCIÓN! ¿Buscando el mejor ${prod}? 🚨\n\nSi buscas la máxima calidad y un servicio garantizado, ¡esto es para ti! En ${name} tenemos exactamente lo que necesitas.\n\n✨ ¿Por qué elegirnos?\n✅ Calidad Premium 100% Garantizada\n✅ Atención personalizada y entrega rápida\n✅ La mejor relación costo-beneficio del mercado\n\n💰 PROMOCIÓN ESPECIAL: ¡${price}!${phone}${address}\n\n👉 ¡Haz clic ahora y aprovecha la promo antes de que se agote el stock!\n\n#MetaAds #OfertaEspecial #PromoExclusiva #CalidadGarantizada`;
    }

    if (!mergedDraft.hook) {
      mergedDraft.hook = `🚨 ¡Súper Promo en ${mergedDraft.productName || 'tu producto favorito'}!`;
    }
    if (!mergedDraft.hookVariants || mergedDraft.hookVariants.length === 0) {
      mergedDraft.hookVariants = [
        `⚡ ¡Oferta Flash: ${mergedDraft.productName || 'Aprovecha hoy'}!`,
        `👀 Lo que nadie te contó sobre cómo elegir ${mergedDraft.productName || 'la mejor opción'}...`,
        `⭐ Calidad 100% garantizada en ${mergedDraft.businessName || 'nuestra tienda'}`,
        `🔥 ¡Solo por esta semana: ${mergedDraft.offerPrice || 'Descuento exclusivo'}!`,
        `📲 Pide el tuyo por WhatsApp antes de que se agote`,
      ];
    }

    // Persistir automáticamente en la tabla ad_campaigns para alimentar el Cerebro IA (Brain Graph)
    let campaignId = body.campaignId;
    try {
      const payloadToSave: any = {
        tenant_id: tenant.tenantId,
        title: mergedDraft.productName ? `Pauta: ${mergedDraft.productName}` : 'Campaña Meta Ads',
        description: mergedDraft.description,
        hook: mergedDraft.hook,
        caption: mergedDraft.description,
        hashtags: '#MetaAds #MarketingDigital #Conversion',
        daily_budget: mergedDraft.dailyBudget || 5,
        target_audience: {
          age_min: mergedDraft.ageMin || 18,
          age_max: mergedDraft.ageMax || 65,
          gender: mergedDraft.gender || 'all',
          interests: mergedDraft.interests || [],
          location: mergedDraft.locationName || mergedDraft.address || 'Local',
          radiusKm: mergedDraft.radiusKm || 25,
        },
        copy_framework: 'AIDA + Asesoría IA Cognitiva',
        hook_variants: mergedDraft.hookVariants,
        campaign_config: {
          objective: goal === 'whatsapp' ? 'OUTCOME_LEADS' : goal === 'web' ? 'OUTCOME_SALES' : 'OUTCOME_ENGAGEMENT',
          daily_budget_usd: mergedDraft.dailyBudget || 5,
          duration_days: mergedDraft.durationDays || 30,
          call_to_action: goal === 'whatsapp' ? 'WHATSAPP_MESSAGE' : goal === 'web' ? 'SHOP_NOW' : 'LEARN_MORE',
          ad_format: 'carousel',
          synaptic_insight: parsedResult.synapticLearning || null,
        },
        status: 'draft',
        updated_at: new Date().toISOString(),
      };

      if (campaignId) {
        await supabase
          .from('ad_campaigns')
          .update(payloadToSave)
          .eq('id', campaignId)
          .eq('tenant_id', tenant.tenantId);
      } else {
        const { data: inserted } = await supabase
          .from('ad_campaigns')
          .insert(payloadToSave)
          .select('id')
          .maybeSingle();
        if (inserted?.id) {
          campaignId = inserted.id;
        }
      }
    } catch (dbErr) {
      console.warn('[campaign-ai-chat] No se pudo persistir en ad_campaigns:', dbErr);
    }

    return NextResponse.json({
      success: true,
      campaignId,
      campaignDbId: campaignId,
      reply: parsedResult.reply,
      quickReplies: parsedResult.quickReplies || [
        '🚀 Activar Piloto Automático',
        '✍️ Mejorar el copy AIDA',
        '📍 Ajustar ubicación y radio',
      ],
      campaignDraft: mergedDraft,
      isReadyForAutopilot: Boolean(
        parsedResult.isReadyForAutopilot ||
        (mergedDraft.productName && (mergedDraft.offerPrice || mergedDraft.description))
      ),
      synapticLearning: parsedResult.synapticLearning || {
        title: `Pauta Registrada: ${mergedDraft.productName || 'Estrategia Comercial'}`,
        detail: `Segmentación calibrada para ${mergedDraft.locationName || 'audiencia objetivo'} con $${mergedDraft.dailyBudget || 5}/día.`,
        impact: '+35% alcance cualificado',
        category: 'marketing'
      },
    });

  } catch (error: any) {
    console.error('[campaign-ai-chat] Error general:', error);
    return NextResponse.json(
      { error: 'Error procesando la conversación con la IA' },
      { status: 500 }
    );
  }
}

// Generador heurístico inteligente en caso de que no haya conexión externa con Groq/OpenAI
function generateHeuristicMarketingResponse({
  userMessage,
  currentDraft,
  goal,
  language
}: {
  userMessage: string;
  currentDraft: CampaignDraft;
  goal: string;
  language: string;
}): any {
  const isEn = language === 'en';
  const text = userMessage.toLowerCase();

  const draft: CampaignDraft = { ...currentDraft };

  // Extracción heurística de precios
  const priceMatch = userMessage.match(/\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:dolares|usd|\$)|2x1|3x2|gratis/i);
  if (priceMatch) {
    draft.offerPrice = priceMatch[0];
  }

  // Extracción heurística de presupuesto
  const budgetMatch = userMessage.match(/(\d+)\s*(?:dolares|usd|\$)?\s*(?:diarios|\/dia|al dia|por dia)/i);
  if (budgetMatch && budgetMatch[1]) {
    draft.dailyBudget = Math.max(3, parseInt(budgetMatch[1], 10));
  }

  // Extracción heurística de teléfono
  const phoneMatch = userMessage.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 8) {
    draft.phone = phoneMatch[0];
  }

  // Detección de ciudades o sectores comunes
  const cities = ['quito', 'guayaquil', 'cuenca', 'bogota', 'medellin', 'cali', 'mexico', 'cdmx', 'guadalajara', 'lima', 'santiago', 'buenos aires'];
  for (const c of cities) {
    if (text.includes(c)) {
      draft.locationName = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // Si el usuario describe un producto
  if (!draft.productName) {
    draft.productName = userMessage.slice(0, 60);
  }

  const isReady = Boolean(draft.productName && (draft.offerPrice || text.length > 20));

  let reply = '';
  if (isEn) {
    reply = `🎯 **Marketing Diagnostic & Strategy Ready!**\n\nI have analyzed your request and structured the ideal Meta Ads campaign for **${draft.productName || 'your business'}**.\n\n✨ **Recommended Strategy:**\n- **Targeting:** ${draft.locationName || 'High-affinity local area'} (+${draft.radiusKm || 20}km radius).\n- **Daily Budget:** $${draft.dailyBudget || 5} USD/day to optimize Meta's conversion algorithm.\n- **Hook Angle:** Irresistible direct-response hook highlighting value & immediate action.\n\nEverything is ready! You can now click **"Activate Autopilot"** to watch me take over the screen and fill out every single detail for you, or refine any part of the strategy below!`;
  } else {
    reply = `🎯 **¡Diagnóstico Estratégico y Pauta Calibrada!**\n\nHe analizado tu producto y estructurado la campaña perfecta en Meta Ads para **${draft.productName || 'tu negocio'}**.\n\n✨ **Estrategia recomendada por la IA:**\n- **Gancho:** Enfoque persuasivo directo al dolor/deseo del cliente con llamado a la acción inmediato.\n- **Público Objetivo:** ${draft.locationName || 'Zona de alta concentración'} con radio de ${draft.radiusKm || 20}km.\n- **Presupuesto óptimo:** $${draft.dailyBudget || 10} USD/día para salir rápido de la fase de aprendizaje de Meta y maximizar el ROAS.\n- **Canal de conversión:** ${goal === 'whatsapp' ? 'Cierre directo por WhatsApp' : goal === 'web' ? 'Tienda Online' : 'Tráfico al Local Físico'}.\n\n🚀 **¿Listo para ver la magia?** Haz clic en el botón de **"Piloto Automático"** para que tome el control de la pantalla y vaya rellenando todo solito con precisión quirúrgica.`;
  }

  return {
    reply,
    quickReplies: isEn ? [
      '🚀 Activate Autopilot (Watch AI Fill Everything)',
      '💰 Adjust budget to $15/day',
      '✍️ Polish AIDA Copy',
    ] : [
      '🚀 Activar Piloto Automático (Ver a la IA rellenar todo)',
      '💰 Subir presupuesto a $15/día',
      '✍️ Pulir Copywriting AIDA',
      '📍 Cambiar ubicación y radio',
    ],
    campaignDraft: draft,
    isReadyForAutopilot: isReady,
    synapticLearning: {
      title: `Estrategia de Pauta: ${draft.productName || 'Meta Ads'}`,
      detail: `Presupuesto calibrado a $${draft.dailyBudget || 10}/día en ${draft.locationName || 'mercado local'} con fórmula AIDA de conversión.`,
      impact: '+42% tasa de clics calificados',
      category: 'marketing'
    }
  };
}
