import { createSupabaseAdmin } from './supabase';
import OpenAI from 'openai';
import { formatForWhatsApp, sanitizeGreetings } from './whatsapp-formatting';
import { getNowInTimezone, processAppointmentHandling } from './calendar-booking';
import { getActiveKnowledgeContext } from './knowledge-base';
import { deductAiCredits, hasAvailableCredits } from './ai-credits';

interface FlowNode {
  id: string;
  type: string;
  data: any;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowConfig {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Helper to interpolate variables in text
function interpolateText(text: string, variables: Record<string, any>) {
  if (!text) return '';
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return variables[key.trim()] !== undefined ? variables[key.trim()] : match;
  });
}

function evaluateCondition(operator: string, actual: any, expected: any) {
  if (actual === undefined || actual === null) actual = '';
  const aStr = String(actual).toLowerCase();
  const eStr = String(expected).toLowerCase();
  
  switch (operator) {
    case '==': return aStr === eStr;
    case '!=': return aStr !== eStr;
    case 'contains': return aStr.includes(eStr);
    case 'not_contains': return !aStr.includes(eStr);
    case 'startsWith': return aStr.startsWith(eStr);
    case 'endsWith': return aStr.endsWith(eStr);
    case '>': return Number(actual) > Number(expected);
    case '<': return Number(actual) < Number(expected);
    case '>=': return Number(actual) >= Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case 'regex': 
      try { return new RegExp(String(expected), 'i').test(String(actual)); } catch { return false; }
    default: return false;
  }
}

export async function processFlowEngineMessage(
  messageData: any,
  botMenuConfig: any,
  customerPhone: string,
  tenantId: string
) {
  if (!botMenuConfig || !Array.isArray(botMenuConfig.nodes) || botMenuConfig.nodes.length === 0) {
    return null; // Fallback or ignored if no flow
  }

  const supabase = createSupabaseAdmin();
  
  // 1. Get or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, current_node_id, is_human_mode, status, flow_variables')
    .eq('tenant_id', tenantId)
    .eq('phone_number', customerPhone)
    .maybeSingle();
    
  if (conversation?.is_human_mode) {
    return { type: 'text', content: '__SYSTEM_PAUSE__' }; // Don't reply if human mode
  }

  const config = botMenuConfig as FlowConfig;
  let currentNodeId = conversation?.current_node_id;
  let variables = conversation?.flow_variables || {};
  let variablesUpdated = false;

  const userText = messageData?.text?.body?.toLowerCase().trim() || '';

  // 2. Identify Start node if no current node
  if (!currentNodeId) {
    const startNode = config.nodes.find(n => n.type === 'start');
    const startEdge = startNode ? config.edges.find(e => e.source === startNode.id) : null;
    currentNodeId = startEdge ? startEdge.target : (startNode ? startNode.id : config.nodes[0].id);
  } else {
    // 3. Process user response against current node
    const currentNode = config.nodes.find(n => n.id === currentNodeId);
    const outgoingEdges = config.edges.filter(e => e.source === currentNodeId);
    let nextNodeId = null;

    if (currentNode?.type === 'buttons') {
      const matchingEdge = outgoingEdges.find(e => e.sourceHandle && e.sourceHandle.toLowerCase() === userText);
      if (matchingEdge) nextNodeId = matchingEdge.target;
      else if (outgoingEdges.length > 0) nextNodeId = outgoingEdges[0].target; 
    } 
    else if (currentNode?.type === 'question') {
      // Save answer to variable
      if (currentNode.data?.variable) {
        variables[currentNode.data.variable] = messageData?.text?.body || '';
        variablesUpdated = true;
      }
      if (outgoingEdges.length > 0) nextNodeId = outgoingEdges[0].target;
    }
    else {
      if (outgoingEdges.length > 0) nextNodeId = outgoingEdges[0].target;
    }

    if (nextNodeId) {
      currentNodeId = nextNodeId;
    }
  }

  // 4. Auto-traverse non-blocking nodes (like Condition, Webhook) immediately
  let nextNode = config.nodes.find(n => n.id === currentNodeId);
  
  while (nextNode && (nextNode.type === 'condition' || nextNode.type === 'webhook')) {
    let nextNodeTarget = null;

    if (nextNode.type === 'condition') {
      const varValue = variables[nextNode.data?.variable || ''];
      const result = evaluateCondition(nextNode.data?.operator || '==', varValue, nextNode.data?.value || '');
      
      const conditionEdges = config.edges.filter(e => e.source === nextNode!.id);
      const targetHandle = result ? 'true' : 'false';
      const edge = conditionEdges.find(e => e.sourceHandle === targetHandle);
      if (edge) nextNodeTarget = edge.target;
    } 
    else if (nextNode.type === 'webhook') {
      try {
        const url = interpolateText(nextNode.data?.url || '', variables);
        const method = nextNode.data?.method || 'GET';
        if (url) {
          const res = await fetch(url, { method });
          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            // Store response in a variable if specified
            if (nextNode.data?.variable) {
              variables[nextNode.data.variable] = JSON.stringify(json);
              variablesUpdated = true;
            }
          }
        }
      } catch (err) {
        console.error('Webhook node failed:', err);
      }
      
      const webhookEdges = config.edges.filter(e => e.source === nextNode!.id);
      if (webhookEdges.length > 0) nextNodeTarget = webhookEdges[0].target;
    }
    
    if (nextNodeTarget) {
      currentNodeId = nextNodeTarget;
      nextNode = config.nodes.find(n => n.id === currentNodeId);
    } else {
      break;
    }
  }

  if (!nextNode) {
    return { type: 'text', content: 'Flujo terminado.' };
  }

  // Update conversation with new state
  if (conversation) {
    const updatePayload: any = { current_node_id: currentNodeId };
    if (variablesUpdated) updatePayload.flow_variables = variables;
    
    await supabase.from('conversations')
      .update(updatePayload)
      .eq('id', conversation.id);
  }

  // 5. Generate Response
  if (nextNode.type === 'message' || nextNode.type === 'start' || nextNode.type === 'question') {
    return {
      type: 'text',
      content: formatForWhatsApp(interpolateText(nextNode.data?.text || '', variables))
    };
  }
  
  if (nextNode.type === 'buttons') {
    const buttons = Array.isArray(nextNode.data?.buttons) ? nextNode.data.buttons : [];
    if (buttons.length === 0) {
      return { type: 'text', content: interpolateText(nextNode.data?.text || 'Opciones', variables) };
    }
    return {
      type: 'interactive',
      content: interpolateText(nextNode.data?.text || 'Elige una opción', variables),
      interactive: {
        type: 'button',
        body: { text: interpolateText(nextNode.data?.text || 'Elige una opción', variables) },
        action: {
          buttons: buttons.map((btn: any) => ({
            type: 'reply',
            reply: { id: btn.id || btn.label, title: btn.label }
          }))
        }
      }
    };
  }

  if (nextNode.type === 'ai') {
    try {
      // 1. Fetch AI config, Config row, Platform Settings and Tenant credits
      const { data: tenant } = await supabase
        .from('tenants')
        .select('ai_credits_balance, ai_prompt')
        .eq('id', tenantId)
        .maybeSingle();

      const { data: tenantConfig } = await supabase
        .from('config')
        .select('openai_key, ai_prompt')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const { data: platformSettings } = await supabase
        .from('platform_settings')
        .select('global_ai_config')
        .limit(1)
        .maybeSingle();

      const { data: aiConfig } = await supabase
        .from('ai_provider_configs')
        .select('is_active, model, api_key, provider')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Resolve key, model & provider
      let provider = 'openai';
      let model = 'gpt-4o-mini';
      let apiKey = '';

      const globalAi = (platformSettings as any)?.global_ai_config;
      if (globalAi && globalAi.enabled && globalAi.apiKey) {
        provider = globalAi.provider || 'gemini';
        model = globalAi.model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o');
        apiKey = globalAi.apiKey;
      } else if (tenantConfig?.openai_key) {
        try {
          const parsed = JSON.parse(tenantConfig.openai_key);
          if (parsed.groq_key) {
            provider = 'groq';
            apiKey = parsed.groq_key;
            model = 'qwen/qwen3.8-27b';
          } else if (parsed.gemini_key) {
            provider = 'gemini';
            apiKey = parsed.gemini_key;
            model = parsed.model_selection || 'gemini-2.5-flash';
          } else if (parsed.openai_key) {
            provider = 'openai';
            apiKey = parsed.openai_key;
            model = parsed.model_selection || 'gpt-4o-mini';
          }
        } catch {
          apiKey = tenantConfig.openai_key;
        }
      } else if (aiConfig?.is_active && aiConfig.api_key) {
        provider = aiConfig.provider || 'openai';
        model = aiConfig.model || 'gpt-4o-mini';
        apiKey = aiConfig.api_key;
      }

      if (!apiKey) {
        if (process.env.GROQ_API_KEY) {
          provider = 'groq';
          model = 'qwen/qwen3.8-27b';
          apiKey = process.env.GROQ_API_KEY;
        } else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
          provider = 'gemini';
          model = 'gemini-2.5-flash';
          apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
        } else if (process.env.OPENAI_API_KEY) {
          provider = 'openai';
          model = 'gpt-4o-mini';
          apiKey = process.env.OPENAI_API_KEY;
        }
      }

      // Map deprecated models
      if (model === 'gemini-1.5-flash' || model === 'gemini-2.0-flash' || model === 'gemini-2.5-pro') {
        model = 'gemini-2.5-flash';
      }
      if (model.startsWith('llama') || model.startsWith('mixtral')) {
        model = 'qwen/qwen3.8-27b';
      }

      const hasCredits = (tenant?.ai_credits_balance || 0) > 0 || !!globalAi?.enabled;

      if (!apiKey || !hasCredits) {
        console.warn(`[FlowEngine] Nodo IA omitido para tenant ${tenantId}. Tiene key: ${!!apiKey}, Créditos: ${hasCredits}`);
        const aiEdges = config.edges.filter(e => e.source === nextNode!.id);
        if (aiEdges.length > 0) {
          if (conversation) {
            await supabase.from('conversations').update({ current_node_id: aiEdges[0].target }).eq('id', conversation.id);
          }
          return { type: 'text', content: '__SYSTEM_PAUSE__' }; 
        }
        return null;
      }

      // 2. Build history from recent messages
      const { data: recentMsgs } = await supabase
        .from('messages')
        .select('content, role')
        .eq('conversation_id', conversation?.id)
        .order('created_at', { ascending: false })
        .limit(6); 

      const history = (recentMsgs || []).reverse().map(m => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as "assistant" | "user",
        content: m.content
      }));
      
      if (history.length === 0 || history[history.length - 1].content !== userText) {
        history.push({ role: 'user', content: userText });
      }

      // 3. Prepare Prompt Configuration
      const blockContext = nextNode.data?.context || '';
      const blockTone = nextNode.data?.tone || 'profesional';
      const isStrict = nextNode.data?.strictMode === 'yes';

      let toneInstruction = '';
      if (blockTone === 'amigable') toneInstruction = 'Usa un tono muy amigable, cercano y casual. Usa emojis.';
      if (blockTone === 'profesional') toneInstruction = 'Usa un tono profesional, claro y respetuoso.';
      if (blockTone === 'vendedor') toneInstruction = 'Usa un tono persuasivo, resalta los beneficios de los productos y trata de cerrar la venta.';

      let strictInstruction = '';
      if (isStrict) {
        strictInstruction = 'REGLA ESTRICTA: Basa tus respuestas ÚNICAMENTE en el catálogo/memoria provista. Si te preguntan sobre un producto, precio o servicio que no está en el catálogo, DEBES responder amablemente que no tienes esa información o que no ofrecen ese producto. NUNCA inventes precios ni productos.';
      }

      // Configuración extendida del bot (identidad, tono, temperatura)
      let parsedExtConfig: any = {};
      try {
        if (tenantConfig?.openai_key) parsedExtConfig = JSON.parse(tenantConfig.openai_key);
      } catch {}

      const globalPrompt = tenant?.ai_prompt || tenantConfig?.ai_prompt || 'Eres un asistente de ventas útil y profesional.';
      
      let finalSystemPrompt = `${globalPrompt}\n\n${toneInstruction}\n${strictInstruction}`;

      if (parsedExtConfig.bot_name || parsedExtConfig.bot_role || parsedExtConfig.bot_tone) {
        finalSystemPrompt += `\n\n[IDENTIDAD Y TONO DEL ASISTENTE]:
- Tu nombre: ${parsedExtConfig.bot_name || 'Asistente'}
- Tu rol: ${parsedExtConfig.bot_role || 'Especialista de Atención'}
- Tono de comunicación: ${parsedExtConfig.bot_tone || 'Profesional'}`;
      }

      finalSystemPrompt += `\n\nREGLAS DE FORMATO WHATSAPP:
- Usa formato nativo de WhatsApp. Para negrillas usa SIEMPRE UN SOLO asterisco: *texto*. NUNCA uses doble asterisco **texto** ni markdown estándar.
- ${history.length > 1 ? 'Esta conversación ya está en curso. NO saludes (no digas Hola, Buenas tardes, ni Bienvenida). Ve directo al grano a responder la duda del cliente de manera servicial y natural.' : 'Saluda de forma natural una sola vez al inicio sin repetir saludos.'}`;

      const nowInfo = getNowInTimezone();
      finalSystemPrompt += `\n\n[SISTEMA DE AGENDAMIENTO Y CALENDARIO]:
Tienes acceso directo al calendario para verificar disponibilidad y agendar citas.
Hoy es ${nowInfo.dayName} ${nowInfo.dateStr} (hora local).
Horario de atención: Lunes a Viernes de 09:00 a 18:00.
1. Para consultar horarios disponibles usa el tag: [VERIFICAR_DISPONIBILIDAD:YYYY-MM-DD]
2. Cuando el cliente confirme día y hora (ej. "hoy a las 3 pm", "mañana a las 10 am"), usa el tag:
   [AGENDAR_CITA:Cliente:${customerPhone}:YYYY-MM-DD:HH:MM:Asesoría]
   El sistema verificará la disponibilidad y guardará la cita automáticamente en el calendario.`;
      if (blockContext.trim()) {
        finalSystemPrompt += `\n\n--- MEMORIA / CATÁLOGO DEL NEGOCIO ---\n${blockContext}\n-----------------------------------\n`;
      }

      // Integrar PDFs y documentos activos de la Base de Conocimiento
      try {
        const kbContext = await getActiveKnowledgeContext(supabase, tenantId);
        if (kbContext) {
          finalSystemPrompt += `\n\n${kbContext}\n`;
        }
      } catch (kbErr) {
        console.warn('[FlowEngine] Error cargando base de conocimiento:', kbErr);
      }

      // Integrar filtros de seguridad y guardrails
      const botProfanityFilter = parsedExtConfig.bot_profanity_filter !== false;
      const botTopicLocks = parsedExtConfig.bot_topic_locks === true;

      if (botProfanityFilter) {
        finalSystemPrompt += `\n\n[FILTRO DE LENGUAJE ACTIVO]: Si el usuario utiliza lenguaje ofensivo, vulgar o inapropiado, responde siempre con cortesía y profesionalismo, sin utilizar ni repetir insultos.`;
      }
      if (botTopicLocks) {
        finalSystemPrompt += `\n\n[BLOQUEO DE TEMAS ACTIVO]: Restringe estrictamente tus respuestas exclusivamente al catálogo, productos, servicios y atención de este negocio. Si el usuario intenta salir del tema, declina cortésmente.`;
      }

      // Calcular temperatura efectiva
      const configuredTemp = typeof parsedExtConfig.bot_temperature === 'number' ? parsedExtConfig.bot_temperature : 0.7;
      const effectiveTemp = isStrict ? 0.2 : Math.max(0, Math.min(1.5, configuredTemp));

      // Verificar créditos antes de llamar a la IA
      if (tenantId) {
        const { hasCredits, balance } = await hasAvailableCredits(supabase, tenantId);
        if (!hasCredits) {
          console.warn(`💳 [FlowEngine] Tenant ${tenantId} sin créditos de IA disponibles (saldo: ${balance})`);
          return {
            type: 'text',
            content: 'Nuestro asistente inteligente se encuentra temporalmente en pausa. Un asesor humano se comunicará contigo pronto. 🙏',
          };
        }
      }

      // 4. Call AI Model (Gemini, Groq or OpenAI)
      let replyText = '';
      const isGroq = provider === 'groq' || model.startsWith('qwen') || model.startsWith('llama');
      if (provider === 'gemini' || model.startsWith('gemini')) {
        try {
          const geminiContents = history.map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
          }));
          if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
            geminiContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
          }
          const geminiPayload: any = {
            contents: geminiContents,
            systemInstruction: { parts: [{ text: finalSystemPrompt }] },
            generationConfig: { maxOutputTokens: 600, temperature: effectiveTemp }
          };
          const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
            signal: AbortSignal.timeout(15_000),
          });
          if (gemRes.ok) {
            const gemData = await gemRes.json();
            replyText = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        } catch (gemErr) {
          console.warn('[FlowEngine] Error llamando a Gemini:', gemErr);
        }
      }

      // Si no es Gemini o si Gemini falló/devolvió vacío, probar con OpenAI / Groq
      if (!replyText) {
        try {
          let groqKey = isGroq ? apiKey : '';
          let actualBaseUrl: string | undefined = undefined;
          let actualModel = model;
          let actualKey = apiKey;

          if (isGroq) {
            actualBaseUrl = 'https://api.groq.com/openai/v1';
            actualModel = model.startsWith('qwen') ? model : 'qwen/qwen3.8-27b';
          } else if (!isGroq && provider === 'gemini') {
            // Fallback desde Gemini: intentar con Groq si hay key guardada
            try {
              const parsed = JSON.parse(tenantConfig?.openai_key || '{}');
              if (parsed.groq_key) {
                actualKey = parsed.groq_key;
                actualBaseUrl = 'https://api.groq.com/openai/v1';
                actualModel = 'qwen/qwen3.8-27b';
              }
            } catch {}
          }

          if (actualKey) {
            const openai = new OpenAI({ 
              apiKey: actualKey,
              baseURL: actualBaseUrl,
              timeout: 12000,
            });
            const response = await openai.chat.completions.create({
              model: actualModel,
              messages: [
                { role: 'system', content: finalSystemPrompt },
                ...history
              ],
              temperature: effectiveTemp
            });
            replyText = response.choices[0]?.message?.content || '';
          }
        } catch (aiErr) {
          console.warn('[FlowEngine] Error en llamada a OpenAI/Groq:', aiErr);
        }
      }
      try {
        if (tenantConfig?.openai_key) parsedExtConfig = JSON.parse(tenantConfig.openai_key);
      } catch {}

      replyText = await processAppointmentHandling({
        rawResponse: replyText,
        userMessage: messageData?.text?.body || userText,
        tenantId,
        customerName: 'Cliente',
        customerPhone,
        conversationId: conversation?.id || null,
        extConfig: parsedExtConfig
      });

      // Format for WhatsApp (single asterisks) and prevent duplicate greetings
      replyText = sanitizeGreetings(formatForWhatsApp(replyText), history.length > 1);

      // 4. Deduct Credits safely
      if (replyText && tenantId) {
        await deductAiCredits(supabase, tenantId, 1, `Consulta IA FlowZap (Nodo ${nextNode?.id || 'AI'})`);
      }

      // 5. If AI node has an outgoing edge to an interactive node (e.g. menu, buttons)
      const aiOutgoingEdges = config.edges.filter(e => e.source === nextNode!.id);
      if (aiOutgoingEdges.length > 0) {
        const postAiNode = config.nodes.find(n => n.id === aiOutgoingEdges[0].target);
        if (postAiNode) {
          if (conversation) {
            await supabase.from('conversations').update({ current_node_id: postAiNode.id }).eq('id', conversation.id);
          }
          if (postAiNode.type === 'buttons' || postAiNode.type === 'menu') {
            const buttons = Array.isArray(postAiNode.data?.buttons) ? postAiNode.data.buttons : [];
            const menuText = postAiNode.data?.text || 'Opciones:';
            const buttonList = buttons.map((b: any, i: number) => `${i + 1}. ${b.label}`).join('\n');
            return {
              type: 'text',
              content: `${replyText}\n\n${menuText}\n${buttonList}`
            };
          }
        }
      }

      return {
        type: 'text',
        content: replyText
      };

    } catch (error) {
      console.error('[FlowEngine] Error en nodo IA:', error);
      // Fallback on error
      const aiEdges = config.edges.filter(e => e.source === nextNode!.id);
      if (aiEdges.length > 0 && conversation) {
        await supabase.from('conversations').update({ current_node_id: aiEdges[0].target }).eq('id', conversation.id);
      }
      return null;
    }
  }

  if (nextNode.type === 'media') {
    const mediaType = nextNode.data?.mediaType || 'image';
    const url = nextNode.data?.url || '';
    if (!url) return { type: 'text', content: 'Archivo adjunto no disponible.' };
    
    return {
      type: mediaType, // 'image', 'document', 'video'
      url: url,
      caption: interpolateText(nextNode.data?.text || '', variables)
    };
  }

  if (nextNode.type === 'human') {
    if (conversation) {
      await supabase.from('conversations')
        .update({ is_human_mode: true, status: 'waiting_human' })
        .eq('id', conversation.id);
    }
    return {
      type: 'text',
      content: interpolateText(nextNode.data?.text || 'Un asesor humano se conectará contigo en breve.', variables)
    };
  }

  return { type: 'text', content: 'Paso procesado.' };
}
