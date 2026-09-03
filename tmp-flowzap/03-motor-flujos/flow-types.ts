export type FlowNodeType =
  | 'start'
  | 'message'
  | 'menu'
  | 'buttons'
  | 'question'
  | 'condition'
  | 'media'
  | 'tag'
  | 'wait'
  | 'human'
  | 'end'
  | 'ai'
  | 'api'
  | 'webhook'
  | 'subflow'
  | 'template';

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  position?: { x: number; y: number };
  data: Record<string, any>;
};

export type FlowEdge = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
};

export type FlowDocument = {
  schemaVersion: 2;
  name: string;
  startNodeId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata?: Record<string, any>;
};

export type FlowWaiting =
  | { type: 'question'; nodeId: string; variable: string }
  | { type: 'choice'; nodeId: string }
  | { type: 'timer'; nodeId: string; resumeAt: string; nextNodeId: string | null };

export type FlowSession = {
  currentNodeId: string | null;
  vars: Record<string, any>;
  waiting: FlowWaiting | null;
  pausedForHuman: boolean;
  trace: Array<{ nodeId: string; title: string; at: string }>;
  updatedAt: string;
};

export type FlowOutput =
  | { type: 'bot'; text: string; nodeId: string; interactive?: any; media?: any; ai?: any }
  | { type: 'system'; text: string; nodeId?: string }
  | { type: 'schedule'; nodeId: string; resumeAt: string };

export type FlowContext = {
  tenantId: string;
  whatsappAccountId?: string;
  conversationId?: string;
  phone?: string;
  source?: 'whatsapp' | 'simulator' | 'manual' | string;
};

export type FlowHooks = {
  executeAI?: (input: { prompt: string; node: FlowNode; session: FlowSession; context: FlowContext }) => Promise<{ text: string; meta?: any }>;
  applyTag?: (input: { action: 'add' | 'remove'; tag: string; session: FlowSession; context: FlowContext }) => Promise<void>;
  transferHuman?: (input: { node: FlowNode; session: FlowSession; context: FlowContext }) => Promise<void>;
  executeApi?: (input: { node: FlowNode; session: FlowSession; context: FlowContext }) => Promise<Record<string, any>>;
  executeWebhook?: (input: { node: FlowNode; session: FlowSession; context: FlowContext }) => Promise<Record<string, any>>;
  runSubflow?: (input: { flowKey: string; session: FlowSession; context: FlowContext }) => Promise<{ vars?: Record<string, any> }>;
  sendTemplate?: (input: { node: FlowNode; session: FlowSession; context: FlowContext }) => Promise<void>;
};
