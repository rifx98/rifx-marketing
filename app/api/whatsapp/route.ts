import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';
import { checkAvailability, createCalendarEvent, getCalendarCredentials, deleteCalendarEvent } from '@/lib/google-calendar';
import { classifyIntent } from '@/lib/intent-router';
import { detectSignalsFromMessage, calculateLeadScore, inferSalesStage, extractSalesMetadata } from '@/lib/lead-scoring';
import { getSalesStageInstructions, DEFAULT_SALES_PROMPT, DEFAULT_SUPPORT_PROMPT } from '@/lib/sales-prompts';
import { loadTenantPricing, buildPricingPrompt, validatePricingInResponse } from '@/lib/pricing-guard';

// ============================================
// WHATSAPP WEBHOOK — El corazón del bot de IA
// ============================================

// GET: Verificación del webhook (Meta lo llama al registrar)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado correctamente');
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Token inválido' }, { status: 403 });
}

// POST: Recibir mensajes de WhatsApp
export async function POST(req: NextRequest) {
  try {
    // VULN-12 fix: Verify Meta HMAC signature
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (process.env.NODE_ENV === 'production' && !appSecret) {
      console.error('❌ WhatsApp webhook: FACEBOOK_APP_SECRET is missing in production!');
      return NextResponse.json({ error: 'Configuration error: webhook signature verification key is missing' }, { status: 500 });
    }

    if (appSecret) {
      if (!signature) {
        console.warn('⚠️ WhatsApp webhook: Missing X-Hub-Signature-256 header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      const crypto = await import('crypto');
      const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature !== expectedSig) {
        console.error('❌ WhatsApp webhook: Invalid HMAC signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('⚠️ FACEBOOK_APP_SECRET not set — skipping webhook signature verification (non-production only)');
    }

    const body = JSON.parse(rawBody);

    // Extraer el mensaje del payload de Meta
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageData = value?.messages?.[0];

    // Ignorar si no es texto ni audio
    if (!messageData || (messageData.type !== 'text' && messageData.type !== 'audio')) {
      return NextResponse.json({ status: 'ignored' });
    }

    const customerPhone = messageData.from; // ej: "593984111222"
    const customerName = value?.contacts?.[0]?.profile?.name || 'Cliente';
    // Extract the WhatsApp Phone Number ID from Meta's webhook payload
    const webhookPhoneId = value?.metadata?.phone_number_id || '';

    const supabase = createSupabaseAdmin();

    // 0. Resolve tenant config using the webhook phone_number_id
    //    This ensures we always load the correct tenant's config in multi-tenant setups
    let config: Record<string, any> | null = null;
    let tenantId: string | null = null;

    // Strategy 1: Match by whatsapp_phone_id from the webhook
    if (webhookPhoneId) {
      const { data: matchedConfig } = await supabase
        .from('config')
        .select('*')
        .eq('whatsapp_phone_id', webhookPhoneId)
        .limit(1)
        .single();
      if (matchedConfig) {
        config = matchedConfig;
        tenantId = matchedConfig.tenant_id || null;
        console.log(`✅ Config encontrada por phone_id ${webhookPhoneId} → tenant: ${tenantId}`);
      }
    }

    // Strategy 2: If the customer already has a conversation, use its tenant_id
    if (!config) {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('tenant_id')
        .eq('phone_number', customerPhone)
        .single();
      if (existingConv?.tenant_id) {
        const { data: tenantConfig } = await supabase
          .from('config')
          .select('*')
          .eq('tenant_id', existingConv.tenant_id)
          .limit(1)
          .single();
        if (tenantConfig) {
          config = tenantConfig;
          tenantId = tenantConfig.tenant_id || null;
          console.log(`✅ Config encontrada por tenant de conversación existente → tenant: ${tenantId}`);
        }
      }
    }

    // Strategy 3: Fallback — pick the first config that has whatsapp_token set
    if (!config) {
      const { data: fallbackConfig } = await supabase
        .from('config')
        .select('*')
        .not('whatsapp_token', 'is', null)
        .not('whatsapp_token', 'eq', '')
        .limit(1)
        .single();
      if (fallbackConfig) {
        config = fallbackConfig;
        tenantId = fallbackConfig.tenant_id || null;
        console.log(`⚠️ Config fallback (primera con token): tenant: ${tenantId}`);
      }
    }

    // Strategy 4: Absolute fallback — first row
    if (!config) {
      const { data: anyConfig } = await supabase
        .from('config')
        .select('*')
        .limit(1)
        .single();
      config = anyConfig;
      tenantId = anyConfig?.tenant_id || null;
      console.log(`⚠️ Config absolute fallback → tenant: ${tenantId}`);
    }

    console.log(`🏢 Tenant resuelto: ${tenantId || '(ninguno)'} | Config ID: ${config?.id || '(ninguna)'}`);

    // Extraer o transcribir el mensaje del cliente
    let customerMessage = '';
    const isAudio = messageData.type === 'audio';

    if (messageData.type === 'text') {
      customerMessage = messageData.text.body;
    } else if (isAudio) {
      console.log(`🎙️ Audio detectado de ${customerName} (${customerPhone}). Transcribiendo...`);
      let extConfig = { openai_key: '', gemini_key: '', groq_key: '' };
      try { 
        const p = JSON.parse(config?.openai_key || '{}');
        extConfig = { ...extConfig, ...p };
      } catch { 
        extConfig.openai_key = config?.openai_key || '';
      }

      let token = config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
      if (token && token.length < 20) token = process.env.WHATSAPP_TOKEN;

      const openAiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';
      const groqKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';

      if (!token) {
        console.error('❌ No se puede transcribir audio: whatsapp_token no configurado');
        customerMessage = '(Mensaje de audio enviado pero no se pudo descargar por falta de token de WhatsApp)';
      } else {
        const audioId = messageData.audio.id;
        const text = await transcribeWhatsAppAudio(audioId, token, openAiKey, groqKey);
        if (text) {
          customerMessage = text;
          console.log(`🎙️ Audio transcribido de ${customerPhone}: "${customerMessage}"`);
        } else {
          customerMessage = '(Mensaje de audio enviado pero falló la transcripción)';
        }
      }
    }

    console.log(`📩 Mensaje de ${customerName} (${customerPhone}): ${customerMessage}`);
    console.log(`📞 Webhook phone_number_id: ${webhookPhoneId}`);

    // 1. Buscar o crear conversación (filtrar por tenant_id para aislamiento multi-tenant)
    let conversationQuery = supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', customerPhone);
    if (tenantId) {
      conversationQuery = conversationQuery.eq('tenant_id', tenantId);
    }
    let { data: conversation } = await conversationQuery.single();

    if (!conversation) {
      const insertData: any = { phone_number: customerPhone, customer_name: customerName, status: 'chatting' };
      if (tenantId) insertData.tenant_id = tenantId;
      const { data: newConv } = await supabase
        .from('conversations')
        .insert(insertData)
        .select()
        .single();
      conversation = newConv;
      console.log(`📝 Nueva conversación creada para ${customerName} (${customerPhone}) con tenant: ${tenantId || '(sin tenant)'}`);
    } else {
      // Actualizar nombre, timestamp, y asignar tenant_id si falta
      const updateData: any = { customer_name: customerName, updated_at: new Date().toISOString() };
      if (tenantId && !conversation.tenant_id) {
        updateData.tenant_id = tenantId;
        console.log(`🔧 Asignando tenant_id a conversación existente de ${customerName}`);
      }
      await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversation.id);
    }

    if (!conversation) {
      console.error('❌ No se pudo crear/encontrar conversación');
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    // 2. Guardar mensaje del cliente
    const dbContent = isAudio ? `🎙️ [Audio]: ${customerMessage}` : customerMessage;

    // Evitar procesamiento duplicado por reintentos de webhook de Meta (Meta reintenta si tardamos > 5s)
    if (dbContent) {
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversation.id)
        .eq('role', 'user')
        .eq('content', dbContent)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentMessages && recentMessages.length > 0) {
        const timeDiff = Date.now() - new Date(recentMessages[0].created_at).getTime();
        if (timeDiff < 20000) { // 20 segundos
          console.log(`⚠️ [WEBHOOK DUPLICATE] Ignorando mensaje duplicado de ${customerPhone} (recibido hace ${timeDiff}ms)`);
          return NextResponse.json({ status: 'duplicate_ignored' });
        }
      }
    }

    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content: dbContent,
    });

    // 2.5 Verificar si la conversación está en MODO HUMANO (señal en mensajes)
    const { data: signalMessages } = await supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', conversation.id)
      .in('content', ['__SYSTEM_PAUSE__', '__SYSTEM_RESUME__'])
      .order('created_at', { ascending: false })
      .limit(1);

    const isHumanMode = signalMessages && signalMessages.length > 0 && signalMessages[0].content === '__SYSTEM_PAUSE__';
    console.log(`🔎 Modo humano para ${customerPhone}: ${isHumanMode ? 'PAUSADO ⏸️' : 'IA ACTIVA ▶️'}`);

    if (isHumanMode) {
      console.log(`⏸️ [MODO HUMANO] — Mensaje de ${customerPhone} guardado. La IA NO responderá.`);
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation.id);
      return NextResponse.json({ status: 'paused_human_mode' });
    }

    // 2.6 Detectar intención de compra → mover a "interested" automáticamente
    const realStatus = conversation.status.replace('paused_', '');
    if (realStatus === 'chatting') {
      const msgLower = customerMessage.toLowerCase();
      const buyIntentKeywords = [
        'pagar', 'precio', 'cuánto cuesta', 'cuanto cuesta', 'cuánto vale', 'cuanto vale',
        'contratar', 'comprar', 'adquirir', 'link de pago', 'forma de pago',
        'método de pago', 'metodo de pago', 'quiero el servicio', 'me interesa',
        'cómo pago', 'como pago', 'dónde pago', 'donde pago', 'quiero pagar',
        'cotización', 'cotizacion', 'presupuesto', 'invertir', 'inversión', 'inversion',
        'quiero empezar', 'hagámoslo', 'hagamoslo', 'acepto', 'dale', 'va', 'sí quiero',
        'si quiero', 'lo quiero', 'lo necesito', 'cuánto cobran', 'cuanto cobran',
      ];

      const hasIntent = buyIntentKeywords.some(kw => msgLower.includes(kw));
      if (hasIntent) {
        await supabase
          .from('conversations')
          .update({ status: 'interested', updated_at: new Date().toISOString() })
          .eq('id', conversation.id);
        console.log(`⚡ ${customerName} movido a INTERESADO (keyword detectada en: "${customerMessage.substring(0, 50)}")`);
      }
    }

    // 2.7 Detectar solicitud de hablar con un humano (sistema de 3 intentos)
    const msgLowerHuman = customerMessage.toLowerCase();
    const humanRequestKeywords = [
      'hablar con un humano', 'hablar con una persona', 'hablar con alguien',
      'quiero hablar con un humano', 'quiero un humano', 'persona real',
      'agente real', 'agente humano', 'operador', 'asesor real',
      'no quiero hablar con un bot', 'no quiero un bot', 'no eres real',
      'eres un robot', 'eres un bot', 'quiero hablar con un asesor',
      'necesito hablar con alguien', 'comunícame con alguien', 'comunicame con alguien',
      'pásame con un humano', 'pasame con un humano', 'con una persona',
      'quiero atención humana', 'quiero atencion humana', 'representante',
    ];

    const wantsHuman = humanRequestKeywords.some(kw => msgLowerHuman.includes(kw));
    let humanAskCount = 0;
    let forceHumanEscalation = false;

    if (wantsHuman) {
      // Contar cuántas veces ha pedido hablar con humano
      const { data: prevAsks } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', conversation.id)
        .in('content', ['__HUMAN_ASK__', '__HUMAN_REQUEST__']);

      humanAskCount = (prevAsks || []).length;

      if (humanAskCount < 2) {
        // 1ra o 2da vez: registrar intento, la IA insistirá que puede ayudar
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          role: 'assistant',
          content: '__HUMAN_ASK__',
        });
        console.log(`💬 ${customerName} pidió humano (intento ${humanAskCount + 1}/3) — IA insistirá`);
      } else {
        // 3ra+ vez: escalar a humano real, insertar alerta para el panel
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          role: 'assistant',
          content: '__HUMAN_REQUEST__',
        });
        forceHumanEscalation = true;
        console.log(`🚨 ${customerName} (${customerPhone}) pidió humano 3+ veces — ALERTA ACTIVADA`);
      }
    }

    // 2.8 🆕 Intent Router — Clasificar intención del mensaje
    const quickAiKey = (() => {
      try {
        const p = JSON.parse(config?.openai_key || '{}');
        return p.groq_key || process.env.GROQ_API_KEY || '';
      } catch { return process.env.GROQ_API_KEY || ''; }
    })();
    const isDropiEnabledForIntent = (() => {
      try {
        const p = JSON.parse(config?.openai_key || '{}');
        return !!p.dropi_enabled;
      } catch { return false; }
    })();
    const intentResult = await classifyIntent(customerMessage, isDropiEnabledForIntent, quickAiKey);
    console.log(`🎯 Intent: ${intentResult.intent} (${intentResult.confidence.toFixed(2)}, ${intentResult.method})`);

    // 2.9 🆕 Lead Scoring — Detectar señales y calcular score
    const currentSignals = {
      hasBusinessIdentified: !!conversation.business_type,
      hasClearProblem: (conversation.lead_score || 0) >= 15,
      hasUrgency: conversation.urgency_level === 'high' || conversation.urgency_level === 'alta',
      hasBudget: !!conversation.budget_range,
      askedForPrice: false,
      requestedCall: intentResult.intent === 'appointment',
      acceptedProposal: false,
      gaveContactData: false,
      messageCount: 0,
    };
    const updatedSignals = detectSignalsFromMessage(customerMessage, currentSignals);
    const newLeadScore = calculateLeadScore(updatedSignals);
    const newSalesStage = inferSalesStage(
      conversation.sales_stage || 'new_lead',
      newLeadScore,
      intentResult.intent,
      updatedSignals.acceptedProposal
    );

    // 3. Cargar historial de mensajes (últimos 10, sin mensajes de error)
    const { data: rawHistory } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(15);

    // Filtrar mensajes de error/fallback que contaminan el contexto
    const errorPatterns = [
      'Lo siento, no pude procesar',
      'Disculpa, estoy procesando mucha información',
      'Estamos experimentando dificultades técnicas',
    ];
    const cleanHistory = (rawHistory || [])
      .reverse() // volver a orden cronológico
      .filter((m: { content: string }) => 
        !errorPatterns.some(p => m.content.includes(p)) &&
        m.content !== '__SYSTEM_PAUSE__' && 
        m.content !== '__SYSTEM_RESUME__' &&
        m.content !== '__HUMAN_REQUEST__' &&
        m.content !== '__HUMAN_ASK__'
      );

    // Limitar a los últimos 10 mensajes limpios para no exceder el contexto
    const history = cleanHistory.slice(-10);

    // 4. Decode extended config for AI keys + model settings first
    let extConfig = {
      openai_key: '', gemini_key: '', groq_key: '',
      model_selection: 'gpt-4o', confidence_threshold: 0.85,
      dropi_enabled: false, dropi_token: '',
      dropi_default_product_id: '', dropi_default_price: 50,
      dropi_prompt: ''
    };
    try { 
      const p = JSON.parse(config?.openai_key || '{}');
      extConfig = { ...extConfig, ...p };
    } catch { 
      extConfig.openai_key = config?.openai_key || '';
    }

    // 4.1 Select system prompt based on mode (Services vs Dropshipping)
    let aiPrompt = '';
    if (extConfig.dropi_enabled) {
      aiPrompt = extConfig.dropi_prompt || 'Eres un asesor de ventas amigable y experto en nuestro catálogo de productos.';
    } else {
      aiPrompt = config?.ai_prompt || 'Eres un asesor de ventas amigable y profesional.';
    }

    // 4.15 🆕 Sales Agent — Seleccionar prompt según intent y etapa de venta
    const extSalesPrompt = (extConfig as any).sales_prompt || '';
    const extSupportPrompt = (extConfig as any).support_prompt || '';
    if (intentResult.intent === 'sales_services' || intentResult.intent === 'sales_dropshipping') {
      if (extSalesPrompt) aiPrompt = extSalesPrompt;
      else if (!extConfig.dropi_enabled) aiPrompt = aiPrompt || DEFAULT_SALES_PROMPT;
      const stageInstructions = getSalesStageInstructions({
        salesStage: newSalesStage,
        leadScore: newLeadScore,
        lastObjection: conversation.last_objection,
        nextAction: conversation.next_action,
        businessType: conversation.business_type,
        serviceInterest: conversation.service_interest,
        urgencyLevel: conversation.urgency_level,
        budgetRange: conversation.budget_range,
      });
      aiPrompt += '\n\n' + stageInstructions;
    } else if (intentResult.intent === 'support') {
      aiPrompt = extSupportPrompt || DEFAULT_SUPPORT_PROMPT;
    }

    // 4.2 Cargar Base de Conocimiento del tenant
    if (tenantId) {
      try {
        const kbIndexPath = `${tenantId}/index.json`;
        const { data: kbData } = await supabase.storage
          .from('knowledge-base')
          .download(kbIndexPath);
        
        if (kbData) {
          const kbText = await kbData.text();
          const kbEntries = JSON.parse(kbText);
          const activeEntries = kbEntries.filter((e: any) => e.active && e.content);
          
          if (activeEntries.length > 0) {
            // Build knowledge context (limit total to ~30K chars to avoid token overflow)
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
            
            aiPrompt += kbContext;
            console.log(`📚 KB: ${activeEntries.length} archivos activos inyectados (${totalChars} chars) para tenant ${tenantId}`);
          }
        }
      } catch (kbErr) {
        console.log(`📚 KB: Sin base de conocimiento para tenant ${tenantId} (${kbErr})`);
      }
    }

    // 4.25 🆕 Pricing Guard — Cargar lista oficial de precios del tenant (solo modo servicios)
    let tenantPricing: any[] = [];
    if (tenantId && !(extConfig.dropi_enabled && intentResult.intent === 'sales_dropshipping')) {
      tenantPricing = await loadTenantPricing(supabase, tenantId);
      const pricingPrompt = buildPricingPrompt(tenantPricing);
      aiPrompt += pricingPrompt;
      console.log(`💰 Pricing: ${tenantPricing.length} servicios cargados para tenant ${tenantId}`);
    }

    if (extConfig.dropi_enabled) {
      aiPrompt += `\n\n[AGENTE DE VENTAS Y DROPSHIPPING ACTIVADO - DROPI]:
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
NUNCA le digas al cliente que el pedido ya fue "confirmado", "creado" o "generado con éxito" en tu propia respuesta. El sistema backend automáticamente procesará la orden e inyectará los detalles de confirmación (número de guía y transportadora) o informará de cualquier error de conexión. Reemplaza los campos nombre_cliente, telefono, direccion y ciudad con la información correspondiente. No dejes corchetes vacíos ni inventes datos de envío.`;
    }

    // 4.3 Inyectar instrucciones de agendamiento de Google Calendar (solo en modo servicios)
    let isCalendarConnected = false;
    if (!extConfig.dropi_enabled && tenantId) {
      const calendarCreds = await getCalendarCredentials(tenantId);
      if (calendarCreds) {
        isCalendarConnected = true;

        // Reemplazar la regla del enlace estático por una regla de agendamiento dinámico interactivo en el prompt base
        aiPrompt = aiPrompt.replace(
          /REGLA DEL ENLACE \(CRÍTICO\): NO pongas el enlace de reunión en todos tus mensajes\. Es molesto\. Úsalo ÚNICAMENTE al final de tu mensaje cuando le propongas tener una llamada DESPUÉS de haberle aportado valor, o si el cliente lo pide expresamente\./gi,
          `REGLA DE AGENDAMIENTO (CRÍTICO): NO intentes enviar enlaces de reunión estáticos ni confirmes citas directamente. Debes preguntar la fecha y hora preferida del cliente y usar el sistema de agendamiento dinámico.`
        );

        aiPrompt = aiPrompt.replace(
          /Después de explicar un beneficio, da un Call To Action \(CTA\) directivo: "Para aterrizar esto a tu negocio, elige un horario aquí 👇: \[PON TU LINK DE REUNIÓN AQUÍ\]" o "Si estás listo para empezar, el pago se hace aquí 💳: \[PON TU LINK DE PAGO AQUÍ\]"\./gi,
          `Después de explicar un beneficio y responder todas las dudas del cliente, si el cliente muestra interés puedes sugerirle amablemente agendar una llamada para profundizar — pero NUNCA saltes a ofrecer horarios si el cliente está haciendo preguntas sobre el servicio. Primero responde sus preguntas.`
        );

        // Sanitizar cualquier otro enlace estático del prompt base que conflictuaría con el calendario dinámico
        const staticLinkPatterns = [
          /\[PON TU LINK DE REUNIÓN AQUÍ\]/gi,
          /\[enlace de reunión\]/gi,
          /\[link de reunión\]/gi,
          /\[enlace de agenda\]/gi,
          /\[link de agenda\]/gi,
          /\[tu link de agenda\]/gi,
          /\[pon tu enlace aquí\]/gi,
          /\[insertar link de calendly\]/gi,
          /\[insertar enlace\]/gi,
        ];
        for (const pattern of staticLinkPatterns) {
          aiPrompt = aiPrompt.replace(pattern, '[pregunta disponibilidad por mensaje]');
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const todayName = dayNames[today.getDay()];

        aiPrompt += `\n\n[SISTEMA DE AGENDAMIENTO DE CITAS — GOOGLE CALENDAR CONECTADO]:
Tienes acceso al calendario del negocio para agendar reuniones y citas con los clientes.
Hoy es ${todayName} ${todayStr}.
El cliente actual es:
- Nombre: ${customerName || 'Cliente'}
- Teléfono: ${customerPhone}

REGLA DE ORO DEL AGENDAMIENTO (CRÍTICO — LEE ESTO PRIMERO):
NO ofrezcas horarios ni inicies el flujo de agendamiento a menos que el cliente EXPLÍCITAMENTE lo pida usando palabras de intención de agendar como: "agendar", "reunión", "cita", "llamada", "videollamada", "agenda", "quiero una cita", "podemos hablar", "cuándo nos reunimos", "agéndame", "quiero agendar", "me gustaría una reunión", "podemos tener una llamada", o cuando el cliente proponga un día/hora ESPECÍFICO para reunirse (ej. "el jueves a las 4").
Si el cliente está haciendo PREGUNTAS sobre el servicio (ej. "¿cómo funciona?", "¿qué incluye?", "¿cómo me ayudan?", "¿qué resultados puedo esperar?"), RESPONDE SUS PREGUNTAS con información útil y detallada. NO saltes a ofrecer horarios. Sé un asesor de ventas experto primero — aporta valor, resuelve dudas, genera confianza. Solo cuando el cliente ya esté convencido o pida explícitamente agendar, ahí sí inicia el flujo de agendamiento.

Flujo de agendamiento (SOLO cuando el cliente lo solicite):
1. Pregúntale qué día y hora le conviene. Los horarios de atención son de Lunes a Viernes, de 9:00 AM a 6:00 PM.
2. Cuando el cliente proponga una fecha (sin hora específica), usa el siguiente tag para verificar disponibilidad:
   [VERIFICAR_DISPONIBILIDAD:YYYY-MM-DD]
   El sistema te devolverá los horarios disponibles para ese día.
3. Muéstrale al cliente las opciones de horario disponibles.
4. Cuando el cliente confirme un horario específico (ej. "a las 4", "10 AM", "las 3 de la tarde", "4:00 PM"), debes usar INMEDIATAMENTE este tag exacto para crear la cita — NO vuelvas a usar [VERIFICAR_DISPONIBILIDAD]:
   [AGENDAR_CITA:${customerName || 'Cliente'}:${customerPhone}:YYYY-MM-DD:HH:MM:Asesoría de RIFX]
   Ejemplo: [AGENDAR_CITA:${customerName || 'Cliente'}:${customerPhone}:2026-06-12:10:00:Asesoría de RIFX]
   Usa la fecha de la que ya estaban hablando. NUNCA confirmes la cita tú mismo en tu propia respuesta sin poner este tag. El sistema procesará el agendamiento en Google Calendar al ver el tag y te dará la confirmación automáticamente.
5. Si el cliente pregunta por disponibilidad sin dar una fecha concreta, sugiérele los próximos días hábiles.

REGLA ANTI-CICLO (CRÍTICO): Si ya le mostraste horarios disponibles al cliente y él responde eligiendo uno (ej. "a las 4", "la de las 10", "2 PM", "4:00 PM"), DEBES usar [AGENDAR_CITA] directamente con la fecha y hora correspondiente. JAMÁS vuelvas a usar [VERIFICAR_DISPONIBILIDAD] para la misma fecha después de haber mostrado los slots — hacerlo crea un ciclo infinito. Si el usuario ya indicó día Y hora en un mismo mensaje (ej. "el jueves a las 4"), después de verificar disponibilidad agenda directamente si ese horario está disponible.

IMPORTANTE:
- Solo usa estos tags cuando el cliente EXPLÍCITAMENTE quiera agendar una cita.
- No inventes fechas ni horarios. Consulta primero con [VERIFICAR_DISPONIBILIDAD] solo UNA VEZ por fecha.
- Las citas duran 1 hora por defecto.
- NUNCA envíes un enlace de reunión estático. Siempre usa los tags [VERIFICAR_DISPONIBILIDAD] y [AGENDAR_CITA] para gestionar citas de forma dinámica.
- Para calcular fechas relativas (ej. "mañana", "el jueves", "este viernes"), básate en que hoy es ${todayName} ${todayStr}. Por ejemplo, si hoy es Lunes 2026-06-08, "este viernes" es 2026-06-12. Calcula siempre la fecha exacta en formato YYYY-MM-DD.`;
        console.log(`📅 Calendar: Instrucciones de agendamiento inyectadas para tenant ${tenantId} (enlaces estáticos sanitizados)`);
      }
    }

    // 4.25 Buscar cita pendiente próxima para este cliente y agregar contexto
    let upcomingApptText = '';
    let upcomingApptId = '';
    if (!extConfig.dropi_enabled && conversation) {
      try {
        const { data: upcomingAppt } = await supabase
          .from('appointments')
          .select('*')
          .eq('conversation_id', conversation.id)
          .in('status', ['pending', 'confirmed', 'awaiting_reschedule', 'rescheduled', 'pending_completion'])
          .gte('scheduled_time', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .order('scheduled_time', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (upcomingAppt) {
          upcomingApptId = upcomingAppt.id;
          const apptDate = new Date(upcomingAppt.scheduled_time);
          // Format date for Ecuador (UTC-5)
          const options: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Guayaquil',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          };
          const formattedDate = new Intl.DateTimeFormat('es-EC', options).format(apptDate);
          
          upcomingApptText = `\n\n[CITA ENCONTRADA]:
El cliente tiene una cita programada (Estado actual: ${upcomingAppt.status}):
- Servicio/Motivo: ${upcomingAppt.service || 'Asesoría'}
- Fecha y Hora: ${formattedDate}
- ID de Cita: ${upcomingAppt.id}
- Estado de Confirmación: ${upcomingAppt.status}

INSTRUCCIONES CRÍTICAS PARA LA CITA:
- Si el cliente confirma su asistencia (ej. dice palabras como "Sí", "Confirmado", "Ahí estaré", "Perfecto", "Claro", "Nos vemos", "De acuerdo"), debes responder de manera amable confirmando que su asistencia ha sido registrada y agregar exactamente este tag en tu respuesta: [CONFIRMAR_ASISTENCIA:${upcomingAppt.id}].
- Si el cliente quiere cambiar el horario de la cita o reagendar (ej. dice "Quiero cambiar de hora/día", "Necesito otro horario", "Reagendar", "Cambiar cita"), debes ofrecerle otras opciones usando el tag [VERIFICAR_DISPONIBILIDAD:YYYY-MM-DD] y agregar exactamente este tag en tu respuesta para que el sistema lo ponga en espera de reagendar (manteniendo su cita actual temporalmente activa): [SOLICITAR_REAGENDAMIENTO:${upcomingAppt.id}].
- Si el cliente cancela definitivamente o dice que no asistirá de ninguna manera (ej. dice "No puedo ir", "Cancela", "Me surgió algo", "Ya no voy a asistir"), debes ofrecer disculpas y agregar exactamente este tag en tu respuesta: [CANCELAR_CITA:${upcomingAppt.id}].`;
          console.log(`📅 Cita encontrada (${upcomingAppt.status}): ${upcomingAppt.id} para conversación ${conversation.id}`);
        } else {
          upcomingApptText = `\n\n[ESTADO DE CITAS]:
El cliente ACTUALMENTE NO TIENE ninguna cita agendada o programada.
INSTRUCCIONES CRÍTICAS: Si el cliente pregunta cuándo es su cita o pide información sobre su cita, debes decirle amablemente que revisaste el sistema y no tiene ninguna cita agendada actualmente, y ofrécele agendar una nueva cita en ese momento.`;
        }
      } catch (dbErr) {
        console.error('⚠️ Error al buscar cita pendiente:', dbErr);
      }
      
      // Asegurarnos de agregar este texto al prompt
      if (upcomingApptText) {
        aiPrompt += upcomingApptText;
      }
    }

    // Enforce greeting/signature rule: only introduce/present once.
    aiPrompt += `\n\n[REGLA CRÍTICA DE COMUNICACIÓN]:
- Únicamente debes presentarte como "especialista de RIFX" o decir "Soy especialista de RIFX" en tu primer saludo o inicio de la conversación.
- En todos los mensajes siguientes de la conversación, está estrictamente PROHIBIDO que repitas "Soy especialista de RIFX", "asistente de RIFX", o que te presentes de nuevo. Responde directamente a las dudas del cliente con naturalidad, empatía y profesionalismo sin repetir tu presentación.`;


    // Determine which provider & model to use
    let selectedModel = extConfig.model_selection || 'gpt-4o';
    let isGroq = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral');
    let isGemini = selectedModel.startsWith('gemini');
    let isOpenAI = !isGroq && !isGemini;

    // Resolve API key based on provider
    let apiKey = '';
    if (isGroq) apiKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
    else if (isGemini) apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    else apiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

    // 4.1 Si el cliente pidió humano, inyectar instrucción especial al prompt
    if (wantsHuman && !forceHumanEscalation) {
      aiPrompt += `\n\n[INSTRUCCIÓN ESPECIAL]: El cliente ha pedido hablar con un humano. NO lo transfieras todavía. Responde de forma empática y profesional, diciéndole que tú como asistente especializado de RIFX puedes resolver su consulta de forma inmediata. Destaca que tienes acceso a toda la información de los servicios y que puedes ayudarle ahora mismo sin tiempos de espera. Sé persuasivo pero respetuoso. No menciones que eres un bot o IA.`;
    }
    if (forceHumanEscalation) {
      aiPrompt += `\n\n[INSTRUCCIÓN ESPECIAL]: El cliente ha insistido múltiples veces en hablar con un humano. Responde de forma profesional diciendo que respetas su preferencia y que un asesor especializado de RIFX se pondrá en contacto con él en breve. Pide disculpas por las molestias y agradece su paciencia. Sé breve y cálido.`;
    }

    // SMART FALLBACK: If the selected model has no API key, try other providers
    if (!apiKey || apiKey.length < 10) {
      console.warn(`⚠️ No hay API Key para el modelo seleccionado (${selectedModel}). Buscando fallback...`);
      const fallbackOptions = [
        { key: extConfig.groq_key || process.env.GROQ_API_KEY || '', model: 'llama-3.3-70b-versatile', name: 'Groq' },
        { key: extConfig.openai_key || process.env.OPENAI_API_KEY || '', model: 'gpt-4o-mini', name: 'OpenAI' },
        { key: extConfig.gemini_key || process.env.GEMINI_API_KEY || '', model: 'gemini-2.0-flash', name: 'Gemini' },
      ];
      let foundFallback = false;
      for (const fb of fallbackOptions) {
        if (fb.key && fb.key.length >= 10) {
          console.log(`🔄 Fallback de API Key → usando ${fb.name} (${fb.model})`);
          apiKey = fb.key;
          selectedModel = fb.model;
          isGroq = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral');
          isGemini = selectedModel.startsWith('gemini');
          isOpenAI = !isGroq && !isGemini;
          foundFallback = true;
          break;
        }
      }
      if (!foundFallback) {
        console.error(`❌ No hay API Key configurada para NINGÚN proveedor de IA`);
        await sendWhatsAppMessage(customerPhone, 'Estamos experimentando dificultades técnicas. Por favor intenta más tarde. 🙏', config);
        return NextResponse.json({ error: 'No AI key configured' }, { status: 500 });
      }
    }

    // 5. Enviar al proveedor de IA seleccionado
    console.log(`🤖 Modelo seleccionado: ${selectedModel} (${isGroq ? 'Groq' : isGemini ? 'Gemini' : 'OpenAI'})`);
    console.log(`🔑 Usando API key: [CONFIGURED]`);
    console.log(`📝 Prompt del sistema: ${aiPrompt.substring(0, 80)}...`);
    console.log(`💬 Historial: ${(rawHistory || []).length} total, ${history.length} después de filtrar`);

    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: aiPrompt },
      ...history.map((m: { role: string; content: string }) => {
        let content = m.content;
        if (isCalendarConnected && m.role === 'assistant') {
          const staticLinkPatterns = [
            /\[PON TU LINK DE REUNIÓN AQUÍ\]/gi,
            /\[enlace de reunión\]/gi,
            /\[link de reunión\]/gi,
            /\[enlace de agenda\]/gi,
            /\[link de agenda\]/gi,
            /\[tu link de agenda\]/gi,
            /\[pon tu enlace aquí\]/gi,
            /\[insertar link de calendly\]/gi,
            /\[insertar enlace\]/gi,
            /\[usa el sistema de agendamiento integrado\]/gi
          ];
          for (const pattern of staticLinkPatterns) {
            content = content.replace(pattern, '[pregunta disponibilidad por mensaje]');
          }
        }
        return {
          role: m.role as 'user' | 'assistant',
          content,
        };
      }),
    ];

    let aiResponse: string = '';
    let skipAiCall = false;

    // 4.95 CODE-LEVEL INTERCEPTION: If the last assistant message presented time slots
    // and the user is now selecting a time, skip the AI and directly book the appointment.
    // This is a deterministic fix to prevent the AI from re-checking availability in a loop.
    if (isCalendarConnected && tenantId) {
      const lastAssistantMsg = [...history].reverse().find((m: { role: string; content: string }) => m.role === 'assistant');
      if (lastAssistantMsg) {
        // Check if the last assistant message was presenting time slots
        const timeSlotCount = (lastAssistantMsg.content.match(/\d{1,2}:\d{2}\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/g) || []).length;
        const mentionsSlots = /horarios?\s*(disponibles?|para)/i.test(lastAssistantMsg.content) ||
                              /te\s+gustar[ií]a\s+reunir/i.test(lastAssistantMsg.content) ||
                              /cu[aá]l\s+de\s+estos/i.test(lastAssistantMsg.content) ||
                              /cu[aá]l\s+(?:te\s+)?(?:conviene|prefier)/i.test(lastAssistantMsg.content);

        if (timeSlotCount >= 3 && mentionsSlots) {
          // The last message was showing slots. Try to extract time from user's current message.
          const userMsg = customerMessage.toLowerCase().trim();
          const timeMatch = userMsg.match(/(?:a\s+)?(?:las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+)?\s*(am|pm|a\.?m\.?|p\.?m\.?|mañana|tarde|noche)?/i);

          if (timeMatch) {
            let selHour = parseInt(timeMatch[1]);
            const selMin = timeMatch[2] || '00';
            const selPeriod = (timeMatch[3] || '').toLowerCase().replace(/\./g, '');

            // Convert to 24h format
            if ((selPeriod === 'pm' || selPeriod === 'tarde' || selPeriod === 'noche') && selHour < 12) selHour += 12;
            else if (selPeriod === 'am' && selHour === 12) selHour = 0;
            else if (!selPeriod && selHour >= 1 && selHour <= 6) selHour += 12; // Assume PM for business hours

            const selTime24 = `${String(selHour).padStart(2, '0')}:${selMin}`;

            // Extract the date from the last assistant message
            let bookingDate = '';
            // Try ISO format first (2026-06-12)
            const isoMatch = lastAssistantMsg.content.match(/(\d{4}-\d{2}-\d{2})/);
            if (isoMatch) {
              bookingDate = isoMatch[1];
            } else {
              // Try Spanish date format ("jueves 12 de junio" or "12 de junio")
              const spanishDateMatch = lastAssistantMsg.content.match(/(?:\w+\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
              if (spanishDateMatch) {
                const monthMap: Record<string, string> = {
                  'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
                  'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
                  'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
                };
                const day = spanishDateMatch[1].padStart(2, '0');
                const month = monthMap[spanishDateMatch[2].toLowerCase()] || '01';
                const year = new Date().getFullYear();
                bookingDate = `${year}-${month}-${day}`;
              }
            }

            if (bookingDate) {
              // Format for display
              const dispHour = selHour > 12 ? selHour - 12 : (selHour === 0 ? 12 : selHour);
              const dispPeriod = selHour >= 12 ? 'PM' : 'AM';

              aiResponse = `¡Perfecto! Voy a agendar tu reunión para el *${bookingDate}* a las *${dispHour}:${selMin} ${dispPeriod}*. 😊\n\n[AGENDAR_CITA:${customerName || 'Cliente'}:${customerPhone}:${bookingDate}:${selTime24}:Asesoría de RIFX]`;
              skipAiCall = true;
              console.log(`📅 [INTERCEPCIÓN DIRECTA] Usuario seleccionó ${selTime24} de slots presentados → agendando directamente para ${bookingDate}`);
            }
          }
        }
      }
    }

    if (!skipAiCall) {
      try {
        if (isGemini) {
          // Google Gemini via REST API — use systemInstruction for system prompt
          const systemMsg = chatMessages.find(m => m.role === 'system');
          const nonSystemMsgs = chatMessages.filter(m => m.role !== 'system');
          
          // Gemini requires alternating user/model turns. Merge consecutive same-role messages.
          const geminiContents: { role: string; parts: { text: string }[] }[] = [];
          for (const m of nonSystemMsgs) {
            const gemRole = m.role === 'assistant' ? 'model' : 'user';
            const last = geminiContents[geminiContents.length - 1];
            if (last && last.role === gemRole) {
              // Merge consecutive same-role messages
              last.parts[0].text += '\n' + m.content;
            } else {
              geminiContents.push({ role: gemRole, parts: [{ text: m.content }] });
            }
          }
          // Gemini requires the first message to be from 'user'
          if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
            geminiContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
          }
          
          const geminiPayload: any = {
            contents: geminiContents,
            generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
          };
          // Use systemInstruction for system prompt (supported by Gemini 1.5+ and 2.0)
          if (systemMsg) {
            geminiPayload.systemInstruction = { parts: [{ text: systemMsg.content }] };
          }
          
          const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
          });
          const gemData = await gemRes.json();
          
          // Log full error if present
          if (gemData?.error) {
            console.error(`❌ Gemini API Error:`, JSON.stringify(gemData.error));
            // Throw as exception to trigger fallback chain
            const gemError: any = new Error(`Gemini API Error: ${gemData.error.message || gemData.error.code}`);
            gemError.status = gemData.error.code;
            throw gemError;
          }
          if (gemData?.promptFeedback?.blockReason) {
            console.error(`❌ Gemini blocked prompt:`, gemData.promptFeedback.blockReason);
            const blockError: any = new Error(`Gemini blocked: ${gemData.promptFeedback.blockReason}`);
            blockError.status = 400;
            throw blockError;
          }
          
          aiResponse = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          // OpenAI / Groq (both use OpenAI SDK)
          const client = new OpenAI({
            apiKey,
            baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
          });
          const completion = await client.chat.completions.create({
            model: selectedModel,
            messages: chatMessages,
            max_tokens: 500,
            temperature: 0.7,
          });
          aiResponse = completion.choices[0]?.message?.content || '';
        }

        console.log(`✅ IA respondió (${selectedModel}): ${(aiResponse || '').substring(0, 80)}...`);

        if (!aiResponse) {
          console.error(`⚠️ ${selectedModel} devolvió respuesta vacía`);
          aiResponse = 'Disculpa, estoy procesando mucha información. ¿Podrías repetir tu pregunta? 🙏';
        }
      } catch (aiError: any) {
        console.error(`❌ Error de IA (${selectedModel}):`, aiError?.message || aiError);
        console.error('❌ Detalles:', JSON.stringify(aiError?.error || aiError?.response?.data || 'sin detalles'));

        // FALLBACK: If primary AI fails (rate limit, quota, blocked, etc.), try alternative providers
        const isRateLimit = aiError?.status === 429 || aiError?.message?.includes('429') || aiError?.message?.includes('rate limit') || aiError?.message?.includes('Rate limit') || aiError?.message?.includes('RESOURCE_EXHAUSTED') || aiError?.message?.includes('quota');
        const isServerError = aiError?.status >= 500 || aiError?.message?.includes('500') || aiError?.message?.includes('503');
        const isGeminiError = aiError?.message?.includes('Gemini') || aiError?.message?.includes('blocked');

        if (isRateLimit || isServerError || isGeminiError) {
          console.log(`🔄 Intentando fallback de IA (error ${isRateLimit ? 'rate limit' : 'servidor'})...`);

          // Build fallback chain: try each provider that has a key
          const fallbackProviders: { name: string; key: string; model: string; baseURL?: string }[] = [];

          // Add providers we haven't tried yet
          if (!isOpenAI && (extConfig.openai_key || process.env.OPENAI_API_KEY)) {
            fallbackProviders.push({ name: 'OpenAI', key: extConfig.openai_key || process.env.OPENAI_API_KEY || '', model: 'gpt-4o-mini' });
          }
          if (!isGemini && (extConfig.gemini_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
            fallbackProviders.push({ name: 'Gemini', key: extConfig.gemini_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '', model: 'gemini-2.0-flash' });
          }
          if (!isGroq && (extConfig.groq_key || process.env.GROQ_API_KEY)) {
            fallbackProviders.push({ name: 'Groq', key: extConfig.groq_key || process.env.GROQ_API_KEY || '', model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' });
          }

          for (const fb of fallbackProviders) {
            if (!fb.key || fb.key.length < 10) continue;
            try {
              console.log(`🔄 Fallback → ${fb.name} (${fb.model})...`);
              if (fb.name === 'Gemini') {
                const fbSystemMsg = chatMessages.find(m => m.role === 'system');
                const fbNonSystem = chatMessages.filter(m => m.role !== 'system');
                const fbGemContents: { role: string; parts: { text: string }[] }[] = [];
                for (const m of fbNonSystem) {
                  const r = m.role === 'assistant' ? 'model' : 'user';
                  const last = fbGemContents[fbGemContents.length - 1];
                  if (last && last.role === r) { last.parts[0].text += '\n' + m.content; }
                  else { fbGemContents.push({ role: r, parts: [{ text: m.content }] }); }
                }
                if (fbGemContents.length > 0 && fbGemContents[0].role !== 'user') {
                  fbGemContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
                }
                const fbPayload: any = { contents: fbGemContents, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } };
                if (fbSystemMsg) { fbPayload.systemInstruction = { parts: [{ text: fbSystemMsg.content }] }; }
                const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${fb.model}:generateContent?key=${fb.key}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(fbPayload),
                });
                const gemData = await gemRes.json();
                if (gemData?.error) console.error(`❌ Fallback Gemini Error:`, JSON.stringify(gemData.error));
                aiResponse = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              } else {
                const fbClient = new OpenAI({ apiKey: fb.key, baseURL: fb.baseURL });
                const fbCompletion = await fbClient.chat.completions.create({ model: fb.model, messages: chatMessages, max_tokens: 500, temperature: 0.7 });
                aiResponse = fbCompletion.choices[0]?.message?.content || '';
              }
              if (aiResponse) {
                console.log(`✅ Fallback exitoso con ${fb.name}: ${aiResponse.substring(0, 60)}...`);
                break;
              }
            } catch (fbErr: any) {
              console.error(`❌ Fallback ${fb.name} también falló:`, fbErr?.message || fbErr);
            }
          }
        }

        if (!aiResponse) {
          aiResponse = 'Estamos experimentando dificultades técnicas momentáneas. Por favor intenta en unos segundos. 🙏';
        }
      }
    }

    // 6. Detectar si la IA quiere generar un pago
    const paymentMatch = aiResponse.match(/\[GENERAR_PAGO:(\d+):(.+?)\]/);
    if (paymentMatch) {
      const amount = parseInt(paymentMatch[1]);
      const service = paymentMatch[2];

      // Limpiar el tag del mensaje
      aiResponse = aiResponse.replace(/\[GENERAR_PAGO:\d+:.+?\]/, '').trim();

      // Generar cobro con PayPhone
      const paymentResult = await generatePayPhonePayment(
        customerPhone,
        amount,
        service,
        conversation.id,
        customerName,
        config
      );

      if (paymentResult.success) {
        aiResponse += `\n\n💳 Te he enviado la solicitud de pago por $${amount} a tu app PayPhone. ¡Revisa tu notificación para completar el pago! 🚀`;

        // Actualizar estado de la conversación
        await supabase
          .from('conversations')
          .update({ status: 'interested' })
          .eq('id', conversation.id);
      } else {
        aiResponse += '\n\n⚠️ Hubo un problema al generar el link de pago. Nuestro equipo te contactará para ayudarte.';
      }
    }

    // 6.5 Detectar si la IA quiere generar un pedido en Dropi
    const dropiMatch = aiResponse.match(/\[CREAR_ORDEN_DROPI:(.+?):(.+?):(.+?):(.+?):(.+?):(\d+):(.+?)\]/);
    if (dropiMatch) {
      const [, customerNameArg, phoneArg, addressArg, cityArg, productIdArg, quantityArg, paymentType] = dropiMatch;

      // Limpiar el tag del mensaje
      aiResponse = aiResponse.replace(/\[CREAR_ORDEN_DROPI:.+?\]/, '').trim();

      console.log(`🚛 Creando orden en Dropi para ${customerNameArg} en ${cityArg}...`);
      const dropiToken = extConfig.dropi_token;
      
      const orderResult = await createDropiOrder({
        customerName: customerNameArg,
        phone: phoneArg,
        address: addressArg,
        city: cityArg,
        productId: productIdArg,
        quantity: parseInt(quantityArg),
        paymentType,
        token: dropiToken,
        price: extConfig.dropi_default_price || 50
      });

      // Guardar metadatos del pedido en la base de datos para exportar a Dropi (Carga Masiva)
      try {
        const orderData = {
          name: customerNameArg,
          phone: phoneArg,
          address: addressArg,
          city: cityArg,
          product_id: productIdArg,
          quantity: parseInt(quantityArg),
          price: extConfig.dropi_default_price || 50,
          payment_type: paymentType,
          status: orderResult.success ? 'synced' : 'pending',
          created_at: new Date().toISOString()
        };
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          role: 'assistant',
          content: `__ORDER_DATA__:${JSON.stringify(orderData)}`,
          tenant_id: tenantId
        });
      } catch (err) {
        console.error('Error logging order metadata:', err);
      }

      if (orderResult.success) {
        aiResponse += `\n\n🚛 *¡Pedido Confirmado!*
Se ha generado la orden de envío en Dropi.
Guía de seguimiento: *${orderResult.guideNumber}*
Transportadora: *${orderResult.carrier}*`;

        // Mover estado de conversación a interesado
        await supabase
          .from('conversations')
          .update({ status: 'interested' })
          .eq('id', conversation.id);
      } else {
        console.error(`❌ Error creando orden en Dropi: ${orderResult.error}`);
        aiResponse += `\n\n⚠️ Hemos tomado tus datos de envío, pero hubo un problema al conectar con el sistema logístico de Dropi. Un asesor humano confirmará tu pedido manualmente en breve.`;
        
        // Mover estado de conversación a interesado también cuando hay error de conexión a la API
        await supabase
          .from('conversations')
          .update({ status: 'interested' })
          .eq('id', conversation.id);
      }
    }

    // 6.7 Detectar si la IA quiere verificar disponibilidad en Google Calendar
    const availabilityMatch = aiResponse.match(/\[VERIFICAR_DISPONIBILIDAD:(\d{4}-\d{2}-\d{2})\]/);
    if (availabilityMatch && tenantId) {
      const requestedDate = availabilityMatch[1];
      aiResponse = aiResponse.replace(/\[VERIFICAR_DISPONIBILIDAD:\d{4}-\d{2}-\d{2}\]/, '').trim();

      console.log(`📅 Verificando disponibilidad para ${requestedDate}...`);
      const { available, error: calError } = await checkAvailability(tenantId, requestedDate);

      if (calError) {
        aiResponse += `\n\n⚠️ No pude verificar la disponibilidad: ${calError}`;
      } else if (available.length === 0) {
        aiResponse += `\n\nLo siento, no hay horarios disponibles para el ${requestedDate}. ¿Te gustaría consultar otro día?`;
      } else {
        // Re-call AI with the availability data so it presents the options naturally
        const slotsText = available.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
        // Extract the user's originally requested time (if any) from their message
        const timePatterns = /(?:a las?|las?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:de la)?\s*(am|pm|a\.?m\.?|p\.?m\.?|mañana|tarde|noche)?/i;
        const userTimeMatch = customerMessage.match(timePatterns);
        let userRequestedTimeHint = '';
        if (userTimeMatch) {
          const hour = parseInt(userTimeMatch[1]);
          const period = (userTimeMatch[3] || '').toLowerCase().replace(/\./g, '');
          let hour24 = hour;
          if ((period === 'pm' || period === 'tarde' || period === 'noche') && hour < 12) hour24 = hour + 12;
          if (period === 'am' && hour === 12) hour24 = 0;
          const timeStr24 = `${String(hour24).padStart(2, '0')}:${userTimeMatch[2] || '00'}`;
          // Check if this time is in the available slots
          const matchingSlot = available.find(s => s.label.includes(String(hour)) || s.start?.includes(timeStr24));
          if (matchingSlot) {
            userRequestedTimeHint = `\n\nMUY IMPORTANTE: El cliente YA pidió las ${hour}:${userTimeMatch[2] || '00'} ${period || ''} en su mensaje. Ese horario ESTÁ disponible. NO le preguntes cuál prefiere. Usa directamente el tag [AGENDAR_CITA:${customerName || 'Cliente'}:${customerPhone}:${requestedDate}:${timeStr24}:Asesoría de RIFX] para agendar la cita de inmediato y confirma al cliente.`;
          }
        }

        const followUpMessages = [
          ...chatMessages,
          { role: 'assistant' as const, content: aiResponse || 'Déjame revisar la disponibilidad...' },
          { role: 'user' as const, content: `[SISTEMA: Horarios disponibles para ${requestedDate}]:\n${slotsText}\n\n${userRequestedTimeHint ? userRequestedTimeHint : `Presenta estos horarios al cliente de forma amigable y pregunta cuál prefiere.`} No menciones que consultaste un sistema.` }
        ];

        try {
          let slotsResponse = '';
          if (isGemini) {
            const fuSysMsg = followUpMessages.find(m => m.role === 'system');
            const fuNonSys = followUpMessages.filter(m => m.role !== 'system');
            const fuContents: { role: string; parts: { text: string }[] }[] = [];
            for (const m of fuNonSys) {
              const r = m.role === 'assistant' ? 'model' : 'user';
              const last = fuContents[fuContents.length - 1];
              if (last && last.role === r) { last.parts[0].text += '\n' + m.content; }
              else { fuContents.push({ role: r, parts: [{ text: m.content }] }); }
            }
            if (fuContents.length > 0 && fuContents[0].role !== 'user') {
              fuContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
            }
            const fuPayload: any = { contents: fuContents, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } };
            if (fuSysMsg) { fuPayload.systemInstruction = { parts: [{ text: fuSysMsg.content }] }; }
            const gemRes2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fuPayload),
            });
            const gemData2 = await gemRes2.json();
            slotsResponse = gemData2?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            const client2 = new OpenAI({ apiKey, baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined });
            const comp2 = await client2.chat.completions.create({ model: selectedModel, messages: followUpMessages, max_tokens: 500, temperature: 0.7 });
            slotsResponse = comp2.choices[0]?.message?.content || '';
          }
          if (slotsResponse) {
            aiResponse = slotsResponse;
          } else {
            aiResponse = `Estos son los horarios disponibles para el ${requestedDate}:\n\n${slotsText}\n\n¿Cuál te conviene más? 😊`;
          }
        } catch (e) {
          aiResponse = `Estos son los horarios disponibles para el ${requestedDate}:\n\n${slotsText}\n\n¿Cuál te conviene más? 😊`;
        }
      }
    }

    // 6.8 Detectar si la IA quiere agendar una cita en Google Calendar
    const appointmentMatch = aiResponse.match(/\[AGENDAR_CITA:(.+?):(.+?):(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):(.+?)\]/);
    if (appointmentMatch && tenantId) {
      const [, clientName, clientPhone, date, time, service] = appointmentMatch;
      aiResponse = aiResponse.replace(/\[AGENDAR_CITA:.+?\]/, '').trim();

      console.log(`📅 Agendando cita para ${clientName} el ${date} a las ${time}...`);

      const startDateTime = `${date}T${time}:00`;
      const [h, m] = time.split(':').map(Number);
      const endH = h + 1; // 1 hour duration
      const endDateTime = `${date}T${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

      const result = await createCalendarEvent(tenantId, {
        summary: `📅 Cita: ${clientName} — ${service}`,
        description: `Cliente: ${clientName}\nTeléfono: ${clientPhone}\nServicio: ${service}\nAgendado vía WhatsApp Bot de RIFX Marketing`,
        startDateTime,
        endDateTime,
        timeZone: 'America/Guayaquil'
      });

      if (result.success) {
        aiResponse += `\n\n✅ *¡Cita Agendada con Éxito!*\n📅 Fecha: *${date}*\n🕐 Hora: *${time}*\n📋 Motivo: *${service}*\n\n¡Te esperamos! Si necesitas reagendar, avísame con anticipación. 😊`;
        console.log(`✅ Cita creada exitosamente: ${result.eventId}`);

        // Guardar cita en la base de datos
        try {
          // America/Guayaquil is UTC-5, so we parse it with -05:00 offset to construct correct timestamp
          const scheduledTimeISO = new Date(`${date}T${time}:00-05:00`).toISOString();

          // Buscar si el cliente ya tiene una cita para reciclarla en esta conversación
          const { data: existingAppt } = await supabase
            .from('appointments')
            .select('*')
            .eq('conversation_id', conversation.id)
            .order('scheduled_time', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingAppt) {
            // Eliminar evento viejo de Google Calendar
            if (existingAppt.event_id) {
              const delRes = await deleteCalendarEvent(tenantId, existingAppt.event_id);
              if (delRes.success) {
                console.log(`✅ [Reagendamiento] Evento viejo de Google Calendar ${existingAppt.event_id} eliminado exitosamente`);
              } else {
                console.error(`❌ [Reagendamiento] Error al eliminar evento viejo de Google Calendar:`, delRes.error);
              }
            }

            // Actualizar la cita existente en la DB
            const { error: dbUpdateErr } = await supabase
              .from('appointments')
              .update({
                event_id: result.eventId,
                scheduled_time: scheduledTimeISO,
                service: service,
                status: 'rescheduled',
                reminder_24h_sent: false,
                reminder_2h_sent: false,
                reminder_30m_sent: false,
                reminder_sent_at: null,
                confirmed_at: null,
                confirmation_message: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingAppt.id);

            if (dbUpdateErr) {
              console.error('❌ Error al actualizar la cita reagendada en la DB:', dbUpdateErr);
            } else {
              console.log(`✅ Cita ${existingAppt.id} reagendada con éxito en la DB`);
            }
          } else {
            // Insertar una nueva cita
            const { error: dbInsertErr } = await supabase.from('appointments').insert({
              tenant_id: tenantId,
              conversation_id: conversation.id,
              event_id: result.eventId,
              customer_name: clientName,
              phone_number: clientPhone,
              scheduled_time: scheduledTimeISO,
              service: service,
              status: 'pending',
              reminder_24h_sent: false,
              reminder_2h_sent: false,
              reminder_30m_sent: false
            });
            if (dbInsertErr) {
              console.error('❌ Error al guardar la cita en la base de datos:', dbInsertErr);
            } else {
              console.log(`✅ Cita guardada en base de datos para el cliente ${clientName}`);
            }
          }
        } catch (dbErr) {
          console.error('❌ Error inesperado al guardar la cita en la base de datos:', dbErr);
        }
      } else {
        console.error(`❌ Error agendando cita: ${result.error}`);
        aiResponse += `\n\n⚠️ Hubo un problema al agendar tu cita. Un asesor se pondrá en contacto contigo para confirmar manualmente. 🙏`;
      }
    }

    // 6.85 Sanitizar cualquier placeholder estático de reunión remanente en la respuesta de la IA
    if (isCalendarConnected) {
      const staticLinkPatterns = [
        /\[PON TU LINK DE REUNIÓN AQUÍ\]/gi,
        /\[enlace de reunión\]/gi,
        /\[link de reunión\]/gi,
        /\[enlace de agenda\]/gi,
        /\[link de agenda\]/gi,
        /\[tu link de agenda\]/gi,
        /\[pon tu enlace aquí\]/gi,
        /\[insertar link de calendly\]/gi,
        /\[insertar enlace\]/gi,
        /\[usa el sistema de agendamiento integrado\]/gi,
        /\[pregunta disponibilidad por mensaje\]/gi
      ];
      let hasPlaceholder = false;
      for (const pattern of staticLinkPatterns) {
        if (pattern.test(aiResponse)) {
          hasPlaceholder = true;
          aiResponse = aiResponse.replace(pattern, 'indicándome qué día y hora prefieres');
        }
      }
      if (hasPlaceholder) {
        console.log('⚠️ [Sanitizer] Reemplazado placeholder estático de reunión en la respuesta final de la IA');
        aiResponse = aiResponse.trim();
      }
    }

    // 6.9 Detectar tag de CONFIRMAR_ASISTENCIA
    const confirmMatch = aiResponse.match(/\[CONFIRMAR_ASISTENCIA:(.+?)\]/);
    if (confirmMatch) {
      const apptId = confirmMatch[1];
      aiResponse = aiResponse.replace(/\[CONFIRMAR_ASISTENCIA:.+?\]/, '').trim();
      console.log(`📅 Confirmando asistencia para la cita ${apptId}...`);
      
      try {
        const { error: dbUpdateErr } = await supabase
          .from('appointments')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            confirmation_message: customerMessage || 'Confirmado por chat',
            updated_at: new Date().toISOString()
          })
          .eq('id', apptId);
        if (dbUpdateErr) {
          console.error(`❌ Error al actualizar estado de cita a confirmado:`, dbUpdateErr);
        } else {
          console.log(`✅ Cita ${apptId} marcada como confirmada en la base de datos`);
        }
      } catch (dbErr) {
        console.error(`❌ Error al actualizar estado de cita a confirmado:`, dbErr);
      }
    }

    // 6.92 Detectar tag de SOLICITAR_REAGENDAMIENTO (pone la cita en espera de reagendar pero mantiene el evento en Calendar)
    const requestRescheduleMatch = aiResponse.match(/\[SOLICITAR_REAGENDAMIENTO:(.+?)\]/);
    if (requestRescheduleMatch) {
      const apptId = requestRescheduleMatch[1];
      aiResponse = aiResponse.replace(/\[SOLICITAR_REAGENDAMIENTO:.+?\]/, '').trim();
      console.log(`📅 Cambiando estado de cita ${apptId} a awaiting_reschedule...`);
      
      try {
        const { error: dbUpdateErr } = await supabase
          .from('appointments')
          .update({
            status: 'awaiting_reschedule',
            updated_at: new Date().toISOString()
          })
          .eq('id', apptId);
        if (dbUpdateErr) {
          console.error(`❌ Error al actualizar estado de cita a awaiting_reschedule:`, dbUpdateErr);
        } else {
          console.log(`✅ Cita ${apptId} marcada como awaiting_reschedule en la base de datos`);
        }
      } catch (dbErr) {
        console.error(`❌ Error al actualizar estado de cita a awaiting_reschedule:`, dbErr);
      }
    }

    // 6.95 Detectar tag de CANCELAR_CITA (o el anterior REAGENDAR_CITA)
    const cancelMatch = aiResponse.match(/\[(?:CANCELAR_CITA|REAGENDAR_CITA):(.+?)\]/);
    if (cancelMatch) {
      const apptId = cancelMatch[1];
      aiResponse = aiResponse.replace(/\[(?:CANCELAR_CITA|REAGENDAR_CITA):.+?\]/, '').trim();
      console.log(`📅 Cancelando cita ${apptId}...`);

      try {
        // Obtener el event_id de la cita para eliminar de Google Calendar
        const { data: appt, error: apptQueryErr } = await supabase
          .from('appointments')
          .select('event_id, tenant_id')
          .eq('id', apptId)
          .limit(1)
          .maybeSingle();

        if (apptQueryErr) {
          console.error(`❌ Error al consultar cita ${apptId} para cancelación:`, apptQueryErr);
        } else if (appt && appt.event_id && appt.tenant_id) {
          const delResult = await deleteCalendarEvent(appt.tenant_id, appt.event_id);
          if (delResult.success) {
            console.log(`✅ Evento de Google Calendar ${appt.event_id} eliminado exitosamente`);
          } else {
            console.error(`❌ Error al eliminar evento de Google Calendar:`, delResult.error);
          }
        }

        // Marcar la cita como cancelada
        const { error: dbCancelErr } = await supabase
          .from('appointments')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', apptId);
        
        if (dbCancelErr) {
          console.error(`❌ Error al marcar cita ${apptId} como cancelada:`, dbCancelErr);
        } else {
          console.log(`✅ Cita ${apptId} marcada como cancelada en la base de datos`);
        }
      } catch (dbErr) {
        console.error(`❌ Error al procesar cancelación de cita:`, dbErr);
      }
    }

    // 6.98 🆕 Extraer metadata de ventas del tag [SALES_META] y actualizar conversación
    const { cleanResponse: cleanedAiResponse, metadata: salesMeta } = extractSalesMetadata(aiResponse);
    aiResponse = cleanedAiResponse;

    // 6.99 🆕 Pricing Guard — Validar precios en la respuesta
    if (tenantId && !(extConfig.dropi_enabled && intentResult.intent === 'sales_dropshipping')) {
      const { isValid, cleanResponse: pricingCleanResponse } = validatePricingInResponse(aiResponse, tenantPricing);
      if (!isValid) {
        console.log('🚫 Pricing Guard: precio no autorizado detectado — respuesta reemplazada');
        aiResponse = pricingCleanResponse;
      }
    }

    // Actualizar campos de ventas en la conversación
    const salesUpdate: Record<string, any> = {
      intent: intentResult.intent,
      sales_stage: newSalesStage,
      lead_score: newLeadScore,
      updated_at: new Date().toISOString(),
    };
    if (salesMeta.objection) salesUpdate.last_objection = salesMeta.objection;
    if (salesMeta.nextAction) salesUpdate.next_action = salesMeta.nextAction;
    if (salesMeta.businessType) salesUpdate.business_type = salesMeta.businessType;
    if (salesMeta.urgency) salesUpdate.urgency_level = salesMeta.urgency;
    if (salesMeta.serviceInterest) salesUpdate.service_interest = salesMeta.serviceInterest;
    if (salesMeta.budgetRange) salesUpdate.budget_range = salesMeta.budgetRange;

    await supabase.from('conversations').update(salesUpdate).eq('id', conversation.id);
    console.log(`📊 Sales: stage=${newSalesStage}, score=${newLeadScore}, intent=${intentResult.intent}`);

    // 7. Guardar respuesta de la IA
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: aiResponse,
    });

    // 8. Enviar respuesta por WhatsApp
    await sendWhatsAppMessage(customerPhone, aiResponse, config);

    console.log(`🤖 Respuesta enviada a ${customerName}: ${aiResponse.substring(0, 80)}...`);

    // 🔔 Piggyback: disparar verificación de recordatorios (fire-and-forget, sin bloquear)
    // El cron de Vercel Hobby solo corre 1x/día, así que aprovechamos el tráfico del webhook
    // para verificar y enviar recordatorios de 2h y 30min que el cron diario no alcanza.
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
      const cronSecret = process.env.CRON_SECRET || '';
      fetch(`${baseUrl}/api/cron/send-reminders`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${cronSecret}` },
      }).catch(() => {}); // fire-and-forget
    } catch {}

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Error en webhook WhatsApp:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function sendWhatsAppMessage(to: string, text: string, config: Record<string, string> | null) {
  let token = config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
  let phoneId = config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Si los tokens de la DB son cortos o parecen de prueba, forzamos usar el .env
  if (token && token.length < 20) token = process.env.WHATSAPP_TOKEN;
  if (phoneId && phoneId.length < 5) phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error('❌ Faltan credenciales de WhatsApp');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      console.error('❌ Error de Meta API:', JSON.stringify(result, null, 2));
    } else {
      console.log('✅ WhatsApp enviado:', result);
    }
  } catch (err) {
    console.error('❌ Error en fetch WhatsApp:', err);
  }
}

async function generatePayPhonePayment(
  phone: string,
  amountDollars: number,
  service: string,
  conversationId: string,
  customerName: string,
  config: Record<string, string> | null
) {
  const token = config?.payphone_token || process.env.PAYPHONE_TOKEN;
  const storeId = config?.payphone_store_id || process.env.PAYPHONE_STORE_ID;

  if (!token || !storeId) {
    console.error('❌ Faltan credenciales de PayPhone');
    return { success: false };
  }

  const supabase = createSupabaseAdmin();
  const clientTransactionId = `RIFX-${Date.now()}`;
  const amountCents = amountDollars * 100; // PayPhone usa centavos

  try {
    const response = await fetch('https://pay.payphonetodoesposible.com/api/Sale', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phone.replace('593', '0'), // Convertir formato internacional a local
        countryCode: '593',
        amount: amountCents,
        amountWithoutTax: amountCents,
        clientTransactionId,
        reference: `RIFX - ${service}`,
        storeId,
        currency: 'USD',
        timeZone: -5,
      }),
    });

    const data = await response.json();

    if (data.transactionId) {
      // Guardar la venta como pendiente
      await supabase.from('sales').insert({
        conversation_id: conversationId,
        customer_name: customerName,
        phone_number: phone,
        amount: amountCents,
        service,
        payphone_transaction_id: String(data.transactionId),
        client_transaction_id: clientTransactionId,
        status: 'pending',
      });

      return { success: true, transactionId: data.transactionId };
    } else {
      console.error('❌ PayPhone error:', data);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Error al generar pago PayPhone:', error);
    return { success: false };
  }
}

async function transcribeWhatsAppAudio(
  audioId: string,
  token: string,
  openAiKey: string,
  groqKey?: string
): Promise<string> {
  try {
    console.log(`🎙️ Solicitando metadata de audio Meta ID: ${audioId}`);
    // 1. Obtener la URL del audio
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${audioId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Meta API error fetching audio metadata: ${metaRes.status} ${errText}`);
    }
    const metaData = await metaRes.json();
    const audioUrl = metaData.url;
    const mimeType = metaData.mime_type || 'audio/ogg';
    
    if (!audioUrl) {
      throw new Error('No se encontró URL de audio en la metadata');
    }

    console.log(`🎙️ Descargando archivo de audio desde Meta CDN...`);
    // 2. Descargar el archivo binario
    const audioRes = await fetch(audioUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) {
      throw new Error(`Error descargando archivo de audio: ${audioRes.statusText}`);
    }
    const arrayBuffer = await audioRes.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: mimeType });
    
    // 3. Enviar a Whisper (Groq o OpenAI)
    const formData = new FormData();
    formData.append('file', blob, 'audio.ogg');
    
    if (groqKey && groqKey.length > 10) {
      console.log('🎙️ Intentando transcribir con Groq Whisper...');
      formData.append('model', 'whisper-large-v3');
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: formData,
        });
        if (groqRes.ok) {
          const data = await groqRes.json();
          return data.text || '';
        }
        const errText = await groqRes.text();
        console.warn(`⚠️ Falló la transcripción con Groq Whisper: ${errText}`);
      } catch (groqErr: any) {
        console.warn(`⚠️ Error conectando con Groq Whisper: ${groqErr?.message || groqErr}`);
      }
    }

    if (openAiKey && openAiKey.length > 10) {
      console.log('🎙️ Intentando transcribir con OpenAI Whisper...');
      formData.append('model', 'whisper-1');
      const oaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
        },
        body: formData,
      });
      if (oaiRes.ok) {
        const data = await oaiRes.json();
        return data.text || '';
      }
      const errText = await oaiRes.text();
      throw new Error(`OpenAI Whisper error: ${errText}`);
    }

    throw new Error('No hay claves de API válidas de OpenAI o Groq configuradas para transcripción.');
  } catch (err: any) {
    console.error('❌ Error en transcribeWhatsAppAudio:', err?.message || err);
    return '';
  }
}

interface DropiOrderParams {
  customerName: string;
  phone: string;
  address: string;
  city: string;
  productId: string;
  quantity: number;
  paymentType: string;
  token: string;
  price: number;
}

function getDropiApiUrl(token: string): string {
  if (!token) return 'https://api.dropi.co/api/orders/myorders';
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload.iss) {
        if (payload.iss.includes('dropi.ec')) return 'https://api.dropi.ec/api/orders/myorders';
        if (payload.iss.includes('dropi.mx')) return 'https://api.dropi.mx/api/orders/myorders';
        if (payload.iss.includes('dropi.pe')) return 'https://api.dropi.pe/api/orders/myorders';
      }
    }
  } catch (e) {
    console.error('Error parsing Dropi token issuer:', e);
  }
  return 'https://api.dropi.co/api/orders/myorders';
}

async function createDropiOrder(params: DropiOrderParams) {
  const { customerName, phone, address, city, productId, quantity, paymentType, token, price } = params;

  if (!token || token.length < 10) {
    console.log('⚠️ No Dropi token configured or token too short. Running in SIMULATION mode.');
    return {
      success: true,
      guideNumber: `MOCK-${Math.floor(100000 + Math.random() * 900000)}`,
      carrier: 'Servientrega (Simulado)'
    };
  }

  try {
    // Dropi API order payload structure
    const payload = {
      nombre: customerName,
      telefono: phone,
      direccion: address,
      ciudad: city,
      metodo_pago: paymentType === 'contra_entrega' ? 1 : 2, // 1: Contra entrega, 2: Pago anticipado
      productos: [
        {
          id: productId,
          cantidad: quantity,
          precio: price
        }
      ]
    };

    const url = getDropiApiUrl(token);
    console.log(`Sending order payload to Dropi (${url}):`, JSON.stringify(payload));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && (result.success || result.isSuccess || result.id || result.guia)) {
      return {
        success: true,
        guideNumber: result.guia || result.tracking_number || `DP-${result.id || Date.now()}`,
        carrier: result.transportadora || 'Envía'
      };
    } else {
      console.error('❌ Dropi API responded with error:', JSON.stringify(result));
      return {
        success: false,
        error: result.message || 'API error'
      };
    }
  } catch (err: any) {
    console.error('❌ Error executing Dropi order request:', err);
    return {
      success: false,
      error: err.message || 'Connection error'
    };
  }
}
