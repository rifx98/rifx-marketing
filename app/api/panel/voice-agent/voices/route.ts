import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  getEffectiveElevenLabsKey,
  listVoices,
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

    // 1. Obtener voces clonadas del tenant guardadas localmente
    const { data: localClones } = await supabase
      .from('voice_clones')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    // 2. Obtener clave de ElevenLabs para consultar catálogo remoto
    let remoteVoices = CURATED_VOICES;
    try {
      const { data: settings } = await supabase
        .from('voice_agent_settings')
        .select('elevenlabs_api_key')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      const apiKey = getEffectiveElevenLabsKey(settings?.elevenlabs_api_key);
      remoteVoices = await listVoices(apiKey);
    } catch {
      // Usar catálogo curado por defecto
    }

    // Unir catálogo con clones locales
    const clonedList = (localClones || []).map(c => ({
      voice_id: c.voice_id,
      name: `⭐ ${c.name} (Tu Voz Clonada)`,
      category: 'cloned',
      description: c.description || 'Voz personalizada clonada por ti'
    }));

    // Combinar sin duplicados
    const allVoices = [...clonedList, ...remoteVoices.filter(r => !clonedList.some(c => c.voice_id === r.voice_id))];

    return NextResponse.json({ voices: allVoices });
  } catch (err: any) {
    console.error('[voice-agent] Error en GET voices:', err);
    return NextResponse.json({ voices: CURATED_VOICES });
  }
}
