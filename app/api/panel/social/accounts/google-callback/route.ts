import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    console.error('❌ [YouTube OAuth] Missing code or state');
    return NextResponse.redirect(new URL('/panel/social?error=invalid_callback', req.url));
  }

  try {
    let tenantId = '';
    try {
      const decodedState = JSON.parse(decodeURIComponent(state));
      tenantId = decodedState.tenantId;
    } catch {
      console.error('❌ [YouTube OAuth] Error decoding state parameter');
      return NextResponse.redirect(new URL('/panel/social?error=invalid_state', req.url));
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const redirectUri = `${appUrl}/api/panel/social/accounts/google-callback`;

    if (!clientId) {
      throw new Error('Google Client ID no configurado en .env.local');
    }

    if (!clientSecret) {
      throw new Error('Falta GOOGLE_CLIENT_SECRET en .env.local para completar la autenticación OAuth');
    }

    console.log(`[YouTube OAuth] Exchanging code for token... tenant: ${tenantId}`);

    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed');
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    // Fetch YouTube channel details
    console.log('[YouTube OAuth] Fetching channel details...');
    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const channelData = await channelRes.json();
    if (channelData.error) {
      throw new Error(channelData.error.message || 'Failed to fetch YouTube channel info');
    }

    const channel = channelData.items?.[0];
    if (!channel) {
      throw new Error('No se encontró ningún canal de YouTube para esta cuenta de Google');
    }

    const channelId = channel.id;
    const channelName = channel.snippet.title;
    const profilePic = channel.snippet.thumbnails?.default?.url || null;

    // Securely encrypt the credentials
    // For YouTube, if we have a refresh token, we can serialize them together so both are securely saved
    const tokenPayload = JSON.stringify({
      access_token,
      refresh_token: refresh_token || null
    });
    const enc = encryptToken(tokenPayload);

    const supabase = createSupabaseAdmin();
    console.log(`[YouTube OAuth] Storing YouTube account: ${channelName} (${channelId})`);

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        tenant_id: tenantId,
        platform: 'youtube',
        platform_user_id: channelId,
        platform_username: channelName,
        profile_picture_url: profilePic,
        encrypted_access_token: enc.ciphertext,
        encrypted_refresh_token: null, // Stored combined in encrypted_access_token
        encryption_iv: enc.iv,
        encryption_tag: enc.tag,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,platform,platform_user_id'
      });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return NextResponse.redirect(new URL('/panel/social?oauth_success=true', req.url));
  } catch (error: any) {
    console.error('❌ [YouTube OAuth] Callback error:', error.message || error);
    return NextResponse.redirect(new URL(`/panel/social?error=${encodeURIComponent(error.message || 'youtube_oauth_failed')}`, req.url));
  }
}
