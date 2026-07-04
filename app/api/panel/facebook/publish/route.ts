/**
 * ============================================================
 *  RIFX Facebook Ads Publisher — Meta Marketing API v25.0
 * ============================================================
 *
 *  Flujo:  Campaign → Ad Set → N Ad Creatives → N Ads
 *
 *  Modos de segmentación:
 *   • SIMPLE  (advantage_audience = 1) — Meta optimiza la audiencia (Advantage+)
 *   • PRO     (advantage_audience = 0) — Segmentación manual completa
 *
 *  Detección automática: si el body NO trae interests, behaviors,
 *  custom_audiences ni lookalike_audiences → se usa SIMPLE.
 *
 *  Reglas de "agente experto":
 *   - Siempre se prioriza Advantage+ (advantage_audience = 1), incluso en
 *     remarketing (Meta permite expandir mas alla del publico base).
 *   - Cada conjunto de anuncios publica un MINIMO de 6 anuncios (variantes
 *     de copy) para dar señal suficiente al algoritmo de aprendizaje.
 *   - Si duration_days >= 14, la campaña se divide automaticamente en 2
 *     fases encadenadas: la primera mitad de alcance/aprendizaje, y la
 *     segunda mitad de remarketing dirigido a quienes interactuaron con la
 *     Pagina durante la fase 1 (Custom Audience de engagement).
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

export const maxDuration = 60;

// ─── Meta API Config ──────────────────────────────────────
const FB_API_VERSION = 'v25.0';
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;
const MIN_ADS_PER_SET = 6;

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

  // Multiples variantes de copy para A/B testing (min 6 por conjunto,
  // se rellena ciclando si vienen menos)
  message_variants?: string[];

  // Duracion total solicitada — si es >= 14 dias se divide en 2 fases
  duration_days?: number;

  language?: 'en' | 'es';

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

  const hasManual =
    (body.interests && body.interests.length > 0) ||
    (body.behaviors && body.behaviors.length > 0) ||
    (body.custom_audiences && body.custom_audiences.length > 0) ||
    (body.lookalike_audiences && body.lookalike_audiences.length > 0);

  return hasManual ? 'professional' : 'simple';
}

// ─── Build message variants — siempre al menos MIN_ADS_PER_SET ───
function buildMessageVariants(body: RequestBody): string[] {
  const raw = (body.message_variants || []).map(v => (v || '').trim()).filter(Boolean);
  const base = raw.length > 0 ? raw : [body.message];
  const variants: string[] = [];
  for (let i = 0; i < MIN_ADS_PER_SET; i++) {
    variants.push(base[i % base.length]);
  }
  return variants;
}

// ─── Build targeting spec ─────────────────────────────────
function buildTargeting(body: RequestBody, mode: 'simple' | 'professional', customAudienceIds: string[] = []) {
  // Advantage+ (simple) requires age_min=18, age_max=65 — no custom ranges allowed
  const ageMin = mode === 'simple' ? 18 : Math.max(13, Math.min(65, body.age_min || 18));
  const ageMax = mode === 'simple' ? 65 : Math.max(ageMin, Math.min(65, body.age_max || 65));

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
    // Siempre Advantage+ audience — incluso en remarketing (Meta puede
    // expandir mas alla del publico base de la custom audience si mejora
    // el rendimiento). El "agente experto" nunca desactiva esto.
    targeting_automation: {
      advantage_audience: 1,
    },
  };

  if (mode === 'professional' && body.gender !== undefined && body.gender !== 0) {
    targeting.genders = [body.gender];
  }

  if (mode === 'professional' && body.interests && body.interests.length > 0) {
    targeting.flexible_spec = [{ interests: body.interests }];
  }

  if (mode === 'professional' && body.behaviors && body.behaviors.length > 0) {
    if (targeting.flexible_spec) {
      targeting.flexible_spec[0].behaviors = body.behaviors;
    } else {
      targeting.flexible_spec = [{ behaviors: body.behaviors }];
    }
  }

  if (mode === 'professional' && body.custom_audiences && body.custom_audiences.length > 0) {
    targeting.custom_audiences = body.custom_audiences;
  }

  if (mode === 'professional' && body.lookalike_audiences && body.lookalike_audiences.length > 0) {
    targeting.custom_audiences = [
      ...(targeting.custom_audiences || []),
      ...body.lookalike_audiences,
    ];
  }

  // Remarketing (fase 2): agrega la custom audience de engagement como
  // "semilla", Advantage+ sigue activo para expandir si conviene.
  if (customAudienceIds.length > 0) {
    targeting.custom_audiences = [
      ...(targeting.custom_audiences || []),
      ...customAudienceIds.map(id => ({ id })),
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

// Helper to delete a campaign in case of error (rollback)
async function rollbackCampaign(campaignId: string, token: string) {
  try {
    console.log(`🧹 [ROLLBACK] Deleting incomplete campaign: ${campaignId}`);
    const res = await fetch(`${FB_BASE}/${campaignId}?access_token=${token}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    console.log(`🧹 [ROLLBACK RESULT]`, data);
  } catch (err) {
    console.error(`❌ [ROLLBACK FAILED] Error deleting campaign ${campaignId}:`, err);
  }
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

interface AdSetResult {
  campaignId: string;
  adSetId: string;
  adsCreated: Array<{ ad_id: string; creative_id: string }>;
  adsFailed: number;
}

// ─── Create N ads (creative + ad) under one ad set, in parallel ───
async function createAdsForSet(params: {
  adAccountId: string;
  adSetId: string;
  pageId: string;
  variants: string[];
  linkUrl: string;
  cta: string;
  imageUrl?: string;
  token: string;
  campaignName: string;
}): Promise<{ created: Array<{ ad_id: string; creative_id: string }>; failed: number; firstError: MetaApiError | null }> {
  const { adAccountId, adSetId, pageId, variants, linkUrl, cta, imageUrl, token, campaignName } = params;

  // 1. Crear todas las creatividades en paralelo
  const creativeResults = await Promise.allSettled(variants.map((message, idx) => {
    const linkData: Record<string, any> = {
      message,
      link: linkUrl,
      call_to_action: { type: cta },
    };
    if (imageUrl) linkData.picture = imageUrl;

    return metaPost(`${FB_BASE}/${adAccountId}/adcreatives`, {
      name: `Creative ${idx + 1} - ${campaignName}`,
      object_story_spec: { page_id: pageId, link_data: linkData },
      access_token: token,
    });
  }));

  let firstError: MetaApiError | null = null;
  const okCreatives: Array<{ idx: number; creativeId: string }> = [];
  creativeResults.forEach((r, idx) => {
    if (r.status === 'fulfilled' && r.value.id) {
      okCreatives.push({ idx, creativeId: r.value.id });
    } else if (r.status === 'fulfilled' && r.value.error) {
      if (!firstError) firstError = r.value.error;
    }
  });

  // 2. Crear los ads correspondientes en paralelo
  const adResults = await Promise.allSettled(okCreatives.map(({ idx, creativeId }) =>
    metaPost(`${FB_BASE}/${adAccountId}/ads`, {
      name: `Ad ${idx + 1} - ${campaignName}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
      access_token: token,
    }).then(data => ({ data, creativeId }))
  ));

  const created: Array<{ ad_id: string; creative_id: string }> = [];
  adResults.forEach(r => {
    if (r.status === 'fulfilled' && r.value.data.id) {
      created.push({ ad_id: r.value.data.id, creative_id: r.value.creativeId });
    } else if (r.status === 'fulfilled' && r.value.data.error) {
      if (!firstError) firstError = r.value.data.error;
    }
  });

  return { created, failed: variants.length - created.length, firstError };
}

// ─── Custom Audience de engagement con la Pagina (para remarketing) ───
// Best-effort: si falla, la fase 2 sigue corriendo con targeting normal.
async function createEngagementAudience(params: {
  adAccountId: string;
  pageId: string;
  retentionDays: number;
  name: string;
  token: string;
}): Promise<string | null> {
  const { adAccountId, pageId, retentionDays, name, token } = params;
  try {
    const data = await metaPost(`${FB_BASE}/${adAccountId}/customaudiences`, {
      name,
      subtype: 'ENGAGEMENT',
      rule: JSON.stringify({
        inclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ type: 'page', id: pageId }],
            retention_seconds: Math.max(1, retentionDays) * 86400,
            filter: {
              operator: 'and',
              filters: [{ field: 'event', operator: 'eq', value: 'page_engaged' }],
            },
          }],
        },
      }),
      access_token: token,
    });
    if (data.id) return data.id;
    console.error('⚠️ [REMARKETING AUDIENCE] No se pudo crear, se sigue con targeting normal:', data.error);
    return null;
  } catch (err) {
    console.error('⚠️ [REMARKETING AUDIENCE] Excepción, se sigue con targeting normal:', err);
    return null;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
    const linkUrl = body.link_url || 'https://rifx.online';
    const lang = body.language === 'en' ? 'en' : 'es';
    const durationDays = Math.max(1, Math.min(90, body.duration_days || 30));
    const shouldSplit = durationDays >= 14;
    const messageVariants = buildMessageVariants(body);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🚀 RIFX Ad Publisher — Mode: ${mode.toUpperCase()} | Advantage+: ON`);
    console.log(`   Objective: ${objective} | Goal: ${optimizationGoal}`);
    console.log(`   Budget: $${(dailyBudget / 100).toFixed(2)}/day | Duration: ${durationDays}d | Split: ${shouldSplit}`);
    console.log(`   Ads per set: ${messageVariants.length} | Page: ${resolvedPageId} | API: ${FB_API_VERSION}`);
    console.log(`${'═'.repeat(60)}\n`);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const phase1Days = shouldSplit ? Math.ceil(durationDays / 2) : durationDays;
    const phase2Days = shouldSplit ? durationDays - phase1Days : 0;
    const phase1End = addDays(tomorrow, phase1Days);

    // ── FASE 1 (o campaña unica si no hay split) ────────
    const phase1Name = shouldSplit ? `${body.campaign_name} - Alcance` : body.campaign_name;
    const campaign1Data = await metaPost(`${FB_BASE}/${adAccountId}/campaigns`, {
      name: phase1Name,
      objective,
      status,
      special_ad_categories: [] as string[],
      is_adset_budget_sharing_enabled: false,
      access_token: token,
    });

    if (campaign1Data.error) {
      return createErrorResponse('campaign', campaign1Data.error);
    }
    const campaign1Id = campaign1Data.id;

    const targeting1 = buildTargeting(body, mode);
    const adSet1Data = await metaPost(`${FB_BASE}/${adAccountId}/adsets`, {
      name: body.ad_set_name || `${phase1Name} - Ad Set`,
      campaign_id: campaign1Id,
      daily_budget: dailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: targeting1,
      start_time: tomorrow.toISOString(),
      end_time: phase1End.toISOString(),
      status,
      access_token: token,
    });

    if (adSet1Data.error) {
      await rollbackCampaign(campaign1Id, token);
      return createErrorResponse('adset', adSet1Data.error, {
        campaign_id: campaign1Id,
        targeting_mode: mode,
        advantage_audience: 1,
      });
    }
    const adSet1Id = adSet1Data.id;

    const ads1 = await createAdsForSet({
      adAccountId,
      adSetId: adSet1Id,
      pageId: resolvedPageId,
      variants: messageVariants,
      linkUrl,
      cta,
      imageUrl: body.image_url,
      token,
      campaignName: phase1Name,
    });

    if (ads1.created.length === 0) {
      await rollbackCampaign(campaign1Id, token);
      return createErrorResponse('ad', ads1.firstError || { message: 'No se pudo crear ningún anuncio.' }, {
        campaign_id: campaign1Id,
        adset_id: adSet1Id,
      });
    }

    const phase1Result: AdSetResult = {
      campaignId: campaign1Id,
      adSetId: adSet1Id,
      adsCreated: ads1.created,
      adsFailed: ads1.failed,
    };

    console.log(`\n✅ Fase 1 publicada: campaign=${campaign1Id} adset=${adSet1Id} ads=${ads1.created.length}/${messageVariants.length}\n`);

    if (!shouldSplit) {
      return NextResponse.json({
        success: true,
        message: `Campaña publicada exitosamente en Facebook (Estado: ${status})`,
        targeting_mode: mode,
        advantage_audience: 1,
        phases: 1,
        ads_created: phase1Result.adsCreated.length,
        data: { phase1: phase1Result },
      });
    }

    // ── FASE 2: Remarketing ─────────────────────────────
    const phase2Name = `${body.campaign_name} - Remarketing`;
    const audienceName = `RIFX Remarketing - ${body.campaign_name}`.substring(0, 100);
    const audienceId = await createEngagementAudience({
      adAccountId,
      pageId: resolvedPageId,
      retentionDays: phase1Days,
      name: audienceName,
      token,
    });

    const campaign2Data = await metaPost(`${FB_BASE}/${adAccountId}/campaigns`, {
      name: phase2Name,
      objective,
      status,
      special_ad_categories: [] as string[],
      is_adset_budget_sharing_enabled: false,
      access_token: token,
    });

    if (campaign2Data.error) {
      // Fase 1 ya quedo publicada y es funcional por si sola — no se revierte.
      return NextResponse.json({
        success: true,
        message: `Fase 1 publicada, pero la fase 2 (remarketing) falló al crearse: ${campaign2Data.error.message}`,
        targeting_mode: mode,
        advantage_audience: 1,
        phases: 1,
        ads_created: phase1Result.adsCreated.length,
        data: { phase1: phase1Result },
        phase2_error: campaign2Data.error.message,
      });
    }
    const campaign2Id = campaign2Data.id;

    const targeting2 = buildTargeting(body, mode, audienceId ? [audienceId] : []);
    const phase2End = addDays(phase1End, phase2Days);
    const adSet2Data = await metaPost(`${FB_BASE}/${adAccountId}/adsets`, {
      name: `${phase2Name} - Ad Set`,
      campaign_id: campaign2Id,
      daily_budget: dailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: targeting2,
      start_time: phase1End.toISOString(),
      end_time: phase2End.toISOString(),
      status,
      access_token: token,
    });

    if (adSet2Data.error) {
      await rollbackCampaign(campaign2Id, token);
      return NextResponse.json({
        success: true,
        message: `Fase 1 publicada, pero el conjunto de anuncios de la fase 2 (remarketing) falló: ${adSet2Data.error.message}`,
        targeting_mode: mode,
        advantage_audience: 1,
        phases: 1,
        ads_created: phase1Result.adsCreated.length,
        data: { phase1: phase1Result },
        phase2_error: adSet2Data.error.message,
      });
    }
    const adSet2Id = adSet2Data.id;

    // Copy de remarketing: reconoce que esta persona ya interactuo antes.
    const remarketingPrefix = lang === 'en'
      ? '👋 Still thinking about it? Here\'s another chance:\n\n'
      : '👋 ¿Ya nos viste? Todavía estás a tiempo:\n\n';
    const remarketingVariants = messageVariants.map(v => `${remarketingPrefix}${v}`);

    const ads2 = await createAdsForSet({
      adAccountId,
      adSetId: adSet2Id,
      pageId: resolvedPageId,
      variants: remarketingVariants,
      linkUrl,
      cta,
      imageUrl: body.image_url,
      token,
      campaignName: phase2Name,
    });

    if (ads2.created.length === 0) {
      await rollbackCampaign(campaign2Id, token);
      return NextResponse.json({
        success: true,
        message: `Fase 1 publicada, pero no se pudo crear ningún anuncio de remarketing para la fase 2.`,
        targeting_mode: mode,
        advantage_audience: 1,
        phases: 1,
        ads_created: phase1Result.adsCreated.length,
        data: { phase1: phase1Result },
        phase2_error: ads2.firstError?.message || 'No se pudo crear ningún anuncio de remarketing.',
      });
    }

    const phase2Result: AdSetResult = {
      campaignId: campaign2Id,
      adSetId: adSet2Id,
      adsCreated: ads2.created,
      adsFailed: ads2.failed,
    };

    console.log(`\n✅ Fase 2 (remarketing) publicada: campaign=${campaign2Id} adset=${adSet2Id} ads=${ads2.created.length}/${remarketingVariants.length} audience=${audienceId || 'N/A'}\n`);

    return NextResponse.json({
      success: true,
      message: `Campaña publicada en 2 fases encadenadas (Estado: ${status})`,
      targeting_mode: mode,
      advantage_audience: 1,
      phases: 2,
      ads_created: phase1Result.adsCreated.length + phase2Result.adsCreated.length,
      remarketing_audience_id: audienceId,
      remarketing_audience_status: audienceId ? 'created' : 'fallback_broad_targeting',
      data: { phase1: phase1Result, phase2: phase2Result },
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
