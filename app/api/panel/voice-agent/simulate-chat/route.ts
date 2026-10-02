import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  parseNaturalDate,
  parseNaturalTime,
  bookAppointment,
  getNowInTimezone,
  evaluateVoiceAvailability,
  formatTimeLabel
} from '@/lib/calendar-booking';
import { VOICE_AGENT_CLOSING_PROMPT } from '@/lib/sales-prompts';
import { getBrainLearnedDirectivesForPrompt } from '@/lib/brain-sales-intelligence';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const body = await req.json();
    const { message, system_prompt, history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    const cleanPrompt = system_prompt?.trim() || VOICE_AGENT_CLOSING_PROMPT;
    const now = getNowInTimezone();

    // Detectar si en el historial ya se acordó o se confirmó la cita
    const lowerMsg = message.toLowerCase().trim();
    const allUserTexts = [...history.filter((m: any) => m.role === 'user').map((m: any) => m.text), message].join(' ').toLowerCase();
    const isAcknowledgement = /\b(ok|okay|gracias|muchas gracias|listo|de acuerdo|perfecto|chao|adi[oó]s|hasta luego|vale|dale|eso era todo)\b/i.test(lowerMsg);

    const hasConfirmedAppointmentInHistory = history.some(
      (m: any) =>
        m.role === 'agent' &&
        (m.text.toLowerCase().includes('queda agendada') ||
          m.text.toLowerCase().includes('agendado') ||
          m.text.toLowerCase().includes('agendada') ||
          m.text.toLowerCase().includes('te esperamos'))
    );

    // Si la cita ya se confirmó previamente y el cliente dice gracias / listo / adiós, despedir y colgar de inmediato
    if (hasConfirmedAppointmentInHistory && isAcknowledgement) {
      return NextResponse.json({
        reply: '¡Ha sido un verdadero placer! Que tengas un excelente día, hasta luego.',
        hang_up: true,
        appointment_created: false
      });
    }

    // Detectar si el asesor propuso un horario en mensajes recientes y el cliente acaba de aceptarlo
    const agentMsgs = [...history].reverse().filter((m: any) => m.role === 'agent');
    const lastAgentText = agentMsgs[0]?.text || '';
    const prevAgentText = agentMsgs[1]?.text || '';

    let proposedDateFromAgent = parseNaturalDate(lastAgentText) || parseNaturalDate(prevAgentText);
    let proposedTimeFromAgent = parseNaturalTime(lastAgentText) || parseNaturalTime(prevAgentText);

    const isAffirmation = /\b(s[ií]|claro|por supuesto|me parece bien|me parecer[ií]a muy bien|me parece perfecto|perfecto|dale|de una|est[aá] bien|bueno|de acuerdo|va|exacto|listo|hag[aá]mosle|seguro|totalmente|me queda bien)\b/i.test(lowerMsg);

    // Si el cliente se queja de repetición ("ya quedamos para el lunes...")
    const isComplainingAboutRepeat = /\b(ya quedamos|ya agendamos|ya te dije|ya hab[ií]amos quedado|por qu[eé] me preguntas de nuevo|otra vez|ya te hab[ií]a dicho)\b/i.test(lowerMsg);
    if (isComplainingAboutRepeat) {
      const repeatDate = parseNaturalDate(message) || proposedDateFromAgent;
      const repeatTime = parseNaturalTime(message) || proposedTimeFromAgent;
      let dayName = 'el lunes';
      if (repeatDate) {
        const [y, m, d] = repeatDate.split('-').map(Number);
        const dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
        dayName = ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'][dayOfWeek] || 'el día acordado';
      }
      const timeStr = repeatTime ? formatTimeLabel(repeatTime.time24) : '3:00 PM';

      if (repeatDate && repeatTime) {
        try {
          await bookAppointment({
            tenantId: tenant.tenantId,
            customerName: 'Cliente Agente de Voz',
            phoneNumber: '593999999999',
            date: repeatDate,
            time: repeatTime.time24,
            service: 'Asesoría Comercial',
            notes: `Agendado automáticamente tras queja de repetición del cliente: "${message}"`,
            force: true
          });
        } catch (e) {}
      }

      return NextResponse.json({
        reply: `¡Tienes toda la razón, disculpa la confusión! Ya queda confirmada tu sesión para ${dayName} a las ${timeStr}. Te esperamos puntuales.`,
        hang_up: false,
        appointment_created: true
      });
    }

    // Si el cliente está aceptando el horario ofrecido por el asesor
    if (
      isAffirmation &&
      proposedDateFromAgent &&
      proposedTimeFromAgent &&
      (lastAgentText.includes('?') ||
        /te\s+(?:queda|parece)|agendar|horario|sesi[oó]n|cita/i.test(lastAgentText) ||
        /te\s+(?:queda|parece)|agendar|horario|sesi[oó]n|cita/i.test(prevAgentText))
    ) {
      let detectedService = 'Asesoría Comercial / Crecimiento de Negocio';
      if (/peluquer[ií]a|sal[oó]n|barber[ií]a|est[eé]tica|spa|u[ñn]as/i.test(allUserTexts)) {
        detectedService = 'Peluquería / Sistema de Citas y Reservas';
      } else if (/p[aá]gina\s*web|sitio\s*web|landing|web/i.test(allUserTexts)) {
        detectedService = 'Desarrollo Web / Landing Page';
      } else if (/pauta|publicidad|anuncio|meta\s*ads|campa[ñn]a/i.test(allUserTexts)) {
        detectedService = 'Pautas Publicitarias / Campañas Digitales';
      } else if (/tienda|e-?commerce/i.test(allUserTexts)) {
        detectedService = 'Tienda Online / Comercio Electrónico';
      }

      const booking = await bookAppointment({
        tenantId: tenant.tenantId,
        customerName: 'Cliente Agente de Voz',
        phoneNumber: '593999999999',
        date: proposedDateFromAgent,
        time: proposedTimeFromAgent.time24,
        service: detectedService,
        notes: `Agendado automáticamente vía Agente de Voz IA.\nAcuerdo confirmado por el cliente tras propuesta: "${lastAgentText}"`,
        force: true
      });

      const [y, m, d] = proposedDateFromAgent.split('-').map(Number);
      const targetDayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
      const targetDayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][targetDayOfWeek] || 'el día acordado';
      const formattedTime = formatTimeLabel(proposedTimeFromAgent.time24);

      return NextResponse.json({
        reply: `¡Excelente! Ya queda agendada tu sesión para el ${targetDayName.toLowerCase()} a las ${formattedTime}. Te esperamos puntuales.`,
        hang_up: false,
        appointment_created: true,
        appointment_details: {
          date: proposedDateFromAgent,
          time: proposedTimeFromAgent.time24,
          service: detectedService,
          appointmentId: booking.appointment?.id
        }
      });
    }

    // 1. Extraer fecha candidata: mensaje actual -> historial reciente
    let candidateDate = parseNaturalDate(message);
    if (!candidateDate) {
      const recentUserTexts = [...history]
        .reverse()
        .filter((m: any) => m.role === 'user')
        .slice(0, 3)
        .map((m: any) => m.text || '');
      for (const prevTxt of recentUserTexts) {
        const d = parseNaturalDate(prevTxt);
        if (d) {
          candidateDate = d;
          break;
        }
      }
    }

    // 2. Extraer hora candidata: mensaje actual
    const candidateTime = parseNaturalTime(message);

    // Si hay hora pero no fecha, y se está proponiendo horario:
    if (!candidateDate && candidateTime) {
      if (candidateTime.hour > now.hour) {
        candidateDate = now.dateStr;
      } else {
        const tmr = new Date(Date.now() + 24 * 60 * 60 * 1000);
        candidateDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tmr);
      }
    }

    // 3. Evaluar en tiempo real la disponibilidad en el calendario del negocio
    const calEval = await evaluateVoiceAvailability(tenant.tenantId, candidateDate, candidateTime);

    let availabilityInstructions = `
[HORARIOS Y DÍAS DE ATENCIÓN DEL CALENDARIO]:
- Días de atención configurados: ${calEval.calConfig.businessDaysFormatted}.
- Horario de atención configurado: de ${calEval.calConfig.startHourLabel} a ${calEval.calConfig.endHourLabel}.
- Si el cliente pregunta qué días o a qué horas atienden, indícale exactamente estos datos.`;

    if (calEval.hasProposal) {
      if (calEval.status === 'day_not_allowed') {
        availabilityInstructions += `
[REVISIÓN DE DISPONIBILIDAD EN TIEMPO REAL - ESE DÍA NO SE PUEDE]:
- El cliente propuso: ${candidateDate} (${calEval.targetDayName}).
- RESULTADO: NO SE PUEDE ATENDER ESE DÍA.
- Motivo: ${calEval.reason}.
- Próximo día disponible: ${calEval.nextAvailableDate || 'el próximo día hábil'}.
- REGLA OBLIGATORIA: Explícale amablemente al cliente que los ${calEval.targetDayName} no atienden. Indícale que los días de atención son de ${calEval.calConfig.businessDaysFormatted} de ${calEval.calConfig.startHourLabel} a ${calEval.calConfig.endHourLabel}, y proponle agendar para ${calEval.nextAvailableDate || 'el siguiente día hábil'}. ¡NO confirmes cita para ese día no laborable!`;
      } else if (calEval.status === 'outside_hours') {
        const slotsStr = calEval.suggestedSlots.slice(0, 3).map(s => s.label).join(' o ');
        availabilityInstructions += `
[REVISIÓN DE DISPONIBILIDAD EN TIEMPO REAL - FUERA DE HORARIO]:
- El cliente propuso: ${candidateTime?.time24} (${formatTimeLabel(candidateTime?.time24 || '')}).
- RESULTADO: FUERA DEL HORARIO DE ATENCIÓN.
- Horario de atención: ${calEval.calConfig.startHourLabel} a ${calEval.calConfig.endHourLabel}.
- Horarios libres disponibles en ese día: ${slotsStr || 'horarios dentro de la jornada'}.
- REGLA OBLIGATORIA: Explícale amablemente que el horario de atención es de ${calEval.calConfig.startHourLabel} a ${calEval.calConfig.endHourLabel}, y ofrécele uno de los horarios libres (por ejemplo: ${slotsStr}). ¡NO confirmes un horario fuera de atención!`;
      } else if (calEval.status === 'slot_busy') {
        const slotsStr = calEval.suggestedSlots.slice(0, 3).map(s => s.label).join(' o ');
        availabilityInstructions += `
[REVISIÓN DE DISPONIBILIDAD EN TIEMPO REAL - HORARIO OCUPADO]:
- El cliente propuso: ${candidateTime?.time24} (${formatTimeLabel(candidateTime?.time24 || '')}).
- RESULTADO: ESE HORARIO YA ESTÁ OCUPADO EN EL CALENDARIO.
- Horarios libres disponibles en ese día: ${slotsStr}.
- REGLA OBLIGATORIA: Dile con empatía que las ${formatTimeLabel(candidateTime?.time24 || '')} ya está reservado por otra cita, pero que tienes disponibilidad a las ${slotsStr}. Pregúntale cuál de esos horarios le queda mejor. ¡NO confirmes un horario ocupado!`;
      } else if (calEval.status === 'no_slots_left') {
        availabilityInstructions += `
[REVISIÓN DE DISPONIBILIDAD EN TIEMPO REAL - DÍA SIN DISPONIBILIDAD]:
- Para el ${calEval.targetDayName} ya no quedan espacios libres.
- REGLA OBLIGATORIA: Explícale amablemente que la agenda para ese día está llena y pregúntale si prefiere el día siguiente.`;
      } else if (calEval.status === 'available' && candidateDate && candidateTime) {
        let detectedService = 'Asesoría Comercial / Crecimiento de Negocio';

        if (/peluquer[ií]a|sal[oó]n|barber[ií]a|est[eé]tica|spa|u[ñn]as/i.test(allUserTexts)) {
          detectedService = 'Peluquería / Sistema de Citas y Reservas';
        } else if (/p[aá]gina\s*web|sitio\s*web|landing|web/i.test(allUserTexts)) {
          detectedService = 'Desarrollo Web / Landing Page';
        } else if (/pauta|publicidad|anuncio|meta\s*ads|campa[ñn]a/i.test(allUserTexts)) {
          detectedService = 'Pautas Publicitarias / Campañas Digitales';
        } else if (/tienda|e-?commerce/i.test(allUserTexts)) {
          detectedService = 'Tienda Online / Comercio Electrónico';
        }

        const booking = await bookAppointment({
          tenantId: tenant.tenantId,
          customerName: 'Cliente Agente de Voz',
          phoneNumber: '593999999999',
          date: candidateDate,
          time: candidateTime.time24,
          service: detectedService,
          notes: `Agendado automáticamente vía Agente de Voz IA.\nSolicitud directa disponible: "${message}"`,
          force: true
        });

        const formattedTime = formatTimeLabel(candidateTime.time24);
        const dayLabel = (calEval.targetDayName || 'el día acordado').toLowerCase();
        return NextResponse.json({
          reply: `¡Excelente! Ya queda agendada tu sesión para el ${dayLabel} a las ${formattedTime}. Te esperamos puntuales.`,
          hang_up: false,
          appointment_created: true,
          appointment_details: {
            date: candidateDate,
            time: candidateTime.time24,
            service: detectedService,
            appointmentId: booking.appointment?.id
          }
        });
      }
    }

    // Analizar el estado acumulado de la conversación
    const allAgentTexts = history.filter((m: any) => m.role === 'agent').map((m: any) => m.text).join(' ').toLowerCase();

    const hasMentionedBusiness = /peluquer[ií]a|sal[oó]n|barber[ií]a|est[eé]tica|spa|u[ñn]as|tienda|comercio|restaurante|cl[ií]nica|consultorio|negocio|empresa|local/i.test(allUserTexts);
    const hasMentionedGoal = /llenar\s+(?:mi\s+)?agenda|citas|clientes|reservas|vender|fidelizar|crecer|facturar/i.test(allUserTexts);
    const hasSchedulingStarted = allAgentTexts.includes('calendario') || allAgentTexts.includes('agendemos') || allAgentTexts.includes('horario') || allAgentTexts.includes('atención') || allAgentTexts.includes('lunes');

    let dynamicPhaseDirective = '';
    if (hasConfirmedAppointmentInHistory) {
      dynamicPhaseDirective = `
[FASE ACTUAL: CITA YA CONFIRMADA Y GUARDADA EN EL CALENDARIO]
- La cita ya quedó guardada con éxito.
- ¡NO ofrezcas más horarios, NO preguntes qué servicio busca, NO hagas más preguntas de negocio!
- Si el cliente dice 'gracias', 'listo', 'eso era todo' o se despide: despídete con una sola frase cálida y agrega al final [COLGAR_LLAMADA].
- Si el cliente hace una pregunta puntual (ej: por dónde se conectan), responde en 1 frase y agrega al final [COLGAR_LLAMADA].`;
    } else if (hasSchedulingStarted || (hasMentionedBusiness && hasMentionedGoal)) {
      dynamicPhaseDirective = `
[FASE ACTUAL: COORDINACIÓN DE HORARIO EN CALENDARIO]
- El cliente YA te dijo su negocio y su objetivo. ¡LA FASE DE DIAGNÓSTICO ESTÁ 100% TERMINADA!
- ¡PROHIBIDO TOTALMENTE volver a preguntar cómo maneja las citas, qué le frena para crecer, o qué objetivos tiene!
- ¡PROHIBIDO TOTALMENTE repetir el pitch de ventas o volver a preguntar qué servicio busca!
- Tu ÚNICO foco en este momento es acordar la fecha y la hora en el calendario.
- Si el horario que propusiste fue aceptado, confírmalo de inmediato con energía.`;
    }

    const brainDirectives = await getBrainLearnedDirectivesForPrompt(tenant.tenantId).catch(() => '');

    const systemInstruction = `${VOICE_AGENT_CLOSING_PROMPT}

${brainDirectives}

[CONTEXTO DE TIEMPO REAL]:
- Hoy es: ${now.dayName}, fecha ${now.dateStr}. Hora actual: ${now.hour}:${String(now.minute).padStart(2, '0')}.
- Si el cliente dice "hoy", "el día de hoy" o pregunta si se puede hoy, la fecha es HOY (${now.dayName} ${now.dateStr}).
${availabilityInstructions}
${dynamicPhaseDirective}

[REGLAS CRÍTICAS DE CONVERSACIÓN TELEFÓNICA]:
1. NUNCA SALUDES DE NUEVO: La llamada ya comenzó y ya saludaste en el primer mensaje. NUNCA digas "Hola", "Buenas tardes" ni "Soy el asesor comercial de RIFX". Ve DIRECTO a responder la pregunta del cliente.
2. CERO FRASES ROBÓTICAS: ¡PROHIBIDO empezar con "Entiendo perfectamente"! Usa variedad: "¡Buenísimo!", "¡Totalmente!", "Tiene todo el sentido,", "¡Claro que sí!", "De una,".
3. Ya estás en una llamada telefónica en vivo. NUNCA digas "¿hacemos una llamada?" ni "¿a qué hora te llamamos?". Di directamente: "agendemos tu sesión en el calendario".
4. Si el cliente ya mencionó de qué es su negocio (ej: peluquería, restaurante, etc.) y su problema, NO le preguntes de nuevo lo mismo. Valídalo y pasa al pitch breve de beneficios y luego al agendamiento.
5. CERO ALUCINACIONES DE DISPONIBILIDAD: Respeta estrictamente el estado del calendario. Si el día no se atiende, o la hora está ocupada o fuera de horario, díselo al cliente y propónle alternativas disponibles. Si está disponible, confirma con alegría.
6. Si la conversación ha concluido o el cliente se despide, despídete cordialmente e incluye al final: [COLGAR_LLAMADA].
7. Responde de forma concisa (1 o máximo 2 oraciones breves y dinámicas). Cero viñetas o markdown.`;

    let rawReply = '';

    // 1. Probar Groq (Motor de respuesta ultra-rápido y conversacional)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map((m: any) => ({
            role: m.role === 'agent' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ];

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.8-27b',
            messages,
            max_tokens: 160,
            temperature: 0.65
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) rawReply = content.trim();
        }
      } catch (groqErr) {
        console.warn('[simulate-chat] Error con Groq:', groqErr);
      }
    }

    // 2. Probar Gemini si no hubo respuesta
    if (!rawReply) {
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (geminiKey) {
        try {
          const geminiContents = history.map((m: any) => ({
            role: m.role === 'agent' ? 'model' : 'user',
            parts: [{ text: m.text || '' }]
          }));
          if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
            geminiContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
          }
          geminiContents.push({ role: 'user', parts: [{ text: message }] });

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: geminiContents,
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: { maxOutputTokens: 160, temperature: 0.65 }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) rawReply = reply.trim();
          }
        } catch (geminiErr) {
          console.warn('[simulate-chat] Error con Gemini:', geminiErr);
        }
      }
    }

    // Fallback si ningún motor respondió
    if (!rawReply) {
      rawReply = '¡Totalmente! Cuéntame los detalles para diseñar la mejor estrategia para tu negocio.';
    }

    // Eliminar doble saludo o re-presentación si la llamada ya había iniciado
    if (history.length > 0) {
      rawReply = rawReply
        .replace(/^(?:¡?hola!?(?:,\s*buenas?\s*(?:tardes|d[ií]as|noches))?\.?\s*(?:soy\s+el\s+asesor\s+[^.]+\.)?\s*(?:me\s+alegra\s+que\s+est[eé]s\s+aqu[ií]\.?\s*)?)/i, '')
        .replace(/^(?:buenas?\s*(?:tardes|d[ií]as|noches)\.?\s*(?:soy\s+el\s+asesor\s+[^.]+\.)?\s*)/i, '')
        .trim();
      if (rawReply.length > 0) {
        rawReply = rawReply.charAt(0).toUpperCase() + rawReply.slice(1);
      }
    }

    // Humanizar si el modelo empezó con la muletilla robótica "Entiendo perfectamente"
    if (/^entiendo perfectamente(?:,\s*|\s+que\s+|\s+)/i.test(rawReply)) {
      const naturalStarters = ['¡Totalmente! ', 'Tiene todo el sentido. ', '¡Claro que sí! ', 'Te comprendo. '];
      const starter = naturalStarters[Math.floor(Math.random() * naturalStarters.length)];
      rawReply = rawReply.replace(/^entiendo perfectamente(?:,\s*|\s+que\s+|\s+)/i, starter);
    }

    // 1. Extraer desde el tag [AGENDAR_CITA: ...] del modelo si está presente
    const tagMatch = rawReply.match(/\[AGENDAR_CITA:\s*([^|]+)\|\s*([^\]]+)\]/i);
    const tagDate = tagMatch ? parseNaturalDate(tagMatch[1]) : null;
    const tagTime = tagMatch ? parseNaturalTime(tagMatch[2]) : null;

    // 2. Extraer fecha: mensaje actual -> tag del modelo -> historial reciente -> texto de respuesta
    let parsedDate = parseNaturalDate(message) || tagDate;
    if (!parsedDate) {
      const recentUserTexts = [...history]
        .reverse()
        .filter((m: any) => m.role === 'user')
        .slice(0, 3)
        .map((m: any) => m.text || '');
      for (const prevTxt of recentUserTexts) {
        const d = parseNaturalDate(prevTxt);
        if (d) {
          parsedDate = d;
          break;
        }
      }
    }
    if (!parsedDate) {
      parsedDate = parseNaturalDate(rawReply);
    }

    // 3. Extraer hora: mensaje actual -> tag del modelo -> texto de respuesta
    const parsedTime = parseNaturalTime(message) || tagTime || parseNaturalTime(rawReply);

    // Si tenemos hora pero no fecha, asignar hoy si aún no ha pasado la hora, o mañana
    if (!parsedDate && parsedTime) {
      if (parsedTime.hour > now.hour) {
        parsedDate = now.dateStr;
      } else {
        const tmr = new Date(Date.now() + 24 * 60 * 60 * 1000);
        parsedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tmr);
      }
    }

    // Si la fecha acordada es HOY, corregir si el modelo dijo por error "para mañana"
    if (parsedDate === now.dateStr && /para\s+mañana/i.test(rawReply)) {
      rawReply = rawReply.replace(/para\s+mañana/gi, 'para hoy');
    }

    // 4. Detectar servicio o giro del negocio en el diálogo
    let detectedService = 'Asesoría Comercial / Crecimiento de Negocio';

    if (/peluquer[ií]a|sal[oó]n|barber[ií]a|est[eé]tica|spa|u[ñn]as/i.test(allUserTexts)) {
      detectedService = 'Peluquería / Sistema de Citas y Reservas';
    } else if (/p[aá]gina\s*web|sitio\s*web|landing|web/i.test(allUserTexts)) {
      detectedService = 'Desarrollo Web / Landing Page';
    } else if (/pauta|publicidad|anuncio|meta\s*ads|campa[ñn]a/i.test(allUserTexts)) {
      detectedService = 'Pautas Publicitarias / Campañas Digitales';
    } else if (/tienda|e-?commerce/i.test(allUserTexts)) {
      detectedService = 'Tienda Online / Comercio Electrónico';
    }

    // 5. Procesar agendamiento automático si se detecta fecha y hora Y la disponibilidad es válida o fue confirmada
    let appointmentCreated = false;
    let appointmentDetails: any = null;

    const isConfirmedByAgent = rawReply.includes('[AGENDAR_CITA:') || /queda\s+agendad[ao]/i.test(rawReply);
    const isSlotValid = calEval.status === 'available';

    if (parsedDate && parsedTime && (isConfirmedByAgent || isSlotValid)) {
      try {
        console.log(`[simulate-chat] Agendando cita en calendario: ${parsedDate} a las ${parsedTime.time24} (${detectedService})`);
        const booking = await bookAppointment({
          tenantId: tenant.tenantId,
          customerName: 'Cliente Agente de Voz',
          phoneNumber: '593999999999',
          date: parsedDate,
          time: parsedTime.time24,
          service: detectedService,
          notes: `Agendado automáticamente vía Agente de Voz IA.\nÚltimo mensaje cliente: "${message}"`,
          force: true // Guarda la cita en la tabla appointments de Supabase y en Google Calendar
        });

        console.log('[simulate-chat] Resultado bookAppointment:', booking.success ? 'Éxito' : 'Fallo', booking);

        if (booking.success) {
          appointmentCreated = true;
          appointmentDetails = {
            date: parsedDate,
            time: parsedTime.time24,
            service: detectedService,
            appointmentId: booking.appointment?.id
          };
        }
      } catch (bookErr) {
        console.error('[simulate-chat] Error en bookAppointment:', bookErr);
      }
    }

    // Detectar si la llamada debe colgarse automáticamente
    const wasAppointmentJustConfirmed = hasConfirmedAppointmentInHistory || appointmentCreated || /queda\s+agendad[ao]/i.test(rawReply);
    let hangUp = false;
    if (rawReply.includes('[COLGAR_LLAMADA]')) {
      hangUp = true;
    } else if (
      (hasConfirmedAppointmentInHistory || wasAppointmentJustConfirmed) &&
      (isAcknowledgement || /hasta luego|que tengas un excelente|nos vemos|adiós|chao/i.test(rawReply))
    ) {
      hangUp = true;
    }

    // Limpiar tags técnicos de la respuesta hablada
    const cleanReply = rawReply
      .replace(/\[AGENDAR_CITA:.*?\]/gi, '')
      .replace(/\[COLGAR_LLAMADA\]/gi, '')
      .trim();

    return NextResponse.json({
      reply: cleanReply,
      hang_up: hangUp,
      appointment_created: appointmentCreated,
      appointment_details: appointmentDetails
    });
  } catch (err: any) {
    console.error('[simulate-chat] Error:', err);
    return NextResponse.json({
      reply: '¡Claro que sí! Cuéntame qué objetivo tienes en mente para asesorarte.',
      hang_up: false,
      appointment_created: false
    });
  }
}
