import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { encryptToken } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    console.error('❌ [Google Calendar OAuth] Missing code or state');
    return NextResponse.redirect(new URL('/panel?tab=settings&error=invalid_callback', req.url));
  }

  try {
    // Verify the state token to get tenantId
    let tenantId = '';
    try {
      const decodedPayload = await verifyToken(decodeURIComponent(state));
      if (!decodedPayload || decodedPayload.purpose !== 'oauth_state' || !decodedPayload.tenantId) {
        throw new Error('Invalid or expired state parameter');
      }
      tenantId = decodedPayload.tenantId;
    } catch (err: any) {
      console.error('❌ [Google Calendar OAuth] Error decoding state:', err.message);
      return NextResponse.redirect(new URL('/panel?tab=settings&error=invalid_state', req.url));
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const redirectUri = `${appUrl}/api/panel/social/accounts/google-calendar-callback`;

    if (!clientId) {
      throw new Error('Google Client ID no configurado');
    }
    if (!clientSecret) {
      throw new Error('Falta GOOGLE_CLIENT_SECRET en las variables de entorno');
    }

    console.log(`[Google Calendar OAuth] Exchanging code for token... tenant: ${tenantId}`);

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

    // Fetch user email for identification
    console.log('[Google Calendar OAuth] Fetching user info...');
    let userEmail = 'calendar-user';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      const userInfo = await userInfoRes.json();
      if (userInfo.email) {
        userEmail = userInfo.email;
      }
    } catch (e) {
      console.warn('⚠️ [Google Calendar OAuth] Could not fetch user email, using default');
    }

    // Verify calendar access works
    console.log('[Google Calendar OAuth] Verifying calendar access...');
    const calTestRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const calTestData = await calTestRes.json();
    if (calTestData.error) {
      throw new Error(`Google Calendar access failed: ${calTestData.error.message}`);
    }

    // Encrypt the token payload (both access_token and refresh_token together)
    const tokenPayload = JSON.stringify({
      access_token,
      refresh_token: refresh_token || null
    });
    const enc = encryptToken(tokenPayload);

    const supabase = createSupabaseAdmin();
    console.log(`[Google Calendar OAuth] Storing calendar account: ${userEmail} for tenant ${tenantId}`);

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        tenant_id: tenantId,
        platform: 'google_calendar',
        platform_user_id: userEmail,
        platform_username: `📅 ${userEmail}`,
        profile_picture_url: null,
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

    console.log(`✅ [Google Calendar OAuth] Successfully connected calendar for ${userEmail}`);
    return NextResponse.redirect(new URL('/panel?tab=settings&calendar_success=true', req.url));
  } catch (error: any) {
    console.error('❌ [Google Calendar OAuth] Callback error:', error.message || error);
    return NextResponse.redirect(new URL(`/panel?tab=settings&error=${encodeURIComponent(error.message || 'calendar_oauth_failed')}`, req.url));
  }
}
