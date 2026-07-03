import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';

interface InsightItem {
  message: string;
  metric: string;
  confidence: 'Alta Confianza' | 'Confianza Media' | 'Baja Confianza';
}

// Genera recomendaciones deterministas basadas en los numeros reales,
// usadas cuando no hay una API key de IA configurada para el tenant.
function heuristicInsights(kpis: any, platformBreakdown: any[], topCreatives: any[]): InsightItem[] {
  const insights: InsightItem[] = [];

  const sortedPlatforms = [...(platformBreakdown || [])]
    .filter(p => parseInt(p.impressions || '0') > 0)
    .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

  if (sortedPlatforms.length >= 2) {
    const best = sortedPlatforms[0];
    insights.push({
      message: `${best.platform} concentra el ${best.percentage}% de las impresiones. Si el CTR ahi es bueno, conviene priorizar presupuesto en esa plataforma.`,
      metric: `${best.platform}: ${best.percentage}% de impresiones`,
      confidence: 'Confianza Media',
    });
  }

  const sortedCreatives = [...(topCreatives || [])]
    .filter(c => parseFloat(c.ctr || '0') > 0)
    .sort((a, b) => parseFloat(b.ctr) - parseFloat(a.ctr));

  if (sortedCreatives.length > 0) {
    const top = sortedCreatives[0];
    insights.push({
      message: `El anuncio "${top.name}" tiene el CTR mas alto (${top.ctr}%). Considera escalar su presupuesto o replicar su formato en otros anuncios.`,
      metric: `CTR: ${top.ctr}% | Gasto: $${top.spend}`,
      confidence: 'Alta Confianza',
    });
  }

  const cpa = parseFloat(kpis?.cpa || '0');
  const spend = parseFloat(kpis?.spend || '0');
  if (spend > 0) {
    insights.push({
      message: cpa > 0
        ? `El costo por conversion actual es de $${kpis.cpa}. Compara este numero con el valor promedio de tu cliente para saber si la campana es rentable.`
        : `Se registro gasto de $${kpis.spend} sin conversiones atribuidas en el periodo. Revisa el objetivo de la campana o el evento de conversion configurado.`,
      metric: `Gasto total: $${kpis.spend}`,
      confidence: 'Confianza Media',
    });
  }

  if (insights.length === 0) {
    insights.push({
      message: 'Aun no hay suficientes datos en este periodo para generar recomendaciones. Corre la campana unos dias mas y vuelve a cargar los datos.',
      metric: 'Sin datos suficientes',
      confidence: 'Baja Confianza',
    });
  }

  return insights.slice(0, 3);
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { kpis, platformBreakdown, topCreatives } = body || {};

    if (!kpis) {
      return NextResponse.json({ error: 'Faltan datos de rendimiento (kpis) para analizar.' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: config } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .single();

    let groqKey = '';
    try { const p = JSON.parse(config?.openai_key || '{}'); groqKey = p.groq_key || p.openai_key || ''; } catch { groqKey = config?.openai_key || ''; }
    if (!groqKey) groqKey = process.env.GROQ_API_KEY || '';

    if (!groqKey) {
      const insights = heuristicInsights(kpis, platformBreakdown, topCreatives);
      return NextResponse.json({ insights, source: 'heuristic' });
    }

    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });

    const dataSummary = `
KPIs de la cuenta (periodo seleccionado):
- Gasto total: $${kpis.spend}
- Impresiones: ${kpis.impressions}
- Clics: ${kpis.clicks}
- CTR: ${kpis.ctr}%
- CPC: $${kpis.cpc}
- CPA: $${kpis.cpa}
- ROAS: ${kpis.roas}x
- Conversiones: ${kpis.conversions}

Desglose por plataforma:
${(platformBreakdown || []).map((p: any) => `- ${p.platform}: ${p.percentage}% de impresiones, $${p.spend} de gasto`).join('\n') || '(sin datos)'}

Top anuncios por impresiones:
${(topCreatives || []).slice(0, 5).map((c: any) => `- "${c.name}": CTR ${c.ctr}%, gasto $${c.spend}, conversiones ${c.conversions}`).join('\n') || '(sin datos)'}
`.trim();

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un analista de marketing digital experto en Facebook/Instagram Ads. Analiza SOLO los numeros reales que te paso y da recomendaciones concretas y accionables basadas exclusivamente en esos datos. No inventes campanas, porcentajes ni cifras que no esten en los datos proporcionados.

Responde SOLO con un JSON array de maximo 3 objetos:
[{"message": "recomendacion concisa en espanol, max 30 palabras, mencionando el dato real que la respalda", "metric": "el dato concreto que respalda la recomendacion (ej: 'CTR: 3.2%')", "confidence": "Alta Confianza" | "Confianza Media" | "Baja Confianza"}]

Si los datos son insuficientes o todo esta en cero, dilo honestamente en vez de inventar una recomendacion.`
        },
        {
          role: 'user',
          content: dataSummary
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const aiContent = completion.choices[0]?.message?.content || '[]';
    let insights: InsightItem[] = [];
    const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try { insights = JSON.parse(jsonMatch[0]); } catch (e) { console.error('Error parsing AI insights:', e); }
    }

    if (!insights.length) {
      insights = heuristicInsights(kpis, platformBreakdown, topCreatives);
      return NextResponse.json({ insights, source: 'heuristic_fallback' });
    }

    return NextResponse.json({ insights, source: 'ai' });
  } catch (error: any) {
    console.error('Campaign Insights Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
