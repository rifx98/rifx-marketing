import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { generateAppointmentBriefing } from '@/lib/calendar-booking';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { appointmentId, force = false, history } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .select('id, customer_name, service, conversation_id, confirmation_message, phone_number, created_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    if (apptError || !appt) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    // Si ya existe un briefing válido y no es forzado por el usuario, devolverlo directamente
    if (appt.confirmation_message && !force && appt.confirmation_message.length > 30) {
      return NextResponse.json({
        success: true,
        briefing: appt.confirmation_message,
        cached: true
      });
    }

    let conversationId = appt.conversation_id;

    // Si la cita no tiene conversation_id vinculado, buscar inteligentemente en conversations
    if (!conversationId) {
      const isSimulator = (appt.customer_name || '').toLowerCase().includes('simula') || appt.phone_number === tenant.tenantId;

      if (isSimulator) {
        // Buscar conversación del simulador
        const { data: simConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('tenant_id', tenant.tenantId)
          .or('customer_name.ilike.%Simulador%,phone_number.eq.simulador')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (simConv?.id) {
          conversationId = simConv.id;
        }
      } else {
        // 1. Buscar por teléfono exacto o dígitos
        if (appt.phone_number) {
          const rawPhone = appt.phone_number.trim();
          const cleanDigits = rawPhone.replace(/\D/g, '');
          
          let { data: matchedPhone } = await supabase
            .from('conversations')
            .select('id')
            .eq('tenant_id', tenant.tenantId)
            .eq('phone_number', rawPhone)
            .limit(1)
            .maybeSingle();

          if (!matchedPhone?.id && cleanDigits.length >= 7) {
            const last8 = cleanDigits.slice(-8);
            const { data: matchedDigits } = await supabase
              .from('conversations')
              .select('id')
              .eq('tenant_id', tenant.tenantId)
              .ilike('phone_number', `%${last8}%`)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            matchedPhone = matchedDigits;
          }

          if (matchedPhone?.id) {
            conversationId = matchedPhone.id;
          }
        }

        // 2. Buscar por nombre de cliente si aún no se encontró
        if (!conversationId && appt.customer_name && appt.customer_name.trim().length > 2) {
          const { data: matchedName } = await supabase
            .from('conversations')
            .select('id')
            .eq('tenant_id', tenant.tenantId)
            .ilike('customer_name', `%${appt.customer_name.trim()}%`)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (matchedName?.id) {
            conversationId = matchedName.id;
          }
        }
      }

      // Si encontramos conversación, vincularla permanentemente a la cita
      if (conversationId) {
        await supabase
          .from('appointments')
          .update({
            conversation_id: conversationId,
            updated_at: new Date().toISOString()
          })
          .eq('id', appointmentId)
          .eq('tenant_id', tenant.tenantId);
      }
    }

    // Generar nuevo briefing con el Analista de IA a partir de la conversación del día de la reserva
    const briefing = await generateAppointmentBriefing({
      tenantId: tenant.tenantId,
      customerName: appt.customer_name || 'Cliente',
      service: appt.service || 'Asesoría',
      conversationId: conversationId || null,
      recentMessages: Array.isArray(history) && history.length > 0 ? history : undefined,
      bookingDate: appt.created_at
    });

    // Guardar en la cita
    await supabase
      .from('appointments')
      .update({
        confirmation_message: briefing,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenant.tenantId);

    // Si tiene conversación vinculada, actualizar notas del CRM también
    if (conversationId) {
      await supabase
        .from('conversations')
        .update({
          notes: briefing,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .eq('tenant_id', tenant.tenantId);
    }

    return NextResponse.json({
      success: true,
      briefing,
      cached: false
    });

  } catch (error: any) {
    console.error('[Appointments Briefing API] Error:', error);
    return NextResponse.json({ error: 'Error interno analizando conversación' }, { status: 500 });
  }
}
