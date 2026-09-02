export type ID = string;

export type WhatsAppAccountOption = {
  id: ID;
  name: string;
  displayPhone?: string;
  status?: 'connected' | 'demo' | 'error' | 'disabled';
};

export type Advisor = {
  id: ID;
  name: string;
  email?: string;
  role?: 'Administrador' | 'Supervisor' | 'Asesor' | string;
  status?: 'Disponible' | 'Ocupado' | 'Desconectado' | string;
};

export type Contact = {
  id?: ID;
  phone: string;
  name?: string;
  tags?: string[];
  notes?: string;
  fields?: Record<string, string>;
  lastSeenAt?: string;
};

export type ChatMessage = {
  id?: ID;
  direction: 'in' | 'out' | 'system';
  text?: string;
  createdAt?: string;
  status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  media?: { type?: string; url?: string; filename?: string };
};

export type ConversationSummary = {
  id?: ID;
  phone: string;
  name?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unread?: number;
  status?: 'open' | 'closed' | string;
  botPaused?: boolean;
  advisorName?: string;
  whatsappAccountName?: string;
};

export type ConversationDetail = ConversationSummary & {
  contact?: Contact;
  assignedTo?: ID | null;
  messages: ChatMessage[];
};

export type FlowNodeView = {
  id: ID;
  type: string;
  title?: string;
  summary?: string;
  disabled?: boolean;
};

export type AICreditMovement = {
  id: ID;
  createdAt: string;
  type: 'purchase' | 'usage' | 'bonus' | 'refund' | 'adjustment' | string;
  amount: number;
  balanceAfter: number;
  reference?: string;
};

export type AIUsageRow = {
  id: ID;
  createdAt: string;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  credits?: number;
  estimatedCost?: number;
  source?: string;
};
