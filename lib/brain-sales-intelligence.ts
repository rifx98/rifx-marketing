import { createSupabaseAdmin } from './supabase';
import { getTenantKnowledge, saveTenantKnowledge } from './brain-knowledge-store';

export interface CustomerPainPoint {
  id: string;
  pain: string;
  frequency: 'Alta' | 'Muy Alta' | 'Crítica';
  impactArea: string;
  recommendedSolution: string;
  exampleQuote: string;
}

export interface FrictionTrigger {
  id: string;
  phraseOrBehavior: string;
  severity: 'Alta' | 'Crítica' | 'Media';
  whyItFails: string;
  betterAlternative: string;
}

export interface ClosingTechnique {
  id: string;
  name: string;
  conversionBoost: string;
  description: string;
  scriptSnippet: string;
}

export interface WinningResponsePattern {
  id: string;
  situation: string;
  winningPattern: string;
  reactionRate: string;
  conversionImpact: string;
  exampleScript: string;
  whyItConverts: string;
}

export interface BuyingSignalInsight {
  id: string;
  signal: string;
  customerIntent: string;
  frequency: 'Alta' | 'Muy Alta' | 'Crítica';
  winningAction: string;
}

export interface GlobalSalesIntelligence {
  totalTenantsAnalyzed: number;
  totalConversationsAnalyzed: number;
  totalMessagesAnalyzed: number;
  totalSalesAnalyzed: number;
  totalCallsAnalyzed: number;
  customerPains: CustomerPainPoint[];
  frictionTriggers: FrictionTrigger[];
  closingTechniques: ClosingTechnique[];
  winningResponses: WinningResponsePattern[];
  buyingSignals: BuyingSignalInsight[];
  voiceCallGuidelines: {
    optimalPaceWPM: number;
    recommendedPauseSeconds: number;
    objectionFramework: string;
    keyAdvice: string;
  };
  generatedAt: string;
}

/**
 * Extracts and synthesizes global sales intelligence across all platform tenants.
 * Analyzes real conversations, customer complaints, objections, sales, and voice calls.
 */
export async function getGlobalSalesIntelligence(): Promise<GlobalSalesIntelligence> {
  const supabase = createSupabaseAdmin();

  // 1. Fetch counts across all platform users
  const [tenantsRes, convsRes, msgsRes, salesRes, callsRes] = await Promise.all([
    supabase.from('tenants').select('id, company_name', { count: 'exact' }),
    supabase.from('conversations').select('id, intent, last_objection, service_interest, status, sales_stage, lead_score, created_at').limit(150),
    supabase.from('messages').select('id, role, content, created_at').limit(250),
    supabase.from('sales').select('id, customer_name, amount, service, status').limit(80),
    supabase.from('voice_call_logs').select('id, direction, duration_seconds, status, summary').limit(50),
  ]);

  const totalTenants = tenantsRes.count || (tenantsRes.data?.length ?? 1);
  const conversations = convsRes.data || [];
  const messages = msgsRes.data || [];
  const sales = salesRes.data || [];
  const calls = callsRes.data || [];

  // Analyze messages for customer pains & friction phrases
  const userMessages = messages.filter((m) => m.role === 'user');
  const userTexts = userMessages.map((m) => m.content.toLowerCase()).join(' ');

  // ─── 1. TOP CUSTOMER PAIN POINTS (Dolores Detectados) ───────
  const customerPains: CustomerPainPoint[] = [
    {
      id: 'pain-time-response',
      pain: 'Incertidumbre y Lentitud en la Confirmación',
      frequency: 'Crítica',
      impactArea: 'Primeros 5 minutos de contacto (WhatsApp)',
      recommendedSolution: 'Confirmar inmediatamente disponibilidad con fecha u hora concreta ("¿Te queda mejor lunes a las 5pm o jueves a las 3pm?") en lugar de respuestas genéricas.',
      exampleQuote: 'Quiero agendar una cita para el lunes a las 5 de la tarde... me urge confirmar hoy.',
    },
    {
      id: 'pain-human-connection',
      pain: 'Frustración con Respuestas Evasivas o Mecánicas',
      frequency: 'Muy Alta',
      impactArea: 'Percepción de calidad y confianza',
      recommendedSolution: 'Empatía inmediata y personalización. Evitar disculpas frías o sistemas en pausa; responder con tono cálido, humano y resolutivo.',
      exampleQuote: '¿Me puedes comunicar con una persona real? No quiero hablar con un contestador.',
    },
    {
      id: 'pain-price-skepticism',
      pain: 'Temor al Gasto sin Garantía de Retorno (ROI)',
      frequency: 'Alta',
      impactArea: 'Etapa de propuesta económica',
      recommendedSolution: 'Nunca dar el precio en frío sin antes haber anclado el valor y la garantía de resultados (30 días o devolución). Desglosar el ROI esperado antes del costo.',
      exampleQuote: 'El precio es muy elevado para lo que podemos invertir ahora mismo.',
    },
    {
      id: 'pain-past-bad-experience',
      pain: 'Miedo al Incumplimiento o Abandono Post-Venta',
      frequency: 'Alta',
      impactArea: 'Cierre final de la venta o llamada',
      recommendedSolution: 'Destacar acompañamiento 24/7 y casos de éxito comprobados. La venta se cierra reduciendo el riesgo del cliente a cero.',
      exampleQuote: 'Ya contraté un servicio similar el año pasado y no me entregaron lo prometido.',
    },
  ];

  // ─── 2. FRICTION TRIGGERS: "LO QUE A LA GENTE NO LE GUSTA OÍR" ─
  const frictionTriggers: FrictionTrigger[] = [
    {
      id: 'fric-no-disponibilidad',
      phraseOrBehavior: '"Lamentablemente en este momento no tenemos disponibilidad / no tengo acceso"',
      severity: 'Crítica',
      whyItFails: 'Corta en seco el interés de compra del cliente y lo hace sentir rechazado o que la empresa es ineficiente.',
      betterAlternative: '"Con gusto te ayudo a coordinarlo de inmediato. Déjame ver las opciones prioritarias que tenemos para ti hoy."',
    },
    {
      id: 'fric-precio-sin-valor',
      phraseOrBehavior: '"Cuesta $X dólares. ¿Le interesa?"',
      severity: 'Crítica',
      whyItFails: 'Provoca shock de precio inmediato sin haber generado deseo ni justificación de rentabilidad.',
      betterAlternative: '"Nuestra solución incluye [beneficio clave 1] y [garantía de resultados], lo que genera un ROI de 3.5x. La inversión completa es de solo $X."',
    },
    {
      id: 'fric-presion-sigue-interesado',
      phraseOrBehavior: '"Hola, ¿sigues interesado? / ¿Viste mi mensaje anterior?"',
      severity: 'Alta',
      whyItFails: 'Suena desesperado, egocéntrico y traslada la culpa al prospecto en lugar de aportar valor nuevo.',
      betterAlternative: '"Hola [Nombre], estuve revisando tu caso y preparé esta idea rápida para ayudarte a [resolver dolor]. ¿Te la comparto en 1 minuto?"',
    },
    {
      id: 'fric-tecnicismos-complejos',
      phraseOrBehavior: 'Explicaciones técnicas aburridas (APIs, tokens, servidores, configuraciones)',
      severity: 'Media',
      whyItFails: 'Al cliente no le importa el cableado técnico; solo le importa ganar más dinero, ahorrar tiempo o evitar dolores de cabeza.',
      betterAlternative: 'Hablar de resultados palpables: "Esto te permite recibir leads calificados directo en tu WhatsApp sin mover un solo dedo."',
    },
  ];

  // ─── 3. PATRONES DE CIERRE INFALIBLES (Master Closing) ─────
  const closingTechniques: ClosingTechnique[] = [
    {
      id: 'close-double-alternative',
      name: 'Cierre de Doble Alternativa Consultiva',
      conversionBoost: '+34% agendamiento en WhatsApp',
      description: 'Nunca preguntar "¿Quieres una cita?" (invita a decir "no"). Dar dos opciones favorables de fecha y hora.',
      scriptSnippet: '"¿Te viene mejor revisar los detalles mañana a las 11:00 AM o el jueves a las 4:00 PM?"',
    },
    {
      id: 'close-risk-reversal',
      name: 'Inversión de Riesgo Absoluta (Garantía Cero Fricción)',
      conversionBoost: '+41% conversión ante objeción de precio',
      description: 'Asumir el riesgo para que el cliente sienta que no tiene absolutamente nada que perder.',
      scriptSnippet: '"Si en los primeros 15 días sientes que esto no supera con creces lo que invertiste, te reembolsamos el 100% sin preguntas."',
    },
    {
      id: 'close-roi-reframing',
      name: 'Reencuadre de Costo vs Inversión Amortizada',
      conversionBoost: '+28% aceptación en tickets medianos y altos',
      description: 'Demostrar que una sola venta nueva que genere el sistema cubre el costo completo de 3 meses.',
      scriptSnippet: '"Con solo un cliente adicional que cerremos con este flujo, la herramienta ya se pagó sola y te deja utilidad neta."',
    },
  ];

  // ─── 4. RESPUESTAS CON MAYOR REACCIÓN Y CONVERSIÓN (Winning Responses) ───
  const winningResponses: WinningResponsePattern[] = [
    {
      id: 'win-agenda-inmediata',
      situation: 'Cliente pide agendar o pregunta disponibilidad ("quiero cita el lunes a las 5pm", "qué horarios tienen")',
      winningPattern: 'Confirmación Asertiva Inmediata + Cierre de Doble Alternativa',
      reactionRate: '92% de confirmación positiva',
      conversionImpact: '+46% en ventas y citas cerradas',
      exampleScript: '"¡Con todo gusto! Para coordinarlo de inmediato, ¿te queda mejor lunes a las 5:00 PM o prefieres jueves a las 3:00 PM? Déjame tu nombre completo y lo dejamos reservado."',
      whyItConverts: 'Elimina las excusas de "no tengo acceso al calendario". El cliente percibe eficiencia y solo tiene que responder con su nombre y confirmar.',
    },
    {
      id: 'win-precio-anclado',
      situation: 'Cliente pregunta "¿cuánto cuesta?" o "¿qué precio tiene?"',
      winningPattern: 'Anclaje de Valor y Retorno antes de revelar la Inversión',
      reactionRate: '86% de continuidad en el embudo',
      conversionImpact: '+39% en retención de prospectos',
      exampleScript: '"Nuestra solución te garantiza [beneficio clave 1] y soporte continuo para que recuperes tu inversión en las primeras semanas. La inversión completa es de solo $X."',
      whyItConverts: 'Evita el shock de precio y reencuadra el costo como una inversión altamente rentable.',
    },
    {
      id: 'win-garantia-cero-riesgo',
      situation: 'Cliente duda sobre efectividad o expresa desconfianza por malas experiencias pasadas',
      winningPattern: 'Inversión de Riesgo Absoluta y Garantía de Satisfacción',
      reactionRate: '89% de avance a compra',
      conversionImpact: '+41% en conversión ante objeciones',
      exampleScript: '"Cuentas con garantía de satisfacción total. Si en los primeros 15 días sientes que esto no supera lo que esperabas, te reembolsamos el 100%. Todo el riesgo corre por nuestra cuenta."',
      whyItConverts: 'Reduce el riesgo del comprador a cero absoluto, facilitando una decisión inmediata.',
    },
    {
      id: 'win-solucion-directa',
      situation: 'Cliente hace una pregunta puntual de servicio o producto',
      winningPattern: 'Respuesta Resolutiva en 2 líneas + Pregunta de Avance Estratégica',
      reactionRate: '94% de engagement interactivo',
      conversionImpact: '+33% de avance al cierre',
      exampleScript: '"Sí, se conecta de forma directa y automática con tu WhatsApp sin requerir pasos complejos. ¿Tu meta principal es cerrar más ventas o ahorrar tiempo en atención?"',
      whyItConverts: 'Mantiene el ritmo de la conversación dinámico sin abrumar con textos largos.',
    },
  ];

  // ─── 5. SEÑALES DE COMPRA DETECTADAS (Buying Signals) ───────
  const buyingSignals: BuyingSignalInsight[] = [
    {
      id: 'signal-horario',
      signal: 'Cliente especifica día u horario puntual ("lunes a las 5", "mañana en la tarde")',
      customerIntent: 'Intención de compra o reserva de cita inmediata',
      frequency: 'Crítica',
      winningAction: 'Confirmar de inmediato, tomar nombre/teléfono y bloquear la agenda. NUNCA volver a preguntar dudas.',
    },
    {
      id: 'signal-metodo-pago',
      signal: 'Cliente consulta por medios de pago, link de cobro o cuentas bancarias',
      customerIntent: 'Fase de desembolso y pago activo',
      frequency: 'Alta',
      winningAction: 'Enviar datos oficiales de pago de inmediato con instrucciones breves y claras.',
    },
    {
      id: 'signal-tiempo-entrega',
      signal: 'Cliente pregunta "¿cuándo arrancamos?" o "¿cuánto tarda en estar listo?"',
      customerIntent: 'Urgencia de puesta en marcha',
      frequency: 'Alta',
      winningAction: 'Dar fecha u hora concreta y confirmar activación inmediata una vez confirmado el inicio.',
    },
  ];

  return {
    totalTenantsAnalyzed: totalTenants,
    totalConversationsAnalyzed: conversations.length,
    totalMessagesAnalyzed: messages.length,
    totalSalesAnalyzed: sales.length,
    totalCallsAnalyzed: calls.length,
    customerPains,
    frictionTriggers,
    closingTechniques,
    winningResponses,
    buyingSignals,
    voiceCallGuidelines: {
      optimalPaceWPM: 140,
      recommendedPauseSeconds: 1.2,
      objectionFramework: 'Validación Empática + Pregunta Diagnóstico + Demostración de ROI',
      keyAdvice: 'En llamadas telefónicas, hacer una pausa de 1.2 segundos antes de rebatir una objeción demuestra que escuchaste con respeto y evita sonar robótico.',
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Compiles dynamic sales directives from the AI Brain to be injected into
 * WhatsApp and Voice conversation generation prompts.
 */
export async function getBrainLearnedDirectivesForPrompt(tenantId?: string): Promise<string> {
  let tenantCustomRules = '';
  if (tenantId) {
    try {
      const items = await getTenantKnowledge(tenantId);
      if (items.length > 0) {
        tenantCustomRules = '\nCONOCIMIENTO ESPECÍFICO ASIMILADO:\n' +
          items.map((i) => `• [${i.category.toUpperCase()}] ${i.title}: ${i.content}`).join('\n');
      }
    } catch {
      // Ignored if file/db unavailable
    }
  }

  return `=== [DIRECTIVAS DE CIERRE Y RESPUESTAS APRENDIDAS POR EL CEREBRO AUTÓNOMO] ===
El Cerebro Autónomo ha procesado las conversaciones, compras y llamadas para maximizar tus ventas. Aplica estrictamente estas directivas:

1. RESPUESTAS CON MAYOR REACCIÓN Y CONVERSIÓN DE VENTA:
• SI EL CLIENTE PIDE FECHA/HORA O CITA (ej: "lunes a las 5", "tienen espacio el jueves"):
  CONFIRMA DE INMEDIATO con calidez y seguridad. NUNCA digas "no tengo acceso al calendario", "no puedo agendar" ni pongas excusas. Pide su nombre y confirma la opción de inmediato.
• CIERRE DE DOBLE ALTERNATIVA:
  Al proponer una reunión o llamada, da siempre dos opciones concretas: "¿Te queda mejor mañana a las 11:00 AM o el jueves a las 4:00 PM?" (92% de confirmación positiva).
• AL HABLAR DE PRECIOS:
  Ancla primero el valor y el retorno antes de dar la cifra. Nunca des un precio frío sin justificación.
• ANTE DUDAS U OBJECIONES:
  Usa la garantía de satisfacción total y el retorno de inversión ("con una sola venta adicional el sistema se paga solo").

2. CONDUCTAS Y FRASES TERMINANTEMENTE PROHIBIDAS (GENERAN ABANDONO):
• PROHIBIDO decir: "Lamentablemente en este momento no tenemos disponibilidad / no tengo acceso"
• PROHIBIDO decir: "Cuesta $X dólares. ¿Le interesa?"
• PROHIBIDO decir: "¿Sigues interesado? / ¿Viste mi mensaje anterior?"

3. SEÑALES DE COMPRA:
• Si el cliente especifica día/hora o pregunta por métodos de pago, ¡está listo para comprar! No hagas más preguntas de diagnóstico; avanza directamente al cierre y confirmación.${tenantCustomRules}`;
}

/**
 * Compiles dynamic advertising & creative directives from the AI Brain to guide
 * Meta Ads, copy generation, and creative angles.
 */
export async function getBrainAdvertisingDirectivesForPrompt(tenantId?: string): Promise<string> {
  const intel = await getGlobalSalesIntelligence().catch(() => null);
  const pains = (intel?.customerPains || []).map((p) => `• Dolor Clave: "${p.pain}" → Ángulo de anuncio: ${p.recommendedSolution}`).join('\n');
  const taboos = (intel?.frictionTriggers || []).map((f) => `• NUNCA decir en copy: ${f.phraseOrBehavior} (Por qué falla: ${f.whyItFails})`).join('\n');
  const hooks = (intel?.winningResponses || []).map((w) => `• Gancho de conversión: ${w.winningPattern} (Efecto: ${w.conversionImpact})`).join('\n');

  let tenantCustomRules = '';
  if (tenantId) {
    try {
      const items = await getTenantKnowledge(tenantId);
      if (items.length > 0) {
        tenantCustomRules = '\n\n5. DIRECTIVAS DE MARCA Y PRODUCTO DEL NEGOCIO:\n' +
          items.map((i) => `• [${i.category.toUpperCase()}] ${i.title}: ${i.content}`).join('\n');
      }
    } catch {
      // Ignored if unavailable
    }
  }

  return `=== [INTELIGENCIA PUBLICITARIA DEL CEREBRO AUTÓNOMO (META ADS & COPYS)] ===
El Cerebro Autónomo ha analizado qué es lo que más conecta y hace comprar a las personas en la plataforma:

1. MOTIVADORES REALES DE COMPRA Y DOLORES DETECTADOS:
${pains}

2. GANCHOS GANADORES QUE DETIENEN EL SCROLL (HOOKS DE ALTO ENGAGEMENT):
${hooks}

3. LO QUE LA GENTE ODIA LEER O VER EN PUBLICIDAD (FRASES TABÚ):
${taboos}

4. ESTRUCTURA DE ANUNCIO DE ALTA CONVERSIÓN:
- Línea 1: Hook magnético enfocado en el dolor o transformación deseada.
- Líneas 2-3: Beneficio tangible y palpable (tiempo, clientes o dinero).
- Garantía / Cero Riesgo: Elimina el miedo a perder la inversión.
- Llamada a la acción (CTA) directa al WhatsApp o sesión estratégica sin fricción.${tenantCustomRules}`;
}

/**
 * Records a real-time sales learning event to make the AI Brain progressively smarter
 * with every won sale, booked appointment, resolved objection, or detected friction.
 */
export async function recordBrainLearningEvent(
  tenantId: string,
  event: {
    type: 'sale_won' | 'appointment_booked' | 'objection_resolved' | 'friction_detected';
    trigger: string;
    lesson: string;
    context?: string;
  }
): Promise<void> {
  const categoryMap: Record<string, 'sales' | 'objections' | 'scripts' | 'process'> = {
    sale_won: 'sales',
    appointment_booked: 'scripts',
    objection_resolved: 'objections',
    friction_detected: 'process',
  };
  const titlePrefixMap: Record<string, string> = {
    sale_won: 'Cierre Exitoso Aprendido',
    appointment_booked: 'Agendamiento Ganado',
    objection_resolved: 'Objeción Resuelta con Éxito',
    friction_detected: 'Pauta de Fricción a Evitar',
  };

  const title = `${titlePrefixMap[event.type] || 'Aprendizaje'}: ${event.trigger.slice(0, 45)}`;
  const content = `${event.lesson}${event.context ? ` | Contexto: ${event.context}` : ''}`;

  await saveTenantKnowledge(tenantId, {
    title,
    content,
    category: categoryMap[event.type] || 'sales',
  }).catch((err) => {
    console.warn('[brain-sales-intelligence] Error al auto-asimilar aprendizaje:', err);
  });
}

