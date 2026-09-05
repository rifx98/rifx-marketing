import { createSupabaseAdmin } from './supabase';
import OpenAI from 'openai';

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
    currentNodeId = startNode ? startNode.id : config.nodes[0].id;
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
      content: interpolateText(nextNode.data?.text || '', variables)
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
      // 1. Fetch AI config and Tenant credits
      const { data: aiConfig } = await supabase
        .from('ai_provider_configs')
        .select('is_active, model, api_key, provider')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const { data: tenant } = await supabase
        .from('tenants')
        .select('ai_credits_balance, ai_prompt')
        .eq('id', tenantId)
        .maybeSingle();

      const isAiActive = aiConfig?.is_active === true;
      const hasCredits = (tenant?.ai_credits_balance || 0) > 0;

      // Si no está activa o no hay créditos, saltamos silenciosamente al siguiente nodo
      if (!isAiActive || !hasCredits) {
        console.warn(`[FlowEngine] Nodo IA omitido para tenant ${tenantId}. Activa: ${isAiActive}, Créditos: ${hasCredits}`);
        const aiEdges = config.edges.filter(e => e.source === nextNode!.id);
        if (aiEdges.length > 0) {
          if (conversation) {
            await supabase.from('conversations').update({ current_node_id: aiEdges[0].target }).eq('id', conversation.id);
          }
          // Retornar null hará que se envíe __SYSTEM_PAUSE__ implícitamente o nada,
          // pero es mejor retornar un system pause para no enviar mensaje en blanco.
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

      const globalPrompt = tenant?.ai_prompt || 'Eres un asistente útil.';
      
      let finalSystemPrompt = `${globalPrompt}\n\n${toneInstruction}\n${strictInstruction}`;
      if (blockContext.trim()) {
        finalSystemPrompt += `\n\n--- MEMORIA / CATÁLOGO DEL NEGOCIO ---\n${blockContext}\n-----------------------------------\n`;
      }

      // 4. Call OpenAI
      const openai = new OpenAI({
        apiKey: aiConfig?.api_key || process.env.OPENAI_API_KEY,
      });

      const response = await openai.chat.completions.create({
        model: aiConfig?.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: finalSystemPrompt },
          ...history
        ],
        temperature: isStrict ? 0.3 : 0.7
      });

      const replyText = response.choices[0]?.message?.content || '';

      // 4. Deduct Credits safely
      const costPerMessage = 0.005; // Costo fijo por mensaje
      await supabase.rpc('increment_ai_credits', {
        p_tenant_id: tenantId,
        p_amount: -costPerMessage
      });

      await supabase.from('ai_credit_ledger').insert({
        tenant_id: tenantId,
        type: 'usage',
        amount: -costPerMessage,
        balance_after: (tenant?.ai_credits_balance || 0) - costPerMessage,
        reference: `Mensaje IA - Conversación ${conversation?.id}`
      });

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
