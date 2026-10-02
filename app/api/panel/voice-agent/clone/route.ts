import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  getEffectiveElevenLabsKey,
  cloneVoiceFromAudio
} from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const formData = await req.formData();
    const name = formData.get('name') as string;
    const description = (formData.get('description') as string) || 'Voz clonada en RIFX';
    const audioFile = formData.get('audio') as File | null;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Debes proporcionar un nombre para la voz (ej. Mi Voz).' }, { status: 400 });
    }

    if (!audioFile) {
      return NextResponse.json({ error: 'Debes proporcionar una muestra de audio.' }, { status: 400 });
    }

    // Obtener API Key de ElevenLabs
    const supabase = createSupabaseAdmin();
    const { data: settings } = await supabase
      .from('voice_agent_settings')
      .select('elevenlabs_api_key')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    let apiKey: string;
    try {
      apiKey = getEffectiveElevenLabsKey(settings?.elevenlabs_api_key);
    } catch {
      return NextResponse.json({
        error: 'Para clonar tu voz con redes neuronales, primero debes ingresar tu API Key de ElevenLabs en la pestaña "Personalidad y Voz del Agente".'
      }, { status: 400 });
    }

    // Convertir archivo a Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Clonar voz en ElevenLabs
    const { voice_id } = await cloneVoiceFromAudio({
      apiKey,
      name: name.trim(),
      description,
      audioBuffer: buffer,
      fileName: audioFile.name || 'voice-sample.mp3',
      contentType: audioFile.type || 'audio/mpeg'
    });

    // Guardar registro en BD
    const { data: savedClone, error: dbError } = await supabase
      .from('voice_clones')
      .insert({
        tenant_id: tenant.tenantId,
        voice_id,
        name: name.trim(),
        description,
        sample_filename: audioFile.name || 'sample.mp3'
      })
      .select()
      .single();

    if (dbError) {
      console.error('[voice-agent] Error guardando clon en BD:', dbError);
    }

    return NextResponse.json({
      success: true,
      voice: {
        voice_id,
        name: name.trim(),
        category: 'cloned'
      },
      message: '¡Voz clonada exitosamente con ElevenLabs!'
    });
  } catch (err: any) {
    console.error('[voice-agent] Excepción en clonar voz:', err);
    return NextResponse.json({ error: err.message || 'Error al clonar voz' }, { status: 500 });
  }
}
