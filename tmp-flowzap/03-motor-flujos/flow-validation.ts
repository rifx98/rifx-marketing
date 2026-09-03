import type { FlowDocument } from './flow-types';

const NEEDS_NEXT = new Set(['start','message','question','media','tag','wait','api','webhook','subflow','template']);

function outgoing(flow: FlowDocument, nodeId: string, handle?: string) {
  return flow.edges.filter(e => e.source === nodeId && (handle === undefined || (e.sourceHandle || 'next') === handle));
}

export function validateFlow(flow: FlowDocument) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  if (!flow.startNodeId) errors.push('Falta startNodeId.');
  for (const node of flow.nodes) {
    if (!node.id) errors.push('Existe un nodo sin ID.');
    if (ids.has(node.id)) errors.push(`ID duplicado: ${node.id}`);
    ids.add(node.id);
  }
  if (flow.startNodeId && !ids.has(flow.startNodeId)) errors.push('startNodeId no existe dentro de nodes.');

  for (const edge of flow.edges) {
    if (!ids.has(edge.source)) errors.push(`Edge con origen inexistente: ${edge.source}`);
    if (!ids.has(edge.target)) errors.push(`Edge ${edge.source} apunta a nodo inexistente: ${edge.target}`);
  }

  for (const node of flow.nodes) {
    const title = String(node.data?.title || node.id);
    if (NEEDS_NEXT.has(node.type) && outgoing(flow, node.id).length === 0 && !node.data?.disabled) {
      warnings.push(`“${title}” no tiene salida.`);
    }
    if (node.type === 'condition') {
      if (!outgoing(flow, node.id, 'yes').length) errors.push(`La condición “${title}” no tiene salida Sí.`);
      if (!outgoing(flow, node.id, 'no').length) errors.push(`La condición “${title}” no tiene salida No.`);
    }
    if (node.type === 'menu' || node.type === 'buttons') {
      const options = node.data?.options || [];
      if (!options.length) errors.push(`“${title}” no tiene opciones.`);
      for (const option of options) {
        const handle = `option:${String(option.key ?? option.label ?? '')}`;
        if (!outgoing(flow, node.id, handle).length) warnings.push(`Opción “${option.label || option.key}” de “${title}” no tiene destino.`);
      }
    }
    if (node.type === 'ai' && !String(node.data?.prompt || '').trim()) errors.push(`El nodo IA “${title}” no tiene prompt.`);
    if (node.type === 'question' && !String(node.data?.variable || '').trim()) errors.push(`La pregunta “${title}” no guarda una variable.`);
  }

  // Detección de nodos inalcanzables.
  if (flow.startNodeId && ids.has(flow.startNodeId)) {
    const reachable = new Set<string>();
    const stack = [flow.startNodeId];
    while (stack.length) {
      const current = stack.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const e of outgoing(flow, current)) if (!reachable.has(e.target)) stack.push(e.target);
    }
    for (const node of flow.nodes) if (!reachable.has(node.id)) warnings.push(`Nodo inalcanzable: “${node.data?.title || node.id}”.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
