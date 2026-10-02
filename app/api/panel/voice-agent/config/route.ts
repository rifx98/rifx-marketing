import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  getEffectiveElevenLabsKey,
  syncConversationalAgent,
  CURATED_VOICES
} from '@/lib/elevenlabs';
import { VOICE_AGENT_CLOSING_PROMPT } from '@/lib/sales-prompts';

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
    const { data, error } = await supabase
      .from('voice_agent_settings')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[voice-agent] Error obteniendo configuración:', error);
      return NextResponse.json({ error: 'Error al consultar configuración' }, { status: 500 });
    }

    // Si aún no existe configuración, devolvemos valores por defecto
    const settings = data || {
      name: 'Asistente de Ventas RIFX',
      voice_id: CURATED_VOICES[0].voice_id,
      voice_name: CURATED_VOICES[0].name,
      language: 'es',
      system_prompt: VOICE_AGENT_CLOSING_PROMPT,
      first_message: '¡Hola! Es un gusto saludarte. Soy el asesor comercial de la empresa. Cuéntame, ¿qué servicio o meta te gustaría explorar hoy?',
      is_active: true,
      inbound_enabled: true,
      outbound_enabled: true,
      call_cost_per_minute: 0.25,
      twilio_phone_number: process.env.TWILIO_PHONE_NUMBER || '',
      has_custom_key: false
    };

    // Ocultamos las credenciales sensibles reales si existen
    if (settings.elevenlabs_api_key) {
      settings.has_custom_key = true;
      delete settings.elevenlabs_api_key;
    }

    const hasMasterTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const hasEnvTwilio = !!(hasMasterTwilio && process.env.TWILIO_PHONE_NUMBER);
    const hasCustomTwilio = !!(settings.twilio_account_sid && settings.twilio_auth_token && settings.twilio_phone_number);
    const hasProvisionedNumber = !!(settings.twilio_phone_number && hasMasterTwilio);
    settings.has_twilio = hasEnvTwilio || hasCustomTwilio || hasProvisionedNumber;
    settings.is_provisioned = !!(settings.twilio_phone_number && settings.twilio_phone_sid);

    if (settings.twilio_auth_token) {
      settings.has_custom_twilio_token = true;
      delete settings.twilio_auth_token;
    }

    return NextResponse.json({
      settings,
      hasEnvKey: !!process.env.ELEVENLABS_API_KEY,
      hasEnvTwilio,
      hasMasterTwilio,
      isSynced: !!settings.agent_id
    });
  } catch (err: any) {
    console.error('[voice-agent] Excepción en GET config:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const body = await req.json();
    const {
      name,
      voice_id,
      voice_name,
      language,
      system_prompt,
      first_message,
      elevenlabs_api_key,
      twilio_phone_number,
      twilio_account_sid,
      twilio_auth_token,
      is_active,
      inbound_enabled,
      outbound_enabled
    } = body;

    const supabase = createSupabaseAdmin();

    // Consultamos registro previo para obtener el agent_id existente
    const { data: existing } = await supabase
      .from('voice_agent_settings')
      .select('agent_id, elevenlabs_api_key, twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    let apiKey: string | null = null;
    try {
      apiKey = getEffectiveElevenLabsKey(
        elevenlabs_api_key && elevenlabs_api_key.trim().length > 10
          ? elevenlabs_api_key
          : existing?.elevenlabs_api_key
      );
    } catch {
      // Clave aún no configurada
    }

    let syncedAgentId = existing?.agent_id;

    // Sincronizar agente en ElevenLabs si hay API key válida
    let syncSuccess = false;
    let syncErrorMsg = '';

    if (apiKey) {
      try {
        const syncResult = await syncConversationalAgent({
          apiKey,
          agentId: existing?.agent_id,
          name: name || 'Asistente de Ventas RIFX',
          systemPrompt: system_prompt || 'Eres un asesor comercial atento y profesional.',
          firstMessage: first_message || '¡Hola! ¿En qué puedo ayudarte hoy?',
          voiceId: voice_id || CURATED_VOICES[0].voice_id,
          language: language || 'es'
        });
        syncedAgentId = syncResult.agent_id;
        syncSuccess = true;
      } catch (syncErr: any) {
        console.warn('[voice-agent] No se pudo sincronizar en ElevenLabs:', syncErr.message);
        syncErrorMsg = syncErr.message;
      }
    }

    const updatePayload: Record<string, any> = {
      tenant_id: tenant.tenantId,
      name: name || 'Asistente de Ventas RIFX',
      voice_id: voice_id || CURATED_VOICES[0].voice_id,
      voice_name: voice_name || 'Sarah (Profesional y Cercana)',
      language: language || 'es',
      system_prompt: system_prompt || '',
      first_message: first_message || '',
      agent_id: syncedAgentId,
      twilio_phone_number: twilio_phone_number !== undefined ? (twilio_phone_number?.trim() || null) : existing?.twilio_phone_number,
      is_active: is_active ?? true,
      inbound_enabled: inbound_enabled ?? true,
      outbound_enabled: outbound_enabled ?? true,
      updated_at: new Date().toISOString()
    };

    if (elevenlabs_api_key && elevenlabs_api_key.trim().length > 10) {
      updatePayload.elevenlabs_api_key = elevenlabs_api_key.trim();
    }

    if (twilio_account_sid && twilio_account_sid.trim().length > 5) {
      updatePayload.twilio_account_sid = twilio_account_sid.trim();
    }

    if (twilio_auth_token && twilio_auth_token.trim().length > 5) {
      updatePayload.twilio_auth_token = twilio_auth_token.trim();
    }

    const { data: saved, error } = await supabase
      .from('voice_agent_settings')
      .upsert(updatePayload, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) {
      console.error('[voice-agent] Error guardando configuración:', error);
      return NextResponse.json({ error: 'Error al guardar configuración en base de datos' }, { status: 500 });
    }

    // Redactar API key y Twilio token en respuesta
    const safeSettings = { ...saved };
    if (safeSettings.elevenlabs_api_key) {
      safeSettings.has_custom_key = true;
      delete safeSettings.elevenlabs_api_key;
    }
    if (safeSettings.twilio_auth_token) {
      safeSettings.has_custom_twilio_token = true;
      delete safeSettings.twilio_auth_token;
    }

    return NextResponse.json({
      success: true,
      settings: safeSettings,
      agentId: syncedAgentId,
      hasKey: !!apiKey,
      syncedWithElevenLabs: syncSuccess,
      message: syncSuccess
        ? '¡Configuración guardada y sincronizada con ElevenLabs!'
        : apiKey
        ? `Configuración guardada en BD. (Nota de sincronización: ${syncErrorMsg})`
        : 'Configuración guardada. Recuerda agregar tu API Key de ElevenLabs para activar las llamadas en vivo.'
    });
  } catch (err: any) {
    console.error('[voice-agent] Excepción en POST config:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
