import type { FlowContext, FlowDocument, FlowHooks, FlowNode, FlowOutput, FlowSession } from './flow-types';

const MAX_AUTOMATIC_STEPS = 80;

export function interpolate(template = '', vars: Record<string, any> = {}) {
  return String(template).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    let value: any = vars;
    for (const part of String(key).split('.')) value = value?.[part];
    return value == null ? '' : String(value);
  });
}

function normalize(v: any) { return String(v ?? '').trim().toLowerCase(); }
function tags(v: any): string[] { return Array.isArray(v) ? v.map(normalize) : String(v || '').split(',').map(normalize).filter(Boolean); }

export function compareValues(left: any, operator: string, right: any) {
  switch (operator) {
    case 'equals': return normalize(left) === normalize(right);
    case 'not_equals': return normalize(left) !== normalize(right);
    case 'contains': return normalize(left).includes(normalize(right));
    case 'not_contains': return !normalize(left).includes(normalize(right));
    case 'starts_with': return normalize(left).startsWith(normalize(right));
    case 'ends_with': return normalize(left).endsWith(normalize(right));
    case 'gt': return Number(left) > Number(right);
    case 'gte': return Number(left) >= Number(right);
    case 'lt': return Number(left) < Number(right);
    case 'lte': return Number(left) <= Number(right);
    case 'exists': return left !== undefined && left !== null && String(left).length > 0;
    case 'is_empty': return left == null || String(left).trim() === '';
    case 'not_empty': return !(left == null || String(left).trim() === '');
    case 'has_tag': return tags(left).includes(normalize(right));
    case 'not_has_tag': return !tags(left).includes(normalize(right));
    default: return false;
  }
}

function nodeById(flow: FlowDocument, id: string | null) { return id ? flow.nodes.find(n => n.id === id) || null : null; }
function nextByHandle(flow: FlowDocument, nodeId: string, handle = 'next') {
  return flow.edges.find(e => e.source === nodeId && (e.sourceHandle || 'next') === handle)?.target || null;
}
function firstNext(flow: FlowDocument, nodeId: string) { return flow.edges.find(e => e.source === nodeId)?.target || null; }
function title(node: FlowNode) { return String(node.data?.title || node.type); }

function evaluateCondition(node: FlowNode, session: FlowSession) {
  const operator = String(node.data?.operator || 'equals');
  const left = operator === 'has_tag' || operator === 'not_has_tag'
    ? session.vars.tags
    : session.vars[String(node.data?.variable || '')];
  return compareValues(left, operator, interpolate(String(node.data?.value || ''), session.vars));
}

async function executeExternalNode(node: FlowNode, flow: FlowDocument, session: FlowSession, context: FlowContext, hooks: FlowHooks) {
  if (node.type === 'api') {
    if (!hooks.executeApi) throw new Error('No existe hook executeApi.');
    Object.assign(session.vars, await hooks.executeApi({ node, session, context }));
  } else if (node.type === 'webhook') {
    if (!hooks.executeWebhook) throw new Error('No existe hook executeWebhook.');
    Object.assign(session.vars, await hooks.executeWebhook({ node, session, context }));
  } else if (node.type === 'subflow') {
    if (!hooks.runSubflow) throw new Error('No existe hook runSubflow.');
    const result = await hooks.runSubflow({ flowKey: String(node.data?.flowKey || ''), session, context });
    Object.assign(session.vars, result.vars || {});
  } else if (node.type === 'template') {
    if (!hooks.sendTemplate) throw new Error('No existe hook sendTemplate.');
    await hooks.sendTemplate({ node, session, context });
  }
  session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
}

export async function runAutomatic(
  flow: FlowDocument,
  session: FlowSession,
  context: FlowContext,
  hooks: FlowHooks = {},
): Promise<FlowOutput[]> {
  const output: FlowOutput[] = [];
  let safety = 0;

  while (session.currentNodeId && safety++ < MAX_AUTOMATIC_STEPS) {
    const node = nodeById(flow, session.currentNodeId);
    if (!node) {
      output.push({ type: 'system', text: 'El flujo apunta a un nodo inexistente.' });
      session.currentNodeId = null;
      break;
    }

    session.trace.push({ nodeId: node.id, title: title(node), at: new Date().toISOString() });
    session.trace = session.trace.slice(-60);

    if (node.data?.disabled) {
      session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      continue;
    }

    if (node.type === 'start') {
      session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      continue;
    }

    if (node.type === 'message') {
      const text = interpolate(String(node.data?.text || ''), session.vars);
      if (text) output.push({ type: 'bot', text, nodeId: node.id });
      session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      continue;
    }

    if (node.type === 'media') {
      output.push({
        type: 'bot',
        text: interpolate(String(node.data?.caption || ''), session.vars),
        nodeId: node.id,
        media: {
          type: node.data?.mediaType || 'image',
          url: interpolate(String(node.data?.url || ''), session.vars),
          filename: interpolate(String(node.data?.filename || ''), session.vars),
        },
      });
      session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      continue;
    }

    if (node.type === 'tag') {
      const action = node.data?.action === 'remove' ? 'remove' : 'add';
      const tag = normalize(interpolate(String(node.data?.tag || ''), session.vars));
      const current = new Set(tags(session.vars.tags));
      if (tag) action === 'remove' ? current.delete(tag) : current.add(tag);
      session.vars.tags = [...current];
      if (tag && hooks.applyTag) await hooks.applyTag({ action, tag, session, context });
      session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      continue;
    }

    if (node.type === 'condition') {
      session.currentNodeId = nextByHandle(flow, node.id, evaluateCondition(node, session) ? 'yes' : 'no');
      continue;
    }

    if (node.type === 'menu' || node.type === 'buttons') {
      const options = node.data?.options || [];
      const text = interpolate(String(node.data?.prompt || node.data?.title || 'Selecciona una opción:'), session.vars);
      output.push({
        type: 'bot',
        text,
        nodeId: node.id,
        interactive: { type: node.type, options: options.map((o: any) => ({ key: String(o.key), label: String(o.label) })) },
      });
      session.waiting = { type: 'choice', nodeId: node.id };
      break;
    }

    if (node.type === 'question') {
      output.push({ type: 'bot', text: interpolate(String(node.data?.prompt || 'Escribe tu respuesta:'), session.vars), nodeId: node.id });
      session.waiting = { type: 'question', nodeId: node.id, variable: String(node.data?.variable || 'respuesta') };
      break;
    }

    if (node.type === 'wait') {
      const seconds = Math.max(0, Math.min(30 * 24 * 3600, Number(node.data?.seconds || 0)));
      const nextNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      if (seconds <= 0) { session.currentNodeId = nextNodeId; continue; }
      const resumeAt = new Date(Date.now() + seconds * 1000).toISOString();
      session.waiting = { type: 'timer', nodeId: node.id, resumeAt, nextNodeId };
      session.currentNodeId = node.id;
      output.push({ type: 'schedule', nodeId: node.id, resumeAt });
      break;
    }

    if (node.type === 'ai') {
      try {
        if (!hooks.executeAI) throw new Error('El módulo IA no está disponible.');
        const prompt = interpolate(String(node.data?.prompt || ''), session.vars);
        if (!prompt.trim()) throw new Error('El bloque IA no tiene prompt.');
        const result = await hooks.executeAI({ prompt, node, session, context });
        const variable = String(node.data?.saveVariable || 'respuesta_ia');
        session.vars[variable] = result.text;
        if (node.data?.sendToUser !== false) output.push({ type: 'bot', text: result.text, nodeId: node.id, ai: result.meta });
        session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      } catch (error: any) {
        session.vars.ai_error = error?.message || 'Error IA';
        const errorMessage = interpolate(String(node.data?.errorMessage || ''), session.vars);
        if (errorMessage) output.push({ type: 'bot', text: errorMessage, nodeId: node.id });
        session.currentNodeId = nextByHandle(flow, node.id, 'error') || nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      }
      continue;
    }

    if (node.type === 'api' || node.type === 'webhook' || node.type === 'subflow' || node.type === 'template') {
      try {
        await executeExternalNode(node, flow, session, context, hooks);
      } catch (error: any) {
        session.vars.integration_error = error?.message || 'Error de integración';
        session.currentNodeId = nextByHandle(flow, node.id, 'error') || nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
      }
      continue;
    }

    if (node.type === 'human') {
      if (hooks.transferHuman) await hooks.transferHuman({ node, session, context });
      output.push({ type: 'bot', text: interpolate(String(node.data?.text || 'Te comunicaré con un asesor.'), session.vars), nodeId: node.id });
      session.pausedForHuman = true;
      session.waiting = null;
      break;
    }

    if (node.type === 'end') {
      session.currentNodeId = null;
      session.waiting = null;
      break;
    }

    session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
  }

  if (safety >= MAX_AUTOMATIC_STEPS) {
    output.push({ type: 'system', text: 'El flujo fue detenido por protección contra ciclos infinitos.' });
    session.currentNodeId = null;
    session.waiting = null;
  }

  session.updatedAt = new Date().toISOString();
  return output;
}

export async function startFlow(flow: FlowDocument, vars: Record<string, any>, context: FlowContext, hooks: FlowHooks = {}) {
  const session: FlowSession = {
    currentNodeId: flow.startNodeId,
    vars: { ...vars },
    waiting: null,
    pausedForHuman: false,
    trace: [],
    updatedAt: new Date().toISOString(),
  };
  const output = await runAutomatic(flow, session, context, hooks);
  return { session, output };
}

export async function handleFlowInput(flow: FlowDocument, session: FlowSession, input: string, context: FlowContext, hooks: FlowHooks = {}) {
  if (session.pausedForHuman) return { session, output: [] as FlowOutput[] };
  if (!session.waiting) return startFlow(flow, session.vars, context, hooks);

  const waiting = session.waiting;
  const node = nodeById(flow, waiting.nodeId);
  if (!node) throw new Error('El nodo que esperaba respuesta ya no existe.');

  if (waiting.type === 'timer') return { session, output: [] as FlowOutput[] };

  if (waiting.type === 'question') {
    session.vars[waiting.variable] = String(input).trim();
    session.waiting = null;
    session.currentNodeId = nextByHandle(flow, node.id, 'next') || firstNext(flow, node.id);
    return { session, output: await runAutomatic(flow, session, context, hooks) };
  }

  const normalized = normalize(input);
  const option = (node.data?.options || []).find((o: any) => normalize(o.key) === normalized || normalize(o.label) === normalized);
  if (!option) {
    const fallback = interpolate(String(node.data?.fallback || 'Opción no válida. Intenta otra vez.'), session.vars);
    return { session, output: [{ type: 'bot', text: fallback, nodeId: node.id }] as FlowOutput[] };
  }

  session.waiting = null;
  session.currentNodeId = nextByHandle(flow, node.id, `option:${String(option.key)}`);
  return { session, output: await runAutomatic(flow, session, context, hooks) };
}

export async function resumeTimedFlow(flow: FlowDocument, session: FlowSession, context: FlowContext, hooks: FlowHooks = {}) {
  if (session.waiting?.type !== 'timer') return { session, output: [] as FlowOutput[] };
  if (Date.now() < new Date(session.waiting.resumeAt).getTime()) return { session, output: [] as FlowOutput[] };
  session.currentNodeId = session.waiting.nextNodeId;
  session.waiting = null;
  return { session, output: await runAutomatic(flow, session, context, hooks) };
}
