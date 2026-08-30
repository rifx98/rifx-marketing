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

interface InsightItem {
  message: string;
  metric: string;
  confidence: 'Alta Confianza' | 'Confianza Media' | 'Baja Confianza';
}

function metric(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(-1_000_000_000, Math.min(1_000_000_000, parsed)) : 0;
}

function shortText(value: unknown, maxLength = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
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
    const featureDenied = denyUnlessFeature(tenant, 'campaigns');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('campaign-insights', tenant.tenantId, 12, 60_000);
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, 64 * 1024);
    if (!bodyResult.ok) return bodyResult.response;
    const rawKpis = bodyResult.body.kpis;

    if (!rawKpis || typeof rawKpis !== 'object' || Array.isArray(rawKpis)) {
      return NextResponse.json({ error: 'Faltan datos de rendimiento (kpis) para analizar.' }, { status: 400 });
    }
    const sourceKpis = rawKpis as Record<string, unknown>;
    const kpis = {
      spend: metric(sourceKpis.spend),
      impressions: metric(sourceKpis.impressions),
      clicks: metric(sourceKpis.clicks),
      ctr: metric(sourceKpis.ctr),
      cpc: metric(sourceKpis.cpc),
      cpa: metric(sourceKpis.cpa),
      roas: metric(sourceKpis.roas),
      conversions: metric(sourceKpis.conversions),
    };
    const platformBreakdown = (Array.isArray(bodyResult.body.platformBreakdown)
      ? bodyResult.body.platformBreakdown
      : [])
      .slice(0, 10)
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
      .map(item => ({
        platform: shortText(item.platform, 40),
        percentage: metric(item.percentage),
        impressions: metric(item.impressions),
        spend: metric(item.spend),
      }));
    const topCreatives = (Array.isArray(bodyResult.body.topCreatives)
      ? bodyResult.body.topCreatives
      : [])
      .slice(0, 10)
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
      .map(item => ({
        name: shortText(item.name, 120),
        ctr: metric(item.ctr),
        spend: metric(item.spend),
        conversions: metric(item.conversions),
      }));

    const supabase = createSupabaseAdmin();
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
      const insights = heuristicInsights(kpis, platformBreakdown, topCreatives);
      return NextResponse.json({ insights, source: 'heuristic' });
    }

    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 20_000,
      maxRetries: 1,
    });

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
      model: 'qwen/qwen3.8-27b',
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
      try { insights = JSON.parse(jsonMatch[0]); } catch { insights = []; }
    }

    if (!insights.length) {
      insights = heuristicInsights(kpis, platformBreakdown, topCreatives);
      return NextResponse.json({ insights, source: 'heuristic_fallback' });
    }

    const allowedConfidence = new Set<InsightItem['confidence']>(['Alta Confianza', 'Confianza Media', 'Baja Confianza']);
    const safeInsights = insights.slice(0, 3).map(item => ({
      message: shortText(item?.message, 300),
      metric: shortText(item?.metric, 160),
      confidence: allowedConfidence.has(item?.confidence) ? item.confidence : 'Baja Confianza',
    }));
    return NextResponse.json({ insights: safeInsights, source: 'ai' });
  } catch {
    console.error('Campaign insights request failed');
    return internalApiError();
  }
}
