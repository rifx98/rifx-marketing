import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { generateElevenLabsTwiML } from '@/lib/elevenlabs';
import { deductAiCredits } from '@/lib/ai-credits';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenant_id');

    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callDurationStr = formData.get('CallDuration') as string;

    const supabase = createSupabaseAdmin();

    // 1. Manejo de fin de llamada (Callback de estado)
    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      const durationSeconds = parseInt(callDurationStr || '0', 10) || 0;
      const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60));

      // Actualizar registro en BD
      if (callSid) {
        const { data: updatedLog } = await supabase
          .from('voice_call_logs')
          .update({
            duration_seconds: durationSeconds,
            status: callStatus === 'completed' ? 'completed' : callStatus,
            credits_deducted: durationMinutes
          })
          .eq('call_sid', callSid)
          .select('tenant_id')
          .maybeSingle();

        const effectiveTenantId = updatedLog?.tenant_id || tenantIdParam;

        // Deducir créditos si la llamada fue completada
        if (effectiveTenantId && durationSeconds > 0) {
          await deductAiCredits(
            supabase,
            effectiveTenantId,
            durationMinutes,
            `Llamada de voz IA (${durationMinutes} min - ${durationSeconds}s)`
          );
        }
      }

      return new NextResponse('OK', { status: 200 });
    }

    // 2. Manejo de llamada entrante (Inbound Voice Call)
    // Buscamos a qué tenant pertenece el número que recibió la llamada
    let query = supabase
      .from('voice_agent_settings')
      .select('*')
      .eq('is_active', true)
      .eq('inbound_enabled', true);

    if (tenantIdParam) {
      query = query.eq('tenant_id', tenantIdParam);
    } else if (to) {
      query = query.eq('twilio_phone_number', to);
    }

    const { data: settings } = await query.maybeSingle();

    if (!settings || !settings.agent_id) {
      console.warn(`[voice-call-webhook] No se encontró agente activo para el número ${to}`);
      const rejectTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX">El servicio de atención automática no se encuentra disponible en este momento. Por favor intenta más tarde.</Say>
  <Hangup/>
</Response>`;
      return new NextResponse(rejectTwiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Registrar llamada entrante en progreso
    if (callSid) {
      await supabase.from('voice_call_logs').insert({
        tenant_id: settings.tenant_id,
        call_sid: callSid,
        direction: 'inbound',
        from_number: from || 'Desconocido',
        to_number: to || settings.twilio_phone_number,
        duration_seconds: 0,
        status: 'in-progress',
        summary: `Llamada entrante de ${from || 'cliente'}`
      });
    }

    // Generar TwiML conectando con el WebSocket de ElevenLabs
    const twiml = generateElevenLabsTwiML(settings.agent_id);

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });
  } catch (err: any) {
    console.error('[voice-call-webhook] Error en webhook de llamada:', err);
    return new NextResponse('Error procesando llamada', { status: 500 });
  }
}
