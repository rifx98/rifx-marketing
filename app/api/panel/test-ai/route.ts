import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
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

    const supabase = createSupabaseAdmin();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    let tenantId: string | null = null;
    try {
      const payload = await verifyToken(token);
      tenantId = payload?.tenantId || null;
    } catch (err) {
      console.error('Error verifying token in test-ai:', err);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

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
    
    const basePrompt = config.ai_prompt || 'Eres un asesor de ventas amigable y profesional.';
    
    // Decode AI key from JSON-encoded openai_key column
    let extConfig = {
      openai_key: '', gemini_key: '', groq_key: '', anthropic_key: '', model_selection: 'gpt-4o',
      dropi_enabled: false, dropi_token: '', dropi_default_product_id: '', dropi_default_price: 50
    };
    try {
      const parsed = JSON.parse(config?.openai_key || '{}');
      extConfig = { ...extConfig, ...parsed };
    } catch {
      extConfig.openai_key = config?.openai_key || '';
    }

    // Resolve model to use
    let selectedModel = model;
    if (!selectedModel) {
      selectedModel = extConfig.model_selection || 'gpt-4o';
    }

    let targetModel = selectedModel;
    if (targetModel === 'llama-3.3-70b') {
      targetModel = 'llama-3.3-70b-versatile';
    } else if (targetModel === 'mixtral-8x7b') {
      targetModel = 'llama-3.1-8b-instant'; // mixtral-8x7b-32768 deprecated, use llama fallback
    } else if (targetModel === 'llama-3.1-405b') {
      targetModel = 'llama-3.3-70b-versatile'; // 405b-reasoning no longer exists on Groq
    } else if (targetModel === 'llama-3.1-405b-reasoning') {
      targetModel = 'llama-3.3-70b-versatile'; // direct fix if stored as full name
    }

    let isGroq = targetModel.startsWith('llama') || targetModel.startsWith('mixtral') || targetModel === 'llama-3.1-8b-instant';
    let isGemini = targetModel.startsWith('gemini');
    let isAnthropic = targetModel.startsWith('claude');
    let isOpenAI = !isGroq && !isGemini && !isAnthropic;

    // Resolve API key based on provider
    let apiKey = '';
    if (isGroq) apiKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
    else if (isGemini) apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || '';
    else if (isAnthropic) apiKey = extConfig.anthropic_key || process.env.ANTHROPIC_API_KEY || '';
    else apiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

    if (!apiKey) {
      if (isGroq) apiKey = process.env.GROQ_API_KEY || '';
      else if (isGemini) apiKey = process.env.GEMINI_API_KEY || '';
      else if (isAnthropic) apiKey = process.env.ANTHROPIC_API_KEY || '';
      else apiKey = process.env.OPENAI_API_KEY || '';
    }

    if (!apiKey || apiKey.length < 10) {
      // Fallback: try Groq if available and we're not already trying Groq
      const groqFallbackKey = process.env.GROQ_API_KEY || extConfig.groq_key || '';
      if (!isGroq && groqFallbackKey && groqFallbackKey.length >= 10) {
        console.warn(`⚠️ test-ai: No API key for ${selectedModel} (${isOpenAI ? 'OpenAI' : isGemini ? 'Gemini' : 'Anthropic'}). Falling back to Groq (llama-3.3-70b-versatile).`);
        apiKey = groqFallbackKey;
        targetModel = 'llama-3.3-70b-versatile';
        // Update provider flags for downstream logic
        isGroq = true;
        isGemini = false;
        isAnthropic = false;
        isOpenAI = false;
      } else {
        console.error(`❌ test-ai: No API key found for model "${selectedModel}". Provider: ${isOpenAI ? 'OpenAI' : isGroq ? 'Groq' : isGemini ? 'Gemini' : 'Anthropic'}. extConfig keys present: openai=${!!extConfig.openai_key}, groq=${!!extConfig.groq_key}, gemini=${!!extConfig.gemini_key}, anthropic=${!!extConfig.anthropic_key}. Env keys: OPENAI=${!!process.env.OPENAI_API_KEY}, GROQ=${!!process.env.GROQ_API_KEY}, GEMINI=${!!process.env.GEMINI_API_KEY}, ANTHROPIC=${!!process.env.ANTHROPIC_API_KEY}`);
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
        const kbEntries = await getKBIndex(supabase, tenantId);
        const activeEntries = kbEntries.filter((e: any) => e.active && e.content);
        
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
    if (botName) {
      parts.push(`\nTu nombre es "${botName}". Siempre preséntate con este nombre cuando sea apropiado.`);
    }
    if (botRole) {
      parts.push(`Tu rol es: ${botRole}.`);
    }
    
    // Tone mapping
    const toneInstructions: Record<string, string> = {
      'Profesional': 'Mantén un tono profesional, formal pero cercano. Usa usted cuando sea apropiado.',
      'Casual': 'Usa un tono casual y amigable. Tutea al usuario y usa emojis moderadamente. Sé conversacional.',
      'Técnico': 'Responde con precisión técnica. Usa terminología específica del sector. Sé detallado y exacto.',
      'Amigable': 'Sé muy cálido y empático. Usa emojis, sé entusiasta y haz que el cliente se sienta bienvenido.',
      'Formal': 'Mantén un tono estrictamente formal y corporativo. No uses emojis. Sé conciso y directo.',
    };
    if (botTone && toneInstructions[botTone]) {
      parts.push(`\n[TONO DE COMUNICACIÓN]: ${toneInstructions[botTone]}`);
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
5. **Crear la orden**: Una vez (y SOLO cuando) el cliente te haya proporcionado los 4 datos de envío completos (Nombre, Teléfono, Dirección, Ciudad), debes confirmar el pedido al cliente y generar la orden en Dropi agregando este tag exacto al final de tu mensaje:
[CREAR_ORDEN_DROPI:nombre_cliente:telefono:direccion:ciudad:${extConfig.dropi_default_product_id || 'DEFAULT_PRODUCT'}:1:contra_entrega]
Reemplaza los campos nombre_cliente, telefono, direccion y ciudad con la información correspondiente. No dejes corchetes vacíos ni inventes datos de envío.`);
    }

    // Classification instruction
    parts.push('\n\n[INSTRUCCIÓN DE PRUEBA]: Al final de tu respuesta, añade SIEMPRE un bloque JSON exacto con este formato: {"classification": "Interesado" | "Indeciso" | "Curioso", "confidence": number, "next_action": string}. Clasifica según el mensaje del usuario.');

    const systemPrompt = parts.join('\n');

    const chatMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
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
          messages: history.map((h: any) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content
          })).concat([{ role: 'user', content: message }])
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

    // Interceptar Dropi en el test
    const dropiMatch = cleanResponse.match(/\[CREAR_ORDEN_DROPI:(.+?):(.+?):(.+?):(.+?):(.+?):(\d+):(.+?)\]/);
    if (dropiMatch) {
      const [, customerNameArg, phoneArg, addressArg, cityArg, productIdArg, quantityArg, paymentType] = dropiMatch;
      
      // Limpiar el tag del mensaje
      cleanResponse = cleanResponse.replace(/\[CREAR_ORDEN_DROPI:.+?\]/, '').trim();
      
      console.log(`🚛 (Test AI) Creando orden en Dropi para ${customerNameArg} en ${cityArg}...`);
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
        cleanResponse += `\n\n🚛 *¡Pedido Confirmado!*
Se ha generado la orden de envío en Dropi.
Guía de seguimiento: *${orderResult.guideNumber}*
Transportadora: *${orderResult.carrier}*`;
      } else {
        console.error(`❌ (Test AI) Error creando orden en Dropi: ${orderResult.error}`);
        cleanResponse += `\n\n⚠️ Hemos tomado tus datos de envío, pero hubo un problema al conectar con el sistema de Dropi: ${orderResult.error}`;
      }
    }

    return NextResponse.json({ 
      response: cleanResponse,
      inference: classification
    });

  } catch (error: any) {
    console.error('Test AI Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Helper: Get KB index from storage
async function getKBIndex(supabase: any, tenantId: string) {
  const path = `${tenantId}/index.json`;
  const { data, error } = await supabase.storage
    .from('knowledge-base')
    .download(path);
  
  if (error || !data) return [];
  
  try {
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return [];
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
    const payload = {
      nombre: customerName,
      telefono: phone,
      direccion: address,
      ciudad: city,
      metodo_pago: paymentType === 'contra_entrega' ? 1 : 2,
      productos: [
        {
          id: productId,
          cantidad: quantity,
          precio: price
        }
      ]
    };

    console.log('Sending order payload to Dropi:', JSON.stringify(payload));

    const response = await fetch('https://api.dropi.co/api/v1/orders', {
      method: 'POST',
      headers: {
        'dropi-integracion-key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && (result.success || result.id || result.guia)) {
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
