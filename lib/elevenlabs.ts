// ==============================================================================
// RIFX Marketing — ElevenLabs Voice & Conversational AI Integration Service
// Soporta gestión de agentes conversacionales, clonación de voz y llamadas telefónicas.
// ==============================================================================

export interface VoiceOption {
  voice_id: string;
  name: string;
  category: 'curated' | 'cloned';
  preview_url?: string;
  labels?: Record<string, string>;
  description?: string;
}

// Voces predefinidas de alta fidelidad con muestras de audio verificadas
export const CURATED_VOICES: VoiceOption[] = [
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah (Profesional y Cercana)',
    category: 'curated',
    description: 'Tono claro, cálido y persuasivo para atención y ventas.',
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3'
  },
  {
    voice_id: 'CwhRBWXzGAHq8TQ4Fs17',
    name: 'Roger (Conversacional y Casual)',
    category: 'curated',
    description: 'Voz masculina relajada, cercana y con excelente resonancia.',
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3'
  },
  {
    voice_id: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Callum (Ejecutivo y Seguro)',
    category: 'curated',
    description: 'Tono masculino firme y seguro para asesoría de negocios.',
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3'
  },
  {
    voice_id: 'SAz9YHcvj6GT2YYXdXww',
    name: 'River (Calma y Neutral)',
    category: 'curated',
    description: 'Voz suave y profesional para soporte y agendamiento de citas.',
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3'
  },
  {
    voice_id: 'SOYHLrjzK2X1ezoPC6cr',
    name: 'Harry (Enérgico y Vendedor)',
    category: 'curated',
    description: 'Voz masculina con convicción y dinamismo para cierres comerciales.',
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/SOYHLrjzK2X1ezoPC6cr/86d178f6-f4b6-4e0e-85be-3de19f490794.mp3'
  }
];

export function getEffectiveElevenLabsKey(customKey?: string | null): string {
  if (customKey && customKey.trim().length > 10) {
    return customKey.trim();
  }
  const envKey = process.env.ELEVENLABS_API_KEY;
  if (!envKey) {
    throw new Error('ELEVENLABS_API_KEY no está configurada en las variables de entorno ni en la cuenta.');
  }
  return envKey.trim();
}

/**
 * Consulta todas las voces disponibles en ElevenLabs (usa API key si existe o catálogo público)
 */
export async function listVoices(apiKey?: string | null): Promise<VoiceOption[]> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (apiKey && apiKey.trim().length > 10) {
      headers['xi-api-key'] = apiKey.trim();
    }

    const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers });

    if (!res.ok) {
      console.warn(`[ElevenLabs] Consulta de voces retornó ${res.status}, usando catálogo curado.`);
      return CURATED_VOICES;
    }

    const data = await res.json();
    const remoteVoices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category === 'cloned' ? 'cloned' : 'curated',
      preview_url: v.preview_url,
      labels: v.labels,
      description: v.description || (v.category === 'cloned' ? 'Voz clonada personalizada' : 'Voz de ElevenLabs')
    }));

    // Mantener las voces curadas con URLs verificadas al inicio
    const combined = [...CURATED_VOICES];
    for (const rv of remoteVoices) {
      if (!combined.some(c => c.voice_id === rv.voice_id) && rv.preview_url) {
        combined.push(rv);
      }
    }

    return combined.length > 0 ? combined : CURATED_VOICES;
  } catch (err: any) {
    console.error('[ElevenLabs] Error de conexión al consultar voces:', err?.message || err);
    return CURATED_VOICES;
  }
}

/**
 * Clona una voz instantáneamente usando un archivo de audio (WAV, MP3, M4A, etc.)
 */
export async function cloneVoiceFromAudio({
  apiKey,
  name,
  description = 'Voz clonada por el usuario en RIFX',
  audioBuffer,
  fileName = 'sample.mp3',
  contentType = 'audio/mpeg'
}: {
  apiKey: string;
  name: string;
  description?: string;
  audioBuffer: Buffer;
  fileName?: string;
  contentType?: string;
}): Promise<{ voice_id: string }> {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);

  // Blob con el buffer de audio
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: contentType });
  formData.append('files', audioBlob, fileName);

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey
    },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.detail?.message || data?.detail || JSON.stringify(data);
    throw new Error(`Error al clonar voz en ElevenLabs: ${errorMsg}`);
  }

  return { voice_id: data.voice_id };
}

/**
 * Elimina una voz clonada
 */
export async function deleteClonedVoice(apiKey: string, voiceId: string): Promise<boolean> {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey
    }
  });
  return res.ok;
}

/**
 * Crea o actualiza un agente de Conversational AI en ElevenLabs
 */
export async function syncConversationalAgent({
  apiKey,
  agentId,
  name,
  systemPrompt,
  firstMessage,
  voiceId,
  language = 'es'
}: {
  apiKey: string;
  agentId?: string | null;
  name: string;
  systemPrompt: string;
  firstMessage: string;
  voiceId: string;
  language?: string;
}): Promise<{ agent_id: string }> {
  const agentPayload = {
    name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: systemPrompt
        },
        first_message: firstMessage,
        language
      },
      tts: {
        voice_id: voiceId,
        model_id: 'eleven_turbo_v2_5', // Baja latencia optimizada para conversaciones
        agent_output_audio_format: 'pcm_16000'
      }
    }
  };

  const isUpdate = !!agentId && agentId.trim().length > 0;
  const url = isUpdate
    ? `https://api.elevenlabs.io/v1/convai/agents/${agentId}`
    : 'https://api.elevenlabs.io/v1/convai/agents/create';

  const method = isUpdate ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(agentPayload)
  });

  const data = await res.json();

  if (!res.ok) {
    // Si la actualización falla porque el agente no existe en ElevenLabs, intentamos crearlo
    if (isUpdate && (res.status === 404 || res.status === 400)) {
      console.warn(`[ElevenLabs] Agente ${agentId} no encontrado, creando uno nuevo...`);
      return syncConversationalAgent({
        apiKey,
        agentId: null,
        name,
        systemPrompt,
        firstMessage,
        voiceId,
        language
      });
    }

    const msg = data?.detail?.message || data?.detail || JSON.stringify(data);
    throw new Error(`Error configurando agente en ElevenLabs: ${msg}`);
  }

  return { agent_id: data.agent_id || agentId };
}

/**
 * Obtiene un Signed URL temporal para que el frontend pueda iniciar una llamada WebRTC/WebSocket
 * segura directamente desde el navegador del cliente sin exponer la API Key.
 */
export async function getConversationSignedUrl({
  apiKey,
  agentId
}: {
  apiKey: string;
  agentId: string;
}): Promise<string> {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`, {
    headers: {
      'xi-api-key': apiKey
    }
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.detail?.message || data?.detail || JSON.stringify(data);
    throw new Error(`Error obteniendo enlace de llamada firmado: ${errorMsg}`);
  }

  return data.signed_url;
}

/**
 * Genera el XML TwiML para conectar una llamada telefónica entrante o saliente
 * con el WebSocket de ElevenLabs Conversational AI
 */
export function generateElevenLabsTwiML(agentId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}" />
  </Connect>
</Response>`;
}
