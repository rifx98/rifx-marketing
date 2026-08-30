import OpenAI from 'openai';

// ============================================
// INTENT ROUTER — Clasificación de intención
// Capa 1: Keywords (0ms, ~70% de mensajes)
// Capa 2: IA ligera (solo si Capa 1 = general_chat)
// ============================================

export type Intent =
  | 'general_chat'
  | 'sales_services'
  | 'sales_dropshipping'
  | 'support'
  | 'appointment'
  | 'payment'
  | 'human_request';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  method: 'keywords' | 'ai';
}

// ---- CAPA 1: Keywords ----

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  human_request: [
    'hablar con un humano', 'hablar con una persona', 'hablar con alguien',
    'quiero un humano', 'persona real', 'agente real', 'agente humano',
    'operador', 'asesor real', 'no quiero hablar con un bot', 'no quiero un bot',
    'eres un robot', 'eres un bot', 'quiero hablar con un asesor',
    'necesito hablar con alguien', 'pásame con un humano', 'pasame con un humano',
    'quiero atención humana', 'quiero atencion humana', 'representante',
  ],
  appointment: [
    'agendar', 'cita', 'reunión', 'reunion', 'llamada', 'videollamada',
    'horario', 'disponibilidad', 'agenda', 'quiero agendar', 'podemos hablar',
    'cuándo nos reunimos', 'cuando nos reunimos', 'agéndame', 'agendame',
  ],
  payment: [
    'pagar', 'pago', 'factura', 'transferencia', 'payphone', 'link de pago',
    'comprobante', 'recibo', 'ya pagué', 'ya pague', 'hice el pago',
    'forma de pago', 'método de pago', 'metodo de pago',
  ],
  support: [
    'ayuda', 'soporte', 'problema', 'error', 'no funciona', 'reclamo',
    'queja', 'devolución', 'devolucion', 'reembolso', 'falla', 'bug',
    'no me llega', 'no recibí', 'no recibi', 'mal servicio',
  ],
  sales_services: [
    'servicio', 'precio', 'cotización', 'cotizacion', 'presupuesto',
    'plan', 'paquete', 'qué incluye', 'que incluye', 'cómo funciona',
    'como funciona', 'resultados', 'casos de éxito', 'casos de exito',
    'me interesa', 'quiero contratar', 'quiero el servicio', 'cuánto cuesta',
    'cuanto cuesta', 'cuánto vale', 'cuanto vale', 'cuánto cobran', 'cuanto cobran',
    'invertir', 'inversión', 'inversion',
  ],
  sales_dropshipping: [
    'pedido', 'orden', 'envío', 'envio', 'dirección', 'direccion',
    'contra entrega', 'producto', 'quiero uno', 'cuántos hay', 'cuantos hay',
    'talla', 'color', 'modelo', 'disponible', 'stock',
  ],
  general_chat: [], // fallback — never matches by keyword
};

export function classifyByKeywords(message: string, isDropiEnabled: boolean): IntentResult | null {
  const lower = message.toLowerCase();

  // Orden de prioridad: human > appointment > payment > support > sales > general
  const priorityOrder: Intent[] = [
    'human_request',
    'appointment',
    'payment',
    'support',
    isDropiEnabled ? 'sales_dropshipping' : 'sales_services',
    isDropiEnabled ? 'sales_services' : 'sales_dropshipping',
  ];

  for (const intent of priorityOrder) {
    const keywords = INTENT_KEYWORDS[intent];
    const matchCount = keywords.filter(kw => lower.includes(kw)).length;
    if (matchCount > 0) {
      return {
        intent,
        confidence: Math.min(0.95, 0.6 + matchCount * 0.1),
        method: 'keywords',
      };
    }
  }

  return null; // No match → goes to Layer 2 (AI)
}

// ---- CAPA 2: IA ligera (solo si Capa 1 no clasificó) ----

export async function classifyByAI(
  message: string,
  apiKey: string,
  isDropiEnabled: boolean
): Promise<IntentResult> {
  const fallback: IntentResult = { intent: 'general_chat', confidence: 0.5, method: 'ai' };

  if (!apiKey || apiKey.length < 10) return fallback;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const validIntents = [
      'general_chat', 'sales_services', 'support', 'appointment', 'payment',
      ...(isDropiEnabled ? ['sales_dropshipping'] : []),
    ];

    const completion = await client.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content: `Clasifica el mensaje del usuario en UNA de estas intenciones: ${validIntents.join(', ')}.
Responde SOLO con el nombre de la intención, nada más.`,
        },
        { role: 'user', content: message },
      ],
      max_tokens: 20,
      temperature: 0,
    });

    const raw = (completion.choices[0]?.message?.content || '').trim().toLowerCase();
    const matched = validIntents.find(i => raw.includes(i));

    return {
      intent: (matched as Intent) || 'general_chat',
      confidence: matched ? 0.8 : 0.4,
      method: 'ai',
    };
  } catch (err) {
    console.error('⚠️ Intent Router AI fallback error:', err);
    return fallback;
  }
}

// ---- FUNCIÓN PRINCIPAL ----

export async function classifyIntent(
  message: string,
  isDropiEnabled: boolean,
  aiKey?: string
): Promise<IntentResult> {
  // Capa 1: Keywords
  const keywordResult = classifyByKeywords(message, isDropiEnabled);
  if (keywordResult) {
    return keywordResult;
  }

  // Capa 2: IA ligera (solo si keywords no resolvieron)
  if (aiKey) {
    return classifyByAI(message, aiKey, isDropiEnabled);
  }

  // Sin IA disponible → fallback
  return { intent: 'general_chat', confidence: 0.3, method: 'keywords' };
}
