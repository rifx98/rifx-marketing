import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest, signOAuthState, verifyOAuthState } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { SECRET_PLACEHOLDER, resolveSecretUpdate } from '@/lib/security';

const GRAPH_VERSION = 'v24.0';
const GRAPH_TIMEOUT_MS = 8_000;
const OAUTH_ACTION = 'whatsapp_connect' as const;
const MAX_BUSINESSES = 10;
const MAX_PHONE_OPTIONS = 100;

type JsonObject = Record<string, unknown>;

interface PhoneOption {
  wabaId: string;
  wabaName: string;
  phoneNumberId: string;
  displayPhone: string;
  verifiedName: string;
  status: string;
  qualityRating: string;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asString(value: unknown, maxLength = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getAppOrigin(req: NextRequest): string | null {
  try {
    const configuredOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!configuredOrigin && process.env.NODE_ENV === 'production') return null;
    const url = new URL(configuredOrigin || req.nextUrl.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function graphFetch(input: string | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
}

async function responseJson(response: Response): Promise<JsonObject> {
  try {
    return asObject(await response.json());
  } catch {
    return {};
  }
}

function extractWabas(data: JsonObject): JsonObject[] {
  const entries = asObject(data).data;
  return Array.isArray(entries) ? entries.map(asObject) : [];
}

function addPhoneOptions(
  data: JsonObject,
  options: PhoneOption[],
  seenWabaIds: Set<string>,
) {
  for (const account of extractWabas(data)) {
    const wabaId = asString(account.id, 64);
    if (!/^\d+$/.test(wabaId) || seenWabaIds.has(wabaId)) continue;
    seenWabaIds.add(wabaId);

    const phones = asObject(account.phone_numbers).data;
    if (!Array.isArray(phones)) continue;
    for (const rawPhone of phones) {
      if (options.length >= MAX_PHONE_OPTIONS) return;
      const phone = asObject(rawPhone);
      const phoneNumberId = asString(phone.id, 64);
      if (!/^\d+$/.test(phoneNumberId)) continue;
      options.push({
        wabaId,
        wabaName: asString(account.name),
        phoneNumberId,
        displayPhone: asString(phone.display_phone_number, 50),
        verifiedName: asString(phone.verified_name),
        status: asString(phone.status, 50),
        qualityRating: asString(phone.quality_rating, 50),
      });
    }
  }
}

async function listWhatsAppPhones(accessToken: string) {
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const businessesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/businesses`);
  businessesUrl.searchParams.set('fields', 'id,name');
  businessesUrl.searchParams.set('limit', String(MAX_BUSINESSES));

  let businessesResponse: Response;
  try {
    businessesResponse = await graphFetch(businessesUrl, { headers: authHeaders });
  } catch {
    return { phoneOptions: [] as PhoneOption[], accountCount: 0, lookupIncomplete: true };
  }
  const businessesData = await responseJson(businessesResponse);
  const rawBusinesses = businessesData.data;
  if (!businessesResponse.ok || !Array.isArray(rawBusinesses)) {
    return { phoneOptions: [] as PhoneOption[], accountCount: 0, lookupIncomplete: true };
  }

  const businessIds = rawBusinesses
    .map((business) => asString(asObject(business).id, 64))
    .filter((id) => /^\d+$/.test(id))
    .slice(0, MAX_BUSINESSES);
  const wabaFields = 'id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,status}';

  const lookups = await Promise.all(businessIds.flatMap((businessId) => {
    return ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts'].map(async (edge) => {
      try {
        const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${businessId}/${edge}`);
        url.searchParams.set('fields', wabaFields);
        url.searchParams.set('limit', '50');
        const response = await graphFetch(url, { headers: authHeaders });
        return { ok: response.ok, data: await responseJson(response) };
      } catch {
        return { ok: false, data: {} as JsonObject };
      }
    });
  }));

  const phoneOptions: PhoneOption[] = [];
  const seenWabaIds = new Set<string>();
  for (const lookup of lookups) {
    if (lookup.ok && !lookup.data.error) addPhoneOptions(lookup.data, phoneOptions, seenWabaIds);
  }

  return {
    phoneOptions,
    accountCount: seenWabaIds.size,
    lookupIncomplete: lookups.some((lookup) => !lookup.ok || Boolean(lookup.data.error)),
  };
}

// Issue a tenant/action-bound OAuth state or exchange the callback code. The
// redirect URI and provider credentials are controlled exclusively server-side.
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const body = asObject(await req.json().catch(() => null));
    if (Object.keys(body).length === 0) return json({ error: 'Solicitud invalida' }, 400);

    const appId = process.env.FACEBOOK_APP_ID;
    const appOrigin = getAppOrigin(req);
    if (!appId || !appOrigin) return json({ error: 'OAuth de WhatsApp no esta configurado' }, 503);
    const redirectUri = `${appOrigin}/panel`;

    if (body.action === 'request_state') {
      const state = await signOAuthState({ tenantId: tenant.tenantId, oauthAction: OAUTH_ACTION });
      return json({
        state,
        redirectUri,
        appId,
        configId: process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID || '',
      });
    }

    const code = asString(body.code, 4096);
    const state = asString(body.state, 4096);
    if (!code || !state) return json({ error: 'Codigo o state OAuth invalido' }, 400);

    const verifiedState = await verifyOAuthState(state);
    if (
      !verifiedState ||
      verifiedState.tenantId !== tenant.tenantId ||
      verifiedState.oauthAction !== OAUTH_ACTION
    ) {
      return json({ error: 'State OAuth invalido o expirado' }, 400);
    }

    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) return json({ error: 'OAuth de WhatsApp no esta configurado' }, 503);

    const tokenResponse = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }),
      },
    );
    const tokenData = await responseJson(tokenResponse);
    const shortToken = asString(tokenData.access_token, 8192);
    if (!tokenResponse.ok || !shortToken) {
      return json({ error: 'No se pudo completar la autorizacion con WhatsApp' }, 400);
    }

    const longTokenResponse = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        }),
      },
    );
    const longTokenData = await responseJson(longTokenResponse);
    const accessToken = longTokenResponse.ok
      ? asString(longTokenData.access_token, 8192) || shortToken
      : shortToken;

    // Persist the credential before sending any response. Browser code only
    // receives SECRET_PLACEHOLDER and can never read the provider token back.
    const supabase = createSupabaseAdmin();
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('tenant_id')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();
    if (configError || !config) return json({ error: 'Configuracion no disponible' }, 404);

    const { error: saveError } = await supabase
      .from('config')
      .update({ whatsapp_token: accessToken })
      .eq('tenant_id', tenant.tenantId);
    if (saveError) return json({ error: 'No se pudo guardar la conexion de WhatsApp' }, 500);

    const { phoneOptions, accountCount, lookupIncomplete } = await listWhatsAppPhones(accessToken);
    return json({
      accessToken: SECRET_PLACEHOLDER,
      tokenConfigured: true,
      phoneOptions,
      accountCount,
      message: phoneOptions.length === 0
        ? 'Token guardado. Ingresa tu Phone Number ID manualmente.'
        : undefined,
      warning: lookupIncomplete
        ? 'La conexion se guardo, pero Meta no devolvio todas las cuentas disponibles.'
        : undefined,
    });
  } catch {
    console.error('WhatsApp OAuth request failed');
    return json({ error: 'No se pudo completar la conexion con WhatsApp' }, 502);
  }
}

// Save the selected phone number. The token must be the public sentinel and is
// resolved only against the authenticated tenant's server-side configuration.
export async function PUT(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const body = asObject(await req.json().catch(() => null));
    const phoneNumberId = asString(body.phoneNumberId, 64);
    const accessTokenInput = asString(body.accessToken, 128);
    const wabaId = asString(body.wabaId, 64);
    const displayPhone = asString(body.displayPhone, 50);
    const verifiedName = asString(body.verifiedName);
    if (
      !/^\d+$/.test(phoneNumberId) ||
      (wabaId && !/^\d+$/.test(wabaId)) ||
      accessTokenInput !== SECRET_PLACEHOLDER
    ) {
      return json({ error: 'Numero o referencia de conexion invalida' }, 400);
    }

    const tenantId = tenant.tenantId;
    const supabase = createSupabaseAdmin();
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key, whatsapp_token')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    if (configError || !config) return json({ error: 'Configuracion no disponible' }, 404);

    const { data: conflictingConfig, error: conflictError } = await supabase
      .from('config')
      .select('tenant_id')
      .eq('whatsapp_phone_id', phoneNumberId)
      .neq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    if (conflictError) return json({ error: 'No se pudo validar la conexion' }, 500);
    if (conflictingConfig) {
      return json({ error: 'Este numero de WhatsApp ya esta conectado a otra cuenta.' }, 409);
    }

    const resolvedAccessToken = resolveSecretUpdate(accessTokenInput, config.whatsapp_token || '');
    if (!resolvedAccessToken) return json({ error: 'Token de WhatsApp requerido' }, 400);

    const verifyUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`);
    verifyUrl.searchParams.set('fields', 'id,display_phone_number,verified_name');
    const verifyResponse = await graphFetch(verifyUrl, {
      headers: { Authorization: `Bearer ${resolvedAccessToken}` },
    });
    const verifyData = await responseJson(verifyResponse);
    if (!verifyResponse.ok || asString(verifyData.id, 64) !== phoneNumberId) {
      return json({ error: 'No se pudo verificar el numero de WhatsApp seleccionado' }, 400);
    }

    let extendedConfig: JsonObject = {};
    try {
      extendedConfig = asObject(JSON.parse(typeof config.openai_key === 'string' ? config.openai_key : '{}'));
    } catch {
      extendedConfig = {};
    }

    const { error: updateError } = await supabase
      .from('config')
      .update({
        whatsapp_token: resolvedAccessToken,
        whatsapp_phone_id: phoneNumberId,
        openai_key: JSON.stringify({
          ...extendedConfig,
          wa_connected_via: 'facebook_oauth',
          wa_waba_id: wabaId,
          wa_display_phone: displayPhone,
          wa_verified_name: verifiedName,
          wa_connected_at: new Date().toISOString(),
        }),
      })
      .eq('tenant_id', tenantId);
    if (updateError) return json({ error: 'No se pudo guardar la conexion de WhatsApp' }, 500);

    // Register the callback and bind the selected WABA to this app. Credentials
    // stay in Authorization headers and every provider request has a timeout.
    let webhookSubscribed = false;
    let webhookSubscribeError = '';
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const appOrigin = getAppOrigin(req);
    if (!appId || !appSecret || !verifyToken || !appOrigin) {
      webhookSubscribeError = 'La configuracion del webhook esta incompleta en el servidor.';
    } else if (!wabaId) {
      webhookSubscribeError = 'No se recibio el identificador WABA para activar mensajes entrantes.';
    } else {
      try {
        const appSubscriptionResponse = await graphFetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/subscriptions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${appId}|${appSecret}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              object: 'whatsapp_business_account',
              callback_url: `${appOrigin}/api/whatsapp`,
              verify_token: verifyToken,
              fields: 'messages',
            }),
          },
        );
        const appSubscriptionData = await responseJson(appSubscriptionResponse);
        if (!appSubscriptionResponse.ok || appSubscriptionData.error) {
          webhookSubscribeError = 'No se pudo registrar el webhook de WhatsApp en Meta.';
        } else {
          const wabaSubscriptionResponse = await graphFetch(
            `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${resolvedAccessToken}` },
            },
          );
          const wabaSubscriptionData = await responseJson(wabaSubscriptionResponse);
          if (!wabaSubscriptionResponse.ok || wabaSubscriptionData.error) {
            webhookSubscribeError = 'No se pudo asociar el WABA con esta aplicacion.';
          } else {
            webhookSubscribed = true;
          }
        }
      } catch {
        webhookSubscribeError = 'No se pudo completar la suscripcion del webhook.';
      }
    }

    return json({
      success: true,
      verified: true,
      webhookSubscribed,
      webhookSubscribeError: webhookSubscribed ? undefined : webhookSubscribeError,
      phoneNumber: asString(verifyData.display_phone_number, 50) || displayPhone,
      message: webhookSubscribed
        ? 'WhatsApp conectado exitosamente'
        : 'WhatsApp guardado; revisa la activacion de mensajes entrantes',
    });
  } catch {
    console.error('WhatsApp connection save failed');
    return json({ error: 'No se pudo guardar la conexion de WhatsApp' }, 502);
  }
}
