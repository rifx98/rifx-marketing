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
const ACTIONS = new Set(['complete', 'no_show', 'cancel', 'reschedule', 'create', 'delete']);
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

      // Validar si el día de la cita está habilitado en business_days
      const { data: tenantConfig } = await supabase
        .from('config')
        .select('business_days')
        .eq('tenant_id', authorization.tenant.tenantId)
        .maybeSingle();

      if (Array.isArray(tenantConfig?.business_days) && tenantConfig.business_days.length > 0) {
        const dateParts = scheduled_time.split('T')[0].split('-').map(Number);
        if (dateParts.length === 3) {
          const dayOfWeek = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay();
          if (!tenantConfig.business_days.includes(dayOfWeek)) {
            return NextResponse.json({
              error: 'No se pueden agendar citas en un día sin atención según el horario comercial configurado.'
            }, { status: 400 });
          }
        }
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
      .select('*')
      .eq('id', appointmentId)
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();
    if (appointmentError) {
      console.error('Appointment ownership lookup failed:', appointmentError.code || 'database_error');
      return internalApiError();
    }
    if (!appointment) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

    // ============================================
    // ACCIÓN: DELETE (Eliminar cita permanentemente)
    // ============================================
    if (action === 'delete') {
      if (typeof appointment.event_id === 'string' && !appointment.event_id.startsWith('manual_')) {
        try {
          await deleteCalendarEvent(authorization.tenant.tenantId, appointment.event_id);
        } catch (calErr) {
          console.warn('[Appointments API] Error al eliminar evento de Google Calendar:', calErr);
        }
      }

      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId)
        .eq('tenant_id', authorization.tenant.tenantId);

      if (deleteError) {
        console.error('[Appointments API] Error deleting appointment:', deleteError);
        return NextResponse.json({ error: 'No se pudo eliminar la cita de la base de datos' }, { status: 400 });
      }

      // Si era una cita futura y activa, notificar a la lista de espera
      if (appointment.scheduled_time && ['pending', 'confirmed', 'rescheduled'].includes(appointment.status)) {
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

      return NextResponse.json({ success: true, message: 'Cita eliminada permanentemente' });
    }

    // ============================================
    // ACCIÓN: RESCHEDULE CON NUEVO HORARIO
    // ============================================
    if (action === 'reschedule' && parsed.body.scheduled_time) {
      const { scheduled_time: newScheduledTime, resource_id: newResId, resource_name: newResName } = parsed.body;
      if (typeof newScheduledTime !== 'string' || !Date.parse(newScheduledTime)) {
        return NextResponse.json({ error: 'Fecha y hora válidas son requeridas para reagendar' }, { status: 400 });
      }

      // Validar si el nuevo día de la cita está habilitado en business_days
      const { data: tenantConfig } = await supabase
        .from('config')
        .select('business_days')
        .eq('tenant_id', authorization.tenant.tenantId)
        .maybeSingle();

      if (Array.isArray(tenantConfig?.business_days) && tenantConfig.business_days.length > 0) {
        const dateParts = newScheduledTime.split('T')[0].split('-').map(Number);
        if (dateParts.length === 3) {
          const dayOfWeek = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay();
          if (!tenantConfig.business_days.includes(dayOfWeek)) {
            return NextResponse.json({
              error: 'No se pueden reagendar citas a un día sin atención según el horario comercial configurado.'
            }, { status: 400 });
          }
        }
      }

      const newDate = new Date(newScheduledTime);
      const newStartIso = newDate.toISOString();
      const newEndIso = new Date(newDate.getTime() + 60 * 60 * 1000).toISOString();

      let eventId = appointment.event_id;
      // Re-sincronizar con Google Calendar
      try {
        if (eventId && !eventId.startsWith('manual_')) {
          await deleteCalendarEvent(authorization.tenant.tenantId, eventId);
        }
        const effectiveResource = newResName || appointment.resource_name || '';
        const summary = `📅 Cita (Reagendada): ${appointment.customer_name || 'Cliente'} — ${appointment.service || 'Asesoría'}${effectiveResource ? ` (${effectiveResource})` : ''}`;
        const description = `Cliente: ${appointment.customer_name || ''}\nTeléfono: ${appointment.phone_number || ''}\nServicio: ${appointment.service || ''}\nEspecialista/Recurso: ${effectiveResource || 'No asignado'}\nReagendada desde CRM RIFX Marketing`;
        const calResult = await createCalendarEvent(authorization.tenant.tenantId, {
          summary,
          description,
          startDateTime: newStartIso,
          endDateTime: newEndIso,
          timeZone: 'America/Guayaquil',
        });
        if (calResult.success && calResult.eventId) {
          eventId = calResult.eventId;
        }
      } catch (calErr) {
        console.warn('[Appointments API] Error al sincronizar Google Calendar en reagendamiento:', calErr);
      }

      // Notificar lista de espera por el horario liberado
      if (appointment.scheduled_time) {
        try {
          const oldDate = new Date(appointment.scheduled_time);
          const freedDate = oldDate.toISOString().split('T')[0];
          const freedTime = oldDate.toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false });
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

      const updatePayload: any = {
        scheduled_time: newStartIso,
        status: 'rescheduled',
        updated_at: now,
        event_id: eventId || appointment.event_id || `manual_${Date.now()}`,
      };
      if (typeof newResName === 'string') updatePayload.resource_name = newResName.trim().slice(0, 150);
      if (typeof newResId === 'string' && UUID_PATTERN.test(newResId)) updatePayload.resource_id = newResId;

      let { data: updatedAppt, error: updateError } = await supabase
        .from('appointments')
        .update(updatePayload)
        .eq('id', appointmentId)
        .eq('tenant_id', authorization.tenant.tenantId)
        .select('*')
        .single();

      if (updateError && (updateError.message?.includes('column') || updateError.code === '42703')) {
        const { resource_name: _rn, resource_id: _ri, ...basePayload } = updatePayload;
        const retryRes = await supabase
          .from('appointments')
          .update(basePayload)
          .eq('id', appointmentId)
          .eq('tenant_id', authorization.tenant.tenantId)
          .select('*')
          .single();
        updatedAppt = retryRes.data;
        updateError = retryRes.error;
      }

      if (updateError) {
        console.error('[Appointments API] Error updating appointment on reschedule:', updateError);
        return NextResponse.json({ error: updateError.message || 'Error al reagendar la cita' }, { status: 400 });
      }

      // Enviar confirmación por WhatsApp si está configurado
      try {
        const { data: config } = await supabase
          .from('config')
          .select('whatsapp_token,whatsapp_phone_id')
          .eq('tenant_id', authorization.tenant.tenantId)
          .maybeSingle();

        if (config?.whatsapp_token && config?.whatsapp_phone_id && appointment.phone_number) {
          const formattedDate = new Intl.DateTimeFormat('es-EC', {
            timeZone: 'America/Guayaquil',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }).format(newDate);

          const rescheduleMsg = `Hola *${appointment.customer_name || 'Cliente'}* 👋\n\nTu cita ha sido *reagendada* con éxito.\n\n📅 *Nuevo Horario:* ${formattedDate}\n📋 *Servicio:* ${appointment.service || 'Asesoría'}${newResName ? `\n👤 *Especialista:* ${newResName}` : ''}\n\n¡Te esperamos! 😊`;

          await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(config.whatsapp_phone_id)}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.whatsapp_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: appointment.phone_number,
              type: 'text',
              text: { body: rescheduleMsg },
            }),
          });

          if (appointment.conversation_id) {
            await supabase.from('messages').insert({
              tenant_id: authorization.tenant.tenantId,
              conversation_id: appointment.conversation_id,
              role: 'assistant',
              content: `[Cita Reagendada]: ${rescheduleMsg}`,
            });
          }
        }
      } catch (waErr) {
        console.warn('[Appointments API] Error al enviar confirmación de reagendamiento por WhatsApp:', waErr);
      }

      return NextResponse.json({ success: true, status: 'rescheduled', appointment: updatedAppt });
    }

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

export async function DELETE(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'appointments-write', 40);
    if ('response' in authorization) return authorization.response;

    let appointmentId = req.nextUrl.searchParams.get('appointmentId');
    if (!appointmentId) {
      const parsed = await readLimitedJsonObject(req, 4 * 1024);
      if (parsed.ok && typeof parsed.body?.appointmentId === 'string') {
        appointmentId = parsed.body.appointmentId;
      }
    }

    if (!appointmentId || !UUID_PATTERN.test(appointmentId)) {
      return NextResponse.json({ error: 'appointmentId inválido requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id,event_id,status,scheduled_time,service')
      .eq('id', appointmentId)
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    if (typeof appointment.event_id === 'string' && !appointment.event_id.startsWith('manual_')) {
      try {
        await deleteCalendarEvent(authorization.tenant.tenantId, appointment.event_id);
      } catch (calErr) {
        console.warn('[Appointments API] Error al eliminar evento de Google Calendar:', calErr);
      }
    }

    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId)
      .eq('tenant_id', authorization.tenant.tenantId);

    if (deleteError) {
      console.error('[Appointments API] Error deleting appointment:', deleteError);
      return NextResponse.json({ error: 'No se pudo eliminar la cita de la base de datos' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Cita eliminada correctamente' });
  } catch {
    console.error('Appointment deletion failed');
    return internalApiError();
  }
}
