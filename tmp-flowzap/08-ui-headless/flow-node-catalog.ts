import type { FlowNodeType } from '../03-motor-flujos/flow-types';

export type NodeCatalogItem = {
  type: FlowNodeType;
  label: string;
  icon: string;
  description: string;
  defaultData: Record<string, any>;
};

export const FLOW_NODE_CATALOG: NodeCatalogItem[] = [
  { type: 'start', label: 'Inicio', icon: '▶️', description: 'Punto de entrada del flujo.', defaultData: { title: 'Inicio' } },
  { type: 'message', label: 'Mensaje', icon: '💬', description: 'Envía un texto.', defaultData: { title: 'Mensaje', text: '' } },
  { type: 'menu', label: 'Menú', icon: '📋', description: 'Opciones numeradas.', defaultData: { title: 'Menú', prompt: 'Selecciona una opción:', fallback: 'Opción no válida.', options: [{ key: '1', label: 'Opción 1' }] } },
  { type: 'buttons', label: 'Botones', icon: '🔘', description: 'Opciones interactivas.', defaultData: { title: 'Botones', prompt: 'Selecciona una opción:', fallback: 'Opción no válida.', options: [{ key: '1', label: 'Opción 1' }] } },
  { type: 'question', label: 'Pregunta', icon: '✍️', description: 'Pregunta y guarda la respuesta.', defaultData: { title: 'Pregunta', prompt: 'Escribe tu respuesta:', variable: 'respuesta' } },
  { type: 'condition', label: 'Condición', icon: '🔀', description: 'Ramifica el flujo.', defaultData: { title: 'Condición', variable: 'respuesta', operator: 'equals', value: '' } },
  { type: 'media', label: 'Multimedia', icon: '🖼️', description: 'Imagen, audio, video o documento.', defaultData: { title: 'Multimedia', mediaType: 'image', url: '', caption: '', filename: '' } },
  { type: 'tag', label: 'Etiqueta', icon: '🏷️', description: 'Agrega o elimina una etiqueta.', defaultData: { title: 'Etiqueta', action: 'add', tag: 'VIP' } },
  { type: 'wait', label: 'Esperar', icon: '⏳', description: 'Reanuda el flujo más adelante.', defaultData: { title: 'Esperar', seconds: 60 } },
  { type: 'human', label: 'Asesor', icon: '👤', description: 'Pausa el bot y transfiere a humano.', defaultData: { title: 'Pasar a asesor', text: 'Te comunicaré con un asesor.' } },
  { type: 'end', label: 'Finalizar', icon: '⛔', description: 'Finaliza el flujo.', defaultData: { title: 'Finalizar' } },
  { type: 'ai', label: 'IA Premium', icon: '🧠', description: 'Usa el saldo IA del tenant.', defaultData: { title: 'IA Premium', prompt: '', saveVariable: 'respuesta_ia', sendToUser: true, errorMessage: 'No pude procesar la consulta.' } },
  { type: 'api', label: 'API', icon: '🌐', description: 'Ejecuta una integración HTTP controlada por backend.', defaultData: { title: 'API', integrationKey: '', input: {} } },
  { type: 'webhook', label: 'Webhook', icon: '🔗', description: 'Dispara un webhook configurado.', defaultData: { title: 'Webhook', integrationKey: '', input: {} } },
  { type: 'subflow', label: 'Subflujo', icon: '🧩', description: 'Ejecuta otro flujo reutilizable.', defaultData: { title: 'Subflujo', flowKey: '' } },
  { type: 'template', label: 'Plantilla WhatsApp', icon: '📄', description: 'Envía una plantilla aprobada.', defaultData: { title: 'Plantilla', templateName: '', language: '', variables: {} } },
];

export const CONDITION_OPERATORS = [
  ['equals', 'Igual a'],
  ['not_equals', 'Diferente de'],
  ['contains', 'Contiene'],
  ['not_contains', 'No contiene'],
  ['starts_with', 'Empieza por'],
  ['ends_with', 'Termina en'],
  ['gt', 'Mayor que'],
  ['gte', 'Mayor o igual'],
  ['lt', 'Menor que'],
  ['lte', 'Menor o igual'],
  ['exists', 'Existe'],
  ['is_empty', 'Está vacío'],
  ['not_empty', 'No está vacío'],
  ['has_tag', 'Tiene etiqueta'],
  ['not_has_tag', 'No tiene etiqueta'],
] as const;
