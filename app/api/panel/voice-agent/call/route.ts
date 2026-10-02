import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { hasAvailableCredits } from '@/lib/ai-credits';
import { generateElevenLabsTwiML } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const body = await req.json();
    const { to_number } = body;

    if (!to_number || !/^\+?[1-9]\d{7,14}$/.test(to_number.replace(/\s+/g, ''))) {
      return NextResponse.json({
        error: 'Número telefónico inválido. Debe incluir código de país (ej. +593991234567 o +525512345678).'
      }, { status: 400 });
    }

    const formattedToNumber = to_number.trim().replace(/\s+/g, '');

    const supabase = createSupabaseAdmin();

    // 1. Verificar créditos
    const { hasCredits, balance } = await hasAvailableCredits(supabase, tenant.tenantId);
    if (!hasCredits && !tenant.isAdmin) {
      return NextResponse.json({
        error: 'Saldo de créditos insuficiente para realizar llamadas telefónicas. Por favor recarga créditos en tu cuenta.'
      }, { status: 402 });
    }

    // 2. Obtener configuración del agente
    const { data: settings } = await supabase
      .from('voice_agent_settings')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    if (!settings?.agent_id) {
      return NextResponse.json({
        error: 'El agente de voz aún no ha sido sincronizado con ElevenLabs. Guarda la configuración primero.'
      }, { status: 400 });
    }

    // 3. Credenciales de Twilio (Personalizadas del tenant o globales de la plataforma)
    const twilioSid = settings?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = settings?.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = settings?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

    if (!twilioSid || !twilioToken || !twilioFrom) {
      return NextResponse.json({
        error: 'Twilio no está configurado. Agrega tus credenciales de Twilio (SID, Token y Número) en el panel o en las variables del sistema.'
      }, { status: 503 });
    }

    const client = twilio(twilioSid, twilioToken);
    const twiml = generateElevenLabsTwiML(settings.agent_id);

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://rifx-marketing.com';
    const statusCallbackUrl = `${appUrl}/api/webhooks/voice-call?tenant_id=${tenant.tenantId}`;

    // 4. Iniciar llamada saliente en Twilio
    const call = await client.calls.create({
      to: formattedToNumber,
      from: twilioFrom,
      twiml,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    // 5. Registrar en la base de datos
    await supabase.from('voice_call_logs').insert({
      tenant_id: tenant.tenantId,
      call_sid: call.sid,
      direction: 'outbound',
      from_number: twilioFrom,
      to_number: formattedToNumber,
      duration_seconds: 0,
      status: 'in-progress',
      summary: `Llamada iniciada a ${formattedToNumber}`
    });

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      message: `Llamando a ${formattedToNumber}...`
    });
  } catch (err: any) {
    console.error('[voice-agent] Error al iniciar llamada saliente:', err);
    return NextResponse.json({
      error: err.message || 'Error al conectar con el servicio de telefonía.'
    }, { status: 500 });
  }
}
