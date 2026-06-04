/**
 * ============================================================
 *  RIFX Facebook Ads Publisher — Meta Marketing API v25.0
 * ============================================================
 *
 *  Flujo:  Campaign → Ad Set → Ad Creative → Ad
 *
 *  Modos de segmentación:
 *   • SIMPLE  (advantage_audience = 1) — Meta optimiza la audiencia
 *   • PRO     (advantage_audience = 0) — Segmentación manual completa
 *
 *  Detección automática: si el body NO trae interests, behaviors,
 *  custom_audiences ni lookalike_audiences → se usa SIMPLE.
 *
 *  Campos obligatorios del body:
 *   - campaign_name (string)
 *   - message       (string)
 *
 *  Campos opcionales: ver RequestBody más abajo.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFacebookCredentials } from '@/lib/facebook';

// ─── Meta API Config ──────────────────────────────────────
const FB_API_VERSION = 'v25.0';
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

// ─── Valid Objectives (Meta Marketing API 2025+) ──────────
const VALID_OBJECTIVES = [
  'OUTCOME_TRAFFIC',
  'OUTCOME_LEADS',
  'OUTCOME_SALES',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_AWARENESS',
  'OUTCOME_APP_PROMOTION',
] as const;
type MetaObjective = typeof VALID_OBJECTIVES[number];

// ─── Objective → Optimization Goal mapping ────────────────
const OPT_GOAL_MAP: Record<MetaObjective, string> = {
  OUTCOME_TRAFFIC:       'LINK_CLICKS',
  OUTCOME_ENGAGEMENT:    'POST_ENGAGEMENT',
  OUTCOME_LEADS:         'LEAD_GENERATION',
  OUTCOME_SALES:         'OFFSITE_CONVERSIONS',
  OUTCOME_AWARENESS:     'REACH',
  OUTCOME_APP_PROMOTION: 'APP_INSTALLS',
};

// ─── Valid CTAs ───────────────────────────────────────────
const VALID_CTAS = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'BOOK_TRAVEL',
  'CONTACT_US', 'DOWNLOAD', 'GET_OFFER', 'GET_QUOTE',
  'SUBSCRIBE', 'WATCH_MORE', 'APPLY_NOW', 'ORDER_NOW',
  'WHATSAPP_MESSAGE', 'CALL_NOW', 'SEND_MESSAGE',
] as const;

// ─── Types ────────────────────────────────────────────────
interface RequestBody {
  // Required
  campaign_name: string;
  message: string;

  // Campaign
  objective?: string;
  status?: 'PAUSED' | 'ACTIVE';

  // Ad Set
  ad_set_name?: string;
  daily_budget?: number;          // en centavos USD (500 = $5.00)

  // Targeting — Simple (solo países + edad)
  countries?: string[];
  age_min?: number;
  age_max?: number;

  // Targeting — Profesional (manual)
  targeting_mode?: 'simple' | 'professional';
  gender?: number;                // 0=all, 1=male, 2=female
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
  custom_audiences?: Array<{ id: string }>;
  lookalike_audiences?: Array<{ id: string }>;

  // Geo-locations (map pins)
  custom_locations?: Array<{ lat: number; lng: number; radius: number; name?: string }>;

  // Creative
  link_url?: string;
  image_url?: string;
  call_to_action?: string;
  ad_name?: string;
  page_id?: string;
}

interface MetaApiError {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

type PublishStep = 'config' | 'campaign' | 'adset' | 'creative' | 'ad';



// ─── Auto-detect Page ID ─────────────────────────────────
async function fetchPageId(token: string): Promise<string> {
  const res = await fetch(`${FB_BASE}/me/accounts?access_token=${token}&limit=100`);
  const data = await res.json();

  if (data.error) {
    throw new Error(
      `Error al obtener páginas de Facebook: ${data.error.message}. ` +
      `Verifica que tu Access Token tenga permisos pages_read_engagement.`
    );
  }

  if (!data.data || data.data.length === 0) {
    throw new Error(
      'No se encontró una página de Facebook asociada a este token. ' +
      'Configura FACEBOOK_PAGE_ID en tu .env'
    );
  }

  // Intentar autodetectar la página que contenga "rifx" en su nombre
  const rifxPage = data.data.find((p: any) => p.name && p.name.toLowerCase().includes('rifx'));
  if (rifxPage) {
    console.log(`✨ Página RIFX autodetectada: ${rifxPage.name} (${rifxPage.id})`);
    return rifxPage.id;
  }

  return data.data[0].id;
}

// ─── Validate & sanitize objective ────────────────────────
function validateObjective(raw?: string): MetaObjective {
  if (raw && VALID_OBJECTIVES.includes(raw as MetaObjective)) {
    return raw as MetaObjective;
  }
  return 'OUTCOME_TRAFFIC';
}

// ─── Validate CTA ─────────────────────────────────────────
function validateCTA(raw?: string): string {
  if (raw && VALID_CTAS.includes(raw as any)) return raw;
  return 'LEARN_MORE';
}

// ─── Detect targeting mode ────────────────────────────────
function detectTargetingMode(body: RequestBody): 'simple' | 'professional' {
  if (body.targeting_mode) return body.targeting_mode;

  // Si tiene intereses, behaviors, custom/lookalike → profesional
  const hasManual =
    (body.interests && body.interests.length > 0) ||
    (body.behaviors && body.behaviors.length > 0) ||
    (body.custom_audiences && body.custom_audiences.length > 0) ||
    (body.lookalike_audiences && body.lookalike_audiences.length > 0);

  return hasManual ? 'professional' : 'simple';
}

// ─── Build targeting spec ─────────────────────────────────
function buildTargeting(body: RequestBody, mode: 'simple' | 'professional') {
  // Advantage+ (simple) requires age_min=18, age_max=65 — no custom ranges allowed
  const ageMin = mode === 'simple' ? 18 : Math.max(13, Math.min(65, body.age_min || 18));
  const ageMax = mode === 'simple' ? 65 : Math.max(ageMin, Math.min(65, body.age_max || 65));

  // Build geo_locations — use custom_locations OR countries, never both (avoids overlap error)
  const hasCustomLocations = body.custom_locations && body.custom_locations.length > 0;
  const geoLocations: Record<string, any> = hasCustomLocations
    ? {
        custom_locations: body.custom_locations!.map(loc => ({
          latitude: loc.lat,
          longitude: loc.lng,
          radius: loc.radius,
          distance_unit: 'kilometer',
        })),
      }
    : {
        countries: body.countries || ['EC'],
      };

  const targeting: Record<string, any> = {
    geo_locations: geoLocations,
    age_min: ageMin,
    age_max: ageMax,
    targeting_automation: {
      advantage_audience: mode === 'simple' ? 1 : 0,
    },
  };

  // Gender (only for professional mode)
  if (mode === 'professional' && body.gender !== undefined && body.gender !== 0) {
    targeting.genders = [body.gender]; // 1=male, 2=female
  }

  // Interests (professional only)
  if (mode === 'professional' && body.interests && body.interests.length > 0) {
    targeting.flexible_spec = [{ interests: body.interests }];
  }

  // Behaviors (professional only)
  if (mode === 'professional' && body.behaviors && body.behaviors.length > 0) {
    if (targeting.flexible_spec) {
      targeting.flexible_spec[0].behaviors = body.behaviors;
    } else {
      targeting.flexible_spec = [{ behaviors: body.behaviors }];
    }
  }

  // Custom audiences (professional only)
  if (mode === 'professional' && body.custom_audiences && body.custom_audiences.length > 0) {
    targeting.custom_audiences = body.custom_audiences;
  }

  // Lookalike audiences (professional only)
  if (mode === 'professional' && body.lookalike_audiences && body.lookalike_audiences.length > 0) {
    targeting.custom_audiences = [
      ...(targeting.custom_audiences || []),
      ...body.lookalike_audiences,
    ];
  }

  return targeting;
}

// ─── Create error response ────────────────────────────────
function createErrorResponse(
  step: PublishStep,
  error: MetaApiError,
  extraData: Record<string, any> = {}
) {
  const userMessage = error.error_user_msg || error.error_user_title || error.message;

  console.error(`❌ [FB ${step.toUpperCase()}] Code: ${error.code}, SubCode: ${error.error_subcode}`);
  console.error(`   Message: ${error.message}`);
  console.error(`   User Msg: ${error.error_user_msg || 'N/A'}`);
  console.error(`   FBTrace: ${error.fbtrace_id || 'N/A'}`);

  return NextResponse.json({
    success: false,
    error: userMessage,
    error_code: error.code,
    error_subcode: error.error_subcode,
    step,
    fbtrace_id: error.fbtrace_id,
    ...extraData,
  }, { status: 400 });
}

// ─── Meta API helper ──────────────────────────────────────
async function metaPost(url: string, payload: Record<string, any>) {
  console.log(`📤 [META POST] ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);
  console.log(`   Payload keys: ${Object.keys(payload).filter(k => k !== 'access_token').join(', ')}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (data.error) {
    console.error(`📥 [META ERROR]`, JSON.stringify(data.error, null, 2));
  } else {
    console.log(`📥 [META OK] id: ${data.id}`);
  }

  return data;
}

// ─── MAIN: POST handler ──────────────────────────────────
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // ── 0. Config & validation ──────────────────────────
    const { token, adAccountId, pageId: envPageId } = await getFacebookCredentials(req);
    const body: RequestBody = await req.json();

    if (!body.campaign_name || !body.message) {
      return NextResponse.json({
        success: false,
        error: 'campaign_name y message son campos requeridos.',
        step: 'config',
      }, { status: 400 });
    }

    const resolvedPageId = body.page_id || envPageId || await fetchPageId(token);
    const objective = validateObjective(body.objective);
    const optimizationGoal = OPT_GOAL_MAP[objective];
    const cta = validateCTA(body.call_to_action);
    const mode = detectTargetingMode(body);
    const status = body.status || 'PAUSED';
    const dailyBudget = Math.max(100, body.daily_budget || 500); // mínimo $1

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🚀 RIFX Ad Publisher — Mode: ${mode.toUpperCase()}`);
    console.log(`   Objective: ${objective} | Goal: ${optimizationGoal}`);
    console.log(`   Budget: $${(dailyBudget / 100).toFixed(2)}/day | Status: ${status}`);
    console.log(`   Page: ${resolvedPageId} | API: ${FB_API_VERSION}`);
    console.log(`${'═'.repeat(60)}\n`);

    // ── 1. Create Campaign ──────────────────────────────
    const campaignPayload = {
      name: body.campaign_name,
      objective,
      status,
      special_ad_categories: [] as string[],
      is_adset_budget_sharing_enabled: false,
      access_token: token,
    };

    const campaignData = await metaPost(
      `${FB_BASE}/${adAccountId}/campaigns`,
      campaignPayload
    );

    if (campaignData.error) {
      return createErrorResponse('campaign', campaignData.error);
    }
    const campaignId = campaignData.id;

    // ── 2. Create Ad Set ────────────────────────────────
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const targeting = buildTargeting(body, mode);

    const adSetPayload = {
      name: body.ad_set_name || `${body.campaign_name} - Ad Set`,
      campaign_id: campaignId,
      daily_budget: dailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      start_time: tomorrow.toISOString(),
      status,
      access_token: token,
    };

    const adSetData = await metaPost(
      `${FB_BASE}/${adAccountId}/adsets`,
      adSetPayload
    );

    if (adSetData.error) {
      return createErrorResponse('adset', adSetData.error, {
        campaign_id: campaignId,
        targeting_mode: mode,
        advantage_audience: targeting.targeting_automation.advantage_audience,
      });
    }
    const adSetId = adSetData.id;

    // ── 3. Create Ad Creative ───────────────────────────
    const linkData: Record<string, any> = {
      message: body.message,
      link: body.link_url || 'https://rifx.online',
      call_to_action: { type: cta },
    };

    if (body.image_url) {
      linkData.picture = body.image_url;
    }

    const creativePayload = {
      name: `Creative - ${body.campaign_name}`,
      object_story_spec: {
        page_id: resolvedPageId,
        link_data: linkData,
      },
      access_token: token,
    };

    const creativeData = await metaPost(
      `${FB_BASE}/${adAccountId}/adcreatives`,
      creativePayload
    );

    if (creativeData.error) {
      return createErrorResponse('creative', creativeData.error, {
        campaign_id: campaignId,
        adset_id: adSetId,
      });
    }
    const creativeId = creativeData.id;

    // ── 4. Create Ad ────────────────────────────────────
    const adPayload = {
      name: body.ad_name || `Ad - ${body.campaign_name}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status,
      access_token: token,
    };

    const adData = await metaPost(
      `${FB_BASE}/${adAccountId}/ads`,
      adPayload
    );

    if (adData.error) {
      return createErrorResponse('ad', adData.error, {
        campaign_id: campaignId,
        adset_id: adSetId,
        creative_id: creativeId,
      });
    }

    // ── 5. Success ──────────────────────────────────────
    console.log(`\n✅ RIFX Ad Published Successfully!`);
    console.log(`   Campaign: ${campaignId}`);
    console.log(`   Ad Set:   ${adSetId}`);
    console.log(`   Creative: ${creativeId}`);
    console.log(`   Ad:       ${adData.id}\n`);

    return NextResponse.json({
      success: true,
      message: `Anuncio publicado exitosamente en Facebook (Estado: ${status})`,
      targeting_mode: mode,
      advantage_audience: targeting.targeting_automation.advantage_audience,
      data: {
        campaign_id: campaignId,
        adset_id: adSetId,
        creative_id: creativeId,
        ad_id: adData.id,
      },
    });

  } catch (error: any) {
    console.error('❌ [RIFX Publisher] Unhandled error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor',
      step: 'config',
    }, { status: 500 });
  }
}
