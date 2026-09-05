import { createSupabaseAdmin } from '@/lib/supabase';

interface WaitlistCandidate {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  customer_name: string;
  phone_number: string;
  desired_date: string;
  preferred_time_range: string;
  service: string;
  resource_id?: string | null;
  resource_name?: string | null;
  status: string;
}

/**
 * Motor de Lista de Espera: Al liberarse o cancelarse un turno,
 * busca el siguiente cliente en cola para esa fecha y le ofrece el cupo por WhatsApp.
 */
export async function notifyNextInWaitlist(params: {
  tenantId: string;
  freedDate: string; // YYYY-MM-DD
  freedTime: string; // HH:mm
  service?: string;
}): Promise<{ notified: boolean; candidate?: WaitlistCandidate; error?: string }> {
  const { tenantId, freedDate, freedTime, service } = params;
  const supabase = createSupabaseAdmin();

  try {
    // 1. Buscar en la cola al siguiente candidato en espera para esa fecha
    let query = supabase
      .from('appointment_waitlist')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('desired_date', freedDate)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1);

    if (service && service !== 'General') {
      query = query.or(`service.eq.${service},service.eq.General`);
    }

    const { data: candidates, error: queryError } = await query;
    if (queryError) {
      console.error('[Waitlist Engine] Error al buscar candidatos:', queryError);
      return { notified: false, error: queryError.message };
    }

    if (!candidates || candidates.length === 0) {
      return { notified: false };
    }

    const candidate = candidates[0] as WaitlistCandidate;

    // 2. Obtener configuración de WhatsApp del tenant
    const { data: tenantConfig, error: configError } = await supabase
      .from('config')
      .select('whatsapp_token, whatsapp_phone_id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (configError || !tenantConfig?.whatsapp_token || !tenantConfig?.whatsapp_phone_id) {
      console.warn('[Waitlist Engine] Sin credenciales de WhatsApp válidas para tenant:', tenantId);
      // Marcamos igualmente como notificado o pendiente
      return { notified: false, candidate, error: 'Credenciales de WhatsApp incompletas' };
    }

    const offerText = `Hola *${candidate.customer_name || 'Cliente'}* 👋\n\n🎉 ¡Buenas noticias! Se acaba de liberar un cupo para tu cita de *${candidate.service || service || 'Atención'}*:\n\n📅 *Fecha:* ${freedDate}\n🕒 *Hora:* ${freedTime}\n\n¿Deseas reservar este turno de inmediato?\n\nResponde:\n✅ *SÍ, CONFIRMO*\n❌ *NO, PREFIERO OTRA FECHA*`;

    // 3. Enviar mensaje de oferta por WhatsApp
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${tenantConfig.whatsapp_phone_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tenantConfig.whatsapp_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: candidate.phone_number,
          type: 'text',
          text: { body: offerText },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Waitlist Engine] Falló envío de WhatsApp de oferta de cupo:', errBody);
      return { notified: false, candidate, error: 'Error al enviar WhatsApp' };
    }

    // 4. Actualizar estado del candidato a 'notified'
    const now = new Date().toISOString();
    await supabase
      .from('appointment_waitlist')
      .update({
        status: 'notified',
        notified_at: now,
        updated_at: now,
      })
      .eq('id', candidate.id);

    // 5. Guardar en el historial de mensajes de la conversación si existe
    if (candidate.conversation_id) {
      await supabase.from('messages').insert({
        tenant_id: tenantId,
        conversation_id: candidate.conversation_id,
        role: 'assistant',
        content: `[Lista de Espera]: ${offerText}`,
      });
    }

    console.log(`[Waitlist Engine] Cupo ofrecido exitosamente al cliente ${candidate.phone_number} para el ${freedDate} a las ${freedTime}`);
    return { notified: true, candidate };
  } catch (err: any) {
    console.error('[Waitlist Engine] Excepción en notifyNextInWaitlist:', err);
    return { notified: false, error: err.message };
  }
}
