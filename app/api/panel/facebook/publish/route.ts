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
 *     Pagina durante la fase 1 (Custom Audience de engagement, combinando
 *     page_engaged + page_post_interaction + page_liked + page_cta_clicked).
 *
 *  Campos obligatorios del body:
 *   - campaign_name (string)
 *   - message       (string)
 *
 *  Campos opcionales: ver RequestBody más abajo.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFacebookJson,
  getFacebookCredentials,
  getFacebookPublicError,
} from '@/lib/facebook';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';

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

  // Multiples creatividades (imagen o video) para A/B testing (min 6 por
  // conjunto, se rellena ciclando si vienen menos). Si no viene, se usa
  // image_url para todos los anuncios (comportamiento anterior).
  creative_assets?: Array<{ url: string; type: 'image' | 'video' }>;

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

  // Para el objetivo OUTCOME_SALES: distingue si la venta ocurre por
  // WhatsApp (click-to-chat, sin pixel) o por sitio web (requiere pixel).
  sales_destination?: 'whatsapp' | 'web';
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

interface CreativeAsset {
  url: string;
  type: 'image' | 'video';
}

// ─── Auto-detect Page ID ─────────────────────────────────
async function fetchPageId(token: string): Promise<string> {
  const data = await fetchFacebookJson(`${FB_BASE}/me/accounts?access_token=${token}&limit=100`);

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
    return rifxPage.id;
  }

  return data.data[0].id;
}

// ─── Obtiene el primer pixel de la cuenta publicitaria, o crea uno nuevo
// si no existe ninguno (requerido por Meta para optimization_goal =
// OFFSITE_CONVERSIONS). Para que las conversiones se registren de verdad,
// el pixel debe estar instalado en el sitio web del cliente — eso lo hace
// el propio negocio, no es algo que la API pueda hacer por ellos ───
async function getOrCreatePixel(adAccountId: string, token: string): Promise<string | null> {
  try {
    const listData = await fetchFacebookJson(`${FB_BASE}/${adAccountId}/adspixels?fields=id,name&access_token=${token}`);
    if (listData.data && listData.data.length > 0) {
      return listData.data[0].id;
    }

    const createData = await metaPost(`${FB_BASE}/${adAccountId}/adspixels`, {
      name: 'RIFX Pixel',
      access_token: token,
    });
    return createData.id || null;
  } catch {
    console.error('Meta pixel lookup failed');
    return null;
  }
}

// ─── Resuelve el promoted_object (y ajustes de optimization_goal/destination_type)
// que Meta exige segun el objetivo — sin esto, Meta rechaza el ad set con
// "Selecciona un objeto promocionado para tu conjunto de anuncios" ───
async function resolvePromotedObject(
  objective: MetaObjective,
  optimizationGoal: string,
  body: RequestBody,
  pageId: string,
  adAccountId: string,
  token: string
): Promise<{ promotedObject?: Record<string, any>; optimizationGoal: string; destinationType?: string }> {
  if (objective === 'OUTCOME_ENGAGEMENT') {
    // POST_ENGAGEMENT (likes/comments/shares en el anuncio-post) requiere
    // destination_type = ON_POST ademas del promoted_object.page_id.
    return { promotedObject: { page_id: pageId }, optimizationGoal, destinationType: 'ON_POST' };
  }

  if (objective === 'OUTCOME_LEADS') {
    return { promotedObject: { page_id: pageId }, optimizationGoal };
  }

  if (objective === 'OUTCOME_SALES') {
    if (body.sales_destination === 'whatsapp') {
      // Click-to-WhatsApp: no requiere pixel, requiere la Pagina + destination_type
      return { promotedObject: { page_id: pageId }, optimizationGoal: 'CONVERSATIONS', destinationType: 'WHATSAPP' };
    }
    const pixelId = await getOrCreatePixel(adAccountId, token);
    if (pixelId) {
      return { promotedObject: { pixel_id: pixelId, custom_event_type: 'PURCHASE' }, optimizationGoal };
    }
    return { optimizationGoal };
  }

  return { optimizationGoal };
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

// ─── Build creative assets (imagen/video) — siempre al menos MIN_ADS_PER_SET ───
function buildCreativeAssets(body: RequestBody): CreativeAsset[] {
  const raw = (body.creative_assets || []).filter(a => a && a.url);
  const base: CreativeAsset[] = raw.length > 0 ? raw : [{ url: body.image_url || '', type: 'image' }];
  const assets: CreativeAsset[] = [];
  for (let i = 0; i < MIN_ADS_PER_SET; i++) {
    assets.push(base[i % base.length]);
  }
  return assets;
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
  console.error('Meta publishing step failed:', step, error.code || 'provider_error', error.error_subcode || 'none');

  return NextResponse.json({
    success: false,
    error: 'Meta rechazo esta operacion. Revisa la configuracion de la campana.',
    error_code: error.code,
    error_subcode: error.error_subcode,
    step,
    ...extraData,
  }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
}

// Helper to delete a campaign in case of error (rollback)
async function rollbackCampaign(campaignId: string, token: string) {
  try {
    await fetchFacebookJson(`${FB_BASE}/${campaignId}?access_token=${token}`, {
      method: 'DELETE',
    });
  } catch {
    console.error('Meta campaign rollback failed');
  }
}

// ─── Meta API helper ──────────────────────────────────────
async function metaPost(url: string, payload: Record<string, any>) {
  return fetchFacebookJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

interface AdSetResult {
  campaignId: string;
  adSetId: string;
  adsCreated: Array<{ ad_id: string; creative_id: string }>;
  adsFailed: number;
}

// ─── Sube un video a Meta (Meta lo descarga desde file_url) y espera a que
// termine de procesarse antes de poder usarlo en una creatividad ───
async function uploadVideoToMeta(adAccountId: string, videoUrl: string, token: string): Promise<string | null> {
  try {
    const data = await metaPost(`${FB_BASE}/${adAccountId}/advideos`, {
      file_url: videoUrl,
      access_token: token,
    });
    if (!data.id) {
      console.error('Meta video upload was rejected');
      return null;
    }
    const videoId = data.id;

    // El procesamiento (transcoding) es asincronico — se espera con un
    // limite acotado de intentos para no exceder el timeout de la funcion.
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusData = await fetchFacebookJson(`${FB_BASE}/${videoId}?fields=status&access_token=${token}`);
      const videoStatus = statusData.status?.video_status;
      if (videoStatus === 'ready') return videoId;
      if (videoStatus === 'error') {
        console.error('Meta video processing failed');
        return null;
      }
    }
    console.error('⚠️ [VIDEO UPLOAD] Timeout esperando el procesamiento del video, se omite ese anuncio.');
    return null;
  } catch {
    console.error('Meta video upload failed');
    return null;
  }
}

async function getVideoThumbnail(videoId: string, token: string): Promise<string | null> {
  try {
    const data = await fetchFacebookJson(`${FB_BASE}/${videoId}/thumbnails?access_token=${token}`);
    const thumbs = data.data || [];
    const preferred = thumbs.find((t: any) => t.is_preferred) || thumbs[0];
    return preferred?.uri || null;
  } catch {
    return null;
  }
}

// ─── Create N ads (creative + ad) under one ad set, in parallel ───
async function createAdsForSet(params: {
  adAccountId: string;
  adSetId: string;
  pageId: string;
  variants: string[];
  assets: CreativeAsset[];
  linkUrl: string;
  cta: string;
  token: string;
  campaignName: string;
  isWhatsAppDestination?: boolean;
}): Promise<{ created: Array<{ ad_id: string; creative_id: string }>; failed: number; firstError: MetaApiError | null }> {
  const { adAccountId, adSetId, pageId, variants, assets, linkUrl, cta, token, campaignName, isWhatsAppDestination } = params;

  // Click-to-WhatsApp: el anuncio debe apuntar a WhatsApp, no a un link
  // generico — si no, Meta muestra "Sitio web" como ubicacion de conversion
  // aunque el ad set tenga destination_type=WHATSAPP.
  const whatsAppCta = { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } };

  // 0. Subir todos los videos unicos a Meta y esperar a que esten listos
  // (en paralelo — una sola vez por URL, aunque se repita en varios slots)
  const uniqueVideoUrls = Array.from(new Set(assets.filter(a => a.type === 'video').map(a => a.url)));
  const videoIdByUrl = new Map<string, string | null>();
  await Promise.all(uniqueVideoUrls.map(async (url) => {
    videoIdByUrl.set(url, await uploadVideoToMeta(adAccountId, url, token));
  }));
  const fallbackThumbnail = assets.find(a => a.type === 'image')?.url;

  // 1. Crear todas las creatividades en paralelo
  const creativeResults = await Promise.allSettled(variants.map(async (message, idx) => {
    const asset = assets[idx];

    if (asset?.type === 'video') {
      const videoId = videoIdByUrl.get(asset.url);
      if (!videoId) {
        return { error: { message: 'El video no se pudo procesar a tiempo, se omitió este anuncio.' } };
      }
      const thumbnail = (await getVideoThumbnail(videoId, token)) || fallbackThumbnail;
      return metaPost(`${FB_BASE}/${adAccountId}/adcreatives`, {
        name: `Creative ${idx + 1} - ${campaignName}`,
        object_story_spec: {
          page_id: pageId,
          video_data: {
            video_id: videoId,
            message,
            call_to_action: isWhatsAppDestination ? whatsAppCta : { type: cta },
            ...(thumbnail ? { image_url: thumbnail } : {}),
          },
        },
        access_token: token,
      });
    }

    const linkData: Record<string, any> = {
      message,
      link: isWhatsAppDestination ? 'https://api.whatsapp.com/send' : linkUrl,
      call_to_action: isWhatsAppDestination ? whatsAppCta : { type: cta },
    };
    if (asset?.url) linkData.picture = asset.url;

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
  // url_tags: agrega parametros UTM a la URL de destino usando los macros
  // nativos de Meta (se reemplazan solos con el nombre real de campaña/
  // conjunto/anuncio) para que el negocio pueda distinguir el trafico de
  // Facebook Ads en Google Analytics / su propio sitio. No aplica en
  // Click-to-WhatsApp porque ahi no hay una pagina web recibiendo la URL.
  const urlTags = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}';

  const adResults = await Promise.allSettled(okCreatives.map(({ idx, creativeId }) =>
    metaPost(`${FB_BASE}/${adAccountId}/ads`, {
      name: `Ad ${idx + 1} - ${campaignName}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
      ...(isWhatsAppDestination ? {} : { url_tags: urlTags }),
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

// ─── Presupuesto por debajo del cual conviene usar Creatividad Dinamica
// (1 solo anuncio con varias imagenes/textos que Meta combina y prueba
// solo) en vez de 6 anuncios separados compitiendo por el mismo dinero.
// Verificado con Meta que SOLO admite objetivos de conversion (no
// Engagement ni Conversations/WhatsApp — Meta los rechaza explicitamente).
const DYNAMIC_CREATIVE_BUDGET_THRESHOLD_CENTS = 1500; // $15/dia

function shouldUseDynamicCreative(
  objective: MetaObjective,
  isWhatsAppDestination: boolean,
  dailyBudgetCents: number,
  assets: CreativeAsset[]
): boolean {
  if (isWhatsAppDestination) return false; // Meta rechaza dynamic creative en CONVERSATIONS
  if (objective === 'OUTCOME_ENGAGEMENT') return false; // Meta rechaza dynamic creative en POST_ENGAGEMENT
  if (dailyBudgetCents >= DYNAMIC_CREATIVE_BUDGET_THRESHOLD_CENTS) return false;
  return assets.every(a => a.type === 'image'); // por ahora solo probado con imagenes
}

// ─── Crea UN solo anuncio con Creatividad Dinamica (asset_feed_spec):
// Meta prueba las combinaciones de imagenes/textos internamente sin
// fragmentar el presupuesto de aprendizaje entre 6 anuncios separados —
// mas eficiente para presupuestos bajos ───
async function createDynamicCreativeAd(params: {
  adAccountId: string;
  adSetId: string;
  pageId: string;
  variants: string[];
  assets: CreativeAsset[];
  linkUrl: string;
  cta: string;
  token: string;
  campaignName: string;
}): Promise<{ created: Array<{ ad_id: string; creative_id: string }>; failed: number; firstError: MetaApiError | null }> {
  const { adAccountId, adSetId, pageId, variants, assets, linkUrl, cta, token, campaignName } = params;

  const urlTags = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}';

  // Limites de Meta para asset_feed_spec: max 10 imagenes, 5 textos, 5 titulos.
  // Meta exige texto UNICO por cada body/title — si solo hay 1 mensaje base
  // (sin variantes), buildMessageVariants lo repite 6 veces y hay que
  // deduplicar antes de enviarlo, o Meta rechaza el anuncio.
  const images = Array.from(new Set(assets.map(a => a.url).filter(Boolean))).slice(0, 10).map(url => ({ url }));
  const bodies = Array.from(new Set(variants.map(v => v.trim()).filter(Boolean))).slice(0, 5).map(text => ({ text }));
  const shortTitle = campaignName.replace(/\n/g, ' ').substring(0, 40);

  const creativeData = await metaPost(`${FB_BASE}/${adAccountId}/adcreatives`, {
    name: `Dynamic Creative - ${campaignName}`,
    object_story_spec: { page_id: pageId },
    asset_feed_spec: {
      images,
      bodies,
      titles: [{ text: shortTitle }],
      call_to_action_types: [cta],
      link_urls: [{ website_url: linkUrl }],
      ad_formats: ['SINGLE_IMAGE'],
    },
    access_token: token,
  });

  if (!creativeData.id) {
    return { created: [], failed: variants.length, firstError: creativeData.error || { message: 'No se pudo crear la creatividad dinámica.' } };
  }

  const adData = await metaPost(`${FB_BASE}/${adAccountId}/ads`, {
    name: `Ad Dinámico - ${campaignName}`,
    adset_id: adSetId,
    creative: { creative_id: creativeData.id },
    status: 'PAUSED',
    url_tags: urlTags,
    access_token: token,
  });

  if (!adData.id) {
    return { created: [], failed: variants.length, firstError: adData.error || { message: 'No se pudo crear el anuncio dinámico.' } };
  }

  return { created: [{ ad_id: adData.id, creative_id: creativeData.id }], failed: 0, firstError: null };
}

// ─── Custom Audience de engagement con la Pagina (para remarketing) ───
// Best-effort: si falla, la fase 2 sigue corriendo con targeting normal.
// Eventos de interaccion de Pagina documentados por Meta (Engagement Custom
// Audiences) que replican lo que el usuario ve en el selector rapido de
// Ads Manager bajo "Interaccion: pagina":
//  - page_post_interaction -> "personas que comentaron o dieron like"
//  - page_engaged          -> "personas que interactuaron con la pagina"
//    (incluye interactuar con cualquier anuncio publicado como post de la
//    pagina, que es como publicamos los nuestros)
//  - page_liked            -> "personas que siguen la cuenta"
//  - page_cta_clicked      -> proxy mas cercano a "publico que indico interes"
//    (alguien que clickeo el boton de CTA del anuncio/pagina)
const PAGE_ENGAGEMENT_EVENTS = ['page_engaged', 'page_post_interaction', 'page_liked', 'page_cta_clicked'];

// ─── Detecta errores de limite de llamadas de Meta (rate limit) para poder
// reintentar una vez — evita que un pico transitorio de trafico (ej. varias
// campañas seguidas) deje el remarketing sin audiencia por accidente ───
function isRateLimitError(error: any): boolean {
  if (!error) return false;
  return error.code === 17 || error.error_subcode === 2446079 || /request limit/i.test(error.message || '');
}

async function createEngagementAudience(params: {
  adAccountId: string;
  pageId: string;
  retentionDays: number;
  name: string;
  token: string;
}): Promise<string | null> {
  const { adAccountId, pageId, retentionDays, name, token } = params;
  const payload = {
    name,
    subtype: 'ENGAGEMENT',
    rule: JSON.stringify({
      inclusions: {
        operator: 'or',
        rules: PAGE_ENGAGEMENT_EVENTS.map(eventName => ({
          event_sources: [{ type: 'page', id: pageId }],
          retention_seconds: Math.max(1, retentionDays) * 86400,
          filter: {
            operator: 'and',
            filters: [{ field: 'event', operator: 'eq', value: eventName }],
          },
        })),
      },
    }),
    access_token: token,
  };
  try {
    let data = await metaPost(`${FB_BASE}/${adAccountId}/customaudiences`, payload);
    if (data.id) return data.id;
    if (isRateLimitError(data.error)) {
      console.warn('⏳ [REMARKETING AUDIENCE] Límite de la API alcanzado, reintentando en 3s...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      data = await metaPost(`${FB_BASE}/${adAccountId}/customaudiences`, payload);
      if (data.id) return data.id;
    }
    console.error('Meta remarketing audience creation was rejected');
    return null;
  } catch {
    console.error('Meta remarketing audience creation failed');
    return null;
  }
}

// ─── Busca audiencias de tipo ENGAGEMENT que ya existan en la cuenta
// publicitaria y que de verdad pertenezcan a ESTA Pagina (no a la de otro
// cliente que haya usado la misma cuenta antes) y esten sanas (no
// "demasiado pequeñas" ni obsoletas) — para sumarlas al remarketing en
// automatico, ademas de la audiencia nueva que crea cada campaña ───
async function findExistingEngagementAudiences(
  adAccountId: string,
  pageId: string,
  token: string,
  excludeId?: string
): Promise<string[]> {
  try {
    const listUrl = `${FB_BASE}/${adAccountId}/customaudiences?fields=id,subtype,delivery_status,rule&limit=200&access_token=${token}`;
    let data = await fetchFacebookJson(listUrl);
    if (!data.data && isRateLimitError(data.error)) {
      console.warn('⏳ [REMARKETING AUDIENCE] Límite de la API alcanzado buscando audiencias existentes, reintentando en 3s...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      data = await fetchFacebookJson(listUrl);
    }
    if (!data.data) return [];

    const matches: string[] = [];
    for (const audience of data.data) {
      if (excludeId && audience.id === excludeId) continue;
      if (audience.subtype !== 'ENGAGEMENT') continue;
      if (audience.delivery_status?.code !== 200) continue; // evita "demasiado pequeña"/obsoleta

      let rule: any = null;
      try { rule = JSON.parse(audience.rule || '{}'); } catch { continue; }
      const rules = rule?.inclusions?.rules || [];
      const belongsToThisPage = rules.some((r: any) =>
        (r.event_sources || []).some((s: any) => String(s.id) === String(pageId))
      );
      if (belongsToThisPage) matches.push(audience.id);
    }
    return matches;
  } catch {
    console.error('Meta remarketing audience lookup failed');
    return [];
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const META_ID_PATTERN = /^[0-9]{5,30}$/;

function isSafeHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isValidPublisherBody(value: Record<string, unknown>): value is Record<string, unknown> & RequestBody {
  if (
    typeof value.campaign_name !== 'string'
    || !value.campaign_name.trim()
    || value.campaign_name.length > 200
    || typeof value.message !== 'string'
    || !value.message.trim()
    || value.message.length > 5_000
  ) return false;
  if (
    value.message_variants !== undefined
    && (
      !Array.isArray(value.message_variants)
      || value.message_variants.length > 12
      || value.message_variants.some(item => typeof item !== 'string' || !item.trim() || item.length > 5_000)
    )
  ) return false;
  if (
    value.creative_assets !== undefined
    && (
      !Array.isArray(value.creative_assets)
      || value.creative_assets.length > 12
      || value.creative_assets.some(asset => {
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return true;
        const candidate = asset as Record<string, unknown>;
        return !isSafeHttpsUrl(candidate.url) || !['image', 'video'].includes(String(candidate.type));
      })
    )
  ) return false;
  if (value.link_url !== undefined && !isSafeHttpsUrl(value.link_url)) return false;
  if (value.image_url !== undefined && !isSafeHttpsUrl(value.image_url)) return false;
  if (value.page_id !== undefined && (typeof value.page_id !== 'string' || !META_ID_PATTERN.test(value.page_id))) return false;
  if (
    value.daily_budget !== undefined
    && (typeof value.daily_budget !== 'number' || !Number.isSafeInteger(value.daily_budget) || value.daily_budget < 100 || value.daily_budget > 100_000_000)
  ) return false;
  if (
    value.duration_days !== undefined
    && (typeof value.duration_days !== 'number' || !Number.isSafeInteger(value.duration_days) || value.duration_days < 1 || value.duration_days > 90)
  ) return false;
  if (value.status !== undefined && value.status !== 'PAUSED' && value.status !== 'ACTIVE') return false;
  if (value.language !== undefined && value.language !== 'es' && value.language !== 'en') return false;
  if (
    value.countries !== undefined
    && (
      !Array.isArray(value.countries)
      || value.countries.length > 25
      || value.countries.some(country => typeof country !== 'string' || !/^[A-Z]{2}$/.test(country))
    )
  ) return false;
  return true;
}

// ─── MAIN: POST handler ──────────────────────────────────
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // ── 0. Config & validation ──────────────────────────
    const { tenantId, token, adAccountId, pageId: envPageId } = await getFacebookCredentials(req);
    const rateDenied = await enforceTenantRateLimit('facebook-publish', tenantId, 4, 5 * 60_000);
    if (rateDenied) return rateDenied;
    const parsedBody = await readLimitedJsonObject(req, 128 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    if (!isValidPublisherBody(parsedBody.body)) {
      return NextResponse.json({
        success: false,
        error: 'La configuracion de la campana es invalida.',
        step: 'config',
      }, { status: 400 });
    }
    const body = parsedBody.body;

    if (!body.campaign_name || !body.message) {
      return NextResponse.json({
        success: false,
        error: 'campaign_name y message son campos requeridos.',
        step: 'config',
      }, { status: 400 });
    }

    const resolvedPageId = body.page_id || envPageId || await fetchPageId(token);
    const objective = validateObjective(body.objective);
    const baseOptimizationGoal = OPT_GOAL_MAP[objective];
    const cta = validateCTA(body.call_to_action);
    const mode = detectTargetingMode(body);
    const status = body.status || 'PAUSED';
    const dailyBudget = Math.max(100, body.daily_budget || 500); // mínimo $1
    const linkUrl = body.link_url || 'https://rifx.online';
    const lang = body.language === 'en' ? 'en' : 'es';
    const durationDays = Math.max(1, Math.min(90, body.duration_days || 30));
    const shouldSplit = durationDays >= 14;
    const messageVariants = buildMessageVariants(body);
    const creativeAssets = buildCreativeAssets(body);

    // Meta exige un "promoted_object" (Pagina, pixel, etc.) segun el objetivo
    // — sin esto rechaza el ad set con "Selecciona un objeto promocionado".
    const { promotedObject, optimizationGoal, destinationType } = await resolvePromotedObject(
      objective, baseOptimizationGoal, body, resolvedPageId, adAccountId, token
    );

    const useDynamicCreative = shouldUseDynamicCreative(objective, destinationType === 'WHATSAPP', dailyBudget, creativeAssets);


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
      ...(promotedObject ? { promoted_object: promotedObject } : {}),
      ...(destinationType ? { destination_type: destinationType } : {}),
      ...(useDynamicCreative ? { is_dynamic_creative: true } : {}),
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

    const ads1 = useDynamicCreative
      ? await createDynamicCreativeAd({
          adAccountId,
          adSetId: adSet1Id,
          pageId: resolvedPageId,
          variants: messageVariants,
          assets: creativeAssets,
          linkUrl,
          cta,
          token,
          campaignName: phase1Name,
        })
      : await createAdsForSet({
      adAccountId,
      adSetId: adSet1Id,
      pageId: resolvedPageId,
      variants: messageVariants,
      assets: creativeAssets,
      linkUrl,
      cta,
      token,
      campaignName: phase1Name,
      isWhatsAppDestination: destinationType === 'WHATSAPP',
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

    // Suma tambien cualquier audiencia de engagement ya existente que
    // pertenezca a esta misma Pagina (no a la de otro cliente que haya
    // usado la cuenta antes) para ampliar el remarketing automaticamente.
    const existingAudienceIds = await findExistingEngagementAudiences(adAccountId, resolvedPageId, token, audienceId || undefined);
    const remarketingAudienceIds = [audienceId, ...existingAudienceIds].filter(Boolean) as string[];
    if (existingAudienceIds.length > 0) {
    }

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

    const targeting2 = buildTargeting(body, mode, remarketingAudienceIds);
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
      ...(promotedObject ? { promoted_object: promotedObject } : {}),
      ...(destinationType ? { destination_type: destinationType } : {}),
      ...(useDynamicCreative ? { is_dynamic_creative: true } : {}),
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

    const ads2 = useDynamicCreative
      ? await createDynamicCreativeAd({
          adAccountId,
          adSetId: adSet2Id,
          pageId: resolvedPageId,
          variants: remarketingVariants,
          assets: creativeAssets,
          linkUrl,
          cta,
          token,
          campaignName: phase2Name,
        })
      : await createAdsForSet({
      adAccountId,
      adSetId: adSet2Id,
      pageId: resolvedPageId,
      variants: remarketingVariants,
      assets: creativeAssets,
      linkUrl,
      cta,
      token,
      campaignName: phase2Name,
      isWhatsAppDestination: destinationType === 'WHATSAPP',
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

  } catch (error) {
    console.error('[RIFX Publisher] Operation failed');
    const failure = getFacebookPublicError(error);
    return NextResponse.json({
      success: false,
      error: failure.error,
      step: 'config',
    }, { status: failure.status });
  }
}
