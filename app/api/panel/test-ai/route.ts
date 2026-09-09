import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import { denyUnlessFeature } from '@/lib/feature-access';
import { formatForWhatsApp, sanitizeGreetings } from '@/lib/whatsapp-formatting';
import { getNowInTimezone, processAppointmentHandling } from '@/lib/calendar-booking';
import { getActiveKnowledgeContext } from '@/lib/knowledge-base';
import { deductAiCredits } from '@/lib/ai-credits';

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
      context = '',
      strictMode = false,
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

    // Obtener configuración (prompt y key) de la DB y platform_settings
    const { data: config } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    const { data: platformSettings } = await supabase
      .from('platform_settings')
      .select('global_ai_config')
      .limit(1)
      .maybeSingle();
    
    // Decode AI key and extended config from JSON-encoded openai_key column
    let extConfig: any = {
      openai_key: '', gemini_key: '', groq_key: '', anthropic_key: '', model_selection: 'gpt-4o',
      dropi_enabled: false, dropi_token: '', dropi_default_product_id: '', dropi_default_price: 50,
      dropi_prompt: '',
      business_days: [1, 2, 3, 4, 5],
      business_start_hour: '09:00',
      business_end_hour: '18:00'
    };
    if (config?.openai_key) {
      try {
        const parsed = JSON.parse(config.openai_key);
        extConfig = { ...extConfig, ...parsed };
      } catch {
        extConfig.openai_key = config.openai_key || '';
      }
    }

    // Select system prompt based on mode (Services vs Dropshipping)
    const basePrompt = extConfig.dropi_enabled 
      ? (extConfig.dropi_prompt || 'Eres un asesor de ventas amigable y experto en nuestro catálogo de productos.')
      : (config?.ai_prompt || 'Eres un asesor de ventas amigable, empático y profesional.');

    // Resolve model to use
    let selectedModel = requestedModel;
    if (!selectedModel) {
      selectedModel = extConfig.model_selection || 'gemini-2.5-flash';
    }

    let targetModel = selectedModel;
    if (
      targetModel === 'llama-3.3-70b' ||
      targetModel === 'llama-3.3-70b-versatile' ||
      targetModel === 'llama-3.1-8b-instant' ||
      targetModel === 'llama-3.1-405b' ||
      targetModel === 'llama-3.1-405b-reasoning' ||
      targetModel === 'mixtral-8x7b'
    ) {
      targetModel = 'qwen/qwen3.8-27b';
    } else if (
      targetModel === 'gemini-1.5-flash' ||
      targetModel === 'gemini-2.0-flash' ||
      targetModel === 'gemini-2.5-pro'
    ) {
      targetModel = 'gemini-2.5-flash';
    }

    let isGroq = targetModel.startsWith('qwen') || targetModel.startsWith('llama') || targetModel.startsWith('mixtral') || targetModel.startsWith('openai/gpt-oss');
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

    // Si no hay key del tenant, revisar la key global de la plataforma (platform_settings)
    const globalAi = (platformSettings as any)?.global_ai_config;
    if ((!apiKey || apiKey.length < 10) && globalAi?.enabled && globalAi?.apiKey) {
      apiKey = globalAi.apiKey;
      const gProvider = globalAi.provider || 'gemini';
      targetModel = globalAi.model || (gProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o');
      if (targetModel === 'gemini-1.5-flash' || targetModel === 'gemini-2.0-flash' || targetModel === 'gemini-2.5-pro') {
        targetModel = 'gemini-2.5-flash';
      }
      isGemini = gProvider === 'gemini' || targetModel.startsWith('gemini');
      isGroq = gProvider === 'groq' || targetModel.startsWith('qwen') || targetModel.startsWith('llama');
      isAnthropic = gProvider === 'anthropic';
      isOpenAI = !isGemini && !isGroq && !isAnthropic;
    }

    if (!apiKey || apiKey.length < 10) {
      // Fallback: try Groq if available and we're not already trying Groq
      const groqFallbackKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
      if (!isGroq && groqFallbackKey && groqFallbackKey.length >= 10) {
        console.warn(`⚠️ test-ai: No API key for ${selectedModel}. Falling back to Groq (qwen/qwen3.8-27b).`);
        apiKey = groqFallbackKey;
        targetModel = 'qwen/qwen3.8-27b';
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

    // Instrucciones específicas del nodo de flujo o catálogo si fue provisto
    if (typeof context === 'string' && context.trim()) {
      parts.push(`\n\n--- MEMORIA / CATÁLOGO DEL NEGOCIO / INSTRUCCIONES DEL NODO ---\n${context.trim()}\n----------------------------------------------------\n`);
    }

    if (strictMode === true || strictMode === 'yes') {
      parts.push('\n[MODO ESTRICTO ACTIVADO]: Basa tus respuestas ÚNICAMENTE en la memoria, catálogo o reglas provistas. Si el cliente pregunta sobre un producto, precio o servicio no especificado, responde amablemente que no dispones de esa información.');
    }

    // Cargar Base de Conocimiento del tenant
    if (tenantId) {
      try {
        const kbContext = await getActiveKnowledgeContext(supabase, tenantId);
        if (kbContext) {
          parts.push(`\n\n${kbContext}`);
          console.log(`📚 KB (Test AI): Base de conocimiento inyectada para tenant ${tenantId}`);
        }
      } catch (kbErr) {
        console.log(`📚 KB (Test AI): Sin base de conocimiento para tenant ${tenantId} (${kbErr})`);
      }
    }

    // Identity & Tone (use request params or fallback to tenant saved settings)
    const effectiveBotName = safeBotName || extConfig.bot_name || '';
    const effectiveBotRole = safeBotRole || extConfig.bot_role || '';
    const effectiveBotTone = safeBotTone || extConfig.bot_tone || 'Profesional';

    if (effectiveBotName) {
      parts.push(`\nTu nombre es "${effectiveBotName}". Siempre preséntate con este nombre cuando sea apropiado.`);
    }
    if (effectiveBotRole) {
      parts.push(`Tu rol es: ${effectiveBotRole}.`);
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
    } else {
      const nowInfo = getNowInTimezone();
      const bDays = extConfig.business_days || [1, 2, 3, 4, 5];
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const configuredDaysStr = bDays.map((d: number) => dayNames[d]).join(', ');
      const scheduleString = `${configuredDaysStr}, de ${extConfig.business_start_hour || '09:00'} a ${extConfig.business_end_hour || '18:00'}`;

      parts.push(`\n\n[SISTEMA DE AGENDAMIENTO Y CALENDARIO]:
Tienes acceso directo al calendario para verificar disponibilidad y agendar reuniones con clientes.
Hoy es ${nowInfo.dayName} ${nowInfo.dateStr} (hora local).
Horario de atención permitido: ${scheduleString}.

REGLAS DE AGENDAMIENTO:
1. Si el cliente pregunta por disponibilidad o pide una cita para un día específico (sin hora), o pide horarios disponibles, usa el tag:
   [VERIFICAR_DISPONIBILIDAD:YYYY-MM-DD]
   El sistema responderá con los horarios libres de ese día.
2. Si el cliente pide un día fuera del horario (${configuredDaysStr}), infórmale amablemente que no hay atención ese día y sugiere los días disponibles.
3. Si el cliente indica o confirma un día y una hora (por ejemplo: "hoy a las 3 de la tarde", "mañana a las 10 am", "el jueves a las 4 pm"), debes verificar o incluir inmediatamente el tag para guardar la cita:
   [AGENDAR_CITA:Cliente:${tenantId}:YYYY-MM-DD:HH:MM:Asesoría]
   Ejemplo: si hoy es ${nowInfo.dateStr} y pide a las 3 de la tarde (15:00):
   [AGENDAR_CITA:Cliente:${tenantId}:${nowInfo.dateStr}:15:00:Asesoría]
   El backend interceptará este tag, verificará la disponibilidad y guardará la cita directamente en el calendario.
4. NUNCA inventes enlaces de reunión estáticos ni confirmes citas sin emitir el tag [AGENDAR_CITA:...].`);
    }

    // Enforce WhatsApp formatting & greeting rules
    const isOngoingConversation = safeHistory.length > 0;
    parts.push(`\n\n[REGLAS CRÍTICAS DE COMUNICACIÓN Y FORMATO WHATSAPP]:
- FORMATO DE NEGRITAS EN WHATSAPP: En WhatsApp las negritas se activan ÚNICAMENTE con un solo asterisco: *palabra*. Está terminantemente PROHIBIDO usar doble asterisco (**palabra**), ya que en WhatsApp los dos asteriscos se ven duplicados como texto literal y rompen el formato. Usa SIEMPRE un único asterisco: *palabra*.
- REGLA DE SALUDOS:${isOngoingConversation ? `
  * La conversación con el cliente YA ESTÁ EN CURSO. Está ESTRICTAMENTE PROHIBIDO volver a saludar (NUNCA digas "Hola", "¡Hola!", "Buenas", "Qué tal", "Un gusto saludarte", etc.). Ve DIRECTO al grano y responde la duda o necesidad del cliente de forma natural sin saludar.` : `
  * Saluda UNA SOLA VEZ de forma breve y cordial al inicio. NUNCA des dos saludos en el mismo mensaje.`}
- Únicamente debes presentarte como especialista o asesor en tu primer saludo si es necesario. En todos los mensajes siguientes, está estrictamente PROHIBIDO que repitas tu presentación.
- IMPORTANTE: Responde de manera 100% natural, humana y profesional, como un mensaje de WhatsApp normal. NUNCA uses prefijos robóticos como "[IA Premium]:", "[Bot]:", "🤖", ni etiquetas entre corchetes.`);

    const systemPrompt = parts.join('\n');

    // Filter out if the last history message is already this identical user message
    const sanitizedHistory = safeHistory.filter((m, idx) => {
      if (idx === safeHistory.length - 1 && m.role === 'user' && m.content.trim() === safeMessage) {
        return false;
      }
      return true;
    });

    const chatMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
      { role: 'user', content: safeMessage }
    ];

    // Use temperature from playground settings or saved configuration
    const effectiveTemp = typeof temperature === 'number' ? temperature : (typeof extConfig.bot_temperature === 'number' ? extConfig.bot_temperature : 0.7);
    const safeTemp = Math.max(0, Math.min(2, effectiveTemp));

    const runGemini = async (key: string, mName: string) => {
      const modelName = mName === 'gemini-1.5-flash' || mName === 'gemini-2.0-flash' || mName === 'gemini-2.5-pro' || !mName ? 'gemini-2.5-flash' : mName;
      try {
        const geminiContents = safeHistory.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        geminiContents.push({ role: 'user', parts: [{ text: safeMessage }] });
        if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
          geminiContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiContents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { maxOutputTokens: 500, temperature: safeTemp }
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          console.warn(`[test-ai] Gemini error status ${res.status} for model: ${modelName}`);
          return '';
        }
        const d = await res.json();
        return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err) {
        console.warn('[test-ai] Error en Gemini:', err);
        return '';
      }
    };

    const runGroq = async (key: string, mName: string = 'qwen/qwen3.8-27b') => {
      const modelName = mName.startsWith('qwen') || mName.startsWith('openai/gpt-oss') ? mName : 'qwen/qwen3.8-27b';
      try {
        const client = new OpenAI({
          apiKey: key,
          baseURL: 'https://api.groq.com/openai/v1',
          timeout: 10000,
        });
        const completion = await client.chat.completions.create({
          model: modelName,
          messages: chatMessages,
          max_tokens: 500,
          temperature: safeTemp,
        });
        return completion.choices[0]?.message?.content || '';
      } catch (err) {
        console.warn('[test-ai] Error en Groq:', err);
        return '';
      }
    };

    const runOpenAI = async (key: string, mName: string = 'gpt-4o-mini') => {
      try {
        const client = new OpenAI({
          apiKey: key,
          timeout: 12000,
        });
        const completion = await client.chat.completions.create({
          model: mName,
          messages: chatMessages,
          max_tokens: 500,
          temperature: safeTemp,
        });
        return completion.choices[0]?.message?.content || '';
      } catch (err) {
        console.warn('[test-ai] Error en OpenAI:', err);
        return '';
      }
    };

    const runAnthropic = async (key: string, mName: string) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const anthRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: mName === 'claude-sonnet-4' ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022',
            max_tokens: 500,
            temperature: safeTemp,
            system: systemPrompt,
            messages: safeHistory.map((h) => ({
              role: h.role === 'assistant' ? 'assistant' : 'user',
              content: h.content
            })).concat([{ role: 'user', content: safeMessage }])
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!anthRes.ok) return '';
        const anthData = await anthRes.json();
        return anthData?.content?.[0]?.text || '';
      } catch (err) {
        console.warn('[test-ai] Error en Anthropic:', err);
        return '';
      }
    };

    let aiContent = '';
    if (isGemini) {
      aiContent = await runGemini(apiKey, targetModel);
    } else if (isAnthropic) {
      aiContent = await runAnthropic(apiKey, targetModel);
    } else if (isGroq) {
      aiContent = await runGroq(apiKey, targetModel);
    } else {
      aiContent = await runOpenAI(apiKey, targetModel);
    }

    // Fallbacks inteligentes si el proveedor primario falló o devolvió vacío
    if (!aiContent) {
      const groqKey = extConfig.groq_key || process.env.GROQ_API_KEY;
      if (groqKey && (!isGroq || apiKey !== groqKey)) {
        console.log('[test-ai] Fallback primario: probando Groq (qwen/qwen3.8-27b)...');
        aiContent = await runGroq(groqKey, 'qwen/qwen3.8-27b');
      }
    }

    if (!aiContent && globalAi?.apiKey) {
      console.log('[test-ai] Fallback secundario: probando global_ai_config...');
      if (globalAi.provider === 'gemini' || (globalAi.model && globalAi.model.startsWith('gemini'))) {
        aiContent = await runGemini(globalAi.apiKey, 'gemini-2.5-flash');
      } else {
        aiContent = await runOpenAI(globalAi.apiKey, globalAi.model || 'gpt-4o-mini');
      }
    }

    if (!aiContent && extConfig.gemini_key && !isGemini) {
      console.log('[test-ai] Fallback terciario: probando Gemini...');
      aiContent = await runGemini(extConfig.gemini_key, 'gemini-2.5-flash');
    }

    if (!aiContent && extConfig.openai_key && !isOpenAI) {
      console.log('[test-ai] Fallback final: probando OpenAI...');
      aiContent = await runOpenAI(extConfig.openai_key, 'gpt-4o-mini');
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

    // Persistir o sincronizar conversación del simulador en DB para que el Analista IA tenga todo el historial
    let simulatorConvId: string | null = null;
    try {
      let { data: existingSimConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone_number', 'simulador')
        .limit(1)
        .maybeSingle();

      if (!existingSimConv) {
        const { data: newSimConv } = await supabase
          .from('conversations')
          .insert({
            tenant_id: tenantId,
            customer_name: 'Cliente (Simulador)',
            phone_number: 'simulador',
            status: 'chatting'
          })
          .select('id')
          .single();
        existingSimConv = newSimConv;
      }

      if (existingSimConv?.id) {
        simulatorConvId = existingSimConv.id;
        // Guardar mensaje del usuario y respuesta del bot en messages
        await supabase.from('messages').insert([
          {
            conversation_id: simulatorConvId,
            tenant_id: tenantId,
            role: 'user',
            content: safeMessage
          },
          {
            conversation_id: simulatorConvId,
            tenant_id: tenantId,
            role: 'assistant',
            content: cleanResponse
          }
        ]);
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', simulatorConvId);
      }
    } catch (simErr) {
      console.warn('[test-ai] No se pudo sincronizar chat de simulador:', simErr);
    }

    // Procesar verificación de disponibilidad y agendamiento de citas en el calendario
    if (!extConfig.dropi_enabled) {
      const fullHistory = [
        ...safeHistory,
        { role: 'user', content: safeMessage },
        { role: 'assistant', content: cleanResponse }
      ];
      cleanResponse = await processAppointmentHandling({
        rawResponse: cleanResponse,
        userMessage: safeMessage,
        tenantId,
        customerName: 'Cliente (Simulador)',
        conversationId: simulatorConvId,
        extConfig,
        history: fullHistory
      });
    }

    // Formatear negritas para WhatsApp (*palabra* en lugar de **palabra**)
    cleanResponse = formatForWhatsApp(cleanResponse);

    // Sanitizar saludos repetidos o duplicados
    cleanResponse = sanitizeGreetings(cleanResponse, isOngoingConversation);

    // Deduct 1 credit for test query
    const deductRes = await deductAiCredits(supabase, tenantId, 1, 'Consulta de prueba Playground');

    return NextResponse.json({ 
      response: cleanResponse,
      inference: classification,
      balance: deductRes.newBalance,
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
