export const CONVERSATION_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'No leídos' },
  { key: 'open', label: 'Pendientes' },
  { key: 'bot', label: 'Bot' },
  { key: 'human', label: 'Humano' },
  { key: 'unassigned', label: 'Sin asignar' },
  { key: 'closed', label: 'Cerrados' },
] as const;

export type ConversationFilterKey = typeof CONVERSATION_FILTERS[number]['key'];
