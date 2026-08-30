import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'playground');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('generate-email', tenant.tenantId, 12, 60_000);
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, 32 * 1024);
    if (!bodyResult.ok) return bodyResult.response;
    const contactId = typeof bodyResult.body.contactId === 'string' ? bodyResult.body.contactId.trim() : '';
    const prompt = typeof bodyResult.body.prompt === 'string' ? bodyResult.body.prompt.trim() : '';
    if (!UUID_PATTERN.test(contactId) || prompt.length > 2_000) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify ownership of the conversation (contactId is conversation_id)
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', contactId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada o no autorizada' }, { status: 404 });
    }

    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .single();
    if (configError) return internalApiError();
    let groqKey = '';
    try { const p = JSON.parse(config?.openai_key || '{}'); groqKey = p.groq_key || p.openai_key || ''; } catch { groqKey = config?.openai_key || ''; }
    if (!groqKey) groqKey = process.env.GROQ_API_KEY || '';

    if (!groqKey) {
      return NextResponse.json({ 
        subject: 'Seguimiento de nuestra conversación',
        body: 'Hola, un gusto saludarte. Quería dar seguimiento a nuestra conversación de WhatsApp. Quedo a tu disposición para cualquier duda.\n\nSaludos.'
      });
    }

    // Get last messages for context
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', contactId)
      .not('content', 'in', '("__SYSTEM_PAUSE__","__SYSTEM_RESUME__","__HUMAN_ASK__","__HUMAN_REQUEST__")')
      .order('created_at', { ascending: false })
      .limit(10);

    const context = (msgs || [])
      .reverse()
      .map(m => `${String(m.role).slice(0, 20)}: ${String(m.content).slice(0, 2_000)}`)
      .join('\n')
      .slice(0, 12_000);

    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 20_000,
      maxRetries: 1,
    });

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente de ventas profesional. Tu tarea es redactar un correo electrónico de seguimiento basado en una conversación de WhatsApp previa.
          El correo debe ser:
          - Profesional pero cercano.
          - Referenciar puntos clave mencionados en la conversación.
          - En idioma español.
          - Incluir un asunto sugerido y el cuerpo del correo.
          
          Responde EXCLUSIVAMENTE en formato JSON con la siguiente estructura:
          {
            "subject": "Asunto del correo",
            "body": "Cuerpo del correo..."
          }`
        },
        {
          role: 'user',
          content: `Contexto de la conversación:\n${context}\n\nInstrucción adicional: ${prompt || 'Redacta un correo de seguimiento estándar.'}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let result = { subject: '', body: '' };
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        result = JSON.parse(match[0]);
      } catch {}
    }

    return NextResponse.json({
      subject: String(result.subject || '').slice(0, 200),
      body: String(result.body || '').slice(0, 8_000),
    });
  } catch {
    console.error('Generate email request failed');
    return internalApiError();
  }
}
