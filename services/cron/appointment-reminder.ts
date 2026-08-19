import { createSupabaseAdmin } from '@/lib/supabase';
import { retryWithBackoff } from '@/app/api/cron/auth';
import { getEligibleTenantIds } from './tenant-eligibility';

export interface AppointmentReminderResult {
  found: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: any[];
  processedIds: string[];
  remaining: number;
}

/**
 * Servicio encargado de gestionar los recordatorios de citas y las transiciones automáticas de ciclos de vida.
 */
export async function runAppointmentReminders(options: {
  tenantId?: string;
  batchSize?: number;
  maxRetries?: number;
  startTime: number;
}): Promise<AppointmentReminderResult> {
  const supabase = createSupabaseAdmin();
  const now = new Date();

  const batchSize = options.batchSize || parseInt(process.env.APPOINTMENT_BATCH_SIZE || '30');
  const concurrency = parseInt(process.env.APPOINTMENT_CONCURRENCY || '10');
  const maxRetries = options.maxRetries || parseInt(process.env.MAX_RETRIES || '3');
  const startTime = options.startTime;

  const result: AppointmentReminderResult = {
    found: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    processedIds: [],
    remaining: 0
  };

  try {
    const eligibleTenantIds = await getEligibleTenantIds(supabase, options.tenantId);
    if (eligibleTenantIds.length === 0) return result;

    // 1. Buscar citas en un rango de -6h a +25h
    const rangeStart = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const rangeEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const query = supabase
      .from('appointments')
      .select('*')
      .in('tenant_id', eligibleTenantIds)
      .gte('scheduled_time', rangeStart)
      .lte('scheduled_time', rangeEnd)
      .in('status', ['pending', 'confirmed', 'awaiting_reschedule', 'rescheduled', 'pending_completion', 'no_show'])
      .order('scheduled_time', { ascending: true })
      .limit(Math.max(batchSize * 5, 100));

    const { data: appts, error } = await query;

    if (error) {
      throw new Error(`Error al consultar citas en Supabase: ${error.message}`);
    }

    if (!appts || appts.length === 0) {
      console.log('[Appointments Service] No se encontraron citas en el rango establecido.');
      return result;
    }

    result.found = appts.length;

    // 2. Filtrar únicamente las citas que requieren procesamiento
    const pendingAppts: any[] = [];
    for (const appt of appts) {
      const apptTime = new Date(appt.scheduled_time).getTime();
      const diffMs = apptTime - now.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      let needsProcessing = false;

      // Evaluación de ciclo de vida (tiempo pasado)
      if (diffMs < 0) {
        const pastMinutes = Math.abs(diffMs) / (1000 * 60);
        if (pastMinutes > 30 && (appt.status === 'confirmed' || appt.status === 'rescheduled')) {
          needsProcessing = true;
        } else if (pastMinutes > 60 && (appt.status === 'pending' || appt.status === 'awaiting_reschedule')) {
          needsProcessing = true;
        }
      }

      // Evaluación de recordatorios (tiempo futuro y pasado)
      if (diffHrs > 1.5 && diffHrs <= 2.75 && !appt.reminder_2h_sent) {
        needsProcessing = true;
      } else if (diffHrs > 0.2 && diffHrs <= 0.85 && !appt.reminder_30m_sent) {
        needsProcessing = true;
      } else if (diffHrs < -4.8 && diffHrs >= -6.0 && appt.status === 'no_show') {
        needsProcessing = true;
      }

      if (needsProcessing) {
        pendingAppts.push(appt);
      } else {
        result.skipped++;
      }
    }

    // 3. Limitar al tamaño de lote e indicar registros pendientes
    const itemsToProcess = pendingAppts.slice(0, batchSize);
    result.remaining = Math.max(0, pendingAppts.length - batchSize);

    // 4. Procesar el lote en chunks paralelos (concurrency) monitoreando el timeout global
    const processOne = async (appt: any) => {
      try {
        const apptTime = new Date(appt.scheduled_time).getTime();
        const diffMs = apptTime - now.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);

        // A. Transiciones de ciclo de vida
        if (diffMs < 0) {
          const pastMinutes = Math.abs(diffMs) / (1000 * 60);

          if (pastMinutes > 30 && (appt.status === 'confirmed' || appt.status === 'rescheduled')) {
            console.log(`[Appointments Service] Cita ${appt.id} pasada sin confirmación de finalización. Cambiando a pending_completion`);
            const { error: err } = await supabase
              .from('appointments')
              .update({ status: 'pending_completion', updated_at: new Date().toISOString() })
              .eq('id', appt.id);
            if (err) throw err;

            result.processed++;
            result.processedIds.push(appt.id);
            return;
          }

          if (pastMinutes > 60 && (appt.status === 'pending' || appt.status === 'awaiting_reschedule')) {
            console.log(`[Appointments Service] Cita ${appt.id} sin confirmar pasada por más de 1 hora. Cambiando a no_show`);
            const { error: err } = await supabase
              .from('appointments')
              .update({ status: 'no_show', updated_at: new Date().toISOString() })
              .eq('id', appt.id);
            if (err) throw err;

            result.processed++;
            result.processedIds.push(appt.id);
            return;
          }
        }

        // B. Selección del recordatorio aplicable
        let type: '2h' | '30m' | 'missed' | null = null;
        let updateField = '';

        if (diffHrs > 1.5 && diffHrs <= 2.75 && !appt.reminder_2h_sent) {
          type = '2h';
          updateField = 'reminder_2h_sent';
        } else if (diffHrs > 0.2 && diffHrs <= 0.85 && !appt.reminder_30m_sent) {
          type = '30m';
          updateField = 'reminder_30m_sent';
        } else if (diffHrs < -4.8 && diffHrs >= -6.0 && appt.status === 'no_show') {
          // Cita perdida (+5h pasadas). Verificar si ya se envió recordatorio hoy
          const { data: prevMessages } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', appt.conversation_id)
            .eq('role', 'assistant')
            .ilike('content', '%Notamos que te perdiste tu cita%')
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!prevMessages || prevMessages.length === 0) {
            type = 'missed';
            updateField = '';
          }
        }

        if (!type) {
          result.skipped++;
          return;
        }

        // Obtener configuración del tenant para credenciales de WhatsApp
        const { data: tenantConfig, error: configErr } = await supabase
          .from('config')
          .select('whatsapp_token, whatsapp_phone_id')
          .eq('tenant_id', appt.tenant_id)
          .limit(1)
          .maybeSingle();

        if (configErr || !tenantConfig) {
          throw new Error(`Configuración de WhatsApp no encontrada para el tenant: ${appt.tenant_id}`);
        }

        const token = tenantConfig.whatsapp_token;
        const phoneId = tenantConfig.whatsapp_phone_id;

        if (!token || !phoneId) {
          throw new Error(`Credenciales de WhatsApp incompletas para el tenant: ${appt.tenant_id}`);
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
        if (type === '2h') {
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nTe recordamos tu cita de *${appt.service || 'Asesoría'}* programada para hoy.\n\n📅 Fecha: ${formattedDate}\n🕒 Hora: ${formattedTime}\n\n¿Confirmas tu asistencia o deseas reagendar?\n\nResponde:\n✅ Sí, ahí estaré\n🔄 Necesito reagendar`;
        } else if (type === '30m') {
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nTu cita de *${appt.service || 'Asesoría'}* comienza en 30 minutos.\n\n📅 Fecha: ${formattedDate}\n🕒 Hora: ${formattedTime}\n\n¡Te esperamos! 😊`;
        } else if (type === 'missed') {
          reminderText = `Hola *${appt.customer_name || 'Cliente'}* 👋\n\nNotamos que te perdiste tu cita de *${appt.service || 'Asesoría'}* hoy a las ${formattedTime}.\n\n¿Deseas reagendarla para el día de mañana o para qué día te vendría mejor?`;
        }

        // Enviar WhatsApp con reintento automático
        await retryWithBackoff(async () => {
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

          const resData = await response.json();
          if (!response.ok) {
            throw new Error(`Meta API error: ${JSON.stringify(resData)}`);
          }
          return resData;
        }, maxRetries);

        console.log(`[Appointments Service] Recordatorio ${type} enviado exitosamente a ${appt.phone_number}`);

        // Actualizar el estado del recordatorio en la cita
        const updateData: Record<string, any> = {
          reminder_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (updateField) {
          updateData[updateField] = true;
        }

        const { error: updateErr } = await supabase
          .from('appointments')
          .update(updateData)
          .eq('id', appt.id);

        if (updateErr) throw updateErr;

        // Registrar el mensaje en el historial del chat
        await supabase.from('messages').insert({
          conversation_id: appt.conversation_id,
          role: 'assistant',
          content: `🤖 [Recordatorio ${type}]: ${reminderText}`,
        });

        result.processed++;
        result.processedIds.push(appt.id);
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push({ appointmentId: appt.id, error: err.message || err });
        console.error(`[Appointments Service] Error en cita ${appt.id}:`, err);
      }
    };

    for (let i = 0; i < itemsToProcess.length; i += concurrency) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 8.0) { // 2s de margen sobre el límite de 10s de Vercel Hobby
        console.warn(`[Appointments Service] Timeout preventivo activado. Transcurridos: ${elapsed}s. Suspendiendo lote.`);
        result.remaining += itemsToProcess.length - i;
        break;
      }

      const chunk = itemsToProcess.slice(i, i + concurrency);
      await Promise.allSettled(chunk.map(processOne));
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push({ error: err.message || err });
    console.error('[Appointments Service] Error general:', err);
  }

  return result;
}
