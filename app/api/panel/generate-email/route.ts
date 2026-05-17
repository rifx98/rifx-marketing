import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { contactId, prompt } = await req.json();
    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: config } = await supabase.from('config').select('*').limit(1).single();
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

    const context = (msgs || []).reverse().map(m => `${m.role}: ${m.content}`).join('\n');

    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
      } catch (e) {
        console.error('Parse error:', e);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Generate email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
