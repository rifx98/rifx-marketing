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

export async function processFlowEngineMessage(
  messageData: any,
  botMenuConfig: any,
  customerPhone: string,
  tenantId: string
) {
  // If no config or not a valid flow config
  if (!botMenuConfig || !Array.isArray(botMenuConfig.nodes) || botMenuConfig.nodes.length === 0) {
    return {
      type: 'text',
      content: 'Bienvenido. (El administrador aún no ha configurado el flujo visual).'
    };
  }

  const supabase = createSupabaseAdmin();
  
  // 1. Get or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, current_node_id, is_human_mode, status')
    .eq('tenant_id', tenantId)
    .eq('phone_number', customerPhone)
    .maybeSingle();
    
  if (conversation?.is_human_mode) {
    return { type: 'text', content: '__SYSTEM_PAUSE__' }; // Don't reply if human mode
  }

  const config = botMenuConfig as FlowConfig;
  let currentNodeId = conversation?.current_node_id;

  // 2. Identify Start node if no current node
  if (!currentNodeId) {
    const startNode = config.nodes.find(n => n.type === 'start');
    currentNodeId = startNode ? startNode.id : config.nodes[0].id;
  } else {
    // 3. Process user response against current node to find next node
    const userText = messageData?.text?.body?.toLowerCase().trim() || '';
    
    // Find edges originating from current node
    const outgoingEdges = config.edges.filter(e => e.source === currentNodeId);
    let nextNodeId = null;

    // Check if the current node was a buttons/menu node
    const currentNode = config.nodes.find(n => n.id === currentNodeId);
    if (currentNode?.type === 'buttons') {
      // Find edge matching the button response
      const matchingEdge = outgoingEdges.find(e => {
        // e.sourceHandle could match the button id or text
        return e.sourceHandle && e.sourceHandle.toLowerCase() === userText;
      });
      if (matchingEdge) nextNodeId = matchingEdge.target;
      else if (outgoingEdges.length > 0) nextNodeId = outgoingEdges[0].target; // fallback
    } else {
      // Default jump to the first outgoing edge
      if (outgoingEdges.length > 0) nextNodeId = outgoingEdges[0].target;
    }

    if (nextNodeId) {
      currentNodeId = nextNodeId;
    }
  }

  const nextNode = config.nodes.find(n => n.id === currentNodeId);
  
  if (!nextNode) {
    return { type: 'text', content: 'Flujo terminado o configurado incorrectamente.' };
  }

  // Update conversation with new state
  if (conversation) {
    await supabase.from('conversations')
      .update({ current_node_id: currentNodeId })
      .eq('id', conversation.id);
  }

  // 4. Generate response based on next node type
  if (nextNode.type === 'message' || nextNode.type === 'start') {
    return {
      type: 'text',
      content: nextNode.data?.text || 'Mensaje no configurado'
    };
  }
  
  if (nextNode.type === 'buttons') {
    const buttons = Array.isArray(nextNode.data?.buttons) ? nextNode.data.buttons : [];
    if (buttons.length === 0) {
      return { type: 'text', content: nextNode.data?.text || 'Opciones' };
    }
    return {
      type: 'interactive',
      content: nextNode.data?.text || 'Elige una opción',
      interactive: {
        type: 'button',
        body: { text: nextNode.data?.text || 'Elige una opción' },
        action: {
          buttons: buttons.map((btn: any) => ({
            type: 'reply',
            reply: { id: btn.id || btn.label, title: btn.label }
          }))
        }
      }
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
      content: nextNode.data?.text || 'Un asesor humano se conectará contigo en breve.'
    };
  }

  return {
    type: 'text',
    content: 'Paso no reconocido.'
  };
}
