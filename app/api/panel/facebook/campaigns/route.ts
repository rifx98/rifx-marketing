import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFacebookJson,
  getFacebookCredentials,
  getFacebookPublicError,
} from '@/lib/facebook';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';

const FB_API_VERSION = 'v21.0';
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;
const META_ID_PATTERN = /^[0-9]{5,30}$/;
const VALID_OBJECTIVES = new Set([
  'OUTCOME_TRAFFIC', 'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_ENGAGEMENT',
  'OUTCOME_AWARENESS', 'OUTCOME_APP_PROMOTION',
]);
const VALID_CAMPAIGN_STATUSES = new Set(['ACTIVE', 'PAUSED']);
const VALID_SPECIAL_CATEGORIES = new Set([
  'HOUSING', 'EMPLOYMENT', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS',
]);
const VALID_DATE_PRESETS = new Set([
  'today', 'yesterday', 'this_month', 'last_month', 'this_quarter', 'maximum',
  'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d',
  'this_week_sun_today', 'this_week_mon_today', 'last_week_sun_sat', 'last_week_mon_sun',
]);

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
}

// GET - Listar campañas con métricas
export async function GET(req: NextRequest) {
  try {
    const { tenantId, token, adAccountId } = await getFacebookCredentials(req);
    const rateDenied = await enforceTenantRateLimit('facebook-campaigns-read', tenantId, 30, 60_000);
    if (rateDenied) return rateDenied;
    const { searchParams } = new URL(req.url);
    const requestedPreset = searchParams.get('date_preset') || 'last_30d';
    const datePreset = VALID_DATE_PRESETS.has(requestedPreset) ? requestedPreset : 'last_30d';

    // 1. Obtener campañas
    const campaignsUrl = `${FB_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time&limit=50&access_token=${token}`;
    const campaignsData = await fetchFacebookJson(campaignsUrl);

    if (campaignsData.error) {
      return NextResponse.json({ error: 'Meta rechazo la consulta de campanas' }, { status: 502 });
    }

    const campaigns = Array.isArray(campaignsData.data) ? campaignsData.data.slice(0, 50) : [];

    // 2. Obtener insights + el schedule real (start_time/end_time viven en el
    // Ad Set para campañas ABO, no en la campaña) para cada campaña
    const campaignsWithInsights = await mapWithConcurrency(
      campaigns,
      5,
      async (campaign: any) => {
        try {
          const [insightsData, adsetsData] = await Promise.all([
            fetchFacebookJson(`${FB_BASE}/${campaign.id}/insights?fields=impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type&date_preset=${datePreset}&access_token=${token}`),
            fetchFacebookJson(`${FB_BASE}/${campaign.id}/adsets?fields=start_time,end_time&limit=50&access_token=${token}`),
          ]);

          const insight = insightsData.data?.[0] || {};

          // Extraer conversiones del array de actions
          const conversions = insight.actions?.find(
            (a: any) => a.action_type === 'offsite_conversion' || a.action_type === 'lead'
          );

          // El schedule real de entrega vive en los Ad Sets (campaign.start_time
          // suele venir vacio en campañas ABO) — usamos el mas temprano/tardio.
          const adsets = adsetsData.data || [];
          const adsetStarts = adsets.map((a: any) => a.start_time).filter(Boolean);
          const adsetEnds = adsets.map((a: any) => a.end_time).filter(Boolean);
          const effectiveStart = adsetStarts.length > 0
            ? adsetStarts.sort()[0]
            : campaign.start_time;
          const effectiveEnd = adsetEnds.length > 0
            ? adsetEnds.sort().reverse()[0]
            : campaign.stop_time;

          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            daily_budget: campaign.daily_budget ? (parseInt(campaign.daily_budget) / 100).toFixed(2) : null,
            lifetime_budget: campaign.lifetime_budget ? (parseInt(campaign.lifetime_budget) / 100).toFixed(2) : null,
            start_time: effectiveStart,
            stop_time: effectiveEnd,
            created_time: campaign.created_time,
            insights: {
              impressions: insight.impressions || '0',
              clicks: insight.clicks || '0',
              ctr: insight.ctr ? parseFloat(insight.ctr).toFixed(2) : '0.00',
              cpc: insight.cpc ? parseFloat(insight.cpc).toFixed(2) : '0.00',
              spend: insight.spend || '0.00',
              conversions: conversions?.value || '0',
            },
          };
        } catch {
          return {
            ...campaign,
            insights: { impressions: '0', clicks: '0', ctr: '0.00', cpc: '0.00', spend: '0.00', conversions: '0' },
          };
        }
      },
    );

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithInsights,
      total: campaignsWithInsights.length,
    });
  } catch (error: any) {
    const failure = getFacebookPublicError(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

// POST - Crear nueva campaña
export async function POST(req: NextRequest) {
  try {
    const { tenantId, token, adAccountId } = await getFacebookCredentials(req);
    const rateDenied = await enforceTenantRateLimit('facebook-campaigns-write', tenantId, 12, 60_000);
    if (rateDenied) return rateDenied;
    const parsedBody = await readLimitedJsonObject(req, 32 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const objective = body.objective === undefined ? 'OUTCOME_TRAFFIC' : body.objective;
    const status = body.status === undefined ? 'PAUSED' : body.status;
    const specialAdCategories = body.special_ad_categories === undefined
      ? []
      : body.special_ad_categories;

    if (
      !name
      || name.length > 200
      || typeof objective !== 'string'
      || !VALID_OBJECTIVES.has(objective)
      || typeof status !== 'string'
      || !VALID_CAMPAIGN_STATUSES.has(status)
      || !Array.isArray(specialAdCategories)
      || specialAdCategories.length > 4
      || specialAdCategories.some(value => typeof value !== 'string' || !VALID_SPECIAL_CATEGORIES.has(value))
    ) {
      return NextResponse.json({ error: 'El nombre de la campaña es requerido' }, { status: 400 });
    }

    // Crear campaña
    const createUrl = `${FB_BASE}/${adAccountId}/campaigns`;
    const createData = await fetchFacebookJson(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        objective,
        status,
        special_ad_categories: specialAdCategories,
        access_token: token,
      }),
    });

    if (createData.error) {
      return NextResponse.json({ error: 'Meta rechazo la creacion de la campana' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      campaign_id: createData.id,
      message: `Campaña "${name}" creada exitosamente`,
    });
  } catch (error: any) {
    const failure = getFacebookPublicError(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

// PATCH - Actualizar estado de campaña (pausar/activar)
export async function PATCH(req: NextRequest) {
  try {
    const { tenantId, token } = await getFacebookCredentials(req);
    const rateDenied = await enforceTenantRateLimit('facebook-campaigns-write', tenantId, 12, 60_000);
    if (rateDenied) return rateDenied;
    const parsedBody = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const { campaign_id, status } = body;

    if (
      typeof campaign_id !== 'string'
      || !META_ID_PATTERN.test(campaign_id)
      || typeof status !== 'string'
      || !VALID_CAMPAIGN_STATUSES.has(status)
    ) {
      return NextResponse.json({ error: 'campaign_id y status son requeridos' }, { status: 400 });
    }

    const updateUrl = `${FB_BASE}/${campaign_id}`;
    const updateData = await fetchFacebookJson(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, access_token: token }),
    });

    if (updateData.error) {
      return NextResponse.json({ error: 'Meta rechazo la actualizacion de la campana' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Campaña ${status === 'ACTIVE' ? 'activada' : 'pausada'} exitosamente`,
    });
  } catch (error: any) {
    const failure = getFacebookPublicError(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

// DELETE - Eliminar campaña
export async function DELETE(req: NextRequest) {
  try {
    const { tenantId, token } = await getFacebookCredentials(req);
    const rateDenied = await enforceTenantRateLimit('facebook-campaigns-write', tenantId, 12, 60_000);
    if (rateDenied) return rateDenied;
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaign_id');

    if (!campaignId || !META_ID_PATTERN.test(campaignId)) {
      return NextResponse.json({ error: 'campaign_id es requerido' }, { status: 400 });
    }

    const deleteUrl = `${FB_BASE}/${campaignId}?access_token=${token}`;
    const deleteData = await fetchFacebookJson(deleteUrl, { method: 'DELETE' });

    if (deleteData.error) {
      return NextResponse.json({ error: 'Meta rechazo la eliminacion de la campana' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Campaña eliminada exitosamente' });
  } catch (error: any) {
    const failure = getFacebookPublicError(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
