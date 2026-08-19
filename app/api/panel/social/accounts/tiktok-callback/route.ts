import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/encryption';
import {
  boundedProfileUrl,
  boundedProviderId,
  boundedProviderName,
  boundedProviderToken,
  buildOAuthRedirectUri,
  buildPanelRedirect,
  fetchOAuthJson,
  isValidOAuthCode,
  oauthTenantCanUseFeature,
  resolveOAuthAppOrigin,
  tokenExpiryFromSeconds,
  verifySocialOAuthState,
} from '@/lib/social-oauth';

interface TikTokTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  open_id?: unknown;
  expires_in?: unknown;
  error?: unknown;
}

interface TikTokUserResponse {
  error?: { code?: unknown } | unknown;
  data?: {
    user?: {
      display_name?: unknown;
      username?: unknown;
      avatar_url?: unknown;
    };
  };
}

export async function GET(req: NextRequest) {
  const appOrigin = resolveOAuthAppOrigin();
  if (!appOrigin) {
    return NextResponse.json({ error: 'OAuth no disponible' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!isValidOAuthCode(code) || !state) {
    return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'invalid_callback' }));
  }

  try {
    const tenantId = await verifySocialOAuthState(state);
    if (!tenantId) {
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'invalid_state' }));
    }

    const supabase = createSupabaseAdmin();
    if (!await oauthTenantCanUseFeature(supabase, tenantId, 'social')) {
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'access_denied' }));
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
      console.error('[TikTok OAuth] Provider configuration unavailable');
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'oauth_unavailable' }));
    }
    const redirectUri = buildOAuthRedirectUri(
      appOrigin,
      '/api/panel/social/accounts/tiktok-callback',
    );

    const tokenResult = await fetchOAuthJson<TikTokTokenResponse>(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      },
    );
    const accessToken = boundedProviderToken(tokenResult.data.access_token);
    const refreshToken = boundedProviderToken(tokenResult.data.refresh_token, true);
    const openId = boundedProviderId(tokenResult.data.open_id);
    if (!tokenResult.ok || tokenResult.data.error || !accessToken || !openId) {
      throw new Error('provider_exchange_failed');
    }

    const userUrl = new URL('https://open.tiktokapis.com/v2/user/info/');
    userUrl.searchParams.set('fields', 'open_id,avatar_url,display_name,username');
    const userResult = await fetchOAuthJson<TikTokUserResponse>(userUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = userResult.data.data?.user;
    const providerErrorCode = userResult.data.error && typeof userResult.data.error === 'object'
      ? (userResult.data.error as { code?: unknown }).code
      : undefined;
    if (
      !userResult.ok ||
      !user ||
      (providerErrorCode !== undefined && providerErrorCode !== 'ok' && providerErrorCode !== 0)
    ) {
      throw new Error('provider_profile_failed');
    }

    const tokenPayload = JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    const enc = encryptToken(tokenPayload);
    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        tenant_id: tenantId,
        platform: 'tiktok',
        platform_user_id: openId,
        platform_username: boundedProviderName(
          user.display_name || user.username,
          'TikTok account',
        ),
        profile_picture_url: boundedProfileUrl(user.avatar_url),
        encrypted_access_token: enc.ciphertext,
        encrypted_refresh_token: null,
        encryption_iv: enc.iv,
        encryption_tag: enc.tag,
        token_expires_at: tokenExpiryFromSeconds(tokenResult.data.expires_in),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,platform,platform_user_id',
      });
    if (dbError) throw new Error('persistence_failed');

    return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { success: 'oauth_success' }));
  } catch {
    console.error('[TikTok OAuth] Callback failed');
    return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'oauth_failed' }));
  }
}
