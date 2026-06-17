// ============================================
// LEAD SCORING — Puntuación de leads 0-100
// Determinista, sin llamadas a IA
// ============================================

export interface ScoreSignals {
  hasBusinessIdentified: boolean;  // +15
  hasClearProblem: boolean;        // +15
  hasUrgency: boolean;             // +10
  hasBudget: boolean;              // +10
  askedForPrice: boolean;          // +10
  requestedCall: boolean;          // +15
  acceptedProposal: boolean;       // +20
  gaveContactData: boolean;        // +5
  messageCount: number;            // +1 por msg, max +10
}

const SIGNAL_WEIGHTS: Record<keyof Omit<ScoreSignals, 'messageCount'>, number> = {
  hasBusinessIdentified: 15,
  hasClearProblem: 15,
  hasUrgency: 10,
  hasBudget: 10,
  askedForPrice: 10,
  requestedCall: 15,
  acceptedProposal: 20,
  gaveContactData: 5,
};

export function calculateLeadScore(signals: ScoreSignals): number {
  let score = 0;

  for (const [key, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    if (signals[key as keyof typeof SIGNAL_WEIGHTS]) {
      score += weight;
    }
  }

  // Bonus por engagement (mensajes intercambiados)
  score += Math.min(10, signals.messageCount);

  return Math.min(100, Math.max(0, score));
}

// ---- DETECCIÓN DE SEÑALES POR KEYWORDS ----

const SIGNAL_KEYWORDS: Record<keyof Omit<ScoreSignals, 'messageCount'>, string[]> = {
  hasBusinessIdentified: [
    'mi empresa', 'mi negocio', 'tengo un', 'tengo una', 'mi tienda',
    'mi marca', 'soy dueño', 'soy dueña', 'mi emprendimiento', 'mi local',
    'mi restaurante', 'mi clínica', 'mi consultorio', 'mi agencia',
  ],
  hasClearProblem: [
    'no consigo', 'me cuesta', 'necesito', 'el problema es', 'no logro',
    'quiero mejorar', 'no tengo clientes', 'no vendo', 'pocas ventas',
    'no me encuentran', 'no aparezco', 'necesito más', 'quiero crecer',
  ],
  hasUrgency: [
    'urgente', 'lo antes posible', 'esta semana', 'cuanto antes',
    'es para ya', 'pronto', 'lo necesito rápido', 'lo necesito rapido',
    'inmediato', 'hoy mismo', 'mañana', 'lo más pronto',
  ],
  hasBudget: [
    'tengo presupuesto', 'puedo invertir', 'mi presupuesto es',
    'dispongo de', 'tengo para invertir', 'cuento con',
  ],
  askedForPrice: [
    'precio', 'cuánto cuesta', 'cuanto cuesta', 'cuánto vale', 'cuanto vale',
    'cotización', 'cotizacion', 'presupuesto', 'inversión', 'inversion',
    'cuánto cobran', 'cuanto cobran', 'tarifas', 'costos',
  ],
  requestedCall: [
    'agendar', 'llamada', 'reunión', 'reunion', 'videollamada',
    'quiero agendar', 'podemos hablar', 'una llamada', 'una reunión',
  ],
  acceptedProposal: [
    'acepto', 'dale', 'hagámoslo', 'hagamoslo', 'sí quiero', 'si quiero',
    'lo quiero', 'quiero empezar', 'vamos', 'perfecto', 'de acuerdo',
    'listo', 'contrátenme', 'contratenme',
  ],
  gaveContactData: [
    '@', '.com', '.ec', '.co', '.mx',
  ],
};

export function detectSignalsFromMessage(
  message: string,
  currentSignals: Partial<ScoreSignals>
): ScoreSignals {
  const lower = message.toLowerCase();
  const signals: ScoreSignals = {
    hasBusinessIdentified: currentSignals.hasBusinessIdentified || false,
    hasClearProblem: currentSignals.hasClearProblem || false,
    hasUrgency: currentSignals.hasUrgency || false,
    hasBudget: currentSignals.hasBudget || false,
    askedForPrice: currentSignals.askedForPrice || false,
    requestedCall: currentSignals.requestedCall || false,
    acceptedProposal: currentSignals.acceptedProposal || false,
    gaveContactData: currentSignals.gaveContactData || false,
    messageCount: (currentSignals.messageCount || 0) + 1,
  };

  for (const [signal, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
    if (!signals[signal as keyof typeof SIGNAL_KEYWORDS]) {
      if (keywords.some(kw => lower.includes(kw))) {
        (signals as any)[signal] = true;
      }
    }
  }

  // Detección adicional: teléfono extra (no el de WhatsApp)
  if (!signals.gaveContactData) {
    const phoneRegex = /(?:09|593|\+593)\d{8,9}/;
    if (phoneRegex.test(message)) {
      signals.gaveContactData = true;
    }
  }

  return signals;
}

// ---- INFERIR ETAPA DE VENTAS ----

export type SalesStage =
  | 'new_lead' | 'discovery' | 'qualified' | 'proposal'
  | 'objection' | 'closing' | 'won' | 'lost';

export function inferSalesStage(
  currentStage: string,
  leadScore: number,
  _intent: string,
  acceptedProposal: boolean
): SalesStage {
  // No retroceder de won/lost
  if (currentStage === 'won' || currentStage === 'lost') {
    return currentStage as SalesStage;
  }

  // Progresión basada en score + señales
  if (acceptedProposal) return 'closing';
  if (leadScore >= 80) return 'closing';
  if (leadScore >= 60) return 'proposal';
  if (leadScore >= 40) return 'qualified';
  if (leadScore >= 20) return 'discovery';
  return 'new_lead';
}

// ---- EXTRAER METADATA DEL TAG POST-IA ----

export interface SalesMetadata {
  objection?: string;
  nextAction?: string;
  businessType?: string;
  urgency?: string;
  serviceInterest?: string;
  budgetRange?: string;
}

export function extractSalesMetadata(aiResponse: string): {
  cleanResponse: string;
  metadata: SalesMetadata;
} {
  const metaMatch = aiResponse.match(/\[SALES_META:(.+?)\]/);
  if (!metaMatch) {
    return { cleanResponse: aiResponse, metadata: {} };
  }

  const cleanResponse = aiResponse.replace(/\[SALES_META:.+?\]/, '').trim();
  const metadata: SalesMetadata = {};
  const pairs = metaMatch[1].split('|');

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    if (!key || !value) continue;

    if (key === 'objection') metadata.objection = value;
    else if (key === 'next_action') metadata.nextAction = value;
    else if (key === 'business_type') metadata.businessType = value;
    else if (key === 'urgency') metadata.urgency = value;
    else if (key === 'service_interest') metadata.serviceInterest = value;
    else if (key === 'budget_range') metadata.budgetRange = value;
  }

  return { cleanResponse, metadata };
}
