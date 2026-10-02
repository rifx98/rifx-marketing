import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  getEffectiveElevenLabsKey,
  getConversationSignedUrl,
  syncConversationalAgent,
  CURATED_VOICES
} from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const supabase = createSupabaseAdmin();
    const { data: settings } = await supabase
      .from('voice_agent_settings')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    let apiKey: string;
    try {
      apiKey = getEffectiveElevenLabsKey(settings?.elevenlabs_api_key);
    } catch {
      return NextResponse.json({
        error: 'Falta configurar tu API Key de ElevenLabs. Ingresa tu clave en la pestaña "Personalidad y Voz del Agente" o en .env.local para activar las llamadas.'
      }, { status: 400 });
    }

    let agentId = settings?.agent_id;

    // Si no tiene agent_id en ElevenLabs, lo creamos ahora mismo
    if (!agentId) {
      const syncResult = await syncConversationalAgent({
        apiKey,
        name: settings?.name || 'Asistente de Ventas RIFX',
        systemPrompt: settings?.system_prompt || 'Eres un asesor comercial atento y profesional.',
        firstMessage: settings?.first_message || '¡Hola! ¿En qué puedo ayudarte hoy?',
        voiceId: settings?.voice_id || CURATED_VOICES[0].voice_id,
        language: settings?.language || 'es'
      });
      agentId = syncResult.agent_id;

      // Actualizar registro en BD
      await supabase
        .from('voice_agent_settings')
        .upsert({
          tenant_id: tenant.tenantId,
          agent_id: agentId,
          voice_id: settings?.voice_id || CURATED_VOICES[0].voice_id,
          name: settings?.name || 'Asistente de Ventas RIFX'
        }, { onConflict: 'tenant_id' });
    }

    const signedUrl = await getConversationSignedUrl({
      apiKey,
      agentId
    });

    return NextResponse.json({
      signed_url: signedUrl,
      agent_id: agentId
    });
  } catch (err: any) {
    console.error('[voice-agent] Error obteniendo signed URL:', err);
    return NextResponse.json({ error: err.message || 'Error al conectar con ElevenLabs' }, { status: 500 });
  }
}
