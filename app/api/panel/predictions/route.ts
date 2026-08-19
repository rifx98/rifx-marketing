import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';
import { denyUnlessFeature } from '@/lib/feature-access';
import { enforceTenantRateLimit, internalApiError } from '@/lib/request-guards';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'analytics');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('predictions', tenant.tenantId, 6, 60_000);
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();

    // 1. Get all conversations with their recent messages for the authenticated tenant
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, customer_name, phone_number, status, created_at, updated_at')
      .eq('tenant_id', tenant.tenantId)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (conversationsError) return internalApiError();

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ predictions: [] });
    }

    // 2. For each conversation, get last 5 messages
    interface ConversationSummary {
      id: string;
      name: string;
      phone: string;
      status: string;
      hoursSinceActivity: number;
      messageCount: number;
      lastMessages: string;
    }
    const conversationIds = conversations.map(conversation => conversation.id);
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .not('content', 'in', '("__SYSTEM_PAUSE__","__SYSTEM_RESUME__","__HUMAN_ASK__","__HUMAN_REQUEST__")')
      .order('created_at', { ascending: false })
      .limit(150);
    if (messagesError) return internalApiError();

    const messagesByConversation = new Map<string, any[]>();
    for (const message of messages || []) {
      const current = messagesByConversation.get(message.conversation_id) || [];
      if (current.length < 5) current.push(message);
      messagesByConversation.set(message.conversation_id, current);
    }

    const conversationSummaries: ConversationSummary[] = [];
    for (const conv of conversations) {
      const lastMessages = (messagesByConversation.get(conv.id) || []).reverse();
      const msgSummary = lastMessages
        .map(m => `${String(m.role).slice(0, 20)}: ${String(m.content).slice(0, 100)}`)
        .join('\n');
      
      const now = new Date();
      const lastActivity = conv.updated_at ? new Date(conv.updated_at) : new Date(conv.created_at);
      const hoursSinceActivity = Math.round((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60));

      conversationSummaries.push({
        id: conv.id,
        name: conv.customer_name || 'Sin nombre',
        phone: conv.phone_number,
        status: conv.status,
        hoursSinceActivity,
        messageCount: lastMessages.length,
        lastMessages: msgSummary,
      });
    }

    // 3. Get AI config for the authenticated tenant
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
      // Fallback: use heuristic scoring without AI
      const predictions = conversationSummaries
        .map(c => {
          let score = 50;
          if (c.status === 'interested') score += 25;
          if (c.status === 'chatting') score += 15;
          if (c.hoursSinceActivity < 24) score += 20;
          else if (c.hoursSinceActivity < 72) score += 10;
          else score -= 10;
          if (c.messageCount >= 3) score += 10;
          score = Math.min(99, Math.max(10, score));
          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            status: c.status,
            score,
            reason: c.hoursSinceActivity < 24 
              ? 'Actividad reciente — alta probabilidad de retomar conversación'
              : c.status === 'interested' 
                ? 'Mostró interés de compra — candidato para seguimiento'
                : 'Contacto con historial — puede reactivarse con un mensaje',
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      return NextResponse.json({ predictions, source: 'heuristic' });
    }

    // 4. Use AI for smart predictions
    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 20_000,
      maxRetries: 1,
    });

    // Phone numbers are needed by the authenticated UI, not by the AI provider.
    const providerSummaries = conversationSummaries.map(c => ({ ...c, phone: '[redacted]' }));
    const contactList = providerSummaries.map((c, i) => 
      `[${i + 1}] "${c.name}" (${c.phone}) | Status: ${c.status} | Última actividad: hace ${c.hoursSinceActivity}h | Msgs: ${c.messageCount}\nÚltimos mensajes:\n${c.lastMessages || '(sin mensajes)'}`
    ).join('\n\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un analista de CRM experto. Analiza las conversaciones de WhatsApp y determina cuáles contactos tienen la mayor probabilidad de RETOMAR la conversación y eventualmente convertir (comprar) en las próximas 24-48 horas.

Factores a considerar:
- Tiempo desde última actividad (menor = más probable)
- Status del contacto (interested > chatting > bought)
- Contenido de los mensajes (¿mostraron interés? ¿pidieron precios? ¿agendaron demo?)
- Cantidad de mensajes intercambiados

Responde SOLO con un JSON array con máximo 8 contactos, ordenados de mayor a menor probabilidad:
[{"index": 1, "score": 92, "reason": "breve razón en español"}]

El "index" corresponde al número del contacto en la lista. El "score" es de 0 a 100. La "reason" debe ser concisa (máx 15 palabras).`
        },
        {
          role: 'user',
          content: `Analiza estos ${conversationSummaries.length} contactos y dame las predicciones:\n\n${contactList}`
        }
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const aiContent = completion.choices[0]?.message?.content || '[]';
    
    // Parse AI response
    let aiPredictions: { index: number; score: number; reason: string }[] = [];
    const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        aiPredictions = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Error parsing AI predictions:', e);
      }
    }

    // Map AI predictions back to contact data
    const predictions = aiPredictions
      .filter(p => p.index && p.index <= conversationSummaries.length)
      .map(p => {
        const contact = conversationSummaries[p.index - 1];
        return {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          status: contact.status,
          score: Math.min(99, Math.max(10, p.score || 50)),
          reason: p.reason || 'Contacto con potencial de conversión',
        };
      })
      .slice(0, 8);

    return NextResponse.json({ predictions, source: 'ai' });

  } catch {
    console.error('Predictions request failed');
    return internalApiError();
  }
}
