import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

// Step 1: Exchange OAuth code for access token + list WhatsApp Business accounts
export async function POST(req: NextRequest) {
  try {
    // Resolve tenant from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyToken(token);
    if (!payload || !payload.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { code, redirectUri } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'Facebook App credentials not configured' }, { status: 500 });
    }

    // Exchange code for short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('FB token exchange failed:', tokenData);
      return NextResponse.json({ 
        error: tokenData.error?.message || 'Failed to exchange authorization code' 
      }, { status: 400 });
    }

    const shortToken = tokenData.access_token;

    // Exchange short-lived for long-lived token (60 days)
    const longTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', appId);
    longTokenUrl.searchParams.set('client_secret', appSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', shortToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || shortToken;

    // Get WhatsApp Business accounts linked to this user
    const waAccountsUrl = new URL('https://graph.facebook.com/v19.0/me/whatsapp_business_accounts');
    waAccountsUrl.searchParams.set('access_token', accessToken);
    waAccountsUrl.searchParams.set('fields', 'id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,status}');

    const waRes = await fetch(waAccountsUrl.toString());
    const waData = await waRes.json();

    if (waData.error) {
      console.error('WA accounts error:', waData.error);
      // Try getting phone numbers directly if no WABA access
      return NextResponse.json({
        accessToken,
        accounts: [],
        message: 'Token obtained. Please enter your Phone Number ID manually.',
        warning: waData.error.message
      });
    }

    // Flatten accounts + their phone numbers into selectable options
    const phoneOptions: any[] = [];
    for (const account of (waData.data || [])) {
      const phones = account.phone_numbers?.data || [];
      for (const phone of phones) {
        phoneOptions.push({
          wabaId: account.id,
          wabaName: account.name,
          phoneNumberId: phone.id,
          displayPhone: phone.display_phone_number,
          verifiedName: phone.verified_name,
          status: phone.status,
          qualityRating: phone.quality_rating,
        });
      }
    }

    return NextResponse.json({
      accessToken,
      phoneOptions,
      accountCount: waData.data?.length || 0,
    });

  } catch (error: any) {
    console.error('Facebook callback error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Step 2: Save the selected phone number to config
export async function PUT(req: NextRequest) {
  try {
    const { phoneNumberId, accessToken, wabaId, displayPhone, verifiedName } = await req.json();

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: 'phoneNumberId and accessToken are required' }, { status: 400 });
    }

    // Resolve tenant from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyToken(token);
    if (!payload || !payload.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    const tenantId = payload.tenantId;

    const supabase = createSupabaseAdmin();

    // Get current config
    const { data: config } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (!config) {
      return NextResponse.json({ error: 'Config not found for tenant' }, { status: 404 });
    }

    // Parse existing openai_key JSON (where extended config is stored)
    let extConfig: any = {};
    try {
      extConfig = JSON.parse(config.openai_key || '{}');
    } catch {}

    // Update the config with new WhatsApp credentials
    const updateData: any = {
      whatsapp_token: accessToken,
      whatsapp_phone_id: phoneNumberId,
      openai_key: JSON.stringify({
        ...extConfig,
        wa_connected_via: 'facebook_oauth',
        wa_waba_id: wabaId || '',
        wa_display_phone: displayPhone || '',
        wa_verified_name: verifiedName || '',
        wa_connected_at: new Date().toISOString(),
      }),
    };

    const { error } = await supabase
      .from('config')
      .update(updateData)
      .eq('tenant_id', tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verify the connection works
    const verifyRes = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const verifyData = await verifyRes.json();
    const isVerified = !verifyData.error;

    return NextResponse.json({
      success: true,
      verified: isVerified,
      phoneNumber: verifyData.display_phone_number || displayPhone,
      message: isVerified ? 'WhatsApp conectado exitosamente' : 'Guardado pero no se pudo verificar la conexión',
    });

  } catch (error: any) {
    console.error('Save WA account error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
