import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// POST: Exchange OAuth code → long-lived token + list Ad Accounts & Pages
export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'Facebook App credentials not configured on server' }, { status: 500 });
    }

    // 1. Exchange code → short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Meta token exchange failed:', tokenData);
      return NextResponse.json({
        error: tokenData.error?.message || 'Failed to exchange authorization code'
      }, { status: 400 });
    }

    // 2. Exchange short-lived → long-lived token (60 days)
    const longTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', appId);
    longTokenUrl.searchParams.set('client_secret', appSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || tokenData.access_token;

    // 3. Get Ad Accounts
    const adAccountsUrl = new URL('https://graph.facebook.com/v19.0/me/adaccounts');
    adAccountsUrl.searchParams.set('access_token', accessToken);
    adAccountsUrl.searchParams.set('fields', 'id,name,account_status,currency,timezone_name,business{id,name}');
    adAccountsUrl.searchParams.set('limit', '20');

    const adRes = await fetch(adAccountsUrl.toString());
    const adData = await adRes.json();

    // 4. Get Pages
    const pagesUrl = new URL('https://graph.facebook.com/v19.0/me/accounts');
    pagesUrl.searchParams.set('access_token', accessToken);
    pagesUrl.searchParams.set('fields', 'id,name,category,fan_count,picture{url}');
    pagesUrl.searchParams.set('limit', '20');

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json();

    const adAccounts = (adData.data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      account_status: a.account_status,
      currency: a.currency,
      timezone: a.timezone_name,
      business: a.business?.name || '',
    }));

    const pages = (pagesData.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      fanCount: p.fan_count,
      picture: p.picture?.data?.url || '',
    }));

    return NextResponse.json({
      accessToken,
      adAccounts,
      pages,
      adAccountCount: adAccounts.length,
      pageCount: pages.length,
    });

  } catch (error: any) {
    console.error('Meta facebook-connect error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: Save selected Ad Account + Page to config
export async function PUT(req: NextRequest) {
  try {
    const { accessToken, adAccountId, adAccountName, pageId, pageName } = await req.json();

    if (!accessToken || !adAccountId) {
      return NextResponse.json({ error: 'accessToken and adAccountId are required' }, { status: 400 });
    }

    // Resolve tenant from auth header — use proper auth helper for security
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const tenantId = tenant.tenantId;

    const supabase = createSupabaseAdmin();

    const { data: config } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (!config) {
      return NextResponse.json({ error: 'Config not found for tenant' }, { status: 404 });
    }

    // Parse existing extended config
    let extConfig: any = {};
    try {
      extConfig = JSON.parse(config.openai_key || '{}');
    } catch {}

    // Build safe field updates
    const updateData: any = {
      openai_key: JSON.stringify({
        ...extConfig,
        // Store Meta credentials in extended config
        facebook_access_token: accessToken,
        facebook_ad_account_id: adAccountId,
        facebook_page_id: pageId || '',
        meta_connected_via: 'facebook_oauth',
        meta_ad_account_name: adAccountName || '',
        meta_page_name: pageName || '',
        meta_connected_at: new Date().toISOString(),
      }),
    };

    const { error } = await supabase
      .from('config')
      .update(updateData)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Meta save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verify token works by checking the ad account
    const verifyRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}?fields=name,account_status&access_token=${accessToken}`
    );
    const verifyData = await verifyRes.json();
    const isVerified = !verifyData.error && verifyData.name;

    return NextResponse.json({
      success: true,
      verified: isVerified,
      adAccountName: verifyData.name || adAccountName,
      message: isVerified ? 'Meta Ads conectado exitosamente' : 'Guardado pero no se pudo verificar la cuenta',
    });

  } catch (error: any) {
    console.error('Meta save error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
