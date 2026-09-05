import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { enforceTenantRateLimit, internalApiError } from '@/lib/request-guards';
import { notifyNextInWaitlist } from '@/lib/waitlist-engine';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['waiting', 'notified', 'booked', 'cancelled', 'expired']);

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureDenied = denyUnlessFeature(tenant, 'appointments');
    if (featureDenied) return featureDenied;

    const rateDenied = await enforceTenantRateLimit('waitlist-read', tenant.tenantId, 60, 60_000);
    if (rateDenied) return rateDenied;

    const status = req.nextUrl.searchParams.get('status');
    const supabase = createSupabaseAdmin();

    let query = supabase
      .from('appointment_waitlist')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all' && STATUSES.has(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Waitlist API] Error al obtener lista de espera:', error);
      return internalApiError();
    }

    return NextResponse.json(data || [], {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (err) {
    console.error('[Waitlist API] Excepción en GET:', err);
    return internalApiError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureDenied = denyUnlessFeature(tenant, 'appointments');
    if (featureDenied) return featureDenied;

    const rateDenied = await enforceTenantRateLimit('waitlist-write', tenant.tenantId, 40, 60_000);
    if (rateDenied) return rateDenied;

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const supabase = createSupabaseAdmin();

    // 1. Notificar manualmente a un cliente de la lista de espera
    if (action === 'notify') {
      const { waitlistId, time } = body;
      if (!waitlistId || !UUID_PATTERN.test(waitlistId)) {
        return NextResponse.json({ error: 'ID de lista de espera inválido' }, { status: 400 });
      }

      const { data: item } = await supabase
        .from('appointment_waitlist')
        .select('*')
        .eq('id', waitlistId)
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (!item) {
        return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
      }

      const slotTime = typeof time === 'string' && time ? time : '10:00';
      const result = await notifyNextInWaitlist({
        tenantId: tenant.tenantId,
        freedDate: item.desired_date,
        freedTime: slotTime,
        service: item.service,
      });

      return NextResponse.json({ success: true, result });
    }

    // 2. Actualizar estado (ej. cancelar o marcar reservado)
    if (action === 'update_status') {
      const { waitlistId, status } = body;
      if (!waitlistId || !UUID_PATTERN.test(waitlistId) || !STATUSES.has(status)) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }

      const { error: updateErr } = await supabase
        .from('appointment_waitlist')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', waitlistId)
        .eq('tenant_id', tenant.tenantId);

      if (updateErr) return internalApiError();
      return NextResponse.json({ success: true });
    }

    // 3. Crear nuevo registro en lista de espera (Acción por defecto)
    const {
      customer_name,
      phone_number,
      desired_date,
      preferred_time_range,
      service,
      resource_id,
      resource_name,
      conversation_id,
      notes,
    } = body;

    if (!customer_name || !phone_number || !desired_date) {
      return NextResponse.json({ error: 'Nombre, teléfono y fecha deseada son obligatorios' }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('appointment_waitlist')
      .insert({
        tenant_id: tenant.tenantId,
        customer_name: String(customer_name).slice(0, 160),
        phone_number: String(phone_number).slice(0, 30),
        desired_date,
        preferred_time_range: preferred_time_range || 'any',
        service: service || 'General',
        resource_id: resource_id && UUID_PATTERN.test(resource_id) ? resource_id : null,
        resource_name: resource_name || null,
        conversation_id: conversation_id && UUID_PATTERN.test(conversation_id) ? conversation_id : null,
        notes: notes || null,
        status: 'waiting',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Waitlist API] Error al insertar en lista de espera:', insertError);
      return internalApiError();
    }

    return NextResponse.json({ success: true, item: inserted });
  } catch (err) {
    console.error('[Waitlist API] Excepción en POST:', err);
    return internalApiError();
  }
}
