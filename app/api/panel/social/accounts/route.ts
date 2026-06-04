import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { encryptToken } from '@/lib/encryption';

const META_API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

// GET: Listar cuentas vinculadas para el tenant, o manejar el Callback OAuth de Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // 1. Manejo del Callback de OAuth (Meta Redirect)
  if (code && state) {
    try {
      let tenantId = '';
      try {
        const decodedState = JSON.parse(decodeURIComponent(state));
        tenantId = decodedState.tenantId;
      } catch {
        console.error('❌ [Social Accounts] Error decoding state parameter');
        return NextResponse.redirect(new URL('/panel?tab=social&error=invalid_state', req.url));
      }

      if (!tenantId) {
        return NextResponse.redirect(new URL('/panel?tab=social&error=missing_tenant', req.url));
      }

      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const redirectUri = `${appUrl}/api/panel/social/accounts`;

      if (!appId || !appSecret) {
        console.error('❌ [Social Accounts] Meta App ID or Secret not configured in .env.local');
        return NextResponse.redirect(new URL('/panel?tab=social&error=app_not_configured', req.url));
      }

      console.log(`[Social Accounts] Exchanging OAuth code for User token... tenant: ${tenantId}`);

      // Step A: Exchange code for short-lived User Access Token
      const tokenExchangeUrl = `${BASE_URL}/${META_API_VERSION}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
      const tokenRes = await fetch(tokenExchangeUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        throw new Error(tokenData.error.message || 'OAuth token exchange failed');
      }

      const shortLivedToken = tokenData.access_token;

      // Step B: Exchange short-lived token for long-lived User Access Token (valid for 60 days)
      const longLivedUrl = `${BASE_URL}/${META_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
      const llRes = await fetch(longLivedUrl);
      const llData = await llRes.json();

      if (llData.error) {
        throw new Error(llData.error.message || 'Long-lived token exchange failed');
      }

      const longLivedUserToken = llData.access_token;
      const tokenExpiresIn = llData.expires_in; // in seconds
      const tokenExpiresAt = tokenExpiresIn ? new Date(Date.now() + tokenExpiresIn * 1000).toISOString() : null;

      // Step C: Fetch user's Facebook Pages
      const pagesUrl = `${BASE_URL}/${META_API_VERSION}/me/accounts?access_token=${longLivedUserToken}&limit=100`;
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json();

      if (pagesData.error) {
        throw new Error(pagesData.error.message || 'Failed to fetch Facebook Pages');
      }

      const supabase = createSupabaseAdmin();
      const pagesList = pagesData.data || [];

      // Step C.2: Fetch user's Facebook Ad Accounts
      let defaultAdAccountId = '';
      try {
        const adAccountsUrl = `${BASE_URL}/${META_API_VERSION}/me/adaccounts?access_token=${longLivedUserToken}&limit=100`;
        const adAccountsRes = await fetch(adAccountsUrl);
        const adAccountsData = await adAccountsRes.json();
        if (adAccountsData.data && adAccountsData.data.length > 0) {
          defaultAdAccountId = adAccountsData.data[0].id;
        }
        console.log(`[Social Accounts] Found ${adAccountsData.data?.length || 0} ad accounts. Default is ${defaultAdAccountId}`);
      } catch (err: any) {
        console.error('⚠️ [Social Accounts] Error fetching Facebook Ad Accounts:', err.message || err);
      }

      // Step C.3: Automatically populate/update global config for this tenant
      try {
        const defaultPageId = pagesList.length > 0 ? pagesList[0].id : '';

        // Fetch existing config row
        let fetchQuery = supabase.from('config').select('id, openai_key');
        fetchQuery = fetchQuery.eq('tenant_id', tenantId);
        const { data: existingRow, error: fetchError } = await fetchQuery.limit(1).maybeSingle();

        if (fetchError) {
          console.error('⚠️ [Social Accounts] Error fetching existing config:', fetchError.message);
        }

        // Decode the existing extended config JSON (usually stored in openai_key column)
        const current = decodeExtendedConfig(existingRow?.openai_key || '');

        // Encode the updated config payload
        const updatedOpenaiKey = encodeExtendedConfig({
          ...current,
          facebook_access_token: longLivedUserToken,
          facebook_page_id: defaultPageId || current.facebook_page_id,
          facebook_ad_account_id: defaultAdAccountId || current.facebook_ad_account_id,
        });

        const updateData: Record<string, any> = {
          openai_key: updatedOpenaiKey,
          updated_at: new Date().toISOString(),
        };

        if (existingRow) {
          console.log(`[Social Accounts] Updating config row for tenant ${tenantId}`);
          await supabase.from('config').update(updateData).eq('id', existingRow.id);
        } else {
          console.log(`[Social Accounts] Inserting new config row for tenant ${tenantId}`);
          updateData.tenant_id = tenantId;
          await supabase.from('config').insert(updateData);
        }
      } catch (configErr: any) {
        console.error('⚠️ [Social Accounts] Error auto-populating config table:', configErr.message || configErr);
      }

      console.log(`[Social Accounts] Found ${pagesList.length} pages. Storing in database...`);

      for (const page of pagesList) {
        const pageId = page.id;
        const pageName = page.name;
        const pageAccessToken = page.access_token; // Page access token (long-lived)

        // Encrypt page access token
        const fbEnc = encryptToken(pageAccessToken);

        // Store Facebook Page account
        await supabase
          .from('social_accounts')
          .upsert({
            tenant_id: tenantId,
            platform: 'facebook',
            platform_user_id: pageId,
            platform_username: pageName,
            encrypted_access_token: fbEnc.ciphertext,
            encrypted_refresh_token: null,
            encryption_iv: fbEnc.iv,
            encryption_tag: fbEnc.tag,
            token_expires_at: null, // Page tokens never expire unless revoked
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'tenant_id,platform,platform_user_id'
          });

        // Step D: Check if Page has an connected Instagram Business Account
        const igCheckUrl = `${BASE_URL}/${META_API_VERSION}/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${longLivedUserToken}`;
        const igRes = await fetch(igCheckUrl);
        const igData = await igRes.json();

        if (igData.instagram_business_account) {
          const igId = igData.instagram_business_account.id;
          const igUsername = igData.instagram_business_account.username;
          const igPic = igData.instagram_business_account.profile_picture_url || null;

          // For Instagram, we can publish using the long-lived User Access Token
          const igEnc = encryptToken(longLivedUserToken);

          console.log(`[Social Accounts] Found linked Instagram account: ${igUsername} (${igId})`);

          // Store Instagram Account
          await supabase
            .from('social_accounts')
            .upsert({
              tenant_id: tenantId,
              platform: 'instagram',
              platform_user_id: igId,
              platform_username: igUsername,
              profile_picture_url: igPic,
              encrypted_access_token: igEnc.ciphertext,
              encrypted_refresh_token: null,
              encryption_iv: igEnc.iv,
              encryption_tag: igEnc.tag,
              token_expires_at: tokenExpiresAt, // Expires in 60 days
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'tenant_id,platform,platform_user_id'
            });
        }
      }

      return NextResponse.redirect(new URL('/panel?tab=social&oauth_success=true', req.url));
    } catch (error: any) {
      console.error('❌ [Social Accounts] OAuth callback error:', error.message || error);
      return NextResponse.redirect(new URL(`/panel?tab=social&error=${encodeURIComponent(error.message || 'oauth_failed')}`, req.url));
    }
  }

  // 2. Listar cuentas conectadas para el panel del usuario
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('id, platform, platform_user_id, platform_username, profile_picture_url, created_at')
      .eq('tenant_id', tenant.tenantId)
      .order('platform', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error('Error listing social accounts:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// POST: Vincular una cuenta manualmente (o generar la URL de OAuth)
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // A. Generar URL de inicio de flujo OAuth
    if (action === 'get_auth_url') {
      const { platform } = body;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const stateObj = { tenantId: tenant.tenantId, timestamp: Date.now() };
      const state = encodeURIComponent(JSON.stringify(stateObj));

      if (platform === 'youtube') {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const redirectUri = `${appUrl}/api/panel/social/accounts/google-callback`;

        if (!clientId) {
          return NextResponse.json({ error: 'Google Client ID no configurado en .env.local' }, { status: 500 });
        }

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly')}&state=${state}&access_type=offline&prompt=consent`;

        return NextResponse.json({ authUrl });
      }

      if (platform === 'tiktok') {
        const clientKey = process.env.TIKTOK_CLIENT_KEY || 'dummy_client_key';
        const redirectUri = `${appUrl}/api/panel/social/accounts/tiktok-callback`;

        const scopes = 'user.info.basic,video.upload,video.publish';
        const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

        return NextResponse.json({ authUrl });
      }

      // Default a Meta (facebook/instagram)
      const appId = process.env.FACEBOOK_APP_ID;
      const redirectUri = `${appUrl}/api/panel/social/accounts`;

      if (!appId) {
        return NextResponse.json({ error: 'Meta App ID no configurado' }, { status: 500 });
      }

      const scopes = [
        'pages_manage_posts',
        'pages_show_list',
        'instagram_basic',
        'instagram_content_publish',
        'business_management',
        'ads_management',
        'ads_read',
        'pages_read_engagement',
        'pages_manage_ads'
      ].join(',');

      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scopes}`;

      return NextResponse.json({ authUrl });
    }

    // B. Guardar cuenta manualmente (como fallback o sandbox)
    if (action === 'link_manual') {
      const { platform, platformUserId, platformUsername, accessToken } = body;

      if (!platform || !platformUserId || !accessToken) {
        return NextResponse.json({ error: 'Faltan parámetros requeridos (platform, platformUserId, accessToken)' }, { status: 400 });
      }

      if (platform !== 'facebook' && platform !== 'instagram' && platform !== 'tiktok' && platform !== 'youtube') {
        return NextResponse.json({ error: 'Plataforma no soportada' }, { status: 400 });
      }

      const enc = encryptToken(accessToken);
      const supabase = createSupabaseAdmin();

      const { data, error } = await supabase
        .from('social_accounts')
        .upsert({
          tenant_id: tenant.tenantId,
          platform,
          platform_user_id: platformUserId,
          platform_username: platformUsername || 'Manual Link',
          encrypted_access_token: enc.ciphertext,
          encrypted_refresh_token: null,
          encryption_iv: enc.iv,
          encryption_tag: enc.tag,
          token_expires_at: null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,platform,platform_user_id'
        })
        .select('id, platform, platform_user_id, platform_username, created_at')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, account: data });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error connecting social account:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// DELETE: Desconectar cuenta vinculada
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de cuenta requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant.tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting social account:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// ─── Extended Config Helpers ─────────────────────────────
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

function encodeExtendedConfig(fields: any): string {
  return JSON.stringify(fields);
}
