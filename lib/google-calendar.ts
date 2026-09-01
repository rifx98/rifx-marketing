import { createSupabaseAdmin } from '@/lib/supabase';
import { decryptToken, encryptToken } from '@/lib/encryption';
import { readLimitedResponseJson } from '@/lib/request-guards';

interface CalendarCredentials {
  access_token: string;
  refresh_token: string | null;
}

interface CalendarEvent {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
}

interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

type JsonRecord = Record<string, unknown>;

const SUPPORTED_TIME_ZONES = new Set([
  'America/Guayaquil',
  'America/Bogota',
  'America/Lima',
  'America/Panama',
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,1024}$/;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function validDateOnly(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validCredentials(value: unknown): CalendarCredentials | null {
  const parsed = record(value);
  const accessToken = parsed.access_token;
  const refreshToken = parsed.refresh_token;
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 8_192) return null;
  if (refreshToken !== null && refreshToken !== undefined
      && (typeof refreshToken !== 'string' || refreshToken.length > 8_192)) return null;
  return {
    access_token: accessToken,
    refresh_token: typeof refreshToken === 'string' && refreshToken ? refreshToken : null,
  };
}

export async function getCalendarCredentials(tenantId: string): Promise<CalendarCredentials | null> {
  try {
    const supabase = createSupabaseAdmin();
    const { data: account, error } = await supabase
      .from('social_accounts')
      .select('encrypted_access_token,encryption_iv,encryption_tag,token_expires_at')
      .eq('tenant_id', tenantId)
      .eq('platform', 'google_calendar')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error('DB_ERROR:' + (error.message || error.code));
    if (!account) throw new Error('ACCOUNT_NOT_FOUND');
    if (!account.encrypted_access_token || !account.encryption_iv || !account.encryption_tag) throw new Error('MISSING_ENCRYPTION_FIELDS');

    let credentials: CalendarCredentials | null = null;
    try {
      const decrypted = decryptToken(
        account.encrypted_access_token,
        account.encryption_iv,
        account.encryption_tag,
      );
      credentials = validCredentials(JSON.parse(decrypted));
    } catch (err: any) {
      throw new Error('DECRYPT_ERROR:' + err.message);
    }
    if (!credentials) throw new Error('INVALID_CREDENTIALS');

    const expiration = typeof account.token_expires_at === 'string'
      ? Date.parse(account.token_expires_at)
      : Number.NaN;
    const expiredOrNearExpiry = !Number.isFinite(expiration) || expiration <= Date.now() + 60_000;
    if (!expiredOrNearExpiry) return credentials;
    if (!credentials.refresh_token) throw new Error('EXPIRED_NO_REFRESH');

    const refreshed = await refreshAccessToken(credentials.refresh_token);
    if (!refreshed) throw new Error('REFRESH_FAILED');
    const nextCredentials = {
      access_token: refreshed.access_token,
      refresh_token: credentials.refresh_token,
    };
    const encrypted = encryptToken(JSON.stringify(nextCredentials));
    const { error: updateError } = await supabase
      .from('social_accounts')
      .update({
        encrypted_access_token: encrypted.ciphertext,
        encryption_iv: encrypted.iv,
        encryption_tag: encrypted.tag,
        token_expires_at: refreshed.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('platform', 'google_calendar');
    if (updateError) throw new Error('UPDATE_ERROR:' + updateError.message);
    return nextCredentials;
  } catch (err: any) {
    throw new Error('GET_CAL_ERROR:' + err.message);
  }
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_at: string } | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || clientId.length > 1_024 || clientSecret.length > 8_192) {
    console.error('[Google Calendar] OAuth refresh configuration unavailable');
    return null;
  }
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const data = record(await readLimitedResponseJson(response, 64 * 1024));
    if (!response.ok || typeof data.access_token !== 'string' || !data.access_token
        || data.access_token.length > 8_192) {
      console.error('[Google Calendar] OAuth refresh rejected:', response.status);
      return null;
    }
    const expiresIn = typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? Math.min(86_400, Math.max(60, data.expires_in))
      : 3_600;
    return {
      access_token: data.access_token,
      expires_at: new Date(Date.now() + expiresIn * 1_000).toISOString(),
    };
  } catch {
    console.error('[Google Calendar] OAuth refresh failed');
    return null;
  }
}

export async function checkAvailability(
  tenantId: string,
  date: string,
  businessHoursStart = 9,
  businessHoursEnd = 18,
  slotDurationMinutes = 60,
  timeZone = 'America/Guayaquil',
): Promise<{ available: TimeSlot[]; error?: string }> {
  if (!validDateOnly(date)
      || !Number.isSafeInteger(businessHoursStart) || businessHoursStart < 0 || businessHoursStart > 23
      || !Number.isSafeInteger(businessHoursEnd) || businessHoursEnd < 1 || businessHoursEnd > 23
      || businessHoursStart >= businessHoursEnd
      || !Number.isSafeInteger(slotDurationMinutes) || slotDurationMinutes < 15 || slotDurationMinutes > 240
      || !SUPPORTED_TIME_ZONES.has(timeZone)) {
    return { available: [], error: 'Parametros de disponibilidad invalidos.' };
  }
  const credentials = await getCalendarCredentials(tenantId);
  if (!credentials) return { available: [], error: 'Google Calendar no conectado.' };

  try {
    const dayStart = `${date}T${String(businessHoursStart).padStart(2, '0')}:00:00-05:00`;
    const dayEnd = `${date}T${String(businessHoursEnd).padStart(2, '0')}:00:00-05:00`;
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: dayStart,
        timeMax: dayEnd,
        timeZone,
        items: [{ id: 'primary' }],
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const data = record(await readLimitedResponseJson(response, 256 * 1024));
    if (!response.ok) {
      console.error('[Google Calendar] Availability request rejected:', response.status);
      return { available: [], error: 'No se pudo consultar el calendario.' };
    }
    const calendars = record(data.calendars);
    const primary = record(calendars.primary);
    const busyInput = Array.isArray(primary.busy) ? primary.busy.slice(0, 1_000) : [];
    const busyPeriods = busyInput.flatMap((item) => {
      const busy = record(item);
      if (typeof busy.start !== 'string' || typeof busy.end !== 'string') return [];
      const start = Date.parse(busy.start);
      const end = Date.parse(busy.end);
      return Number.isFinite(start) && Number.isFinite(end) && start < end ? [{ start, end }] : [];
    });

    const [year, month, day] = date.split('-').map(Number);
    const slots: TimeSlot[] = [];
    const offsetMinutes = 5 * 60;
    const startMinute = businessHoursStart * 60;
    const endMinute = businessHoursEnd * 60;
    for (let minute = startMinute; minute + slotDurationMinutes <= endMinute; minute += slotDurationMinutes) {
      if (slots.length >= 96) break;
      const startHour = Math.floor(minute / 60);
      const startMinutePart = minute % 60;
      const endTotal = minute + slotDurationMinutes;
      const endHour = Math.floor(endTotal / 60);
      const endMinutePart = endTotal % 60;
      const start = Date.UTC(year, month - 1, day, startHour, startMinutePart) + offsetMinutes * 60_000;
      const end = Date.UTC(year, month - 1, day, endHour, endMinutePart) + offsetMinutes * 60_000;
      if (busyPeriods.some((busy) => start < busy.end && end > busy.start)) continue;

      const formatTime = (hour: number, minutePart: number) => {
        const period = hour >= 12 && hour < 24 ? 'PM' : 'AM';
        const normalizedHour = hour === 0 || hour === 24 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${normalizedHour}:${String(minutePart).padStart(2, '0')} ${period}`;
      };
      const labelDate = new Date(Date.UTC(year, month - 1, day, 12));
      const dayName = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'][labelDate.getUTCDay()];
      const monthName = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][labelDate.getUTCMonth()];
      slots.push({
        start: `${date}T${String(startHour).padStart(2, '0')}:${String(startMinutePart).padStart(2, '0')}:00`,
        end: `${date}T${String(endHour).padStart(2, '0')}:${String(endMinutePart).padStart(2, '0')}:00`,
        label: `${dayName} ${day} ${monthName}, ${formatTime(startHour, startMinutePart)} - ${formatTime(endHour, endMinutePart)}`,
      });
    }
    return { available: slots };
  } catch {
    console.error('[Google Calendar] Availability request failed');
    return { available: [], error: 'No se pudo consultar el calendario.' };
  }
}

export async function createCalendarEvent(
  tenantId: string,
  event: CalendarEvent,
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  const timeZone = event.timeZone || 'America/Guayaquil';
  const start = Date.parse(event.startDateTime);
  const end = Date.parse(event.endDateTime);
  if (typeof event.summary !== 'string' || !event.summary.trim() || event.summary.length > 500
      || (event.description !== undefined && (typeof event.description !== 'string' || event.description.length > 10_000))
      || !Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 24 * 60 * 60_000
      || !SUPPORTED_TIME_ZONES.has(timeZone)) {
    return { success: false, error: 'Datos de cita invalidos.' };
  }
  const credentials = await getCalendarCredentials(tenantId);
  if (!credentials) return { success: false, error: 'Google Calendar no conectado.' };

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.summary.trim(),
        description: event.description?.trim() || '',
        start: { dateTime: event.startDateTime, timeZone },
        end: { dateTime: event.endDateTime, timeZone },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 30 }, { method: 'popup', minutes: 10 }],
        },
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const data = record(await readLimitedResponseJson(response, 256 * 1024));
    if (!response.ok || typeof data.id !== 'string' || !EVENT_ID_PATTERN.test(data.id)) {
      console.error('[Google Calendar] Event creation rejected:', response.status);
      return { success: false, error: 'No se pudo crear la cita.' };
    }
    let htmlLink: string | undefined;
    if (typeof data.htmlLink === 'string' && data.htmlLink.length <= 2_048) {
      try {
        const parsedLink = new URL(data.htmlLink);
        if (parsedLink.protocol === 'https:'
            && (parsedLink.hostname === 'google.com' || parsedLink.hostname.endsWith('.google.com'))) {
          htmlLink = parsedLink.toString();
        }
      } catch {
        // The event remains valid even if its optional provider link is not.
      }
    }
    return { success: true, eventId: data.id, htmlLink };
  } catch {
    console.error('[Google Calendar] Event creation failed');
    return { success: false, error: 'No se pudo crear la cita.' };
  }
}

export async function deleteCalendarEvent(
  tenantId: string,
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!EVENT_ID_PATTERN.test(eventId)) return { success: false, error: 'ID de evento invalido.' };
  const credentials = await getCalendarCredentials(tenantId);
  if (!credentials) return { success: false, error: 'Google Calendar no conectado.' };
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${credentials.access_token}` },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    );
    await response.body?.cancel();
    // A missing event is already in the requested final state.
    if (response.ok || response.status === 204 || response.status === 404 || response.status === 410) {
      return { success: true };
    }
    console.error('[Google Calendar] Event deletion rejected:', response.status);
    return { success: false, error: 'No se pudo eliminar el evento.' };
  } catch {
    console.error('[Google Calendar] Event deletion failed');
    return { success: false, error: 'No se pudo eliminar el evento.' };
  }
}
