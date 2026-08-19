import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { deleteCalendarEvent } from '@/lib/google-calendar';
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
const ACTIONS = new Set(['complete', 'no_show', 'cancel', 'reschedule']);
const ACTIONABLE = ['pending', 'confirmed', 'rescheduled', 'pending_completion', 'awaiting_reschedule'];
const APPOINTMENT_SELECT = 'id,conversation_id,event_id,customer_name,phone_number,scheduled_time,service,status,confirmation_message,confirmed_at,cancelled_at,completed_at,created_at,updated_at';

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
      .select(APPOINTMENT_SELECT)
      .eq('tenant_id', authorization.tenant.tenantId)
      .order('scheduled_time', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) {
      console.error('Appointment lookup failed:', error.code || 'database_error');
      return internalApiError();
    }

    const needle = search.toLocaleLowerCase('es');
    const filtered = needle
      ? (data || []).filter((appointment) => [
          appointment.customer_name,
          appointment.phone_number,
          appointment.service,
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
    const parsed = await readLimitedJsonObject(req, 4 * 1024);
    if (!parsed.ok) return parsed.response;
    const { appointmentId, action } = parsed.body;
    if (typeof appointmentId !== 'string' || !UUID_PATTERN.test(appointmentId)
        || typeof action !== 'string' || !ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Accion de cita invalida' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id,conversation_id,event_id,phone_number,status')
      .eq('id', appointmentId)
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();
    if (appointmentError) {
      console.error('Appointment ownership lookup failed:', appointmentError.code || 'database_error');
      return internalApiError();
    }
    if (!appointment) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

    const now = new Date().toISOString();
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
        `https://graph.facebook.com/v24.0/${encodeURIComponent(config.whatsapp_phone_id)}/messages`,
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
