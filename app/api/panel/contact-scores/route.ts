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
    const featureDenied = denyUnlessFeature(tenant, 'analytics');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('contact-scores', tenant.tenantId, 8, 60_000);
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, 8 * 1024);
    if (!bodyResult.ok) return bodyResult.response;
    const rawContactIds = bodyResult.body.contactIds;
    if (!Array.isArray(rawContactIds) || rawContactIds.length === 0 || rawContactIds.length > 15) {
      return NextResponse.json({ error: 'contactIds inválidos' }, { status: 400 });
    }
    const contactIds = [...new Set(rawContactIds)]
      .filter((value): value is string => typeof value === 'string' && UUID_PATTERN.test(value));
    if (contactIds.length !== rawContactIds.length) {
      return NextResponse.json({ error: 'contactIds inválidos' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .single();
    if (configError) return internalApiError();
    // Decode AI keys from JSON-encoded openai_key column
    let groqKey = '';
    try {
      const parsed = JSON.parse(config?.openai_key || '{}');
      groqKey = parsed.groq_key || parsed.openai_key || '';
    } catch {
      groqKey = config?.openai_key || '';
    }
    if (!groqKey) groqKey = process.env.GROQ_API_KEY || '';

    // Batch both tables to avoid the previous 2N query pattern.
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, customer_name, status, updated_at')
      .eq('tenant_id', tenant.tenantId)
      .in('id', contactIds);
    if (conversationsError) return internalApiError();

    const ownedIds = (conversations || []).map(conversation => conversation.id);
    const { data: messages, error: messagesError } = ownedIds.length === 0
      ? { data: [], error: null }
      : await supabase
        .from('messages')
        .select('conversation_id, role, content, created_at')
        .in('conversation_id', ownedIds)
        .not('content', 'in', '("__SYSTEM_PAUSE__","__SYSTEM_RESUME__","__HUMAN_ASK__","__HUMAN_REQUEST__")')
        .order('created_at', { ascending: false })
        .limit(90);
    if (messagesError) return internalApiError();

    const messagesByConversation = new Map<string, any[]>();
    for (const message of messages || []) {
      const current = messagesByConversation.get(message.conversation_id) || [];
      if (current.length < 6) current.push(message);
      messagesByConversation.set(message.conversation_id, current);
    }

    const contactSummaries: any[] = [];
    for (const conv of conversations || []) {
      const lastMsgs = (messagesByConversation.get(conv.id) || []).reverse();
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
      timeout: 20_000,
      maxRetries: 1,
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
      try { parsed = JSON.parse(match[0]); } catch { parsed = []; }
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
  } catch {
    console.error('Contact scores request failed');
    return internalApiError();
  }
}
