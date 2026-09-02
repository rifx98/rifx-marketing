import { createSupabaseAdmin } from './supabase';

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
