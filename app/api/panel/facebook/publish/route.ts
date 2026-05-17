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

// POST - Publicar anuncio completo (Campaign + AdSet + AdCreative + Ad)
export async function POST(req: NextRequest) {
  try {
    const { token, adAccountId } = getEnv();
    const body = await req.json();

    const {
      campaign_name,
      ad_set_name,
      ad_name,
      daily_budget = 500, // en centavos ($5.00)
      objective = 'OUTCOME_TRAFFIC',
      status = 'PAUSED',
      // Targeting
      countries = ['MX'],
      age_min = 18,
      age_max = 65,
      // Creative
      message, // texto del anuncio (hook)
      link_url, // URL de destino
      image_url, // URL de la imagen del anuncio
      call_to_action = 'LEARN_MORE',
      page_id, // ID de la pagina de Facebook
    } = body;

    if (!campaign_name || !message) {
      return NextResponse.json({
        error: 'campaign_name y message son campos requeridos',
      }, { status: 400 });
    }

    // ============================================
    // PASO 1: Crear Campaña
    // ============================================
    const campaignRes = await fetch(`${FB_BASE}/${adAccountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaign_name,
        objective,
        status,
        special_ad_categories: [],
        access_token: token,
      }),
    });
    const campaignData = await campaignRes.json();

    if (campaignData.error) {
      return NextResponse.json({
        error: `Error al crear campaña: ${campaignData.error.message}`,
        step: 'campaign',
      }, { status: 400 });
    }

    const campaignId = campaignData.id;

    // ============================================
    // PASO 2: Crear Ad Set (conjunto de anuncios)
    // ============================================
    const adSetRes = await fetch(`${FB_BASE}/${adAccountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ad_set_name || `${campaign_name} - Ad Set`,
        campaign_id: campaignId,
        daily_budget: daily_budget,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: {
          geo_locations: { countries },
          age_min,
          age_max,
        },
        status,
        access_token: token,
      }),
    });
    const adSetData = await adSetRes.json();

    if (adSetData.error) {
      return NextResponse.json({
        error: `Error al crear Ad Set: ${adSetData.error.message}`,
        step: 'adset',
        campaign_id: campaignId,
      }, { status: 400 });
    }

    const adSetId = adSetData.id;

    // ============================================
    // PASO 3: Crear Ad Creative
    // ============================================
    const creativePayload: any = {
      name: `Creative - ${campaign_name}`,
      object_story_spec: {
        page_id: page_id,
        link_data: {
          message: message,
          link: link_url || 'https://rifx.online',
          call_to_action: {
            type: call_to_action,
          },
        },
      },
      access_token: token,
    };

    // Si hay imagen, agregarla
    if (image_url) {
      creativePayload.object_story_spec.link_data.picture = image_url;
    }

    const creativeRes = await fetch(`${FB_BASE}/${adAccountId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creativePayload),
    });
    const creativeData = await creativeRes.json();

    if (creativeData.error) {
      return NextResponse.json({
        error: `Error al crear Creative: ${creativeData.error.message}`,
        step: 'creative',
        campaign_id: campaignId,
        adset_id: adSetId,
      }, { status: 400 });
    }

    const creativeId = creativeData.id;

    // ============================================
    // PASO 4: Crear Ad (el anuncio final)
    // ============================================
    const adRes = await fetch(`${FB_BASE}/${adAccountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ad_name || `Ad - ${campaign_name}`,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status,
        access_token: token,
      }),
    });
    const adData = await adRes.json();

    if (adData.error) {
      return NextResponse.json({
        error: `Error al crear Ad: ${adData.error.message}`,
        step: 'ad',
        campaign_id: campaignId,
        adset_id: adSetId,
        creative_id: creativeId,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Anuncio publicado exitosamente en Facebook (Estado: ${status})`,
      data: {
        campaign_id: campaignId,
        adset_id: adSetId,
        creative_id: creativeId,
        ad_id: adData.id,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
