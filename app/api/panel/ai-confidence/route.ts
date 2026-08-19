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
    const featureDenied = denyUnlessFeature(tenant, 'playground');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('ai-confidence', tenant.tenantId, 10, 60_000);
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('ai_prompt, openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .single();
    if (configError) return internalApiError();
    
    const prompt = config?.ai_prompt || '';
    let groqKey = '';
    try { const p = JSON.parse(config?.openai_key || '{}'); groqKey = p.groq_key || p.openai_key || ''; } catch { groqKey = config?.openai_key || ''; }
    if (!groqKey) groqKey = process.env.GROQ_API_KEY || '';

    if (!prompt.trim()) {
      return NextResponse.json({ score: 20, reason: 'No hay prompt configurado — la IA no puede vender sin instrucciones.' });
    }

    if (!groqKey) {
      // Heuristic evaluation
      let score = 40;
      const lower = prompt.toLowerCase();
      if (prompt.length > 200) score += 10;
      if (prompt.length > 500) score += 10;
      if (lower.includes('precio') || lower.includes('price')) score += 8;
      if (lower.includes('venta') || lower.includes('sell') || lower.includes('compra')) score += 8;
      if (lower.includes('objeción') || lower.includes('objection')) score += 8;
      if (lower.includes('cierre') || lower.includes('close') || lower.includes('cta')) score += 8;
      if (lower.includes('tono') || lower.includes('tone')) score += 5;
      if (lower.includes('emoji')) score += 3;
      score = Math.min(98, score);
      return NextResponse.json({ 
        score, 
        reason: `Evaluación heurística: prompt de ${prompt.length} caracteres con ${score >= 70 ? 'buena' : 'mejorable'} cobertura de ventas.`,
        source: 'heuristic' 
      });
    }

    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 20_000,
      maxRetries: 1,
    });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un experto en análisis de prompts para chatbots de ventas por WhatsApp. Evalúa el prompt del usuario en una escala del 0 al 100 considerando:

1. Claridad de instrucciones (¿el bot sabe qué hacer?)
2. Técnica de ventas (¿maneja objeciones, cierre, urgencia?)
3. Personalización (¿usa nombre del cliente, es conversacional?)
4. Manejo de flujo (¿sabe cuándo escalar a humano?)
5. Tono y branding (¿es profesional pero cercano?)

Responde EXACTAMENTE con este formato JSON:
{"score": 85, "reason": "razón concisa en español (máx 20 palabras)"}

SOLO responde con el JSON, nada más.`
        },
        {
          role: 'user',
          content: `Evalúa este prompt de chatbot de ventas:\n\n"""${prompt}"""`
        }
      ],
      max_tokens: 150,
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ 
        score: Math.min(99, Math.max(5, parsed.score || 50)), 
        reason: parsed.reason || 'Evaluación completada',
        source: 'ai'
      });
    }

    return NextResponse.json({ score: 50, reason: 'No se pudo evaluar el prompt completamente.' });

  } catch {
    console.error('AI confidence request failed');
    return internalApiError();
  }
}
