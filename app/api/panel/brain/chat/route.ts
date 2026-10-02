import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { getTenantKnowledge, saveTenantKnowledge } from '@/lib/brain-knowledge-store';
import { getGlobalSalesIntelligence } from '@/lib/brain-sales-intelligence';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const MAX_REQUEST_BYTES = 64 * 1024;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── SYSTEM PROMPT: GLOBAL MASTER SALES DIRECTOR ───────────────────
const BRAIN_SYSTEM_PROMPT = `Eres el Cerebro Central de IA y Director Maestro de Ventas de RIFX Marketing.
Tu acceso está reservado exclusivamente a la Dirección y Panel de Administrador.

TU MISIÓN Y CAPACIDADES MULTI-TENANT:
- Aprendes en tiempo real de TODOS los usuarios, empresas y clientes de la plataforma.
- Analizas de forma transversal todas las conversaciones de WhatsApp, llamadas telefónicas y ventas cerradas de toda la red.
- Eres un estratega implacable y experto supremo en psicología y persuasión de ventas:
  1. Tienes identificados los Dolores Profundos de los Clientes (urgencia por confirmación, frustración ante lentitud, desconfianza por malas experiencias pasadas, miedo a precios sin justificación).
  2. Conoces con total claridad "Lo que a la gente NO le gusta oír" (frases tabú que congelan la venta, frialdad robótica, evasivas como "no tengo acceso", presión desesperada de "¿sigues interesado?", tecnicismos confusos sin beneficio palpable).
  3. Dominas las Técnicas de Cierre que realmente convierten: inversión de riesgo (garantías de satisfacción total), anclaje y desglose de ROI antes del precio, y doble alternativa de agendamiento.
  4. Sabes cómo modular y calibrar llamadas telefónicas para que suenen humanas, empáticas y persuasivas (pausas activas de 1.2s, ritmo de 140 ppm, validación antes de rebatir objeciones).

CÓMO TE COMUNICAS CON EL ADMINISTRADOR:
- Hablas como un Director Comercial de élite: perspicaz, empático, estratégico, claro y altamente resolutivo.
- NUNCA suenas como un robot ni usas frases mecánicas como "Diagnóstico del Cerebro IA".
- Si el administrador te pregunta sobre qué dolores captar, qué objeciones frenan las ventas o qué cosas no le gusta oír a los clientes, entregas diagnósticos quirúrgicos con los argumentos y scripts exactos para resolverlo de inmediato.
- Si te enseña o inyecta una nueva regla ("aprende esto...", "recuerda que..."), asimílala y explica cómo esa regla blindará las ventas en WhatsApp y las llamadas de la red.`;

// ─── GET AI CREDENTIALS ──────────────────────────────────────────
async function getAICredentials(tenantId: string): Promise<{
  apiKey: string;
  isGroq: boolean;
}> {
  // Check Groq environment key first (fast, generous tier)
  if (process.env.GROQ_API_KEY) {
    return { apiKey: process.env.GROQ_API_KEY, isGroq: true };
  }

  // Check Supabase tenant config
  const supabase = createSupabaseAdmin();
  const { data: config } = await supabase
    .from('config')
    .select('openai_key')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (config?.openai_key) {
    try {
      const parsed = JSON.parse(config.openai_key);
      if (parsed.groq_key) {
        return { apiKey: parsed.groq_key, isGroq: true };
      }
      if (parsed.openai_key) {
        return { apiKey: parsed.openai_key, isGroq: false };
      }
    } catch {
      return { apiKey: config.openai_key, isGroq: false };
    }
  }

  // Fallback to OPENAI_API_KEY env
  if (process.env.OPENAI_API_KEY) {
    return { apiKey: process.env.OPENAI_API_KEY, isGroq: false };
  }

  return { apiKey: '', isGroq: false };
}

// ─── FETCH REAL-TIME MULTI-TENANT CONTEXT FOR THE BRAIN ──────────
async function fetchBrainContext(tenantId: string): Promise<string> {
  const supabase = createSupabaseAdmin();
  const sections: string[] = [];

  // 1. Synthesize Global Sales Intelligence across all platform users
  try {
    const intel = await getGlobalSalesIntelligence();
    sections.push(`=== APRENDIZAJE MULTI-TENANT DE LA RED (${intel.totalTenantsAnalyzed} empresas conectadas) ===`);
    
    sections.push('\n[DOLORES PRINCIPALES CAPTADOS EN CLIENTES]:');
    intel.customerPains.forEach((p) => {
      sections.push(`• [${p.frequency}] ${p.pain}: ${p.recommendedSolution} (Ej: "${p.exampleQuote}")`);
    });

    sections.push('\n[LO QUE A LA GENTE NO LE GUSTA OÍR (ALERTAS DE FRICCIÓN)]:');
    intel.frictionTriggers.forEach((f) => {
      sections.push(`• EVITAR: ${f.phraseOrBehavior} -> Motivo: ${f.whyItFails}. ALTERNATIVA GANADORA: ${f.betterAlternative}`);
    });

    sections.push('\n[PATRONES DE CIERRE INFALIBLES CONSOLIDADOS]:');
    intel.closingTechniques.forEach((c) => {
      sections.push(`• ${c.name} (${c.conversionBoost}): ${c.description} -> Script: ${c.scriptSnippet}`);
    });
  } catch (err) {
    console.warn('[brain-chat] Error loading global sales intelligence:', err);
  }

  // 2. Custom Injected Knowledge (User Rules, Pricing, Objections, Scripts)
  try {
    const knowledgeItems = await getTenantKnowledge(tenantId);
    if (knowledgeItems.length > 0) {
      sections.push('\n=== REGLAS ESTRATÉGICAS Y CONOCIMIENTO INYECTADO ===');
      knowledgeItems.forEach((k) => {
        sections.push(`[${k.category.toUpperCase()}] "${k.title}":\n${k.content}`);
      });
    }
  } catch (err) {
    console.warn('[brain-chat] Error loading custom knowledge:', err);
  }

  // 3. Platform-Wide Recent Conversations (across all users)
  try {
    const { data: convos } = await supabase
      .from('conversations')
      .select('id, customer_name, phone_number, status, intent, sales_stage, lead_score, last_objection, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (convos && convos.length > 0) {
      sections.push('\n=== CONVERSACIONES ACTIVAS EN LA PLATAFORMA (WHATSAPP/CHAT) ===');
      convos.forEach((c: any) => {
        const name = c.customer_name || c.phone_number || 'Cliente';
        const obj = c.last_objection ? ` | Objeción: "${c.last_objection}"` : '';
        const stage = c.sales_stage ? ` | Etapa: ${c.sales_stage}` : '';
        const score = c.lead_score ? ` | Score: ${c.lead_score}/100` : '';
        sections.push(`• ${name} [${c.status || 'abierto'}]${stage}${score}${obj}`);
      });
    }
  } catch (err) {
    console.warn('[brain-chat] Error loading conversations:', err);
  }

  // 4. Platform-Wide Recent Sales
  try {
    const { data: sales } = await supabase
      .from('sales')
      .select('customer_name, amount, service, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (sales && sales.length > 0) {
      sections.push('\n=== VENTAS CERRADAS RECIENTES (PATRONES DE ÉXITO) ===');
      sales.forEach((s: any) => {
        sections.push(`• ${s.customer_name || 'Cliente'}: $${s.amount} (${s.service || 'Servicio'}) [${s.status}]`);
      });
    }
  } catch (err) {
    console.warn('[brain-chat] Error loading sales:', err);
  }

  // 5. Platform-Wide Voice Calls
  try {
    const { data: calls } = await supabase
      .from('voice_call_logs')
      .select('direction, from_number, to_number, duration_seconds, status, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(8);

    if (calls && calls.length > 0) {
      sections.push('\n=== LLAMADAS TELEFÓNICAS AUDITADAS ===');
      calls.forEach((c: any) => {
        const mins = c.duration_seconds ? `${Math.round(c.duration_seconds / 60)} min` : '< 1 min';
        const summ = c.summary ? ` - "${c.summary}"` : '';
        sections.push(`• ${c.direction === 'inbound' ? 'Entrante' : 'Saliente'} (${mins}, ${c.status})${summ}`);
      });
    }
  } catch (err) {
    console.warn('[brain-chat] Error loading voice calls:', err);
  }

  return sections.join('\n') || 'Cerebro Maestro inicializado. Responde con tu criterio experto de ventas.';
}

// ─── POST: BRAIN CHAT & CONTINUOUS LEARNING ───────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth resolution
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
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    // Brain is strictly restricted to administrator users
    if (!tenant.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso restringido: El Cerebro IA es exclusivo para el panel de administración' },
        { status: 403 }
      );
    }
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;


    // Body parsing
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Mensaje demasiado largo' }, { status: 413 });
    }

    const body = await req.json();
    const { message, history = [], action, titleOverride, categoryOverride } = body as {
      message: string;
      history?: ChatMessage[];
      action?: 'chat' | 'learn';
      titleOverride?: string;
      categoryOverride?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    // ─── 1. LEARN ACTION: Ingest Knowledge into Brain & Sync to Bot/Calls ───
    if (action === 'learn') {
      const trimmed = message.trim();
      const lines = trimmed.split('\n');

      let title = titleOverride || '';
      let content = trimmed;

      if (!title) {
        title = lines[0].replace(/^(aprende|learn|recuerda|memoriza|guarda|conocimiento)\s*:?\s*/i, '').trim();
        if (title.length > 90) {
          title = `${title.substring(0, 87)}…`;
        }
        if (lines.length > 1) {
          content = lines.slice(1).join('\n').trim();
        }
      }

      // Auto-detect category if not overridden
      const lower = trimmed.toLowerCase();
      let category: any = categoryOverride || 'general';

      if (!categoryOverride) {
        if (lower.includes('objecion') || lower.includes('objeción') || lower.includes('caro') || lower.includes('precio') || lower.includes('descuento')) {
          category = 'objections';
        } else if (lower.includes('script') || lower.includes('guion') || lower.includes('guión') || lower.includes('saludo') || lower.includes('mensaje')) {
          category = 'scripts';
        } else if (lower.includes('producto') || lower.includes('servicio') || lower.includes('paquete') || lower.includes('catalogo')) {
          category = 'product';
        } else if (lower.includes('proceso') || lower.includes('flujo') || lower.includes('politica') || lower.includes('horario')) {
          category = 'process';
        } else if (lower.includes('venta') || lower.includes('cierre') || lower.includes('conversion') || lower.includes('seguimiento')) {
          category = 'sales';
        } else if (lower.includes('pregunta') || lower.includes('faq') || lower.includes('duda')) {
          category = 'faq';
        } else if (lower.includes('competencia') || lower.includes('competidor') || lower.includes('rival')) {
          category = 'competitor';
        }
      }

      const savedItem = await saveTenantKnowledge(tenant.tenantId, {
        title: title || 'Regla de negocio',
        content: content || trimmed,
        category,
      });

      const categoryLabels: Record<string, string> = {
        objections: 'Manejo de Objeciones',
        sales: 'Estrategia de Ventas',
        scripts: 'Guiones y Scripts de Conversación',
        product: 'Información de Productos & Servicios',
        process: 'Políticas y Procesos de Atención',
        faq: 'Preguntas Frecuentes',
        competitor: 'Diferenciación frente a la Competencia',
        general: 'Conocimiento General del Negocio',
      };

      const humanCategory = categoryLabels[category] || 'General';

      return NextResponse.json({
        reply: `Entendido y memorizado al 100%. He asimilado esta nueva regla en la categoría **${humanCategory}**:

📌 **${savedItem.title}**
"${savedItem.content}"

⚡ **¿Cómo lo aplicaré a partir de ahora?**
1. **En WhatsApp:** Cuando los prospectos toquen este tema u objeten, la IA usará automáticamente este criterio para responder con alta persuasión y sin contradecirte.
2. **En Llamadas Telefónicas:** El agente de voz tendrá este punto de apoyo activo para rebatir objeciones en vivo y guiar la conversación al cierre.
3. **En el Cerebro:** Mis análisis y recomendaciones estratégicas ya toman en cuenta este conocimiento.

Puedes seguir inyectándome más información en cualquier momento. ¡Entre más me enseñes sobre tu negocio, más infalibles serán nuestras ventas!`,
        learned: true,
        item: savedItem,
      });
    }

    // ─── 2. CHAT ACTION: Natural Human Conversation with Groq / OpenAI ───
    const { apiKey, isGroq } = await getAICredentials(tenant.tenantId);

    if (!apiKey) {
      return NextResponse.json({
        reply: `Hola. Para que pueda responderte con todo mi potencial y conectar en vivo con el motor de IA, asegúrate de tener configurada tu clave de Groq o de OpenAI en el sistema. Mientras tanto, puedes usar el botón "+ Inyectar Conocimiento" para seguir entrenándome con las reglas de tu negocio.`,
        noAI: true,
      });
    }

    // Fetch live CRM context
    const crmContext = await fetchBrainContext(tenant.tenantId);

    const client = new OpenAI({
      apiKey,
      baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
      timeout: 35_000,
      maxRetries: 2,
    });

    const messagesForAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${BRAIN_SYSTEM_PROMPT}\n\n=== CONTEXTO OPERATIVO DEL NEGOCIO EN VIVO ===\n${crmContext}`,
      },
      ...history.slice(-8).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // Candidate models on Groq in priority order
    const groqCandidateModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
    let reply = '';

    if (isGroq) {
      let lastErr: any = null;
      for (const model of groqCandidateModels) {
        try {
          const completion = await client.chat.completions.create({
            model,
            messages: messagesForAI,
            temperature: 0.7,
            max_tokens: 1200,
          });
          const text = completion.choices?.[0]?.message?.content?.trim();
          if (text) {
            reply = text;
            break;
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`[brain-chat] Groq model ${model} failed:`, err?.message || err);
        }
      }

      if (!reply && lastErr) {
        throw lastErr;
      }
    } else {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messagesForAI,
        temperature: 0.7,
        max_tokens: 1200,
      });
      reply = completion.choices?.[0]?.message?.content?.trim() || '';
    }

    if (!reply) {
      reply = 'Analicé la información, pero ocurrió un breve retraso al sintetizar la respuesta. Por favor, pregúntame de nuevo o detalla qué aspecto específico te gustaría revisar.';
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[brain-chat] Fatal error:', error);
    return NextResponse.json(
      {
        reply: `Tuve una pequeña dificultad técnica al conectar con el motor de IA (${error.message || 'error temporal'}). Por favor inténtalo de nuevo en un instante.`,
        error: true,
      },
      { status: 500 },
    );
  }
}
