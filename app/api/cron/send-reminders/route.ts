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

    // Buscar citas desde hace 6 horas (para incluir las de hace 5h que faltaron) hasta dentro de 25 horas
    const rangeStart = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const rangeEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: appts, error } = await supabase
      .from('appointments')
      .select('*')
      .gte('scheduled_time', rangeStart)
      .lte('scheduled_time', rangeEnd)
      .in('status', ['pending', 'confirmed', 'awaiting_reschedule', 'rescheduled', 'pending_completion', 'no_show'])
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ Error buscando citas para recordatorios:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Buscando recordatorios entre ${rangeStart} y ${rangeEnd}. Encontradas: ${appts?.length || 0}`);

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
            appt.status = 'pending_completion'; // update local para no disparar recordatorios incorrectos
          }
          
          // 2. pending/awaiting_reschedule pasados por más de 60 minutos -> no_show automático
          if (pastMinutes > 60 && (appt.status === 'pending' || appt.status === 'awaiting_reschedule')) {
            console.log(`🔄 Transicionando cita ${appt.id} (${appt.customer_name}) a no_show`);
            const { error: err } = await supabase
              .from('appointments')
              .update({ status: 'no_show', updated_at: new Date().toISOString() })
              .eq('id', appt.id);
            if (!err) processedCount++;
            appt.status = 'no_show';
          }
        }

        // B. EVALUACIÓN DE RECORDATORIOS (FUTUROS Y PASADOS)
        let type: '24h' | '2h' | '30m' | 'missed' | null = null;
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
        } else if (diffHrs < -4.8 && diffHrs >= -6.0 && appt.status === 'no_show' && appt.reminder_missed_sent === false) {
          // Recordatorio de cita perdida (+5h pasadas) SOLO si ya fue marcada como no_show
          // Nota: usamos === false para asegurar que la columna existe en la BD
          type = 'missed';
          updateField = 'reminder_missed_sent';
        }

        if (!type) continue; // No entra en ningún rango o ya se envió

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
        } else if (type === '30m') {
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nTu cita de *${appt.service || 'Asesoría'}* comienza en 30 minutos.\n\n📅 Fecha: ${formattedDate}\n🕒 Hora: ${formattedTime}\n\n¡Te esperamos! 😊`;
        } else if (type === 'missed') {
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nNotamos que te perdiste tu cita de *${appt.service || 'Asesoría'}* hoy a las ${formattedTime}.\n\n¿Deseas reagendarla para el día de mañana o para qué día te vendría mejor?`;
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
