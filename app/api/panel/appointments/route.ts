import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { deleteCalendarEvent } from '@/lib/google-calendar';

// GET /api/panel/appointments - Obtener citas del tenant
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    let query = supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('scheduled_time', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error('❌ Error consultando citas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filtrado por texto (búsqueda simple en JS si aplica)
    let filtered = appointments || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(a => 
        (a.customer_name && a.customer_name.toLowerCase().includes(searchLower)) ||
        (a.phone_number && a.phone_number.includes(searchLower)) ||
        (a.service && a.service.toLowerCase().includes(searchLower))
      );
    }

    return NextResponse.json(filtered);
  } catch (error: any) {
    console.error('❌ Error en GET appointments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/panel/appointments - Acciones manuales de administración
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { appointmentId, action } = body;

    if (!appointmentId || !action) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Obtener la cita
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (apptError || !appt) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === 'complete') {
      // Marcar como asistió (completed)
      const { error: updateErr } = await supabase
        .from('appointments')
        .update({
          status: 'completed',
          completed_at: now,
          updated_at: now
        })
        .eq('id', appointmentId);

      if (updateErr) throw updateErr;

      // Enviar mensaje de seguimiento por WhatsApp si está conectado
      try {
        const { data: tenantConfig } = await supabase
          .from('config')
          .select('whatsapp_token, whatsapp_phone_id')
          .eq('tenant_id', tenant.tenantId)
          .limit(1)
          .maybeSingle();

        if (tenantConfig) {
          let token = tenantConfig.whatsapp_token || process.env.WHATSAPP_TOKEN;
          let phoneId = tenantConfig.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
          
          if (token && token.length < 20) token = process.env.WHATSAPP_TOKEN;
          if (phoneId && phoneId.length < 5) phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

          if (token && phoneId) {
            const followupText = `Gracias por visitarnos 😊 ¿Cómo fue tu experiencia? Tu opinión es muy importante para nosotros.`;
            const waRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: appt.phone_number,
                type: 'text',
                text: { body: followupText },
              }),
            });
            if (waRes.ok) {
              await supabase.from('messages').insert({
                conversation_id: appt.conversation_id,
                role: 'assistant',
                content: `🤖 [Seguimiento Post-Visita]: ${followupText}`,
              });
            }
          }
        }
      } catch (e) {
        console.error('⚠️ Error al enviar WhatsApp de seguimiento:', e);
      }

      return NextResponse.json({ success: true, message: 'Cita completada' });
    }

    if (action === 'no_show') {
      // Marcar como no asistió (no_show)
      const { error: updateErr } = await supabase
        .from('appointments')
        .update({
          status: 'no_show',
          updated_at: now
        })
        .eq('id', appointmentId);

      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true, message: 'Cita marcada como no show' });
    }

    if (action === 'cancel') {
      // Cancelar cita: Eliminar de Google Calendar si existe y marcar como cancelled
      if (appt.event_id) {
        const delRes = await deleteCalendarEvent(tenant.tenantId, appt.event_id);
        if (!delRes.success) {
          console.error(`⚠️ Error al eliminar evento de Calendar ${appt.event_id}:`, delRes.error);
        }
      }

      const { error: updateErr } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          cancelled_at: now,
          updated_at: now
        })
        .eq('id', appointmentId);

      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true, message: 'Cita cancelada' });
    }

    if (action === 'reschedule') {
      // Reagendar: Cambiar estado a awaiting_reschedule
      const { error: updateErr } = await supabase
        .from('appointments')
        .update({
          status: 'awaiting_reschedule',
          updated_at: now
        })
        .eq('id', appointmentId);

      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true, message: 'Cita puesta en espera de reagendamiento' });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error: any) {
    console.error('❌ Error en POST appointments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
