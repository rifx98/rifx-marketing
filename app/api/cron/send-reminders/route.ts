import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// GET /api/cron/send-reminders - Enviar recordatorios (24h, 2h, 30m antes) y actualizar ciclos de vida
export async function GET(req: NextRequest) {
  try {
    // 1. Validar autorización
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    const cronSecret = process.env.CRON_SECRET;

    const isAuthorized =
      process.env.NODE_ENV === 'development' ||
      isVercelCron ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      console.warn('⚠️ Intento de ejecución de cron no autorizado');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const now = new Date();

    // Rango de búsqueda: desde hace 3 horas (para completar/no_show) hasta dentro de 26 horas (para recordatorios)
    const rangeStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const rangeEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();

    console.log(`⏰ Cron: Buscando citas activas entre ${rangeStart} y ${rangeEnd}...`);

    const { data: appts, error: apptsError } = await supabase
      .from('appointments')
      .select('*')
      .in('status', ['pending', 'confirmed', 'awaiting_reschedule', 'rescheduled', 'pending_completion'])
      .gte('scheduled_time', rangeStart)
      .lte('scheduled_time', rangeEnd);

    if (apptsError) {
      console.error('❌ Error al buscar citas:', apptsError);
      return NextResponse.json({ error: apptsError.message }, { status: 500 });
    }

    console.log(`⏰ Cron: Se encontraron ${appts?.length || 0} citas activas para procesar`);

    if (!appts || appts.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    let processedCount = 0;

    for (const appt of appts) {
      try {
        const apptTime = new Date(appt.scheduled_time).getTime();
        const nowTime = now.getTime();
        const diffMs = apptTime - nowTime;
        const diffHrs = diffMs / (1000 * 60 * 60);

        // A. CICLO DE VIDA POST-CITA (PASADO)
        if (diffMs < 0) {
          const pastMinutes = Math.abs(diffMs) / (1000 * 60);
          
          // 1. confirmed/rescheduled pasados por más de 30 minutos -> pending_completion (para que el admin valide)
          if (pastMinutes > 30 && (appt.status === 'confirmed' || appt.status === 'rescheduled')) {
            console.log(`🔄 Transicionando cita ${appt.id} (${appt.customer_name}) a pending_completion`);
            const { error: err } = await supabase
              .from('appointments')
              .update({ status: 'pending_completion', updated_at: new Date().toISOString() })
              .eq('id', appt.id);
            if (!err) processedCount++;
          }
          
          // 2. pending/awaiting_reschedule pasados por más de 60 minutos -> no_show automático
          if (pastMinutes > 60 && (appt.status === 'pending' || appt.status === 'awaiting_reschedule')) {
            console.log(`🔄 Transicionando cita ${appt.id} (${appt.customer_name}) a no_show`);
            const { error: err } = await supabase
              .from('appointments')
              .update({ status: 'no_show', updated_at: new Date().toISOString() })
              .eq('id', appt.id);
            if (!err) processedCount++;
          }
          
          continue;
        }

        // B. RECORDATORIOS FUTUROS
        let type: '24h' | '2h' | '30m' | null = null;
        let updateField = '';

        if (diffHrs > 23.0 && diffHrs <= 25.0 && !appt.reminder_24h_sent) {
          type = '24h';
          updateField = 'reminder_24h_sent';
        } else if (diffHrs > 1.5 && diffHrs <= 2.5 && !appt.reminder_2h_sent) {
          type = '2h';
          updateField = 'reminder_2h_sent';
        } else if (diffHrs > 0.25 && diffHrs <= 0.75 && !appt.reminder_30m_sent) {
          type = '30m';
          updateField = 'reminder_30m_sent';
        }

        if (!type) continue; // No entra en ningún rango de recordatorio o ya se envió

        console.log(`💬 Recordatorio ${type} requerido para cita ${appt.id} (${appt.customer_name})`);

        // Obtener configuración del tenant
        const { data: tenantConfig, error: configErr } = await supabase
          .from('config')
          .select('whatsapp_token, whatsapp_phone_id')
          .eq('tenant_id', appt.tenant_id)
          .limit(1)
          .maybeSingle();

        if (configErr || !tenantConfig) {
          console.error(`❌ No se encontró configuración de WhatsApp para el tenant ${appt.tenant_id}`);
          continue;
        }

        let token = tenantConfig.whatsapp_token || process.env.WHATSAPP_TOKEN;
        let phoneId = tenantConfig.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (token && token.length < 20) token = process.env.WHATSAPP_TOKEN;
        if (phoneId && phoneId.length < 5) phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!token || !phoneId) {
          console.error(`❌ Faltan credenciales de WhatsApp para enviar recordatorio de cita ${appt.id}`);
          continue;
        }

        // Formatear fecha y hora para el mensaje (Ecuador UTC-5)
        const apptDate = new Date(appt.scheduled_time);
        const optionsTime: Intl.DateTimeFormatOptions = {
          timeZone: 'America/Guayaquil',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        };
        const optionsDate: Intl.DateTimeFormatOptions = {
          timeZone: 'America/Guayaquil',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        };
        const formattedTime = new Intl.DateTimeFormat('es-EC', optionsTime).format(apptDate);
        const formattedDate = new Intl.DateTimeFormat('es-EC', optionsDate).format(apptDate);

        let reminderText = '';

        if (type === '24h') {
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nTe recordamos tu cita de *${appt.service || 'Asesoría'}*.\n\n📅 Fecha: ${formattedDate}\n🕒 Hora: ${formattedTime}\n\n¿Confirmas tu asistencia?\n\nResponde:\n✅ Sí\n❌ No`;
        } else if (type === '2h') {
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nTe recordamos tu cita de *${appt.service || 'Asesoría'}* programada para hoy.\n\n📅 Fecha: ${formattedDate}\n🕒 Hora: ${formattedTime}\n\n¿Confirmas tu asistencia?\n\nResponde:\n✅ Sí\n❌ No`;
        } else { // 30m
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nTu cita de *${appt.service || 'Asesoría'}* comienza en 30 minutos.\n\n📅 Fecha: ${formattedDate}\n🕒 Hora: ${formattedTime}\n\n¡Te esperamos! 😊`;
        }

        // Enviar mensaje
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: appt.phone_number,
            type: 'text',
            text: { body: reminderText },
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(`❌ Error de Meta API al enviar recordatorio ${type} de cita ${appt.id}:`, JSON.stringify(result));
          continue;
        }

        console.log(`✅ Recordatorio ${type} enviado exitosamente a ${appt.phone_number} para cita ${appt.id}`);

        // Actualizar estado del recordatorio en la DB
        const updateData: Record<string, any> = {
          reminder_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        updateData[updateField] = true;

        const { error: updateErr } = await supabase
          .from('appointments')
          .update(updateData)
          .eq('id', appt.id);

        if (updateErr) {
          console.error(`❌ Error al marcar recordatorio como enviado para la cita ${appt.id}:`, updateErr);
        } else {
          // Guardar log de chat
          await supabase.from('messages').insert({
            conversation_id: appt.conversation_id,
            role: 'assistant',
            content: `🤖 [Recordatorio ${type}]: ${reminderText}`,
          });
          
          processedCount++;
        }
      } catch (err) {
        console.error(`❌ Error inesperado al procesar cita ${appt.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    console.error('❌ Error en cron send-reminders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
