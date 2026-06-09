import { createSupabaseAdmin } from '@/lib/supabase';
import { decryptToken, encryptToken } from '@/lib/encryption';

// ============================================
// Google Calendar Helper — Disponibilidad & Agendamiento
// ============================================

interface CalendarCredentials {
  access_token: string;
  refresh_token: string | null;
}

interface CalendarEvent {
  summary: string;
  description?: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  timeZone?: string;
}

interface TimeSlot {
  start: string;
  end: string;
  label: string; // Human-readable label like "Lunes 10 Jun, 9:00 AM - 10:00 AM"
}

/**
 * Retrieves and decrypts Google Calendar credentials for a tenant.
 * If the access_token is expired, it automatically refreshes it using the refresh_token.
 */
export async function getCalendarCredentials(tenantId: string): Promise<CalendarCredentials | null> {
  const supabase = createSupabaseAdmin();

  const { data: account } = await supabase
    .from('social_accounts')
    .select('encrypted_access_token, encryption_iv, encryption_tag, token_expires_at')
    .eq('tenant_id', tenantId)
    .eq('platform', 'google_calendar')
    .limit(1)
    .single();

  if (!account || !account.encrypted_access_token || !account.encryption_iv || !account.encryption_tag) {
    return null;
  }

  // Decrypt the stored token payload
  const decrypted = decryptToken(account.encrypted_access_token, account.encryption_iv, account.encryption_tag);
  const credentials: CalendarCredentials = JSON.parse(decrypted);

  // Check if token is expired
  const isExpired = account.token_expires_at && new Date(account.token_expires_at) <= new Date();

  if (isExpired && credentials.refresh_token) {
    console.log(`🔄 [Google Calendar] Token expired for tenant ${tenantId}, refreshing...`);
    const refreshed = await refreshAccessToken(credentials.refresh_token);
    if (refreshed) {
      // Update stored credentials
      const newPayload = JSON.stringify({
        access_token: refreshed.access_token,
        refresh_token: credentials.refresh_token // Keep existing refresh token
      });
      const enc = encryptToken(newPayload);

      await supabase
        .from('social_accounts')
        .update({
          encrypted_access_token: enc.ciphertext,
          encryption_iv: enc.iv,
          encryption_tag: enc.tag,
          token_expires_at: refreshed.expires_at,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('platform', 'google_calendar');

      console.log(`✅ [Google Calendar] Token refreshed successfully for tenant ${tenantId}`);
      return { access_token: refreshed.access_token, refresh_token: credentials.refresh_token };
    }
  }

  return credentials;
}

/**
 * Refreshes an expired access token using the refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('❌ [Google Calendar] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET for token refresh');
      return null;
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const data = await res.json();
    if (data.error) {
      console.error('❌ [Google Calendar] Token refresh failed:', data.error_description || data.error);
      return null;
    }

    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
    return { access_token: data.access_token, expires_at: expiresAt };
  } catch (err: any) {
    console.error('❌ [Google Calendar] Token refresh error:', err.message);
    return null;
  }
}

/**
 * Checks availability on a tenant's Google Calendar for a given date.
 * Returns available time slots within business hours.
 * 
 * @param tenantId - The tenant ID
 * @param date - The date to check (YYYY-MM-DD format)
 * @param businessHoursStart - Start hour (default 9 = 9:00 AM)
 * @param businessHoursEnd - End hour (default 18 = 6:00 PM)
 * @param slotDurationMinutes - Duration of each slot in minutes (default 60)
 * @param timeZone - Timezone (default America/Guayaquil for Ecuador)
 */
export async function checkAvailability(
  tenantId: string,
  date: string,
  businessHoursStart: number = 9,
  businessHoursEnd: number = 18,
  slotDurationMinutes: number = 60,
  timeZone: string = 'America/Guayaquil'
): Promise<{ available: TimeSlot[]; error?: string }> {
  const credentials = await getCalendarCredentials(tenantId);
  if (!credentials) {
    return { available: [], error: 'Google Calendar no conectado. El usuario debe conectar su calendario desde el panel.' };
  }

  try {
    // Build time range for the requested date
    const dayStart = `${date}T${String(businessHoursStart).padStart(2, '0')}:00:00`;
    const dayEnd = `${date}T${String(businessHoursEnd).padStart(2, '0')}:00:00`;

    // Use FreeBusy API to check occupied slots
    const freeBusyRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeMin: `${dayStart}-05:00`, // Ecuador is UTC-5
        timeMax: `${dayEnd}-05:00`,
        timeZone,
        items: [{ id: 'primary' }]
      })
    });

    const freeBusyData = await freeBusyRes.json();

    if (freeBusyData.error) {
      console.error('❌ [Google Calendar] FreeBusy error:', freeBusyData.error.message);
      return { available: [], error: `Error consultando calendario: ${freeBusyData.error.message}` };
    }

    // Get busy periods
    const busyPeriods = freeBusyData.calendars?.primary?.busy || [];

    // Generate all possible slots within business hours
    const allSlots: TimeSlot[] = [];
    const [year, month, day] = date.split('-').map(Number);
    const timezoneOffsetHours = 5; // Ecuador is UTC-5, so we add 5 hours to get UTC

    for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
      for (let min = 0; min < 60; min += slotDurationMinutes) {
        if (hour + (min + slotDurationMinutes) / 60 > businessHoursEnd) break;

        // Construct dates in UTC to avoid local server timezone variations (Vercel uses UTC)
        const slotStart = new Date(Date.UTC(year, month - 1, day, hour + timezoneOffsetHours, min, 0, 0));
        const slotEnd = new Date(Date.UTC(year, month - 1, day, hour + timezoneOffsetHours, min + slotDurationMinutes, 0, 0));

        // Check if slot overlaps with any busy period
        const isOccupied = busyPeriods.some((busy: { start: string; end: string }) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        if (!isOccupied) {
          const startHour = hour;
          const startMin = min;
          const endHour = Math.floor((hour * 60 + min + slotDurationMinutes) / 60);
          const endMin = (min + slotDurationMinutes) % 60;

          const formatTime = (h: number, m: number) => {
            const period = h >= 12 ? 'PM' : 'AM';
            const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
            return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
          };

          // Format date label
          const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
          const dayName = dayNames[d.getUTCDay()];
          const monthName = monthNames[d.getUTCMonth()];
          const dayOfMonth = d.getUTCDate();

          allSlots.push({
            start: `${date}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`,
            end: `${date}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`,
            label: `${dayName} ${dayOfMonth} ${monthName}, ${formatTime(startHour, startMin)} - ${formatTime(endHour, endMin)}`
          });
        }
      }
    }

    return { available: allSlots };
  } catch (err: any) {
    console.error('❌ [Google Calendar] Availability check error:', err.message);
    return { available: [], error: `Error inesperado: ${err.message}` };
  }
}

/**
 * Creates a calendar event (appointment) on the tenant's Google Calendar.
 * 
 * @param tenantId - The tenant ID
 * @param event - Event details (summary, description, start/end times)
 * @returns The created event ID and link, or an error
 */
export async function createCalendarEvent(
  tenantId: string,
  event: CalendarEvent
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  const credentials = await getCalendarCredentials(tenantId);
  if (!credentials) {
    return { success: false, error: 'Google Calendar no conectado.' };
  }

  const tz = event.timeZone || 'America/Guayaquil';

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description || '',
        start: {
          dateTime: event.startDateTime.includes('T') ? event.startDateTime : `${event.startDateTime}T00:00:00`,
          timeZone: tz
        },
        end: {
          dateTime: event.endDateTime.includes('T') ? event.endDateTime : `${event.endDateTime}T01:00:00`,
          timeZone: tz
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'popup', minutes: 10 }
          ]
        }
      })
    });

    const data = await res.json();

    if (data.error) {
      console.error('❌ [Google Calendar] Create event error:', data.error.message);
      return { success: false, error: `Error al crear la cita: ${data.error.message}` };
    }

    console.log(`✅ [Google Calendar] Event created: ${data.id} for tenant ${tenantId}`);
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink
    };
  } catch (err: any) {
    console.error('❌ [Google Calendar] Create event error:', err.message);
    return { success: false, error: `Error inesperado: ${err.message}` };
  }
}
