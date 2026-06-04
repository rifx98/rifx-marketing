import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    console.error('❌ [TikTok OAuth] Missing code or state');
    return NextResponse.redirect(new URL('/panel?tab=social&error=invalid_callback', req.url));
  }

  try {
    let tenantId = '';
    try {
      const decodedState = JSON.parse(decodeURIComponent(state));
      tenantId = decodedState.tenantId;
    } catch {
      console.error('❌ [TikTok OAuth] Error decoding state parameter');
      return NextResponse.redirect(new URL('/panel?tab=social&error=invalid_state', req.url));
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const redirectUri = `${appUrl}/api/panel/social/accounts/tiktok-callback`;

    if (!clientKey) {
      throw new Error('TikTok Client Key no configurada en .env.local');
    }

    if (!clientSecret) {
      throw new Error('Falta TIKTOK_CLIENT_SECRET en .env.local para completar la autenticación OAuth');
    }

    console.log(`[TikTok OAuth] Exchanging code for token... tenant: ${tenantId}`);

    // Exchange auth code for tokens
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'TikTok token exchange failed');
    }

    const { access_token, open_id, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    // Fetch TikTok user details
    console.log('[TikTok OAuth] Fetching user details...');
    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userData = await userRes.json();
    if (userData.error || !userRes.ok) {
      throw new Error(userData.error?.message || 'Failed to fetch TikTok profile info');
    }

    const user = userData.data?.user;
    if (!user) {
      throw new Error('No se encontró información de perfil de TikTok');
    }

    const username = user.display_name || user.username || 'TikTok User';
    const profilePic = user.avatar_url || null;

    // Securely encrypt the credentials
    const tokenPayload = JSON.stringify({
      access_token,
      refresh_token: refresh_token || null
    });
    const enc = encryptToken(tokenPayload);

    const supabase = createSupabaseAdmin();
    console.log(`[TikTok OAuth] Storing TikTok account: ${username} (${open_id})`);

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        tenant_id: tenantId,
        platform: 'tiktok',
        platform_user_id: open_id,
        platform_username: username,
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

    return NextResponse.redirect(new URL('/panel?tab=social&oauth_success=true', req.url));
  } catch (error: any) {
    console.error('❌ [TikTok OAuth] Callback error:', error.message || error);
    return NextResponse.redirect(new URL(`/panel?tab=social&error=${encodeURIComponent(error.message || 'tiktok_oauth_failed')}`, req.url));
  }
}
