import { createSupabaseAdmin } from '@/lib/supabase';
import { getCalendarCredentials, createCalendarEvent } from '@/lib/google-calendar';
import { sendNewAppointmentAlertEmail } from '@/lib/email';
import { deductAiCredits, hasAvailableCredits } from '@/lib/ai-credits';
import { recordBrainLearningEvent } from '@/lib/brain-sales-intelligence';

export interface TimeSlotOption {
  time24: string;
  label: string;
}

export interface AvailabilityResult {
  available: boolean;
  date: string;
  slots: TimeSlotOption[];
  reason?: string;
}

export interface BookingResult {
  success: boolean;
  appointment?: any;
  eventId?: string;
  date?: string;
  time?: string;
  service?: string;
  reason?: string;
  suggestedSlots?: TimeSlotOption[];
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Get current date & time parts in Ecuador / Guayaquil timezone (UTC-5)
 */
export function getNowInTimezone(timeZone = 'America/Guayaquil') {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;

  const year = parseInt(partMap.year);
  const month = parseInt(partMap.month);
  const day = parseInt(partMap.day);
  const hour = parseInt(partMap.hour);
  const minute = parseInt(partMap.minute);

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();

  return {
    dateStr,
    dayName: DAY_NAMES[dayOfWeek],
    dayOfWeek,
    hour,
    minute
  };
}

/**
 * Format 24-hour time "15:00" to friendly "3:00 PM"
 */
export function formatTimeLabel(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const dispHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dispHour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Extract natural date from Spanish text (e.g. "hoy", "mañana", "el jueves", "2026-09-10")
 */
export function parseNaturalDate(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  const now = getNowInTimezone();

  // 1. Direct YYYY-MM-DD
  const directMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (directMatch) return directMatch[1];

  // 2. Day/Month/Year or Day/Month (e.g. 15/09 o 15/09/2026)
  const dmMatch = lower.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/);
  if (dmMatch) {
    const d = parseInt(dmMatch[1], 10);
    const m = parseInt(dmMatch[2], 10);
    const y = dmMatch[3] ? parseInt(dmMatch[3], 10) : parseInt(now.dateStr.split('-')[0], 10);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Remove business schedule boilerplate like "de lunes a viernes", "lunes a sabado" to prevent false day match
  const cleanedText = lower.replace(/\b(?:de\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+a\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, '');

  const dayNamesMap: Record<string, number> = {
    'domingo': 0,
    'lunes': 1,
    'martes': 2,
    'miércoles': 3,
    'miercoles': 3,
    'jueves': 4,
    'viernes': 5,
    'sábado': 6,
    'sabado': 6
  };

  // 3. Explicit day proposition: "para el lunes", "el lunes", "agendar para el martes", etc.
  const explicitDayMatch = cleanedText.match(/\b(?:agendar\s+)?(?:para\s+el|para|el|este)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i);
  if (explicitDayMatch) {
    const targetDay = dayNamesMap[explicitDayMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      const currentDay = now.dayOfWeek;
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // next upcoming day
      const targetDate = new Date(Date.now() + diff * 24 * 60 * 60 * 1000);
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(targetDate);
    }
  }

  // 4. "pasado mañana"
  if (cleanedText.includes('pasado mañana') || cleanedText.includes('pasado manana')) {
    const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  // 5. "mañana" (avoid matching when "mañana" only means morning like "de la mañana")
  const withoutMorning = cleanedText.replace(/\b(?:de|en|por)\s+la\s+mañana\b/gi, '');
  if (/\bmañana\b/i.test(withoutMorning)) {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  // 6. Day names anywhere in cleanedText ("lunes", "martes", etc.), ignoring negations ("sábado no")
  for (const [name, targetDay] of Object.entries(dayNamesMap)) {
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(cleanedText)) {
      const isNegated = new RegExp(`\\b${name}\\s*(?:no\\b|cerrado|descanso)`, 'i').test(cleanedText);
      if (!isNegated) {
        const currentDay = now.dayOfWeek;
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7; // next upcoming day
        const targetDate = new Date(Date.now() + diff * 24 * 60 * 60 * 1000);
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(targetDate);
      }
    }
  }

  // 7. "hoy" (only if NOT negated like "hoy no", "hoy cerrado", "hoy no tenemos", "hoy sábado no")
  const isHoyNegated = /\b(?:lamentablemente\s+)?hoy(?:\s+\w+)?\s+no\b/i.test(lower) ||
                       /\bno\s+(?:tenemos|atendemos|abrimos|hay|es\s+posible|se\s+puede)\s+hoy\b/i.test(lower);
  if (!isHoyNegated && (lower.includes('hoy') || lower.includes('el día de hoy') || lower.includes('el dia de hoy'))) {
    return now.dateStr;
  }

  return null;
}

/**
 * Extract natural time from Spanish text (e.g. "a las 3 de la tarde", "3 pm", "15:00", "10:30 am")
 */
export function parseNaturalTime(text: string): { time24: string; hour: number; minute: number } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Remove business schedule boilerplate like "de 9:00 am a 6:00 pm", "de 9 a 18"
  const cleanedText = lower.replace(/\b(?:de\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s*a\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\b/gi, '');

  // 1. Explicit proposal: "a las 3 de la tarde", "para las 3", "a las 15:00"
  const explicitTimeMatch = cleanedText.match(/(?:agendar\s+)?(?:para\s+las?|a\s+las?)\s+(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+)?(am|pm|a\.m\.|p\.m\.|mañana|tarde|noche)?/i);
  const timeMatch = explicitTimeMatch || cleanedText.match(/(?:a\s+)?(?:las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+)?(am|pm|a\.m\.|p\.m\.|mañana|tarde|noche)?/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2] || '0', 10);
  const period = (timeMatch[3] || '').toLowerCase();

  if (period.includes('pm') || period.includes('tarde') || period.includes('noche')) {
    if (hour < 12) hour += 12;
  } else if (period.includes('am') || period.includes('mañana')) {
    if (hour === 12) hour = 0;
  } else {
    // If no period specified: if hour is 1..6 assume afternoon (1 PM to 6 PM)
    if (hour >= 1 && hour <= 6) {
      hour += 12;
    }
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { time24, hour, minute };
}

/**
 * Consulta la configuración de días y horarios laborales del tenant desde la base de datos
 */
export async function getTenantCalendarConfig(tenantId: string): Promise<{
  businessDays: number[];
  businessDaysNames: string[];
  businessDaysFormatted: string;
  startHour: string;
  endHour: string;
  startHourLabel: string;
  endHourLabel: string;
}> {
  const supabase = createSupabaseAdmin();
  let businessDays = [1, 2, 3, 4, 5];
  let startHour = '09:00';
  let endHour = '18:00';

  try {
    const { data: cfg } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (cfg?.openai_key) {
      const parsed = JSON.parse(cfg.openai_key);
      if (Array.isArray(parsed.business_days) && parsed.business_days.length > 0) {
        businessDays = parsed.business_days;
      }
      if (parsed.business_start_hour) startHour = parsed.business_start_hour;
      if (parsed.business_end_hour) endHour = parsed.business_end_hour;
    }
  } catch {}

  const businessDaysNames = businessDays.map(d => DAY_NAMES[d] || `Día ${d}`);

  let businessDaysFormatted = businessDaysNames.join(', ');
  if (businessDays.length === 5 && [1, 2, 3, 4, 5].every(d => businessDays.includes(d))) {
    businessDaysFormatted = 'Lunes a Viernes';
  } else if (businessDays.length === 6 && [1, 2, 3, 4, 5, 6].every(d => businessDays.includes(d))) {
    businessDaysFormatted = 'Lunes a Sábado';
  } else if (businessDays.length === 7) {
    businessDaysFormatted = 'Todos los días (Lunes a Domingo)';
  }

  return {
    businessDays,
    businessDaysNames,
    businessDaysFormatted,
    startHour,
    endHour,
    startHourLabel: formatTimeLabel(startHour),
    endHourLabel: formatTimeLabel(endHour)
  };
}

/**
 * Check availability for a specific date across:
 * 1. Business days
 * 2. Business hours
 * 3. Database appointments table
 * 4. Google Calendar freeBusy (if connected)
 */
export async function checkDateAvailability(
  tenantId: string,
  dateStr: string,
  options?: {
    businessDays?: number[];
    startHour?: string;
    endHour?: string;
  }
): Promise<AvailabilityResult> {
  const tenantCal = await getTenantCalendarConfig(tenantId);
  const bDays = options?.businessDays || tenantCal.businessDays;
  const startHourNum = parseInt(options?.startHour || tenantCal.startHour.split(':')[0], 10) || 9;
  const endHourNum = parseInt(options?.endHour || tenantCal.endHour.split(':')[0], 10) || 18;

  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();

  // 1. Business day check
  if (!bDays.includes(targetDayOfWeek)) {
    const dayName = DAY_NAMES[targetDayOfWeek];
    return {
      available: false,
      date: dateStr,
      slots: [],
      reason: `Los días ${dayName} no atendemos. Nuestros días de atención son de ${tenantCal.businessDaysFormatted} de ${tenantCal.startHourLabel} a ${tenantCal.endHourLabel}.`
    };
  }
  const now = getNowInTimezone();
  const isToday = now.dateStr === dateStr;
  const supabase = createSupabaseAdmin();

  // 2. Fetch busy intervals from appointments table in Supabase
  const dayStartISO = new Date(`${dateStr}T00:00:00-05:00`).toISOString();
  const dayEndISO = new Date(`${dateStr}T23:59:59-05:00`).toISOString();

  const { data: dbAppts } = await supabase
    .from('appointments')
    .select('scheduled_time, status')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'confirmed', 'rescheduled', 'pending_completion', 'awaiting_reschedule'])
    .gte('scheduled_time', dayStartISO)
    .lte('scheduled_time', dayEndISO);

  const busyPeriods: { start: number; end: number }[] = [];
  if (dbAppts) {
    for (const appt of dbAppts) {
      const s = Date.parse(appt.scheduled_time);
      if (Number.isFinite(s)) {
        busyPeriods.push({ start: s, end: s + 60 * 60 * 1000 }); // 1 hour slot
      }
    }
  }

  // 3. Fetch busy intervals from Google Calendar if connected
  try {
    const creds = await getCalendarCredentials(tenantId);
    if (creds) {
      const dayStart = `${dateStr}T${String(startHourNum).padStart(2, '0')}:00:00-05:00`;
      const dayEnd = `${dateStr}T${String(endHourNum).padStart(2, '0')}:00:00-05:00`;
      const gRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: dayStart,
          timeMax: dayEnd,
          timeZone: 'America/Guayaquil',
          items: [{ id: 'primary' }],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (gRes.ok) {
        const gData = await gRes.json();
        const busyList = gData?.calendars?.primary?.busy || [];
        for (const item of busyList) {
          const s = Date.parse(item.start);
          const e = Date.parse(item.end);
          if (Number.isFinite(s) && Number.isFinite(e)) {
            busyPeriods.push({ start: s, end: e });
          }
        }
      }
    }
  } catch (gErr) {
    console.warn('[CalendarBooking] Google Calendar freebusy skipped:', gErr);
  }

  // 4. Generate slots
  const availableSlots: TimeSlotOption[] = [];
  for (let h = startHourNum; h < endHourNum; h++) {
    // If today, slot must be in the future
    if (isToday && h <= now.hour) {
      continue;
    }

    const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00-05:00`).getTime();
    const slotEnd = slotStart + 60 * 60 * 1000;

    const isOverlap = busyPeriods.some(b => slotStart < b.end && slotEnd > b.start);
    if (!isOverlap) {
      const time24 = `${String(h).padStart(2, '0')}:00`;
      availableSlots.push({
        time24,
        label: formatTimeLabel(time24)
      });
    }
  }

  return {
    available: availableSlots.length > 0,
    date: dateStr,
    slots: availableSlots,
    reason: availableSlots.length === 0 ? 'No hay horarios disponibles para esta fecha.' : undefined
  };
}

/**
 * Check if a specific date and time slot is available
 */
export async function checkSpecificSlot(
  tenantId: string,
  dateStr: string,
  time24: string,
  options?: {
    businessDays?: number[];
    startHour?: string;
    endHour?: string;
  }
): Promise<{ available: boolean; reason?: string; availableSlots: TimeSlotOption[] }> {
  const result = await checkDateAvailability(tenantId, dateStr, options);
  if (!result.available) {
    return {
      available: false,
      reason: result.reason || 'Día no disponible.',
      availableSlots: []
    };
  }

  const [reqH] = time24.split(':').map(Number);
  const matchingSlot = result.slots.find(s => {
    const [h] = s.time24.split(':').map(Number);
    return h === reqH;
  });

  if (!matchingSlot) {
    return {
      available: false,
      reason: `El horario de las ${formatTimeLabel(time24)} no está disponible o ya está reservado.`,
      availableSlots: result.slots
    };
  }

  return {
    available: true,
    availableSlots: result.slots
  };
}

/**
 * Evalúa en tiempo real si el día y la hora solicitados por el cliente en llamada de voz
 * están disponibles en el calendario, si el día no se atiende, si está fuera de horario, o si ya está ocupado.
 */
export async function evaluateVoiceAvailability(
  tenantId: string,
  candidateDate?: string | null,
  candidateTime?: { time24: string; hour: number; minute: number } | null
): Promise<{
  calConfig: {
    businessDays: number[];
    businessDaysNames: string[];
    businessDaysFormatted: string;
    startHour: string;
    endHour: string;
    startHourLabel: string;
    endHourLabel: string;
  };
  hasProposal: boolean;
  status: 'available' | 'day_not_allowed' | 'outside_hours' | 'slot_busy' | 'no_slots_left' | 'info_only';
  reason?: string;
  suggestedSlots: TimeSlotOption[];
  nextAvailableDate?: string;
  targetDayName?: string;
}> {
  const calConfig = await getTenantCalendarConfig(tenantId);

  if (!candidateDate) {
    return {
      calConfig,
      hasProposal: false,
      status: 'info_only',
      suggestedSlots: []
    };
  }

  const [y, m, d] = candidateDate.split('-').map(Number);
  const targetDayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  const targetDayName = DAY_NAMES[targetDayOfWeek] || 'ese día';

  // 1. ¿El día propuesto es día de atención?
  if (!calConfig.businessDays.includes(targetDayOfWeek)) {
    // Buscar el próximo día laborable disponible
    let nextDateStr = '';
    let nextDayName = '';
    for (let offset = 1; offset <= 7; offset++) {
      const checkD = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
      const checkDow = checkD.getUTCDay();
      if (calConfig.businessDays.includes(checkDow)) {
        nextDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(checkD);
        nextDayName = DAY_NAMES[checkDow];
        break;
      }
    }

    return {
      calConfig,
      hasProposal: true,
      status: 'day_not_allowed',
      targetDayName,
      reason: `Los días ${targetDayName} no son días de atención. Nuestros días de atención son de ${calConfig.businessDaysFormatted} de ${calConfig.startHourLabel} a ${calConfig.endHourLabel}.`,
      suggestedSlots: [],
      nextAvailableDate: nextDateStr ? `${nextDayName} (${nextDateStr})` : undefined
    };
  }

  // 2. Revisar disponibilidad de slots para ese día
  const dateResult = await checkDateAvailability(tenantId, candidateDate, {
    businessDays: calConfig.businessDays,
    startHour: calConfig.startHour,
    endHour: calConfig.endHour
  });

  if (!dateResult.available || dateResult.slots.length === 0) {
    return {
      calConfig,
      hasProposal: true,
      status: 'no_slots_left',
      targetDayName,
      reason: `Para el ${targetDayName} (${candidateDate}) ya no nos quedan horarios disponibles.`,
      suggestedSlots: []
    };
  }

  // Si no especificó hora aún, ese día sí se puede
  if (!candidateTime) {
    return {
      calConfig,
      hasProposal: true,
      status: 'available',
      targetDayName,
      suggestedSlots: dateResult.slots
    };
  }

  // 3. Revisar si la hora está dentro del horario de atención
  const startH = parseInt(calConfig.startHour.split(':')[0], 10);
  const endH = parseInt(calConfig.endHour.split(':')[0], 10);

  if (candidateTime.hour < startH || candidateTime.hour >= endH) {
    return {
      calConfig,
      hasProposal: true,
      status: 'outside_hours',
      targetDayName,
      reason: `El horario de las ${formatTimeLabel(candidateTime.time24)} está fuera de nuestro horario de atención (${calConfig.startHourLabel} a ${calConfig.endHourLabel}).`,
      suggestedSlots: dateResult.slots
    };
  }

  // 4. Revisar si esa hora específica está libre o ya ocupada
  const matchingSlot = dateResult.slots.find(s => {
    const [h] = s.time24.split(':').map(Number);
    return h === candidateTime.hour;
  });

  if (!matchingSlot) {
    return {
      calConfig,
      hasProposal: true,
      status: 'slot_busy',
      targetDayName,
      reason: `El horario de las ${formatTimeLabel(candidateTime.time24)} ya se encuentra ocupado en el calendario.`,
      suggestedSlots: dateResult.slots
    };
  }

  // 5. ¡Totalmente disponible!
  return {
    calConfig,
    hasProposal: true,
    status: 'available',
    targetDayName,
    suggestedSlots: dateResult.slots
  };
}

/**
 * Book an appointment directly into the database (and Google Calendar if connected)
 */
/**
 * Genera un briefing ejecutivo y conciso con IA para el asesor humano
 * Resumiendo el motivo, el contexto del chat y la recomendación de qué decirle al cliente.
 */
/**
 * Resuelve la fecha exacta (en hora local de Ecuador) en la que el cliente gestionó o reservó la cita,
 * evitando mezclar mensajes de días o meses diferentes.
 */
function resolveBookingDay(msgs: any[], apptCreatedAt?: string): string | null {
  const toDateStr = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date(iso));
    } catch {
      return iso ? iso.slice(0, 10) : null;
    }
  };

  const byDate: Record<string, any[]> = {};
  for (const m of msgs) {
    const d = toDateStr(m.created_at);
    if (d) {
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(m);
    }
  }

  const apptDate = apptCreatedAt ? toDateStr(apptCreatedAt) : null;
  // 1. Si en la fecha de creación de la cita hay mensajes del cliente, esa es la fecha
  if (apptDate && byDate[apptDate] && byDate[apptDate].some(m => m.role === 'user' || m.role === 'customer')) {
    return apptDate;
  }

  // 2. Si no, buscar la fecha donde el cliente o el bot confirmaron/solicitaron la cita
  const bookingKeywords = ['agendada', 'confirmada', 'agendar una cita', 'agendar cita', 'reserva', 'reservar'];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const content = (m.content || '').toLowerCase();
    if (bookingKeywords.some(kw => content.includes(kw))) {
      const d = toDateStr(m.created_at);
      if (d && byDate[d] && byDate[d].some(msg => msg.role === 'user' || msg.role === 'customer')) {
        return d;
      }
    }
  }

  // 3. Fallback: fecha más reciente con interacción del cliente
  const datesWithUser = Object.keys(byDate).filter(d => byDate[d].some(m => m.role === 'user' || m.role === 'customer'));
  if (datesWithUser.length > 0) {
    return datesWithUser[datesWithUser.length - 1];
  }

  return apptDate;
}

export async function generateAppointmentBriefing(params: {
  tenantId: string;
  customerName?: string;
  service?: string;
  conversationId?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
  bookingDate?: string;
}): Promise<string> {
  const { tenantId, customerName = 'Cliente', service = 'Asesoría', conversationId, recentMessages, bookingDate } = params;
  const supabase = createSupabaseAdmin();

  let transcript = '';
  let analysisDateStr = '';
  const ignoredPhrases = [
    '__SYSTEM_',
    '__HUMAN_',
    'Espero que hayamos podido solucionar tu consulta',
    '[Lista de Espera]:'
  ];

  if (Array.isArray(recentMessages) && recentMessages.length > 0) {
    transcript = recentMessages
      .filter(m => m && m.content && !ignoredPhrases.some(p => m.content.includes(p)))
      .slice(-35)
      .map(m => `${m.role === 'user' || m.role === 'customer' ? (customerName || 'Cliente') : 'Bot/Asesor'}: ${m.content.trim()}`)
      .join('\n');
  } else if (conversationId) {
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (Array.isArray(msgs) && msgs.length > 0) {
        // Encontrar EXCLUSIVAMENTE el día en que el cliente realizó la reserva
        const targetDay = resolveBookingDay(msgs, bookingDate);
        analysisDateStr = targetDay || '';

        // Filtrar solo los mensajes correspondientes a ese día exacto
        const dayMsgs = msgs.filter(m => {
          let mDate: string | null = null;
          try {
            mDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date(m.created_at));
          } catch {
            mDate = m.created_at ? m.created_at.slice(0, 10) : null;
          }
          const isTargetDay = targetDay ? mDate === targetDay : true;
          return isTargetDay && !ignoredPhrases.some(p => m.content.includes(p));
        });

        transcript = dayMsgs
          .slice(-35)
          .map(m => `${m.role === 'user' || m.role === 'customer' ? (customerName || 'Cliente') : 'Bot/Asesor'}: ${m.content.trim()}`)
          .join('\n');
      }
    } catch (e) {
      console.warn('[Briefing] Error recuperando mensajes de la conversación:', e);
    }
  }

  // Plantilla de respaldo en caso de que no haya chat previo o fallen los proveedores
  const fallbackBriefing = `📌 Servicio solicitado:
${service || 'Asesoría'}

💬 Lo que pidió el cliente:
Cita registrada en el calendario. No se encontró historial de chat previo para este contacto.`;

  if (!transcript || transcript.trim().length < 10) {
    return fallbackBriefing;
  }

  try {
    const { data: cfg } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let extConfig: any = {};
    if (cfg?.openai_key) {
      try {
        extConfig = JSON.parse(cfg.openai_key);
      } catch {
        extConfig = { openai_key: cfg.openai_key };
      }
    }

    const { data: plat } = await supabase
      .from('platform_settings')
      .select('global_ai_config')
      .limit(1)
      .maybeSingle();

    const groqKey = extConfig.groq_key || process.env.GROQ_API_KEY;
    const geminiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || (plat?.global_ai_config?.provider === 'gemini' ? plat.global_ai_config.apiKey : null);
    const openaiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || (plat?.global_ai_config?.provider === 'openai' ? plat.global_ai_config.apiKey : null);

    const dateContextText = analysisDateStr ? ` correspondiente al día de esta reserva (${analysisDateStr})` : '';

    const systemPrompt = `Eres el Analista Principal de Requerimientos y Ventas de RIFX Marketing.
Tu trabajo es analizar minuciosamente el chat${dateContextText} y descubrir con máxima precisión QUÉ SERVICIO O SOLUCIÓN EXACTA BUSCA EL CLIENTE.

REGLAS CRÍTICAS DE DETECCIÓN:
1. Analiza EXCLUSIVAMENTE los mensajes correspondientes al día de esta sesión de reserva. No asumas solicitudes de otros días.
2. NUNCA respondas con términos vagos como 'Gestión de Citas' o 'Asesoría Comercial' si en el chat de ese día el cliente mencionó qué necesita (por ejemplo: Publicidad Masiva, Pauta en Redes Sociales, Página Web, Tienda Online, etc.).
3. Si el cliente dijo que necesita ayuda con 'publicidad masiva', 'publicidad', 'anuncios', 'campañas' o 'redes sociales', el servicio solicitado es: 'Publicidad Digital / Publicidad Masiva en Redes Sociales'.
4. Si el cliente dijo 'página', 'sitio web', 'landing page', 'tienda online', etc., el servicio solicitado es: 'Desarrollo Web / Landing Page'.
5. Si el cliente tiene dudas sobre precios o paquetes de un servicio, el servicio solicitado es ese servicio sobre el que preguntó.
6. Identifica con exactitud el problema de negocio o requerimiento que el cliente mencionó con sus propias palabras.

Formato estricto de respuesta (sin intros ni despedidas):

📌 Servicio solicitado:
[Servicio exacto identificado, ej: "Publicidad Digital (Publicidad Masiva en Redes Sociales)", "Desarrollo Web (Landing Page)", etc.]

💬 Lo que pidió el cliente:
[Explicación clara y concisa de 1 a 2 frases con lo que el cliente pidió específicamente ese día, su requerimiento de publicidad/web y el motivo por el cual solicitó la reunión o cita].`;

    // Verificar saldo de créditos de IA antes de realizar el análisis
    const { hasCredits, balance } = await hasAvailableCredits(supabase, tenantId);
    if (!hasCredits) {
      console.warn(`💳 [Briefing] Tenant ${tenantId} sin créditos de IA suficientes para análisis (saldo: ${balance})`);
      return fallbackBriefing;
    }

    let analyzedText: string | null = null;

    // 1. Groq (ultra-rápido y con modelo de razonamiento qwen3.8-27b)
    if (groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.8-27b',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Historial de la conversación del cliente:\n\n${transcript}` }
            ],
            temperature: 0.1,
            max_tokens: 400
          }),
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text && text.includes('📌 Servicio solicitado:')) {
            analyzedText = text;
          }
        }
      } catch (groqErr) {
        console.warn('[Briefing] Groq error:', groqErr);
      }
    }

    // 2. Gemini
    if (!analyzedText && geminiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nHistorial de la conversación del cliente:\n\n${transcript}` }]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } }
          }),
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text && text.includes('📌 Servicio solicitado:')) {
            analyzedText = text;
          }
        }
      } catch (gemErr) {
        console.warn('[Briefing] Gemini error:', gemErr);
      }
    }

    // 3. OpenAI
    if (!analyzedText && openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Historial de la conversación del cliente:\n\n${transcript}` }
            ],
            temperature: 0.1,
            max_tokens: 400
          }),
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text && text.includes('📌 Servicio solicitado:')) {
            analyzedText = text;
          }
        }
      } catch (oaErr) {
        console.warn('[Briefing] OpenAI error:', oaErr);
      }
    }

    // Descontar crédito de IA únicamente si el análisis se generó exitosamente
    if (analyzedText) {
      await deductAiCredits(
        supabase,
        tenantId,
        1,
        `Análisis de conversación IA (Resumen de cita - ${customerName || 'Cliente'})`
      );
      return analyzedText;
    }
  } catch (err) {
    console.error('[Briefing] Error generando briefing:', err);
  }

  return fallbackBriefing;
}

export async function bookAppointment(params: {
  tenantId: string;
  customerName?: string;
  phoneNumber?: string;
  date: string;
  time: string;
  service?: string;
  conversationId?: string | null;
  businessDays?: number[];
  startHour?: string;
  endHour?: string;
  history?: Array<{ role: string; content: string }>;
  notes?: string;
  force?: boolean;
}): Promise<BookingResult> {
  const {
    tenantId,
    customerName = 'Cliente',
    phoneNumber = '593999999999',
    date,
    time,
    service = 'Asesoría',
    conversationId = null,
    businessDays,
    startHour,
    endHour,
    history,
    notes,
    force = false
  } = params;

  // 1. Verify availability first
  const slotCheck = await checkSpecificSlot(tenantId, date, time, {
    businessDays,
    startHour,
    endHour
  });

  if (!slotCheck.available && !force) {
    return {
      success: false,
      reason: slotCheck.reason,
      suggestedSlots: slotCheck.availableSlots
    };
  }

  const supabase = createSupabaseAdmin();
  const scheduledTimeISO = `${date}T${time}:00-05:00`;

  // Resolve admin alert email (from config.alert_email, tenants.email or defaults)
  let alertEmail = 'rifxmarketing@gmail.com';
  try {
    const { data: cfg } = await supabase
      .from('config')
      .select('alert_email')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (cfg?.alert_email) {
      alertEmail = cfg.alert_email;
    } else {
      const { data: tData } = await supabase
        .from('tenants')
        .select('email')
        .eq('id', tenantId)
        .maybeSingle();
      if (tData?.email) alertEmail = tData.email;
    }
  } catch {}

  // 2. Sync with Google Calendar if connected
  let eventId = `manual_${Date.now()}`;
  try {
    const [h, m] = time.split(':').map(Number);
    const endH = h + 1;
    const startDateTime = `${date}T${time}:00`;
    const endDateTime = `${date}T${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

    const calResult = await createCalendarEvent(tenantId, {
      summary: `📅 Cita: ${customerName} — ${service}`,
      description: `Cliente: ${customerName}\nTeléfono: ${phoneNumber}\nServicio: ${service}\nAgendado vía Bot de RIFX Marketing`,
      startDateTime,
      endDateTime,
      timeZone: 'America/Guayaquil',
      attendeeEmail: alertEmail
    });

    if (calResult.success && calResult.eventId) {
      eventId = calResult.eventId;
      console.log(`[CalendarBooking] Evento creado en Google Calendar: ${eventId}`);
    }
  } catch (calErr) {
    console.warn('[CalendarBooking] Google Calendar sync error (continuing with local appointment):', calErr);
  }

  // 3. Save appointment in Supabase appointments table
  try {
    let existingApptId: string | null = null;
    if (conversationId) {
      const { data: existingAppt } = await supabase
        .from('appointments')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('tenant_id', tenantId)
        .order('scheduled_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAppt) existingApptId = existingAppt.id;
    }

    // Generar briefing de contexto con IA para el asesor
    let briefing = notes;
    if (!briefing) {
      try {
        briefing = await generateAppointmentBriefing({
          tenantId,
          customerName,
          service,
          conversationId,
          recentMessages: history
        });
      } catch (brErr) {
        console.warn('[CalendarBooking] Error generando briefing:', brErr);
      }
    }

    let appointmentData: any = null;
    if (existingApptId) {
      const { data, error } = await supabase
        .from('appointments')
        .update({
          event_id: eventId,
          customer_name: customerName,
          phone_number: phoneNumber,
          scheduled_time: scheduledTimeISO,
          service,
          status: 'rescheduled',
          confirmation_message: briefing || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingApptId)
        .select()
        .single();

      if (error) throw error;
      appointmentData = data;
      console.log(`[CalendarBooking] Cita actualizada en DB: ${existingApptId}`);
    } else {
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          tenant_id: tenantId,
          conversation_id: conversationId,
          event_id: eventId,
          customer_name: customerName,
          phone_number: phoneNumber,
          scheduled_time: scheduledTimeISO,
          service,
          status: 'confirmed',
          confirmation_message: briefing || null
        })
        .select()
        .single();

      if (error) throw error;
      appointmentData = data;
      console.log(`[CalendarBooking] Cita guardada en DB: ${data.id}`);
    }

    // 4. If conversation exists, advance sales stage & store briefing in notes
    if (conversationId) {
      await supabase
        .from('conversations')
        .update({ 
          sales_stage: 'appointment_booked', 
          notes: briefing || undefined,
          updated_at: new Date().toISOString() 
        })
        .eq('id', conversationId);
    }

    // Auto-asimilar aprendizaje en el Cerebro Central del CRM
    recordBrainLearningEvent(tenantId, {
      type: 'appointment_booked',
      trigger: `Cita confirmada: ${service || 'Consulta'} con ${customerName || 'Cliente'}`,
      lesson: `Cliente agendó exitosamente para las ${formatTimeLabel(time)}. La confirmación inmediata y cierre de doble alternativa maximizaron la conversión.`,
      context: `Día: ${date} ${time} | Tel: ${phoneNumber || 'WhatsApp'}`,
    }).catch(() => {});

    // 5. Send instant email alert to admin/business owner
    sendNewAppointmentAlertEmail({
      to: alertEmail,
      customerName,
      customerPhone: phoneNumber,
      date,
      time: formatTimeLabel(time),
      service,
      eventId
    }).catch(err => console.error('[CalendarBooking] Error enviando alerta de nueva cita por email:', err));

    return {
      success: true,
      appointment: appointmentData,
      eventId,
      date,
      time,
      service
    };
  } catch (dbErr: any) {
    console.error('[CalendarBooking] Error al guardar cita en DB:', dbErr);
    return {
      success: false,
      reason: `Error al guardar en la base de datos: ${dbErr?.message || 'Error desconocido'}`
    };
  }
}

/**
 * Unified processor for checking availability tags, booking tags and anti-hallucination confirmations
 */
export async function processAppointmentHandling(params: {
  rawResponse?: string;
  text?: string;
  userMessage?: string;
  tenantId: string;
  customerName?: string;
  customerPhone?: string;
  conversationId?: string | null;
  extConfig?: any;
  businessDays?: number[];
  startHour?: string;
  endHour?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<string> {
  let response = params.rawResponse || params.text || '';
  const { tenantId, customerName = 'Cliente', customerPhone = '593999999999', conversationId = null, extConfig = {}, history } = params;
  const bDays = params.businessDays || extConfig.business_days || [1, 2, 3, 4, 5];
  const startHour = params.startHour || extConfig.business_start_hour || '09:00';
  const endHour = params.endHour || extConfig.business_end_hour || '18:00';

  // 1. Check for [VERIFICAR_DISPONIBILIDAD:YYYY-MM-DD]
  const availMatch = response.match(/\[VERIFICAR_DISPONIBILIDAD:(\d{4}-\d{2}-\d{2})\]/i);
  if (availMatch) {
    const targetDate = availMatch[1];
    response = response.replace(/\[VERIFICAR_DISPONIBILIDAD:.+?\]/i, '').trim();

    const availResult = await checkDateAvailability(tenantId, targetDate, {
      businessDays: bDays,
      startHour,
      endHour
    });

    if (availResult.available && availResult.slots.length > 0) {
      const slotsList = availResult.slots.map(s => `• *${s.label}*`).join('\n');
      response += `\n\n📅 *Horarios disponibles para el ${targetDate}:*\n${slotsList}\n\n¿Cuál de estos horarios te queda mejor para agendar tu cita? 😊`;
    } else {
      response += `\n\n⚠️ ${availResult.reason || `No hay horarios disponibles para el ${targetDate}.`} ¿Te gustaría que revisemos otro día?`;
    }
    return response.trim();
  }

  // 2. Check for [AGENDAR_CITA:nombre:telefono:YYYY-MM-DD:HH:MM:servicio]
  const apptMatch = response.match(/\[AGENDAR_CITA:(.+?):(.+?):(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):(.+?)\]/i);
  if (apptMatch) {
    const [, rawName, rawPhone, date, time, rawService] = apptMatch;
    response = response.replace(/\[AGENDAR_CITA:.+?\]/i, '').trim();

    const name = rawName && rawName !== 'nombre_cliente' && rawName !== 'Cliente' ? rawName : customerName;
    const phone = rawPhone && rawPhone !== 'telefono' ? rawPhone : customerPhone;
    const service = rawService || 'Asesoría';

    const bookResult = await bookAppointment({
      tenantId,
      customerName: name,
      phoneNumber: phone,
      date,
      time,
      service,
      conversationId,
      businessDays: bDays,
      startHour,
      endHour,
      history
    });

    if (bookResult.success) {
      response += `\n\n✅ *¡Cita Confirmada y Guardada en el Calendario!*\n📅 Fecha: *${date}*\n🕐 Hora: *${formatTimeLabel(time)}*\n📋 Motivo: *${service}*\n\n¡Quedó registrada en nuestro calendario oficial! Te esperamos. 😊`;
    } else {
      response += `\n\n⚠️ *No se pudo concretar el agendamiento:*\n${bookResult.reason || 'El horario seleccionado no está disponible.'}`;
      if (bookResult.suggestedSlots && bookResult.suggestedSlots.length > 0) {
        response += `\n\nHorarios disponibles:\n` + bookResult.suggestedSlots.map(s => `• *${s.label}*`).join('\n');
      }
    }
    return response.trim();
  }

  // 3. Anti-Hallucination & Natural Language Interceptor:
  // If the AI says "queda agendada", "quedó agendado", "te he agendado", "nos vemos a las"
  // but forgot to emit [AGENDAR_CITA], we catch it and actually book it!
  const lowerResp = response.toLowerCase();
  const confirmationPhrases = [
    'queda agendad', 'quedo agendad', 'quedó agendad', 'cita agendada', 'te agendé',
    'ha sido agendad', 'te he agendad', 'cita confirmada', 'reunión confirmada',
    'reunion confirmada', 'te he reservado', 'reservado para', 'reservada para',
    'agendado para el', 'agendada para el', 'nos vemos hoy a las', 'nos vemos el'
  ];

  const hasConfirmationLanguage = confirmationPhrases.some(p => lowerResp.includes(p));

  if (hasConfirmationLanguage && !lowerResp.includes('error') && !lowerResp.includes('no pude')) {
    // Extract date and time from user message or AI response
    const userMsg = params.userMessage || '';
    const detectedDate = parseNaturalDate(userMsg) || parseNaturalDate(response) || getNowInTimezone().dateStr;
    const detectedTime = parseNaturalTime(userMsg) || parseNaturalTime(response);

    if (detectedDate && detectedTime) {
      console.log(`[CalendarBooking] Interceptor activado: Agendando cita para ${detectedDate} a las ${detectedTime.time24}...`);
      const bookResult = await bookAppointment({
        tenantId,
        customerName,
        phoneNumber: customerPhone,
        date: detectedDate,
        time: detectedTime.time24,
        service: 'Asesoría',
        conversationId,
        businessDays: bDays,
        startHour,
        endHour,
        history
      });

      if (bookResult.success) {
        response += `\n\n✅ *¡Cita Guardada en el Calendario!*\n📅 Fecha: *${detectedDate}*\n🕐 Hora: *${formatTimeLabel(detectedTime.time24)}*\n\n¡Quedó registrada en nuestro calendario oficial!`;
      } else {
        response = `Lo siento, el horario de las *${formatTimeLabel(detectedTime.time24)}* no está disponible (${bookResult.reason || 'horario ocupado'}).`;
        if (bookResult.suggestedSlots && bookResult.suggestedSlots.length > 0) {
          response += `\n\nTenemos estos horarios disponibles para el *${detectedDate}*:\n` + bookResult.suggestedSlots.map(s => `• *${s.label}*`).join('\n') + `\n\n¿Cuál de estos te conviene más?`;
        }
      }
    }
  }

  return response.trim();
}
