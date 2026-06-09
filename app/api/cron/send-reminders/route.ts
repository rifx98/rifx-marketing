import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// GET /api/cron/send-reminders - Enviar recordatorios de citas 2 horas antes
export async function GET(req: NextRequest) {
  try {
    // 1. Validar autorización
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    const cronSecret = process.env.CRON_SECRET;

    // Permitir ejecución si es local (desarrollo), si viene de Vercel Cron o si tiene el token secreto
    const isAuthorized =
      process.env.NODE_ENV === 'development' ||
      isVercelCron ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      console.warn('⚠️ Intento de ejecución de cron no autorizado');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    // 2. Buscar todas las citas pendientes de hoy que aún no tienen recordatorio
    // El cron se ejecuta una vez al día (Hobby plan), así que enviamos recordatorios de todas las citas del día
    const now = new Date();
    const rangeStart = now.toISOString();
    // Cubrir las próximas 18 horas para abarcar todo el día de Ecuador (UTC-5)
    const rangeEnd = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();

    console.log(`⏱️ Cron diario: Buscando citas entre ${rangeStart} y ${rangeEnd}...`);

    const { data: appts, error: apptsError } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pending')
      .eq('reminder_sent', false)
      .gte('scheduled_time', rangeStart)
      .lte('scheduled_time', rangeEnd);

    if (apptsError) {
      console.error('❌ Error al buscar citas pendientes para recordatorios:', apptsError);
      return NextResponse.json({ error: apptsError.message }, { status: 500 });
    }

    console.log(`⏱️ Cron: Se encontraron ${appts?.length || 0} citas pendientes de recordatorio`);

    if (!appts || appts.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0 });
    }

    let sentCount = 0;

    // 3. Procesar cada cita
    for (const appt of appts) {
      try {
        console.log(`💬 Enviando recordatorio para cita ${appt.id} (${appt.customer_name})`);

        // Obtener configuración del tenant para WhatsApp (token y phone_number_id)
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

        // Fallbacks
        if (token && token.length < 20) token = process.env.WHATSAPP_TOKEN;
        if (phoneId && phoneId.length < 5) phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!token || !phoneId) {
          console.error(`❌ Faltan credenciales de WhatsApp para enviar recordatorio de cita ${appt.id}`);
          continue;
        }

        // Formatear hora de la cita para el mensaje (en horario Ecuador UTC-5)
        const apptDate = new Date(appt.scheduled_time);
        const formatOptions: Intl.DateTimeFormatOptions = {
          timeZone: 'America/Guayaquil',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        };
        const formattedTime = new Intl.DateTimeFormat('es-EC', formatOptions).format(apptDate);

        // Mensaje del recordatorio interactivo
        const reminderText = `Hola *${appt.customer_name || 'Cliente'}*, te escribimos de RIFX Marketing para recordarte tu cita de *${appt.service || 'Asesoría'}* programada para hoy a las *${formattedTime}*. ¿Confirmas tu asistencia? (Por favor responde con *Sí* o *No*) 😊`;

        // Enviar WhatsApp
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
          console.error(`❌ Error de Meta API al enviar recordatorio de cita ${appt.id}:`, JSON.stringify(result));
          continue;
        }

        console.log(`✅ Recordatorio enviado exitosamente a ${appt.phone_number} para cita ${appt.id}`);

        // 4. Actualizar estado del recordatorio en la DB
        const { error: updateErr } = await supabase
          .from('appointments')
          .update({ reminder_sent: true, updated_at: new Date().toISOString() })
          .eq('id', appt.id);

        if (updateErr) {
          console.error(`❌ Error al marcar recordatorio como enviado para la cita ${appt.id}:`, updateErr);
        } else {
          // Opcional: Insertar el mensaje enviado en el chat log de la conversación para que el asesor lo vea
          await supabase.from('messages').insert({
            conversation_id: appt.conversation_id,
            role: 'assistant',
            content: `🤖 [Recordatorio Automático]: ${reminderText}`,
          });
          
          sentCount++;
        }
      } catch (err) {
        console.error(`❌ Error inesperado al procesar recordatorio para cita ${appt.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, sentCount });
  } catch (error: any) {
    console.error('❌ Error en cron send-reminders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
