import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar';
import { notifyNextInWaitlist } from '@/lib/waitlist-engine';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set([
  'pending', 'confirmed', 'awaiting_reschedule', 'rescheduled',
  'cancelled', 'completed', 'no_show', 'pending_completion',
]);
const ACTIONS = new Set(['complete', 'no_show', 'cancel', 'reschedule', 'create']);
const ACTIONABLE = ['pending', 'confirmed', 'rescheduled', 'pending_completion', 'awaiting_reschedule'];
const APPOINTMENT_SELECT = 'id,conversation_id,event_id,customer_name,phone_number,scheduled_time,service,status,confirmation_message,confirmed_at,cancelled_at,completed_at,resource_id,resource_name,created_at,updated_at';

async function authorize(req: NextRequest, namespace: string, attempts: number) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.tenantId) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const;
  }
  const featureDenied = denyUnlessFeature(tenant, 'appointments');
  if (featureDenied) return { response: featureDenied } as const;
  const rateDenied = await enforceTenantRateLimit(namespace, tenant.tenantId, attempts, 60_000);
  if (rateDenied) return { response: rateDenied } as const;
  return { tenant } as const;
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'appointments-read', 90);
    if ('response' in authorization) return authorization.response;
    const status = req.nextUrl.searchParams.get('status');
    const resource = req.nextUrl.searchParams.get('resource')?.trim() || '';
    const search = req.nextUrl.searchParams.get('search')?.trim() || '';
    const limit = Number(req.nextUrl.searchParams.get('limit') || 200);
    const offset = Number(req.nextUrl.searchParams.get('offset') || 0);
    if ((status && status !== 'all' && !STATUSES.has(status)) || search.length > 100
        || !Number.isSafeInteger(limit) || limit < 1 || limit > 500
        || !Number.isSafeInteger(offset) || offset < 0 || offset > 10_000) {
      return NextResponse.json({ error: 'Filtros invalidos' }, { status: 400 });
    }

    let query = createSupabaseAdmin()
      .from('appointments')
      .select('*')
      .eq('tenant_id', authorization.tenant.tenantId)
      .order('scheduled_time', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status && status !== 'all') query = query.eq('status', status);
    if (resource && resource !== 'all') {
      try {
        query = query.or(`resource_name.eq.${resource},resource_id.eq.${resource}`);
      } catch {
        // Ignorar si la columna no existe en consultas dinámicas
      }
    }
    const { data, error } = await query;
    if (error) {
      console.error('Appointment lookup failed:', error.code || 'database_error', error.message);
      return internalApiError();
    }

    const needle = search.toLocaleLowerCase('es');
    const filtered = needle
      ? (data || []).filter((appointment) => [
          appointment.customer_name,
          appointment.phone_number,
          appointment.service,
          appointment.resource_name,
        ].some((value) => typeof value === 'string' && value.toLocaleLowerCase('es').includes(needle)))
      : (data || []);
    return NextResponse.json(filtered, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    console.error('Appointment request failed');
    return internalApiError();
  }
}

async function transitionAppointment(
  tenantId: string,
  appointmentId: string,
  targetStatus: string,
  allowedStatuses: string[],
  timestamps: Record<string, string>,
) {
  return createSupabaseAdmin()
    .from('appointments')
    .update({ status: targetStatus, updated_at: timestamps.updated_at, ...timestamps })
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .in('status', allowedStatuses)
    .select('id')
    .maybeSingle();
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'appointments-write', 40);
    if ('response' in authorization) return authorization.response;
    const parsed = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsed.ok) return parsed.response;
    const { action } = parsed.body;
    if (typeof action !== 'string' || !ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Accion de cita invalida' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const now = new Date().toISOString();

    // ============================================
    // ACCIÓN: CREATE (Agendamiento Directo desde CRM/Panel)
    // ============================================
    if (action === 'create') {
      const {
        customer_name,
        phone_number,
        scheduled_time,
        service = 'Asesoría',
        resource_id,
        resource_name,
        conversation_id,
      } = parsed.body;

      if (typeof customer_name !== 'string' || !customer_name.trim() ||
          typeof phone_number !== 'string' || !phone_number.trim() ||
          typeof scheduled_time !== 'string' || !Date.parse(scheduled_time)) {
        return NextResponse.json({ error: 'Nombre, teléfono y fecha/hora válidos son obligatorios' }, { status: 400 });
      }

      const validConvId = typeof conversation_id === 'string' && UUID_PATTERN.test(conversation_id) ? conversation_id : null;
      const validResId = typeof resource_id === 'string' && UUID_PATTERN.test(resource_id) ? resource_id : null;

      // Preparar evento para Google Calendar
      const startDate = new Date(scheduled_time);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hora de duración por defecto
      const startDateTime = startDate.toISOString();
      const endDateTime = endDate.toISOString();

      const summary = `📅 Cita: ${customer_name.trim()} — ${service}${resource_name ? ` (${resource_name})` : ''}`;
      const description = `Cliente: ${customer_name.trim()}\nTeléfono: ${phone_number.trim()}\nServicio: ${service}\nEspecialista/Recurso: ${resource_name || 'No asignado'}\nAgendado desde CRM RIFX Marketing`;

      let eventId = `manual_${Date.now()}`;
      try {
        const calResult = await createCalendarEvent(authorization.tenant.tenantId, {
          summary,
          description,
          startDateTime,
          endDateTime,
          timeZone: 'America/Guayaquil',
        });
        if (calResult.success && calResult.eventId) {
          eventId = calResult.eventId;
        }
      } catch (calErr) {
        console.warn('[Appointments API] Error al sincronizar con Google Calendar:', calErr);
      }

      // 1. Obtener o crear conversación en el CRM si es una cita directa/manual
      let finalConvId = validConvId;
      if (!finalConvId) {
        const cleanDigits = phone_number.replace(/[^0-9]/g, '');
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('tenant_id', authorization.tenant.tenantId)
          .ilike('customer_phone', `%${cleanDigits.slice(-8)}%`)
          .limit(1)
          .maybeSingle();

        if (existingConv?.id) {
          finalConvId = existingConv.id;
        } else {
          try {
            const { data: createdConv } = await supabase
              .from('conversations')
              .insert({
                tenant_id: authorization.tenant.tenantId,
                customer_name: customer_name.trim().slice(0, 160),
                customer_phone: phone_number.trim().slice(0, 30),
                sales_stage: 'appointment_booked',
                platform: 'whatsapp',
              })
              .select('id')
              .maybeSingle();

            if (createdConv?.id) {
              finalConvId = createdConv.id;
            }
          } catch (convErr) {
            console.warn('[Appointments API] No se pudo crear conversación placeholder:', convErr);
          }
        }
      }

      // 2. Preparar payload de cita
      const baseApptPayload: any = {
        tenant_id: authorization.tenant.tenantId,
        conversation_id: finalConvId,
        event_id: eventId || `manual_${Date.now()}`,
        customer_name: customer_name.trim().slice(0, 160),
        phone_number: phone_number.trim().slice(0, 30),
        scheduled_time: startDate.toISOString(),
        service: String(service || 'Asesoría').slice(0, 200),
        status: 'confirmed',
      };

      const fullApptPayload = {
        ...baseApptPayload,
        resource_id: validResId,
        resource_name: resource_name ? String(resource_name).slice(0, 150) : null,
        confirmed_at: now,
      };

      // Intentar primero con todas las columnas
      let insertResult = await supabase
        .from('appointments')
        .insert(fullApptPayload)
        .select('*')
        .single();

      // Si falla por columnas que aún no existen en la tabla appointments (ej. resource_id o confirmed_at)
      if (insertResult.error && (insertResult.error.message?.includes('column') || insertResult.error.code === '42703')) {
        console.warn('[Appointments API] Reintentando con columnas básicas:', insertResult.error.message);
        insertResult = await supabase
          .from('appointments')
          .insert(baseApptPayload)
          .select('*')
          .single();
      }

      if (insertResult.error) {
        console.error('[Appointments API] Error al guardar cita en DB:', insertResult.error);
        return NextResponse.json({
          error: `Error al guardar cita: ${insertResult.error.message}. Aplica la migración SQL en Supabase para resolver restricciones.`,
        }, { status: 400 });
      }

      const newAppt = insertResult.data;

      // Si viene de una conversación en el CRM, actualizar etapa a appointment_booked
      if (validConvId) {
        await supabase
          .from('conversations')
          .update({ sales_stage: 'appointment_booked', updated_at: now })
          .eq('id', validConvId)
          .eq('tenant_id', authorization.tenant.tenantId);
      }

      // Enviar confirmación por WhatsApp si está configurado
      try {
        const { data: config } = await supabase
          .from('config')
          .select('whatsapp_token,whatsapp_phone_id')
          .eq('tenant_id', authorization.tenant.tenantId)
          .maybeSingle();

        if (config?.whatsapp_token && config?.whatsapp_phone_id) {
          const formattedDate = new Intl.DateTimeFormat('es-EC', {
            timeZone: 'America/Guayaquil',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }).format(startDate);

          const confirmMsg = `Hola *${customer_name.trim()}* 👋\n\nTu cita ha sido agendada con éxito.\n\n📅 *Fecha y Hora:* ${formattedDate}\n📋 *Servicio:* ${service}${resource_name ? `\n👤 *Especialista:* ${resource_name}` : ''}\n\n¡Te esperamos! 😊`;

          await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(config.whatsapp_phone_id)}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.whatsapp_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone_number.trim(),
              type: 'text',
              text: { body: confirmMsg },
            }),
          });

          if (validConvId) {
            await supabase.from('messages').insert({
              tenant_id: authorization.tenant.tenantId,
              conversation_id: validConvId,
              role: 'assistant',
              content: `[Cita Agendada]: ${confirmMsg}`,
            });
          }
        }
      } catch (waErr) {
        console.warn('[Appointments API] Error al enviar confirmación por WhatsApp:', waErr);
      }

      return NextResponse.json({ success: true, appointment: newAppt }, { status: 201 });
    }

    // ============================================
    // ACCIONES SOBRE CITA EXISTENTE (complete, cancel, reschedule, no_show)
    // ============================================
    const { appointmentId } = parsed.body;
    if (typeof appointmentId !== 'string' || !UUID_PATTERN.test(appointmentId)) {
      return NextResponse.json({ error: 'Accion de cita invalida: appointmentId requerido' }, { status: 400 });
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id,conversation_id,event_id,phone_number,status,scheduled_time,service')
      .eq('id', appointmentId)
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();
    if (appointmentError) {
      console.error('Appointment ownership lookup failed:', appointmentError.code || 'database_error');
      return internalApiError();
    }
    if (!appointment) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

    const targetStatus = action === 'complete'
      ? 'completed'
      : action === 'no_show'
        ? 'no_show'
        : action === 'cancel'
          ? 'cancelled'
          : 'awaiting_reschedule';
    if (appointment.status === targetStatus) {
      return NextResponse.json({ success: true, alreadyApplied: true, status: targetStatus });
    }
    const allowedStatuses = action === 'reschedule'
      ? ['pending', 'confirmed', 'rescheduled']
      : ACTIONABLE;
    const timestamps: Record<string, string> = { updated_at: now };
    if (action === 'complete') timestamps.completed_at = now;
    if (action === 'cancel') timestamps.cancelled_at = now;
    const { data: transitioned, error: transitionError } = await transitionAppointment(
      authorization.tenant.tenantId,
      appointmentId,
      targetStatus,
      allowedStatuses,
      timestamps,
    );
    if (transitionError) {
      console.error('Appointment transition failed:', transitionError.code || 'database_error');
      return internalApiError();
    }
    if (!transitioned) {
      return NextResponse.json({ error: 'La cita ya no admite esta transicion' }, { status: 409 });
    }

    // Si se cancela o reagenda, activar notificación a lista de espera
    if ((action === 'cancel' || action === 'reschedule') && appointment.scheduled_time) {
      try {
        const apptDate = new Date(appointment.scheduled_time);
        const freedDate = apptDate.toISOString().split('T')[0];
        const freedTime = apptDate.toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false });
        notifyNextInWaitlist({
          tenantId: authorization.tenant.tenantId,
          freedDate,
          freedTime,
          service: appointment.service,
        }).catch((e) => console.error('[Waitlist Trigger] Error:', e));
      } catch (err) {
        console.error('[Waitlist Trigger] Error:', err);
      }
    }

    if (action === 'cancel' && typeof appointment.event_id === 'string' && appointment.event_id.length <= 1_024) {
      const calendarResult = await deleteCalendarEvent(authorization.tenant.tenantId, appointment.event_id);
      return NextResponse.json({
        success: true,
        status: targetStatus,
        calendarDeleted: calendarResult.success,
      });
    }

    if (action !== 'complete') {
      return NextResponse.json({ success: true, status: targetStatus });
    }

    const { data: config, error: configError } = await supabase
      .from('config')
      .select('whatsapp_token,whatsapp_phone_id')
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();
    if (configError) {
      console.error('Appointment WhatsApp configuration lookup failed:', configError.code || 'database_error');
      return NextResponse.json({ success: true, status: targetStatus, followupSent: false });
    }
    if (typeof config?.whatsapp_token !== 'string' || !config.whatsapp_token
        || typeof config.whatsapp_phone_id !== 'string' || !/^\d{6,30}$/.test(config.whatsapp_phone_id)
        || typeof appointment.phone_number !== 'string' || !/^\+?\d{7,20}$/.test(appointment.phone_number)) {
      return NextResponse.json({ success: true, status: targetStatus, followupSent: false });
    }

    const followupText = 'Gracias por visitarnos. ¿Como fue tu experiencia? Tu opinion es muy importante para nosotros.';
    let providerResponse: Response;
    try {
      providerResponse = await fetch(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(config.whatsapp_phone_id)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.whatsapp_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: appointment.phone_number,
            type: 'text',
            text: { body: followupText },
          }),
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(12_000),
        },
      );
      await providerResponse.body?.cancel();
    } catch {
      console.error('Appointment WhatsApp followup failed');
      return NextResponse.json({ success: true, status: targetStatus, followupSent: false });
    }
    if (!providerResponse.ok) {
      console.error('Appointment WhatsApp followup rejected:', providerResponse.status);
      return NextResponse.json({ success: true, status: targetStatus, followupSent: false });
    }

    let historySaved = false;
    if (typeof appointment.conversation_id === 'string' && UUID_PATTERN.test(appointment.conversation_id)) {
      const { error: historyError } = await supabase.from('messages').insert({
        tenant_id: authorization.tenant.tenantId,
        conversation_id: appointment.conversation_id,
        role: 'assistant',
        content: `[Seguimiento post-visita]: ${followupText}`,
      });
      historySaved = !historyError;
      if (historyError) console.error('Appointment followup history write failed:', historyError.code || 'database_error');
    }
    return NextResponse.json({
      success: true,
      status: targetStatus,
      followupSent: true,
      historySaved,
    });
  } catch {
    console.error('Appointment mutation failed');
    return internalApiError();
  }
}
