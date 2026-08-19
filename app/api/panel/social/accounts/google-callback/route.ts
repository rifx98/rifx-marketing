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

interface GoogleTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
}

interface YouTubeChannelResponse {
  error?: unknown;
  items?: Array<{
    id?: unknown;
    snippet?: {
      title?: unknown;
      thumbnails?: { default?: { url?: unknown } };
    };
  }>;
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

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error('[YouTube OAuth] Provider configuration unavailable');
      return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'oauth_unavailable' }));
    }
    const redirectUri = buildOAuthRedirectUri(
      appOrigin,
      '/api/panel/social/accounts/google-callback',
    );

    const tokenResult = await fetchOAuthJson<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    );
    const accessToken = boundedProviderToken(tokenResult.data.access_token);
    const refreshToken = boundedProviderToken(tokenResult.data.refresh_token, true);
    if (!tokenResult.ok || tokenResult.data.error || !accessToken) {
      throw new Error('provider_exchange_failed');
    }

    const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    channelUrl.searchParams.set('part', 'snippet');
    channelUrl.searchParams.set('mine', 'true');
    const channelResult = await fetchOAuthJson<YouTubeChannelResponse>(channelUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const channel = channelResult.data.items?.[0];
    const channelId = boundedProviderId(channel?.id);
    if (!channelResult.ok || channelResult.data.error || !channelId) {
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
        platform: 'youtube',
        platform_user_id: channelId,
        platform_username: boundedProviderName(channel?.snippet?.title, 'YouTube channel'),
        profile_picture_url: boundedProfileUrl(channel?.snippet?.thumbnails?.default?.url),
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
    console.error('[YouTube OAuth] Callback failed');
    return NextResponse.redirect(buildPanelRedirect(appOrigin, 'social', { error: 'oauth_failed' }));
  }
}
