import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

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

    // 1. Buscar o crear conversación
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', customerPhone)
      .single();

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

    // Determine which provider & model to use
    const selectedModel = extConfig.model_selection || 'gpt-4o';
    const isGroq = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral');
    const isGemini = selectedModel.startsWith('gemini');
    const isOpenAI = !isGroq && !isGemini;

    // Resolve API key based on provider
    let apiKey = '';
    if (isGroq) apiKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
    else if (isGemini) apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || '';
    else apiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

    // 4.1 Si el cliente pidió humano, inyectar instrucción especial al prompt
    if (wantsHuman && !forceHumanEscalation) {
      aiPrompt += `\n\n[INSTRUCCIÓN ESPECIAL]: El cliente ha pedido hablar con un humano. NO lo transfieras todavía. Responde de forma empática y profesional, diciéndole que tú como asistente especializado de RIFX puedes resolver su consulta de forma inmediata. Destaca que tienes acceso a toda la información de los servicios y que puedes ayudarle ahora mismo sin tiempos de espera. Sé persuasivo pero respetuoso. No menciones que eres un bot o IA.`;
    }
    if (forceHumanEscalation) {
      aiPrompt += `\n\n[INSTRUCCIÓN ESPECIAL]: El cliente ha insistido múltiples veces en hablar con un humano. Responde de forma profesional diciendo que respetas su preferencia y que un asesor especializado de RIFX se pondrá en contacto con él en breve. Pide disculpas por las molestias y agradece su paciencia. Sé breve y cálido.`;
    }

    if (!apiKey || apiKey.length < 10) {
      console.error(`❌ No hay API Key configurada para el proveedor (modelo: ${selectedModel})`);
      await sendWhatsAppMessage(customerPhone, 'Estamos experimentando dificultades técnicas. Por favor intenta más tarde. 🙏', config);
      return NextResponse.json({ error: 'No AI key configured' }, { status: 500 });
    }

    // 5. Enviar al proveedor de IA seleccionado
    console.log(`🤖 Modelo seleccionado: ${selectedModel} (${isGroq ? 'Groq' : isGemini ? 'Gemini' : 'OpenAI'})`);
    console.log(`🔑 Usando API key: [CONFIGURED]`);
    console.log(`📝 Prompt del sistema: ${aiPrompt.substring(0, 80)}...`);
    console.log(`💬 Historial: ${(rawHistory || []).length} total, ${history.length} después de filtrar`);

    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: aiPrompt },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let aiResponse: string;
    try {
      if (isGemini) {
        // Google Gemini via REST API
        const geminiMessages = chatMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.role === 'system' ? `[System Instructions]: ${m.content}` : m.content }],
        }));
        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: geminiMessages, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } }),
        });
        const gemData = await gemRes.json();
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
      aiResponse = 'Estamos experimentando dificultades técnicas momentáneas. Por favor intenta en unos segundos. 🙏';
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
      }
    }

    // 7. Guardar respuesta de la IA
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: aiResponse,
    });

    // 8. Enviar respuesta por WhatsApp
    await sendWhatsAppMessage(customerPhone, aiResponse, config);

    console.log(`🤖 Respuesta enviada a ${customerName}: ${aiResponse.substring(0, 80)}...`);

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
