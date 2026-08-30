import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import { denyUnlessFeature } from '@/lib/feature-access';

interface KnowledgePromptEntry {
  file_name: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'playground');
    if (featureDenied) return featureDenied;
    const tenantId = tenant.tenantId;

    const tenantLimit = await checkRateLimit(rateLimitKey('test-ai', tenantId), 30, 60_000);
    if (tenantLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!tenantLimit.allowed) {
      return NextResponse.json(
        { error: 'Límite de pruebas alcanzado. Intenta de nuevo más tarde.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(tenantLimit.retryAfterMs / 1000)) } },
      );
    }

    const { 
      message, 
      history = [],
      botName = '',
      botRole = '',
      botTone = 'Profesional',
      temperature = 0.7,
      humanHandoff = true,
      profanityFilter = true,
      topicLocks = false,
      model = '',
    } = await req.json();

    if (typeof message !== 'string' || !message.trim() || message.length > 4_000) {
      return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 });
    }
    const safeMessage = message.trim();
    const safeHistory = (Array.isArray(history) ? history : [])
      .slice(-20)
      .filter((item): item is { role: string; content: string } => (
        item !== null
        && typeof item === 'object'
        && (item.role === 'user' || item.role === 'assistant')
        && typeof item.content === 'string'
      ))
      .map(item => ({ role: item.role, content: item.content.slice(0, 2_000) }));
    const safeBotName = typeof botName === 'string' ? botName.trim().slice(0, 80) : '';
    const safeBotRole = typeof botRole === 'string' ? botRole.trim().slice(0, 500) : '';
    const safeBotTone = typeof botTone === 'string' ? botTone.slice(0, 40) : 'Profesional';
    const requestedModel = typeof model === 'string' ? model.slice(0, 100) : '';

    const supabase = createSupabaseAdmin();

    // Obtener configuración (prompt y key) de la DB
    const { data: config } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    
    if (!config) {
      return NextResponse.json({ error: 'Configuración no encontrada. Por favor configure sus API keys primero.' }, { status: 404 });
    }
    
    // Decode AI key and extended config from JSON-encoded openai_key column
    let extConfig = {
      openai_key: '', gemini_key: '', groq_key: '', anthropic_key: '', model_selection: 'gpt-4o',
      dropi_enabled: false, dropi_token: '', dropi_default_product_id: '', dropi_default_price: 50,
      dropi_prompt: ''
    };
    try {
      const parsed = JSON.parse(config?.openai_key || '{}');
      extConfig = { ...extConfig, ...parsed };
    } catch {
      extConfig.openai_key = config?.openai_key || '';
    }

    // Select system prompt based on mode (Services vs Dropshipping)
    const basePrompt = extConfig.dropi_enabled 
      ? (extConfig.dropi_prompt || 'Eres un asesor de ventas amigable y experto en nuestro catálogo de productos.')
      : (config.ai_prompt || 'Eres un asesor de ventas amigable y profesional.');

    // Resolve model to use
    let selectedModel = requestedModel;
    if (!selectedModel) {
      selectedModel = extConfig.model_selection || 'gpt-4o';
    }

    let targetModel = selectedModel;
    if (targetModel === 'llama-3.3-70b') {
      targetModel = 'qwen/qwen3.8-27b';
    } else if (targetModel === 'mixtral-8x7b') {
      targetModel = 'llama-3.1-8b-instant'; // mixtral-8x7b-32768 deprecated, use llama fallback
    } else if (targetModel === 'llama-3.1-405b') {
      targetModel = 'qwen/qwen3.8-27b'; // 405b-reasoning no longer exists on Groq
    } else if (targetModel === 'llama-3.1-405b-reasoning') {
      targetModel = 'qwen/qwen3.8-27b'; // direct fix if stored as full name
    }

    let isGroq = targetModel.startsWith('llama') || targetModel.startsWith('mixtral') || targetModel === 'llama-3.1-8b-instant';
    let isGemini = targetModel.startsWith('gemini');
    let isAnthropic = targetModel.startsWith('claude');
    let isOpenAI = !isGroq && !isGemini && !isAnthropic;

    // Resolve API key based on provider
    let apiKey = '';
    if (isGroq) apiKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
    else if (isGemini) apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    else if (isAnthropic) apiKey = extConfig.anthropic_key || process.env.ANTHROPIC_API_KEY || '';
    else apiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

    if (!apiKey) {
      if (isGroq) apiKey = process.env.GROQ_API_KEY || '';
      else if (isGemini) apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      else if (isAnthropic) apiKey = process.env.ANTHROPIC_API_KEY || '';
      else apiKey = process.env.OPENAI_API_KEY || '';
    }

    if (!apiKey || apiKey.length < 10) {
      // Fallback: try Groq if available and we're not already trying Groq
      const groqFallbackKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
      if (!isGroq && groqFallbackKey && groqFallbackKey.length >= 10) {
        console.warn(`⚠️ test-ai: No API key for ${selectedModel} (${isOpenAI ? 'OpenAI' : isGemini ? 'Gemini' : 'Anthropic'}). Falling back to Groq (qwen/qwen3.8-27b).`);
        apiKey = groqFallbackKey;
        targetModel = 'qwen/qwen3.8-27b';
        // Update provider flags for downstream logic
        isGroq = true;
        isGemini = false;
        isAnthropic = false;
        isOpenAI = false;
      } else {
        console.error('test-ai provider credential unavailable');
        return NextResponse.json({ error: `No se encontró API key de IA para el proveedor de ${selectedModel}. Configúrala en Configuraciones.` }, { status: 500 });
      }
    }

    // === Build dynamic system prompt from playground settings ===
    const parts: string[] = [];

    // Base configured prompt
    parts.push(basePrompt);

    // Cargar Base de Conocimiento del tenant
    if (tenantId) {
      try {
        const activeEntries = await getKnowledgeDocuments(supabase, tenantId);
        
        if (activeEntries.length > 0) {
          let kbContext = '\n\n[BASE DE CONOCIMIENTO — Usa esta información para responder preguntas del cliente]:\n';
          let totalChars = 0;
          const maxKbChars = 30000;
          
          for (const entry of activeEntries) {
            if (totalChars + entry.content.length > maxKbChars) {
              const remaining = maxKbChars - totalChars;
              if (remaining > 200) {
                kbContext += `\n--- ${entry.file_name} ---\n${entry.content.substring(0, remaining)}...\n`;
              }
              break;
            }
            kbContext += `\n--- ${entry.file_name} ---\n${entry.content}\n`;
            totalChars += entry.content.length;
          }
          
          parts.push(kbContext);
          console.log(`📚 KB (Test AI): ${activeEntries.length} archivos activos inyectados (${totalChars} chars) para tenant ${tenantId}`);
        }
      } catch (kbErr) {
        console.log(`📚 KB (Test AI): Sin base de conocimiento para tenant ${tenantId} (${kbErr})`);
      }
    }

    // Identity & Tone
    if (safeBotName) {
      parts.push(`\nTu nombre es "${safeBotName}". Siempre preséntate con este nombre cuando sea apropiado.`);
    }
    if (safeBotRole) {
      parts.push(`Tu rol es: ${safeBotRole}.`);
    }
    
    // Tone mapping
    const toneInstructions: Record<string, string> = {
      'Profesional': 'Mantén un tono profesional, formal pero cercano. Usa usted cuando sea apropiado.',
      'Casual': 'Usa un tono casual y amigable. Tutea al usuario y usa emojis moderadamente. Sé conversacional.',
      'Técnico': 'Responde con precisión técnica. Usa terminología específica del sector. Sé detallado y exacto.',
      'Amigable': 'Sé muy cálido y empático. Usa emojis, sé entusiasta y haz que el cliente se sienta bienvenido.',
      'Formal': 'Mantén un tono estrictamente formal y corporativo. No uses emojis. Sé conciso y directo.',
    };
    if (safeBotTone && toneInstructions[safeBotTone]) {
      parts.push(`\n[TONO DE COMUNICACIÓN]: ${toneInstructions[safeBotTone]}`);
    }

    // Security & Protections
    if (profanityFilter) {
      parts.push('\n[FILTRO DE LENGUAJE]: Si el usuario usa lenguaje ofensivo o inapropiado, responde con cortesía y redirige la conversación. No repitas ni uses lenguaje ofensivo bajo ninguna circunstancia.');
    }
    if (topicLocks) {
      parts.push('\n[BLOQUEO DE TEMAS]: Solo responde sobre temas relacionados con los productos y servicios de la empresa. Si el usuario pregunta sobre temas no relacionados (política, religión, etc.), redirige amablemente al tema de negocio.');
    }
    if (humanHandoff) {
      parts.push('\n[ESCALAMIENTO HUMANO]: Si el usuario insiste en hablar con un humano real, después de intentar ayudar una vez, indica que un asesor se pondrá en contacto pronto.');
    }

    // Agente Dropi si está habilitado
    if (extConfig.dropi_enabled) {
      parts.push(`\n\n[AGENTE DE VENTAS Y DROPSHIPPING ACTIVADO - DROPI]:
Tu objetivo principal es actuar como un excelente asesor de ventas y conectar de forma amigable con el cliente:
1. **Interactúa y Vende primero**: No pidas los datos de envío de inmediato ni de forma "seca". Si el cliente muestra interés o hace preguntas, háblale con entusiasmo del producto, destaca sus beneficios principales, resuelve sus dudas de forma persuasiva e interactúa de manera natural para convencerlo.
2. **Confirma la intención de compra**: Solo cuando el cliente confirme explícitamente que desea adquirir el producto (por ejemplo: "Sí, lo quiero", "Quiero hacer el pedido", "Quiero comprarlo", "Apúntame uno"), procede a solicitar sus datos de envío de manera atenta.
3. **Solicita los datos de envío**: Para procesar el pedido, pídele de forma ordenada la siguiente información:
   - Nombre Completo
   - Teléfono de contacto
   - Dirección exacta de entrega (calle, número de casa/apto, referencias de ubicación)
   - Ciudad y Departamento
4. **Método de pago**: Explícale que el envío es **Contra Entrega** (paga en efectivo cuando reciba el producto en la puerta de su casa) para su total seguridad y tranquilidad.
5. **Crear la orden**: Una vez (y SOLO cuando) el cliente te haya proporcionado los 4 datos de envío completos (Nombre, Teléfono, Dirección, Ciudad), debes indicarle al cliente que estás procesando sus datos de envío en nuestro sistema logístico, y agregar este tag exacto al final de tu mensaje:
[CREAR_ORDEN_DROPI:nombre_cliente:telefono:direccion:ciudad:${extConfig.dropi_default_product_id || 'DEFAULT_PRODUCT'}:1:contra_entrega]
NUNCA le digas al cliente que el pedido ya fue "confirmado", "creado" o "generado con éxito" en tu propia respuesta. El sistema backend automáticamente procesará la orden e inyectará los detalles de confirmación (número de guía y transportadora) o informará de cualquier error de conexión. Reemplaza los campos nombre_cliente, telefono, direccion y ciudad con la información correspondiente. No dejes corchetes vacíos ni inventes datos de envío.`);
    }

    // Enforce greeting/signature rule: only introduce/present once.
    parts.push(`\n\n[REGLA CRÍTICA DE COMUNICACIÓN]:
- Únicamente debes presentarte como "especialista de RIFX" o decir "Soy especialista de RIFX" en tu primer saludo o inicio de la conversación.
- En todos los mensajes siguientes de la conversación, está estrictamente PROHIBIDO que repitas "Soy especialista de RIFX", "asistente de RIFX", o que te presentes de nuevo. Responde directamente a las dudas del cliente con naturalidad, empatía y profesionalismo sin repetir tu presentación.`);

    const systemPrompt = parts.join('\n');

    const chatMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...safeHistory,
      { role: 'user', content: safeMessage }
    ];

    // Use temperature from playground settings
    const safeTemp = Math.max(0, Math.min(2, Number(temperature) || 0.7));

    let aiContent = '';
    if (isGemini) {
      // Google Gemini via REST API
      const geminiMessages = chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.role === 'system' ? `[System Instructions]: ${m.content}` : m.content }],
      }));
      const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: geminiMessages, generationConfig: { maxOutputTokens: 500, temperature: safeTemp } }),
      });
      const gemData = await gemRes.json();
      aiContent = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (isAnthropic) {
      // Anthropic Claude via REST API
      const anthRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel === 'claude-sonnet-4' ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          temperature: safeTemp,
          system: systemPrompt,
          messages: safeHistory.map((h) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content
          })).concat([{ role: 'user', content: safeMessage }])
        })
      });
      const anthData = await anthRes.json();
      aiContent = anthData?.content?.[0]?.text || '';
    } else {
      // OpenAI / Groq (both use OpenAI SDK)
      const client = new OpenAI({
        apiKey,
        baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
      });
      const completion = await client.chat.completions.create({
        model: targetModel,
        messages: chatMessages,
        max_tokens: 500,
        temperature: safeTemp,
      });
      aiContent = completion.choices[0]?.message?.content || '';
    }
    
    // Intentar extraer el JSON del final
    let classification = { classification: "Indeciso", confidence: 0.5, next_action: "continue_chat" };
    let cleanResponse = aiContent;
    const jsonMatch = aiContent.match(/\{[\s\S]*"classification"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        classification = JSON.parse(jsonMatch[0]);
        cleanResponse = aiContent.replace(jsonMatch[0], '').trim();
      } catch (e) {
        console.error("Error parsing AI JSON:", e);
      }
    }

    // A playground/test endpoint must never create external orders. Treat the
    // model tag only as a preview of a proposed action.
    const dropiMatch = cleanResponse.match(/\[CREAR_ORDEN_DROPI:(.+?):(.+?):(.+?):(.+?):(.+?):(\d+):(.+?)\]/);
    if (dropiMatch) {
      cleanResponse = cleanResponse.replace(/\[CREAR_ORDEN_DROPI:.+?\]/, '').trim();
      classification.next_action = 'preview_order';
      cleanResponse += '\n\n🧪 Vista previa: el modelo propuso crear una orden. No se envió ninguna orden real desde el entorno de prueba.';
    }

    return NextResponse.json({ 
      response: cleanResponse,
      inference: classification
    });

  } catch (error: unknown) {
    console.error('Test AI failed:', error instanceof Error ? error.name : 'unknown_error');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
async function getKnowledgeDocuments(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  tenantId: string,
): Promise<KnowledgePromptEntry[]> {
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('file_name, content')
    .eq('tenant_id', tenantId)
    .eq('status', 'ready')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(100);
  if (error) throw new Error('knowledge_context_unavailable');
  return (data || []) as KnowledgePromptEntry[];
}
