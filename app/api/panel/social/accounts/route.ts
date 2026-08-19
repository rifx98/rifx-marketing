import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest, signOAuthState } from '@/lib/auth';
import { encryptToken, decryptToken } from '@/lib/encryption';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  MAX_SOCIAL_ACCOUNTS,
  SOCIAL_OAUTH_ACTION,
  boundedProfileUrl,
  boundedProviderId,
  boundedProviderName,
  boundedProviderToken,
  buildOAuthRedirectUri,
  buildPanelRedirect,
  fetchOAuthJson,
  isValidOAuthCode,
  isValidUuid,
  oauthTenantCanUseFeature,
  readLimitedJsonBody,
  resolveOAuthAppOrigin,
  tokenExpiryFromSeconds,
  verifySocialOAuthState,
} from '@/lib/social-oauth';

const META_API_VERSION = 'v19.0';
const META_BASE_URL = 'https://graph.facebook.com';
const AUTH_PLATFORMS = new Set([
  'meta',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'google_calendar',
]);
const MANUAL_PLATFORMS = new Set([
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'google_calendar',
]);

interface MetaTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
}

interface MetaPage {
  id?: unknown;
  name?: unknown;
  access_token?: unknown;
  picture?: { data?: { url?: unknown } };
  instagram_business_account?: {
    id?: unknown;
    username?: unknown;
    profile_picture_url?: unknown;
  };
}

interface MetaPagesResponse {
  data?: MetaPage[];
  error?: unknown;
}

interface MetaAdAccountsResponse {
  data?: Array<{ id?: unknown }>;
  error?: unknown;
}

interface MetaPictureResponse {
  picture?: { data?: { url?: unknown } };
  profile_picture_url?: unknown;
  error?: unknown;
}

function jsonResponse(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function handleMetaCallback(
  code: string,
  state: string,
  appOrigin: string,
): Promise<NextResponse> {
  try {
    const tenantId = await verifySocialOAuthState(state);
    if (!tenantId) {
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'invalid_state' }));
    }

    const supabase = createSupabaseAdmin();
    if (!await oauthTenantCanUseFeature(supabase, tenantId, 'social')) {
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'access_denied' }));
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      console.error('[Meta OAuth] Provider configuration unavailable');
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'oauth_unavailable' }));
    }
    const redirectUri = buildOAuthRedirectUri(appOrigin, '/api/panel/social/accounts');

    // Meta supports POST for these exchanges. Credentials and tokens must not
    // be placed in URLs where proxies, analytics and access logs can retain them.
    const shortTokenResult = await fetchOAuthJson<MetaTokenResponse>(
      `${META_BASE_URL}/${META_API_VERSION}/oauth/access_token`,
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
    const shortToken = boundedProviderToken(shortTokenResult.data.access_token);
    if (!shortTokenResult.ok || shortTokenResult.data.error || !shortToken) {
      throw new Error('provider_exchange_failed');
    }

    const longTokenResult = await fetchOAuthJson<MetaTokenResponse>(
      `${META_BASE_URL}/${META_API_VERSION}/oauth/access_token`,
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
    const userToken = boundedProviderToken(longTokenResult.data.access_token);
    if (!longTokenResult.ok || longTokenResult.data.error || !userToken) {
      throw new Error('provider_exchange_failed');
    }
    const tokenExpiresAt = tokenExpiryFromSeconds(longTokenResult.data.expires_in);

    const pagesUrl = new URL(`${META_BASE_URL}/${META_API_VERSION}/me/accounts`);
    pagesUrl.searchParams.set(
      'fields',
      'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}',
    );
    pagesUrl.searchParams.set('limit', String(MAX_SOCIAL_ACCOUNTS));
    const pagesResult = await fetchOAuthJson<MetaPagesResponse>(pagesUrl, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!pagesResult.ok || pagesResult.data.error || !Array.isArray(pagesResult.data.data)) {
      throw new Error('provider_profile_failed');
    }
    const pages = pagesResult.data.data.slice(0, MAX_SOCIAL_ACCOUNTS);

    let defaultAdAccountId = '';
    try {
      const adAccountsUrl = new URL(`${META_BASE_URL}/${META_API_VERSION}/me/adaccounts`);
      adAccountsUrl.searchParams.set('fields', 'id');
      adAccountsUrl.searchParams.set('limit', String(MAX_SOCIAL_ACCOUNTS));
      const adAccountsResult = await fetchOAuthJson<MetaAdAccountsResponse>(adAccountsUrl, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (adAccountsResult.ok && !adAccountsResult.data.error) {
        defaultAdAccountId = boundedProviderId(adAccountsResult.data.data?.[0]?.id) || '';
      }
    } catch {
      console.error('[Meta OAuth] Optional ad-account lookup failed');
    }

    const defaultPageId = boundedProviderId(pages[0]?.id) || '';
    const { data: existingConfig, error: configLookupError } = await supabase
      .from('config')
      .select('id,openai_key')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    if (configLookupError) throw new Error('persistence_failed');

    const currentConfig = decodeExtendedConfig(existingConfig?.openai_key || '');
    const updatedOpenaiKey = encodeExtendedConfig({
      ...currentConfig,
      facebook_access_token: userToken,
      facebook_page_id: defaultPageId || currentConfig.facebook_page_id,
      facebook_ad_account_id: defaultAdAccountId || currentConfig.facebook_ad_account_id,
    });
    const configUpdate = existingConfig
      ? await supabase
        .from('config')
        .update({ openai_key: updatedOpenaiKey, updated_at: new Date().toISOString() })
        .eq('id', existingConfig.id)
        .eq('tenant_id', tenantId)
      : await supabase
        .from('config')
        .insert({
          tenant_id: tenantId,
          openai_key: updatedOpenaiKey,
          updated_at: new Date().toISOString(),
        });
    if (configUpdate.error) throw new Error('persistence_failed');

    for (const page of pages) {
      const pageId = boundedProviderId(page.id);
      const pageToken = boundedProviderToken(page.access_token);
      if (!pageId || !pageToken) continue;

      const pageEncryption = encryptToken(pageToken);
      const { error: pageError } = await supabase
        .from('social_accounts')
        .upsert({
          tenant_id: tenantId,
          platform: 'facebook',
          platform_user_id: pageId,
          platform_username: boundedProviderName(page.name, 'Facebook Page'),
          profile_picture_url: boundedProfileUrl(page.picture?.data?.url),
          encrypted_access_token: pageEncryption.ciphertext,
          encrypted_refresh_token: null,
          encryption_iv: pageEncryption.iv,
          encryption_tag: pageEncryption.tag,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,platform,platform_user_id',
        });
      if (pageError) throw new Error('persistence_failed');

      const instagram = page.instagram_business_account;
      const instagramId = boundedProviderId(instagram?.id);
      if (!instagramId) continue;
      const instagramEncryption = encryptToken(userToken);
      const { error: instagramError } = await supabase
        .from('social_accounts')
        .upsert({
          tenant_id: tenantId,
          platform: 'instagram',
          platform_user_id: instagramId,
          platform_username: boundedProviderName(instagram?.username, 'Instagram account'),
          profile_picture_url: boundedProfileUrl(instagram?.profile_picture_url),
          encrypted_access_token: instagramEncryption.ciphertext,
          encrypted_refresh_token: null,
          encryption_iv: instagramEncryption.iv,
          encryption_tag: instagramEncryption.tag,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,platform,platform_user_id',
        });
      if (instagramError) throw new Error('persistence_failed');
    }

    return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { success: 'oauth_success' }));
  } catch {
    console.error('[Meta OAuth] Callback failed');
    return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'oauth_failed' }));
  }
}

// List linked accounts, or handle Meta's OAuth callback.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const isCallback = code !== null || state !== null || searchParams.has('error');

  if (isCallback) {
    const appOrigin = resolveOAuthAppOrigin();
    if (!appOrigin) return jsonResponse({ error: 'OAuth no disponible' }, 503);
    if (searchParams.has('error')) {
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'oauth_denied' }));
    }
    if (!isValidOAuthCode(code) || !state) {
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'invalid_callback' }));
    }
    return handleMetaCallback(code, state, appOrigin);
  }

  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return jsonResponse({ error: 'No autenticado' }, 401);
    const featureDenied = denyUnlessFeature(tenant, 'social');
    if (featureDenied) return featureDenied;

    const supabase = createSupabaseAdmin();
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('id,platform,platform_user_id,platform_username,profile_picture_url,created_at')
      .eq('tenant_id', tenant.tenantId)
      .order('platform', { ascending: true })
      .limit(MAX_SOCIAL_ACCOUNTS);
    if (error) return jsonResponse({ error: 'No se pudieron cargar las cuentas' }, 500);
    return jsonResponse({ accounts: accounts || [] });
  } catch {
    console.error('[Social Accounts] Account listing failed');
    return jsonResponse({ error: 'No se pudieron cargar las cuentas' }, 500);
  }
}

function buildProviderAuthorizationUrl(
  platform: string,
  appOrigin: string,
  state: string,
): URL | null {
  if (platform === 'youtube' || platform === 'google_calendar') {
    const clientId = boundedProviderId(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    if (!clientId) return null;
    const callback = platform === 'youtube'
      ? '/api/panel/social/accounts/google-callback'
      : '/api/panel/social/accounts/google-calendar-callback';
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    const scopes = platform === 'youtube'
      ? [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ]
      : [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ];
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', buildOAuthRedirectUri(appOrigin, callback));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    return authUrl;
  }

  if (platform === 'tiktok') {
    const clientKey = boundedProviderId(process.env.TIKTOK_CLIENT_KEY);
    if (!clientKey) return null;
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.set('client_key', clientKey);
    authUrl.searchParams.set('scope', 'user.info.basic,video.upload,video.publish');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set(
      'redirect_uri',
      buildOAuthRedirectUri(appOrigin, '/api/panel/social/accounts/tiktok-callback'),
    );
    authUrl.searchParams.set('state', state);
    return authUrl;
  }

  if (platform === 'meta' || platform === 'facebook' || platform === 'instagram') {
    const appId = boundedProviderId(process.env.FACEBOOK_APP_ID);
    if (!appId) return null;
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set(
      'redirect_uri',
      buildOAuthRedirectUri(appOrigin, '/api/panel/social/accounts'),
    );
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', [
      'pages_manage_posts',
      'pages_show_list',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
      'ads_management',
      'ads_read',
      'pages_read_engagement',
      'pages_manage_ads',
    ].join(','));
    return authUrl;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return jsonResponse({ error: 'No autenticado' }, 401);
    const body = await readLimitedJsonBody(req);
    if (!body || typeof body.action !== 'string') {
      return jsonResponse({ error: 'Solicitud invalida' }, 400);
    }

    if (body.action === 'get_auth_url') {
      const platform = body.platform === undefined ? 'meta' : body.platform;
      if (typeof platform !== 'string' || !AUTH_PLATFORMS.has(platform)) {
        return jsonResponse({ error: 'Plataforma invalida' }, 400);
      }
      const feature = platform === 'google_calendar' ? 'appointments' : 'social';
      const featureDenied = denyUnlessFeature(tenant, feature);
      if (featureDenied) return featureDenied;

      const appOrigin = resolveOAuthAppOrigin();
      if (!appOrigin) return jsonResponse({ error: 'OAuth no disponible' }, 503);
      const state = await signOAuthState({
        tenantId: tenant.tenantId,
        oauthAction: SOCIAL_OAUTH_ACTION,
      });
      const authUrl = buildProviderAuthorizationUrl(platform, appOrigin, state);
      if (!authUrl) return jsonResponse({ error: 'OAuth no disponible' }, 503);
      return jsonResponse({ authUrl: authUrl.toString() });
    }

    if (body.action === 'refresh_pictures') {
      const featureDenied = denyUnlessFeature(tenant, 'social');
      if (featureDenied) return featureDenied;
      const supabase = createSupabaseAdmin();
      const { data: accounts, error: lookupError } = await supabase
        .from('social_accounts')
        .select('id,platform,platform_user_id,encrypted_access_token,encryption_iv,encryption_tag')
        .eq('tenant_id', tenant.tenantId)
        .in('platform', ['facebook', 'instagram'])
        .limit(MAX_SOCIAL_ACCOUNTS);
      if (lookupError) return jsonResponse({ error: 'No se pudieron actualizar las cuentas' }, 500);

      let updated = 0;
      let failed = 0;
      for (const account of accounts || []) {
        try {
          const providerId = boundedProviderId(account.platform_user_id);
          const token = boundedProviderToken(
            decryptToken(account.encrypted_access_token, account.encryption_iv, account.encryption_tag),
          );
          if (!providerId || !token) throw new Error('invalid_account');
          const profileUrl = new URL(
            `${META_BASE_URL}/${META_API_VERSION}/${encodeURIComponent(providerId)}`,
          );
          profileUrl.searchParams.set(
            'fields',
            account.platform === 'facebook' ? 'picture{url}' : 'profile_picture_url',
          );
          const pictureResult = await fetchOAuthJson<MetaPictureResponse>(profileUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const pictureUrl = boundedProfileUrl(
            account.platform === 'facebook'
              ? pictureResult.data.picture?.data?.url
              : pictureResult.data.profile_picture_url,
          );
          if (!pictureResult.ok || pictureResult.data.error || !pictureUrl) {
            throw new Error('provider_profile_failed');
          }
          const { error: updateError } = await supabase
            .from('social_accounts')
            .update({ profile_picture_url: pictureUrl })
            .eq('id', account.id)
            .eq('tenant_id', tenant.tenantId);
          if (updateError) throw new Error('persistence_failed');
          updated += 1;
        } catch {
          failed += 1;
        }
      }
      return jsonResponse({ success: true, updated, failed, total: accounts?.length || 0 });
    }

    if (body.action === 'link_manual') {
      if (process.env.NODE_ENV === 'production') {
        return jsonResponse({ error: 'Accion no disponible' }, 404);
      }
      const platform = typeof body.platform === 'string' ? body.platform : '';
      const feature = platform === 'google_calendar' ? 'appointments' : 'social';
      const featureDenied = denyUnlessFeature(tenant, feature);
      if (featureDenied) return featureDenied;
      const providerId = boundedProviderId(body.platformUserId);
      const accessToken = boundedProviderToken(body.accessToken);
      if (!MANUAL_PLATFORMS.has(platform) || !providerId || !accessToken) {
        return jsonResponse({ error: 'Parametros invalidos' }, 400);
      }
      if (
        body.platformUsername !== undefined &&
        (typeof body.platformUsername !== 'string' ||
          boundedProviderName(body.platformUsername, '') === '')
      ) {
        return jsonResponse({ error: 'Parametros invalidos' }, 400);
      }

      const encryptedToken = encryptToken(accessToken);
      const supabase = createSupabaseAdmin();
      const { data, error } = await supabase
        .from('social_accounts')
        .upsert({
          tenant_id: tenant.tenantId,
          platform,
          platform_user_id: providerId,
          platform_username: boundedProviderName(body.platformUsername, 'Manual link'),
          encrypted_access_token: encryptedToken.ciphertext,
          encrypted_refresh_token: null,
          encryption_iv: encryptedToken.iv,
          encryption_tag: encryptedToken.tag,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,platform,platform_user_id',
        })
        .select('id,platform,platform_user_id,platform_username,created_at')
        .single();
      if (error) return jsonResponse({ error: 'No se pudo vincular la cuenta' }, 500);
      return jsonResponse({ success: true, account: data });
    }

    return jsonResponse({ error: 'Accion no valida' }, 400);
  } catch {
    console.error('[Social Accounts] Account connection failed');
    return jsonResponse({ error: 'No se pudo procesar la solicitud' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return jsonResponse({ error: 'No autenticado' }, 401);
    const id = new URL(req.url).searchParams.get('id');
    if (!isValidUuid(id)) return jsonResponse({ error: 'ID de cuenta invalido' }, 400);

    const supabase = createSupabaseAdmin();
    const { data: account, error: lookupError } = await supabase
      .from('social_accounts')
      .select('platform')
      .eq('id', id)
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();
    if (lookupError) return jsonResponse({ error: 'No se pudo desconectar la cuenta' }, 500);
    if (!account) return jsonResponse({ error: 'Cuenta no encontrada' }, 404);

    const feature = account.platform === 'google_calendar' ? 'appointments' : 'social';
    const featureDenied = denyUnlessFeature(tenant, feature);
    if (featureDenied) return featureDenied;
    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant.tenantId);
    if (error) return jsonResponse({ error: 'No se pudo desconectar la cuenta' }, 500);
    return jsonResponse({ success: true });
  } catch {
    console.error('[Social Accounts] Account deletion failed');
    return jsonResponse({ error: 'No se pudo desconectar la cuenta' }, 500);
  }
}

function decodeExtendedConfig(stored: string) {
  const defaults = {
    openai_key: '', gemini_key: '', groq_key: '', alert_email: '',
    bulk_wa_token: '', bulk_wa_phone_id: '',
    model_selection: 'gpt-4o', confidence_threshold: 0.85, auto_classification: true,
    fal_key: '', visual_render_provider: 'flux',
    facebook_access_token: '', facebook_ad_account_id: '', facebook_page_id: '',
    dropi_enabled: false, dropi_token: '', dropi_default_product_id: '', dropi_default_price: 50,
  };
  if (!stored) return defaults;
  try {
    const parsed = JSON.parse(stored);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults, openai_key: stored };
  }
}

function encodeExtendedConfig(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}
