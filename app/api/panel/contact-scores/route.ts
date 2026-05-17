import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { contactIds } = await req.json();
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'contactIds required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: config } = await supabase.from('config').select('*').limit(1).single();
    // Decode AI keys from JSON-encoded openai_key column
    let groqKey = '';
    try {
      const parsed = JSON.parse(config?.openai_key || '{}');
      groqKey = parsed.groq_key || parsed.openai_key || '';
    } catch {
      groqKey = config?.openai_key || '';
    }
    if (!groqKey) groqKey = process.env.GROQ_API_KEY || '';

    // Get last messages for each contact
    const contactSummaries: any[] = [];
    for (const id of contactIds.slice(0, 15)) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, customer_name, phone_number, status, updated_at, created_at')
        .eq('id', id)
        .single();
      if (!conv) continue;

      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', id)
        .not('content', 'in', '("__SYSTEM_PAUSE__","__SYSTEM_RESUME__","__HUMAN_ASK__","__HUMAN_REQUEST__")')
        .order('created_at', { ascending: false })
        .limit(6);

      const lastMsgs = (msgs || []).reverse();
      const msgPreview = lastMsgs.map(m => `${m.role}: ${(m.content || '').substring(0, 80)}`).join('\n');

      contactSummaries.push({
        id: conv.id,
        name: conv.customer_name || 'Sin nombre',
        status: conv.status,
        messageCount: lastMsgs.length,
        lastMessages: msgPreview,
        hoursAgo: conv.updated_at ? Math.round((Date.now() - new Date(conv.updated_at).getTime()) / 3600000) : 999,
      });
    }

    if (!groqKey) {
      // Heuristic scoring
      const scores: Record<string, { score: number; reason: string }> = {};
      for (const c of contactSummaries) {
        let score = 40;
        if (c.status === 'interested') score += 20;
        if (c.status === 'chatting') score += 10;
        if (c.messageCount >= 4) score += 15;
        else if (c.messageCount >= 2) score += 8;
        if (c.hoursAgo < 24) score += 15;
        else if (c.hoursAgo < 72) score += 5;
        else score -= 10;
        score = Math.min(98, Math.max(10, score));
        scores[c.id] = {
          score,
          reason: c.hoursAgo < 24 ? 'Actividad reciente' : c.messageCount >= 4 ? 'Conversación fluida' : 'Necesita seguimiento',
        };
      }
      return NextResponse.json({ scores, source: 'heuristic' });
    }

    // AI scoring
    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const contactList = contactSummaries.map((c, i) =>
      `[${i + 1}] "${c.name}" | Status: ${c.status} | Msgs: ${c.messageCount} | Última actividad: hace ${c.hoursAgo}h\n${c.lastMessages || '(sin mensajes)'}`
    ).join('\n---\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un analista CRM experto. Evalúa cada conversación de WhatsApp y da un puntaje de 0-100 que indique qué tan probable es que la conversación siga activa y el contacto convierta.

Factores:
- Cantidad y calidad de mensajes
- Tiempo desde última actividad (menor = mejor)
- Tono del cliente (interés, preguntas sobre precios = alta probabilidad)
- Si el cliente respondió con más que monosílabos

Responde SOLO con JSON así:
[{"index": 1, "score": 85, "reason": "razón breve en español (máx 8 palabras)"}]`
        },
        {
          role: 'user',
          content: `Evalúa estas ${contactSummaries.length} conversaciones:\n\n${contactList}`
        }
      ],
      max_tokens: 600,
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    let parsed: any[] = [];
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch (e) { console.error('Parse error:', e); }
    }

    const scores: Record<string, { score: number; reason: string }> = {};
    for (const p of parsed) {
      if (p.index && p.index <= contactSummaries.length) {
        const contact = contactSummaries[p.index - 1];
        scores[contact.id] = {
          score: Math.min(99, Math.max(5, p.score || 50)),
          reason: p.reason || 'Evaluado por IA',
        };
      }
    }

    // Fill missing with heuristic
    for (const c of contactSummaries) {
      if (!scores[c.id]) {
        scores[c.id] = { score: 50, reason: 'Sin datos suficientes' };
      }
    }

    return NextResponse.json({ scores, source: 'ai' });
  } catch (error: any) {
    console.error('Contact scores error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
