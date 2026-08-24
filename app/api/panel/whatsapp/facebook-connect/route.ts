import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest, signOAuthState, verifyOAuthState } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { SECRET_PLACEHOLDER, resolveSecretUpdate } from '@/lib/security';
import { buildOAuthRedirectUri, resolveOAuthAppOrigin } from '@/lib/social-oauth';
import {
  enforceTenantRateLimit,
  readLimitedJsonObject,
  readLimitedResponseJson,
} from '@/lib/request-guards';

const GRAPH_VERSION = 'v24.0';
const GRAPH_TIMEOUT_MS = 8_000;
const OAUTH_ACTION = 'whatsapp_connect' as const;
const FACEBOOK_APP_ID_PATTERN = /^\d{5,32}$/;
const MAX_BUSINESSES = 10;

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

interface ConnectionResult {
  body: JsonObject;
  status: number;
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
    return asObject(await readLimitedResponseJson(response));
  } catch {
    return {};
  }
}

function whatsappConfigId(): string {
  const configured = process.env.FACEBOOK_WHATSAPP_CONFIG_ID
    || process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID
    || '';
  return configured.trim();
}

async function lookupSelectedPhone(
  accessToken: string,
  wabaId: string,
  phoneNumberId: string,
): Promise<PhoneOption | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}`);
  url.searchParams.set(
    'fields',
    'id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,status}',
  );
  const response = await graphFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const account = await responseJson(response);
  if (!response.ok || asString(account.id, 64) !== wabaId) return null;

  const phones = asObject(account.phone_numbers).data;
  if (!Array.isArray(phones)) return null;
  const rawPhone = phones.map(asObject).find((phone) => asString(phone.id, 64) === phoneNumberId);
  if (!rawPhone) return null;

  return {
    wabaId,
    wabaName: asString(account.name),
    phoneNumberId,
    displayPhone: asString(rawPhone.display_phone_number, 50),
    verifiedName: asString(rawPhone.verified_name),
    status: asString(rawPhone.status, 50),
    qualityRating: asString(rawPhone.quality_rating, 50),
  };
}

function parseExtendedConfig(value: unknown): JsonObject {
  if (typeof value !== 'string' || !value) return {};
  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function addPhoneOptions(
  wabaData: JsonObject,
  out: PhoneOption[],
  seen: Set<string>,
): void {
  const items = Array.isArray(wabaData.data) ? wabaData.data : [];
  for (const rawWaba of items) {
    const waba = asObject(rawWaba);
    const wabaId = asString(waba.id, 64);
    if (!wabaId || seen.has(wabaId)) continue;
    seen.add(wabaId);
    const phones = asObject(waba.phone_numbers).data;
    if (!Array.isArray(phones)) continue;
    for (const rawPhone of phones) {
      const phone = asObject(rawPhone);
      const phoneNumberId = asString(phone.id, 64);
      if (!phoneNumberId) continue;
      out.push({
        wabaId,
        wabaName: asString(waba.name),
        phoneNumberId,
        displayPhone: asString(phone.display_phone_number, 50),
        verifiedName: asString(phone.verified_name),
        status: asString(phone.status, 50),
        qualityRating: asString(phone.quality_rating, 50),
      });
    }
  }
}

async function listWhatsAppPhones(accessToken: string): Promise<{
  phoneOptions: PhoneOption[];
  accountCount: number;
  lookupIncomplete: boolean;
}> {
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

async function subscribeWhatsAppWebhooks(
  accessToken: string,
  wabaId: string,
): Promise<{ webhookSubscribed: boolean; webhookSubscribeError: string }> {
  const appId = typeof process.env.FACEBOOK_APP_ID === 'string'
    ? process.env.FACEBOOK_APP_ID.trim()
    : '';
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const appOrigin = resolveOAuthAppOrigin();
  if (!FACEBOOK_APP_ID_PATTERN.test(appId) || !appSecret || !verifyToken || !appOrigin) {
    return {
      webhookSubscribed: false,
      webhookSubscribeError: 'La configuracion del webhook esta incompleta en el servidor.',
    };
  }

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
          callback_url: buildOAuthRedirectUri(appOrigin, '/api/whatsapp'),
          verify_token: verifyToken,
          fields: 'messages',
        }),
      },
    );
    const appSubscriptionData = await responseJson(appSubscriptionResponse);
    if (!appSubscriptionResponse.ok || appSubscriptionData.success !== true) {
      return {
        webhookSubscribed: false,
        webhookSubscribeError: 'No se pudo registrar el webhook de WhatsApp en Meta.',
      };
    }

    const wabaSubscriptionResponse = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const wabaSubscriptionData = await responseJson(wabaSubscriptionResponse);
    if (!wabaSubscriptionResponse.ok || wabaSubscriptionData.success !== true) {
      return {
        webhookSubscribed: false,
        webhookSubscribeError: 'No se pudo asociar el WABA con esta aplicacion.',
      };
    }
    return { webhookSubscribed: true, webhookSubscribeError: '' };
  } catch {
    return {
      webhookSubscribed: false,
      webhookSubscribeError: 'No se pudo completar la suscripcion del webhook.',
    };
  }
}

async function connectPhoneForTenant(
  tenantId: string,
  accessToken: string,
  wabaId: string,
  phoneNumberId: string,
  businessId: string,
): Promise<ConnectionResult> {
  const verifiedPhone = await lookupSelectedPhone(accessToken, wabaId, phoneNumberId);
  if (!verifiedPhone) {
    return {
      body: { error: 'No se pudo verificar el numero seleccionado con la cuenta autorizada' },
      status: 400,
    };
  }

  const supabase = createSupabaseAdmin();
  const { data: config, error: configError } = await supabase
    .from('config')
    .select('openai_key')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();
  if (configError || !config) {
    return { body: { error: 'Configuracion no disponible' }, status: 404 };
  }

  const { data: conflictingConfig, error: conflictError } = await supabase
    .from('config')
    .select('tenant_id')
    .eq('whatsapp_phone_id', phoneNumberId)
    .neq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();
  if (conflictError) return { body: { error: 'No se pudo validar la conexion' }, status: 500 };
  if (conflictingConfig) {
    return {
      body: { error: 'Este numero de WhatsApp ya esta conectado a otra cuenta.' },
      status: 409,
    };
  }

  const extendedConfig = parseExtendedConfig(config.openai_key);
  const { error: updateError } = await supabase
    .from('config')
    .update({
      whatsapp_token: accessToken,
      whatsapp_phone_id: phoneNumberId,
      wa_display_phone: verifiedPhone.displayPhone || null,
      openai_key: JSON.stringify({
        ...extendedConfig,
        wa_connected_via: 'facebook_embedded_signup',
        wa_business_id: businessId || undefined,
        wa_waba_id: wabaId,
        wa_verified_name: verifiedPhone.verifiedName,
        wa_connected_at: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);
  if (updateError) {
    if (updateError.code === '23505') {
      return {
        body: { error: 'Este numero de WhatsApp ya esta conectado a otra cuenta.' },
        status: 409,
      };
    }
    return { body: { error: 'No se pudo guardar la conexion de WhatsApp' }, status: 500 };
  }

  const { webhookSubscribed, webhookSubscribeError } = await subscribeWhatsAppWebhooks(
    accessToken,
    wabaId,
  );
  return {
    body: {
      success: true,
      verified: true,
      accessToken: SECRET_PLACEHOLDER,
      tokenConfigured: true,
      phoneNumberId,
      wabaId,
      phoneNumber: verifiedPhone.displayPhone,
      webhookSubscribed,
      webhookSubscribeError: webhookSubscribed ? undefined : webhookSubscribeError,
      message: webhookSubscribed
        ? 'WhatsApp conectado exitosamente'
        : 'WhatsApp guardado; revisa la activacion de mensajes entrantes',
    },
    status: 200,
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

    const parsedBody = await readLimitedJsonObject(req, 16 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    if (Object.keys(body).length === 0) return json({ error: 'Solicitud invalida' }, 400);

    const appId = typeof process.env.FACEBOOK_APP_ID === 'string'
      ? process.env.FACEBOOK_APP_ID.trim()
      : '';
    const appOrigin = resolveOAuthAppOrigin();
    if (!FACEBOOK_APP_ID_PATTERN.test(appId)) {
      return json({ error: 'OAuth de WhatsApp no esta configurado: revisa FACEBOOK_APP_ID.' }, 503);
    }
    if (!appOrigin) {
      return json({ error: 'OAuth de WhatsApp no esta configurado: revisa APP_URL.' }, 503);
    }
    const redirectUri = buildOAuthRedirectUri(appOrigin, '/panel');
    const configId = typeof process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID === 'string'
      ? process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID.trim()
      : '';

    if (body.action === 'request_state') {
      const state = await signOAuthState({ tenantId: tenant.tenantId, oauthAction: OAUTH_ACTION });
      return json({
        state,
        redirectUri,
        appId,
        configId: FACEBOOK_APP_ID_PATTERN.test(configId) ? configId : '',
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

    // Annotate which phone numbers are already connected to a DIFFERENT tenant.
    // A number must only be connectable by one tenant at a time.
    let annotatedPhoneOptions = phoneOptions;
    if (phoneOptions.length > 0) {
      const phoneIds = phoneOptions.map((p) => p.phoneNumberId);
      const { data: takenConfigs } = await supabase
        .from('config')
        .select('whatsapp_phone_id')
        .in('whatsapp_phone_id', phoneIds)
        .neq('tenant_id', tenant.tenantId);

      const takenByOthers = new Set(
        (takenConfigs || []).map((c: { whatsapp_phone_id: string }) => c.whatsapp_phone_id),
      );

      annotatedPhoneOptions = phoneOptions.map((p) => ({
        ...p,
        takenByAnotherTenant: takenByOthers.has(p.phoneNumberId),
      }));
    }

    return json({
      accessToken: SECRET_PLACEHOLDER,
      tokenConfigured: true,
      phoneOptions: annotatedPhoneOptions,
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

    const parsedBody = await readLimitedJsonObject(req, 16 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const phoneNumberId = asString(body.phoneNumberId, 64);
    const accessTokenInput = asString(body.accessToken, 128);
    const wabaId = asString(body.wabaId, 64);
    if (
      !/^\d+$/.test(phoneNumberId) ||
      !/^\d+$/.test(wabaId) ||
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

    // Never trust WABA or display metadata supplied by the browser. Resolve
    // the exact phone/WABA pair again with the tenant's server-side token.
    const option = await lookupSelectedPhone(resolvedAccessToken, wabaId, phoneNumberId);
    // Cross-check that the verified option exactly matches what the client requested.
    const verifiedPhone = option && (option.phoneNumberId === phoneNumberId && option.wabaId === wabaId)
      ? option
      : null;
    if (!verifiedPhone) {
      return json({ error: 'No se pudo verificar que el numero pertenezca a la cuenta de WhatsApp seleccionada' }, 400);
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
          wa_display_phone: verifiedPhone.displayPhone,
          wa_verified_name: verifiedPhone.verifiedName,
          wa_connected_at: new Date().toISOString(),
        }),
      })
      .eq('tenant_id', tenantId);
    if (updateError) return json({ error: 'No se pudo guardar la conexion de WhatsApp' }, 500);

    // Register the callback and bind the selected WABA to this app. Credentials
    // stay in Authorization headers and every provider request has a timeout.
    let webhookSubscribed = false;
    let webhookSubscribeError = '';
    const appId = typeof process.env.FACEBOOK_APP_ID === 'string'
      ? process.env.FACEBOOK_APP_ID.trim()
      : '';
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const appOrigin = resolveOAuthAppOrigin();
    if (!FACEBOOK_APP_ID_PATTERN.test(appId) || !appSecret || !verifyToken || !appOrigin) {
      webhookSubscribeError = 'La configuracion del webhook esta incompleta en el servidor.';
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
              callback_url: buildOAuthRedirectUri(appOrigin, '/api/whatsapp'),
              verify_token: verifyToken,
              fields: 'messages',
            }),
          },
        );
        const appSubscriptionData = await responseJson(appSubscriptionResponse);
        if (!appSubscriptionResponse.ok || appSubscriptionData.success !== true) {
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
          if (!wabaSubscriptionResponse.ok || wabaSubscriptionData.success !== true) {
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
      phoneNumber: verifiedPhone.displayPhone,
      message: webhookSubscribed
        ? 'WhatsApp conectado exitosamente'
        : 'WhatsApp guardado; revisa la activacion de mensajes entrantes',
    });
  } catch {
    console.error('WhatsApp connection save failed');
    return json({ error: 'No se pudo guardar la conexion de WhatsApp' }, 502);
  }
}
