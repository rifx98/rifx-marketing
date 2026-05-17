import { NextRequest, NextResponse } from 'next/server';

const FB_API_VERSION = 'v21.0';
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

function getEnv() {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  if (!token || !adAccountId) {
    throw new Error('Faltan credenciales de Facebook Marketing API');
  }
  return { token, adAccountId };
}

// GET - Listar campañas con métricas
export async function GET(req: NextRequest) {
  try {
    const { token, adAccountId } = getEnv();
    const { searchParams } = new URL(req.url);
    const datePreset = searchParams.get('date_preset') || 'last_30d';

    // 1. Obtener campañas
    const campaignsUrl = `${FB_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time&limit=50&access_token=${token}`;
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();

    if (campaignsData.error) {
      return NextResponse.json({ error: campaignsData.error.message }, { status: 400 });
    }

    const campaigns = campaignsData.data || [];

    // 2. Obtener insights para cada campaña
    const campaignsWithInsights = await Promise.all(
      campaigns.map(async (campaign: any) => {
        try {
          const insightsUrl = `${FB_BASE}/${campaign.id}/insights?fields=impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type&date_preset=${datePreset}&access_token=${token}`;
          const insightsRes = await fetch(insightsUrl);
          const insightsData = await insightsRes.json();

          const insight = insightsData.data?.[0] || {};

          // Extraer conversiones del array de actions
          const conversions = insight.actions?.find(
            (a: any) => a.action_type === 'offsite_conversion' || a.action_type === 'lead'
          );

          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            daily_budget: campaign.daily_budget ? (parseInt(campaign.daily_budget) / 100).toFixed(2) : null,
            lifetime_budget: campaign.lifetime_budget ? (parseInt(campaign.lifetime_budget) / 100).toFixed(2) : null,
            start_time: campaign.start_time,
            stop_time: campaign.stop_time,
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
      })
    );

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithInsights,
      total: campaignsWithInsights.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear nueva campaña
export async function POST(req: NextRequest) {
  try {
    const { token, adAccountId } = getEnv();
    const body = await req.json();
    const { name, objective = 'OUTCOME_TRAFFIC', status = 'PAUSED', daily_budget, special_ad_categories = [] } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre de la campaña es requerido' }, { status: 400 });
    }

    // Crear campaña
    const createUrl = `${FB_BASE}/${adAccountId}/campaigns`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        objective,
        status,
        special_ad_categories,
        access_token: token,
      }),
    });
    const createData = await createRes.json();

    if (createData.error) {
      return NextResponse.json({ error: createData.error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      campaign_id: createData.id,
      message: `Campaña "${name}" creada exitosamente`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Actualizar estado de campaña (pausar/activar)
export async function PATCH(req: NextRequest) {
  try {
    const { token } = getEnv();
    const body = await req.json();
    const { campaign_id, status } = body;

    if (!campaign_id || !status) {
      return NextResponse.json({ error: 'campaign_id y status son requeridos' }, { status: 400 });
    }

    const updateUrl = `${FB_BASE}/${campaign_id}`;
    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, access_token: token }),
    });
    const updateData = await updateRes.json();

    if (updateData.error) {
      return NextResponse.json({ error: updateData.error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Campaña ${status === 'ACTIVE' ? 'activada' : 'pausada'} exitosamente`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar campaña
export async function DELETE(req: NextRequest) {
  try {
    const { token } = getEnv();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaign_id');

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id es requerido' }, { status: 400 });
    }

    const deleteUrl = `${FB_BASE}/${campaignId}?access_token=${token}`;
    const deleteRes = await fetch(deleteUrl, { method: 'DELETE' });
    const deleteData = await deleteRes.json();

    if (deleteData.error) {
      return NextResponse.json({ error: deleteData.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Campaña eliminada exitosamente' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
