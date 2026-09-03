import type { FlowDocument, FlowEdge, FlowNode } from './flow-types';

function edge(source: string, target: string | undefined | null, sourceHandle?: string): FlowEdge | null {
  if (!target) return null;
  return { id: `${source}-${sourceHandle || 'next'}-${target}`, source, target, sourceHandle: sourceHandle || 'next' };
}

export function normalizeFlowDocument(input: any): FlowDocument {
  if (!input || !Array.isArray(input.nodes)) throw new Error('Flujo inválido: falta nodes[].');

  // Formato CRM/React Flow ya normalizado.
  if (Array.isArray(input.edges)) {
    return {
      schemaVersion: 2,
      name: String(input.name || 'Chatbot'),
      startNodeId: String(input.startNodeId || input.nodes.find((n: any) => n.type === 'start')?.id || ''),
      nodes: input.nodes.map((n: any) => ({
        id: String(n.id),
        type: n.type,
        position: n.position || { x: Number(n.x || 0), y: Number(n.y || 0) },
        data: n.data || Object.fromEntries(Object.entries(n).filter(([k]) => !['id','type','x','y','position'].includes(k))),
      })) as FlowNode[],
      edges: input.edges,
      metadata: input.metadata || {},
    };
  }

  // Compatibilidad con FlowZap V2/V3 enlazado por next/yes/no/options[].next.
  const edges: FlowEdge[] = [];
  const nodes: FlowNode[] = input.nodes.map((n: any) => {
    const next = edge(n.id, n.next, 'next'); if (next) edges.push(next);
    const yes = edge(n.id, n.yes, 'yes'); if (yes) edges.push(yes);
    const no = edge(n.id, n.no, 'no'); if (no) edges.push(no);
    const onError = edge(n.id, n.onError, 'error'); if (onError) edges.push(onError);
    for (const option of n.options || []) {
      const optionEdge = edge(n.id, option.next, `option:${String(option.key ?? option.label ?? '')}`);
      if (optionEdge) edges.push(optionEdge);
    }
    const data = { ...n };
    delete data.id; delete data.type; delete data.x; delete data.y;
    delete data.next; delete data.yes; delete data.no; delete data.onError;
    if (Array.isArray(data.options)) data.options = data.options.map((o: any) => ({ key: o.key, label: o.label }));
    return { id: String(n.id), type: n.type, position: { x: Number(n.x || 0), y: Number(n.y || 0) }, data } as FlowNode;
  });

  return {
    schemaVersion: 2,
    name: String(input.name || 'Chatbot'),
    startNodeId: String(input.startNodeId || input.nodes.find((n: any) => n.type === 'start')?.id || ''),
    nodes,
    edges,
    metadata: { ...(input.metadata || {}), migratedFromLinkedFlow: true },
  };
}
