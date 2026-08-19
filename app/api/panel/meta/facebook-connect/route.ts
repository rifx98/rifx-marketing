import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest, signOAuthState, verifyOAuthState } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { findConflictingTenantForExtendedField } from '@/lib/connection-guard';
import { SECRET_PLACEHOLDER, resolveSecretUpdate } from '@/lib/security';

const GRAPH_VERSION = 'v24.0';
const GRAPH_TIMEOUT_MS = 8_000;
const OAUTH_ACTION = 'meta_ads_connect' as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function getRedirectUri(req: NextRequest): string | null {
  try {
    const configuredOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!configuredOrigin && process.env.NODE_ENV === 'production') return null;
    const origin = new URL(configuredOrigin || req.nextUrl.origin);
    if (!['http:', 'https:'].includes(origin.protocol)) return null;
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') return null;
    return new URL('/panel', `${origin.origin}/`).toString();
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

async function responseJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function parseExtendedConfig(value: unknown): Record<string, any> {
  try {
    const parsed = JSON.parse(typeof value === 'string' ? value : '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapAdAccounts(data: any): any[] {
  if (!Array.isArray(data?.data)) return [];
  return data.data.slice(0, 50).map((account: any) => ({
    id: String(account?.id || ''),
    name: String(account?.name || ''),
    account_status: account?.account_status,
    currency: String(account?.currency || ''),
    timezone: String(account?.timezone_name || ''),
    business: String(account?.business?.name || ''),
  })).filter((account: any) => account.id);
}

function mapPages(data: any): any[] {
  if (!Array.isArray(data?.data)) return [];
  return data.data.slice(0, 50).map((page: any) => ({
    id: String(page?.id || ''),
    name: String(page?.name || ''),
    category: String(page?.category || ''),
    fanCount: page?.fan_count,
    picture: String(page?.picture?.data?.url || ''),
  })).filter((page: any) => page.id);
}

async function listMetaAssets(accessToken: string, limit = 50) {
  const adAccountsUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts`);
  adAccountsUrl.searchParams.set('fields', 'id,name,account_status,currency,timezone_name,business{id,name}');
  adAccountsUrl.searchParams.set('limit', String(limit));

  const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  pagesUrl.searchParams.set('fields', 'id,name,category,fan_count,picture{url}');
  pagesUrl.searchParams.set('limit', String(limit));

  const requestInit: RequestInit = { headers: { Authorization: `Bearer ${accessToken}` } };
  const [adResponse, pagesResponse] = await Promise.all([
    graphFetch(adAccountsUrl, requestInit),
    graphFetch(pagesUrl, requestInit),
  ]);
  const [adData, pagesData] = await Promise.all([
    responseJson(adResponse),
    responseJson(pagesResponse),
  ]);

  if (!adResponse.ok || adData?.error) {
    throw new Error('META_ASSET_LOOKUP_FAILED');
  }

  return {
    adAccounts: mapAdAccounts(adData),
    pages: pagesResponse.ok && !pagesData?.error ? mapPages(pagesData) : [],
  };
}

// List assets with the tenant's server-side token. The credential is never
// included in the response; the sentinel only tells the client it is present.
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);
    const featureDenied = denyUnlessFeature(tenant, 'campaigns');
    if (featureDenied) return featureDenied;

    const supabase = createSupabaseAdmin();
    const { data: config, error } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (error || !config) return json({ error: 'Configuracion no disponible' }, 404);
    const accessToken = parseExtendedConfig(config.openai_key).facebook_access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
      return json({ error: 'Meta Ads no esta conectado para este tenant' }, 400);
    }

    const { adAccounts, pages } = await listMetaAssets(accessToken);
    return json({
      accessToken: SECRET_PLACEHOLDER,
      tokenConfigured: true,
      adAccounts,
      pages,
    });
  } catch {
    console.error('Meta asset lookup failed');
    return json({ error: 'No se pudieron consultar las cuentas de Meta' }, 502);
  }
}

// Issue a tenant/action-bound OAuth state or exchange a callback code. The
// redirect URI is derived exclusively from server configuration.
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);
    const featureDenied = denyUnlessFeature(tenant, 'campaigns');
    if (featureDenied) return featureDenied;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Solicitud invalida' }, 400);

    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = getRedirectUri(req);
    if (!appId || !redirectUri) return json({ error: 'OAuth de Meta no esta configurado' }, 503);

    if (body.action === 'request_state') {
      const state = await signOAuthState({ tenantId: tenant.tenantId, oauthAction: OAUTH_ACTION });
      return json({
        state,
        redirectUri,
        appId,
        configId: process.env.NEXT_PUBLIC_FACEBOOK_ADS_CONFIG_ID || '',
      });
    }

    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const state = typeof body.state === 'string' ? body.state : '';
    if (!code || code.length > 4096 || !state || state.length > 4096) {
      return json({ error: 'Codigo o state OAuth invalido' }, 400);
    }

    const verifiedState = await verifyOAuthState(state);
    if (
      !verifiedState ||
      verifiedState.tenantId !== tenant.tenantId ||
      verifiedState.oauthAction !== OAUTH_ACTION
    ) {
      return json({ error: 'State OAuth invalido o expirado' }, 400);
    }

    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) return json({ error: 'OAuth de Meta no esta configurado' }, 503);

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenResponse = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams,
      },
    );
    const tokenData = await responseJson(tokenResponse);
    if (!tokenResponse.ok || typeof tokenData?.access_token !== 'string') {
      return json({ error: 'No se pudo completar la autorizacion con Meta' }, 400);
    }

    const longTokenParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: tokenData.access_token,
    });
    const longTokenResponse = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: longTokenParams,
      },
    );
    const longTokenData = await responseJson(longTokenResponse);
    const accessToken = longTokenResponse.ok && typeof longTokenData?.access_token === 'string'
      ? longTokenData.access_token
      : tokenData.access_token;

    // Persist before returning assets, so subsequent PUT requests can submit
    // only SECRET_PLACEHOLDER and never echo the provider token through JS.
    const supabase = createSupabaseAdmin();
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();
    if (configError || !config) return json({ error: 'Configuracion no disponible' }, 404);

    const extendedConfig = parseExtendedConfig(config.openai_key);
    const { error: saveError } = await supabase
      .from('config')
      .update({
        openai_key: JSON.stringify({
          ...extendedConfig,
          facebook_access_token: accessToken,
          meta_oauth_token_updated_at: new Date().toISOString(),
        }),
      })
      .eq('tenant_id', tenant.tenantId);
    if (saveError) return json({ error: 'No se pudo guardar la conexion de Meta' }, 500);

    const { adAccounts, pages } = await listMetaAssets(accessToken, 20);
    return json({
      accessToken: SECRET_PLACEHOLDER,
      tokenConfigured: true,
      adAccounts,
      pages,
      adAccountCount: adAccounts.length,
      pageCount: pages.length,
    });
  } catch {
    console.error('Meta OAuth request failed');
    return json({ error: 'No se pudo completar la conexion con Meta' }, 502);
  }
}

// Save the selected Ad Account and Page. The token normally arrives as the
// sentinel and is resolved exclusively against the tenant's stored secret.
export async function PUT(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);
    const featureDenied = denyUnlessFeature(tenant, 'campaigns');
    if (featureDenied) return featureDenied;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Solicitud invalida' }, 400);
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
    const adAccountId = typeof body.adAccountId === 'string' ? body.adAccountId.trim() : '';
    const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
    if (
      accessToken !== SECRET_PLACEHOLDER ||
      !/^act_\d+$/.test(adAccountId) ||
      (pageId && !/^\d+$/.test(pageId))
    ) {
      return json({ error: 'Cuenta publicitaria o pagina invalida' }, 400);
    }

    const tenantId = tenant.tenantId;
    const supabase = createSupabaseAdmin();
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    if (configError || !config) return json({ error: 'Configuracion no disponible' }, 404);

    const conflictingAdAccount = await findConflictingTenantForExtendedField(
      supabase,
      tenantId,
      'facebook_ad_account_id',
      adAccountId,
    );
    if (conflictingAdAccount) {
      return json({ error: 'Esta cuenta publicitaria de Meta ya esta conectada a otra cuenta.' }, 409);
    }
    if (pageId) {
      const conflictingPage = await findConflictingTenantForExtendedField(
        supabase,
        tenantId,
        'facebook_page_id',
        pageId,
      );
      if (conflictingPage) return json({ error: 'Esta pagina de Facebook ya esta conectada a otra cuenta.' }, 409);
    }

    const extendedConfig = parseExtendedConfig(config.openai_key);
    const resolvedAccessToken = resolveSecretUpdate(accessToken, extendedConfig.facebook_access_token || '');
    if (!resolvedAccessToken) return json({ error: 'Token de Meta requerido' }, 400);

    const verifyResponse = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(adAccountId)}?fields=name,account_status`,
      { headers: { Authorization: `Bearer ${resolvedAccessToken}` } },
    );
    const verifyData = await responseJson(verifyResponse);
    if (!verifyResponse.ok || verifyData?.error || !verifyData?.name) {
      return json({ error: 'No se pudo verificar la cuenta publicitaria seleccionada' }, 400);
    }

    const { error: saveError } = await supabase
      .from('config')
      .update({
        openai_key: JSON.stringify({
          ...extendedConfig,
          facebook_access_token: resolvedAccessToken,
          facebook_ad_account_id: adAccountId,
          facebook_page_id: pageId,
          meta_connected_via: 'facebook_oauth',
          meta_ad_account_name: String(body.adAccountName || '').slice(0, 200),
          meta_page_name: String(body.pageName || '').slice(0, 200),
          meta_connected_at: new Date().toISOString(),
        }),
      })
      .eq('tenant_id', tenantId);
    if (saveError) return json({ error: 'No se pudo guardar la conexion de Meta' }, 500);

    return json({
      success: true,
      verified: true,
      adAccountName: String(verifyData.name).slice(0, 200),
      message: 'Meta Ads conectado exitosamente',
    });
  } catch {
    console.error('Meta connection save failed');
    return json({ error: 'No se pudo guardar la conexion de Meta' }, 502);
  }
}
