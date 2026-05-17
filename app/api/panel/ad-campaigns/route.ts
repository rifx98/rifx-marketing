import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// GET /api/panel/ad-campaigns - Obtener campañas del tenant
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('ad_campaigns')
      .select(`
        *,
        ad_creatives (id, banner_url, product_image_url, reference_image_url, ai_score),
        ad_analytics (impressions, clicks, spend, conversions, ctr, date)
      `)
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching campaigns:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaigns: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/panel/ad-campaigns - Crear nueva campaña
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const supabase = createSupabaseAdmin();

    // Insertar campaña
    const { data: campaign, error: campaignError } = await supabase
      .from('ad_campaigns')
      .insert({
        tenant_id: tenant.tenantId,
        title: body.title || null,
        description: body.description || null,
        hook: body.hook || null,
        caption: body.caption || null,
        hashtags: body.hashtags || null,
        daily_budget: body.daily_budget || 5.00,
        target_audience: body.target_audience || {},
        copy_framework: body.copy_framework || null,
        hook_variants: body.hook_variants || [],
        campaign_config: body.campaign_config || {},
        status: body.status || 'draft',
        facebook_campaign_id: body.facebook_campaign_id || null,
        facebook_adset_id: body.facebook_adset_id || null,
        facebook_ad_id: body.facebook_ad_id || null,
        published_at: body.status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }

    // Insertar creative si hay banner
    if (body.banner_url || body.product_image_url || body.reference_image_url) {
      await supabase.from('ad_creatives').insert({
        campaign_id: campaign.id,
        tenant_id: tenant.tenantId,
        banner_url: body.banner_url || null,
        product_image_url: body.product_image_url || null,
        reference_image_url: body.reference_image_url || null,
        ai_prompt: body.ai_prompt || null,
        ai_score: body.ai_score || null,
        ai_feedback: body.ai_feedback || null,
      });
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/panel/ad-campaigns - Actualizar campaña
export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'published') updateData.published_at = new Date().toISOString();
    }
    if (body.daily_budget !== undefined) updateData.daily_budget = body.daily_budget;
    if (body.facebook_campaign_id !== undefined) updateData.facebook_campaign_id = body.facebook_campaign_id;
    if (body.facebook_adset_id !== undefined) updateData.facebook_adset_id = body.facebook_adset_id;
    if (body.facebook_ad_id !== undefined) updateData.facebook_ad_id = body.facebook_ad_id;

    const { data, error } = await supabase
      .from('ad_campaigns')
      .update(updateData)
      .eq('id', body.id)
      .eq('tenant_id', tenant.tenantId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
