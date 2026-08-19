import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READ_STATUSES = new Set(['draft', 'published', 'paused', 'completed', 'archived']);
const MUTABLE_STATUSES = new Set(['draft', 'paused', 'completed', 'archived']);
const PROVIDER_ID_PATTERN = /^\d{1,64}$/;
const CAMPAIGN_SELECT = 'id,title,description,hook,caption,hashtags,daily_budget,total_spent,target_audience,copy_framework,hook_variants,campaign_config,status,facebook_campaign_id,facebook_adset_id,facebook_ad_id,published_at,created_at,updated_at';

async function authorize(req: NextRequest, namespace: string, attempts: number) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.tenantId) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const;
  }
  const featureDenied = denyUnlessFeature(tenant, 'campaigns');
  if (featureDenied) return { response: featureDenied } as const;
  const rateDenied = await enforceTenantRateLimit(namespace, tenant.tenantId, attempts, 60_000);
  if (rateDenied) return { response: rateDenied } as const;
  return { tenant } as const;
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return normalized ? undefined : null;
  return normalized;
}

function providerId(value: unknown): string | null | undefined {
  const normalized = optionalText(value, 64);
  if (normalized === undefined || normalized === null) return normalized;
  return PROVIDER_ID_PATTERN.test(normalized) ? normalized : undefined;
}

function httpsUrl(value: unknown): string | null | undefined {
  const normalized = optionalText(value, 2_048);
  if (normalized === undefined || normalized === null) return normalized;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function plainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hookVariants(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const variants: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > 500) return null;
    variants.push(item.trim());
  }
  return variants;
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'ad-campaigns-read', 90);
    if ('response' in authorization) return authorization.response;
    const status = req.nextUrl.searchParams.get('status');
    if (status && !READ_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get('limit') || 20);
    const offset = Number(req.nextUrl.searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
        || !Number.isSafeInteger(offset) || offset < 0 || offset > 10_000) {
      return NextResponse.json({ error: 'Paginacion invalida' }, { status: 400 });
    }

    let query = createSupabaseAdmin()
      .from('ad_campaigns')
      .select(`${CAMPAIGN_SELECT},ad_creatives(id,banner_url,product_image_url,reference_image_url,ai_score),ad_analytics(impressions,clicks,spend,conversions,ctr,date)`)
      .eq('tenant_id', authorization.tenant.tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) {
      console.error('Ad campaign lookup failed:', error.code || 'database_error');
      return internalApiError();
    }
    return NextResponse.json(
      { success: true, campaigns: data || [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    console.error('Ad campaign request failed');
    return internalApiError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'ad-campaigns-write', 20);
    if ('response' in authorization) return authorization.response;
    const parsed = await readLimitedJsonObject(req, 64 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;

    const title = optionalText(body.title, 200);
    const description = optionalText(body.description, 4_000);
    const hook = optionalText(body.hook, 1_000);
    const caption = optionalText(body.caption, 4_000);
    const hashtags = optionalText(body.hashtags, 1_000);
    const copyFramework = optionalText(body.copy_framework, 100);
    const targetAudience = body.target_audience === undefined ? {} : plainObject(body.target_audience);
    const campaignConfig = body.campaign_config === undefined ? {} : plainObject(body.campaign_config);
    const variants = hookVariants(body.hook_variants);
    const dailyBudget = body.daily_budget === undefined ? 5 : body.daily_budget;
    if (
      [title, description, hook, caption, hashtags, copyFramework].some((value) => value === undefined)
      || targetAudience === null
      || campaignConfig === null
      || variants === null
      || typeof dailyBudget !== 'number'
      || !Number.isFinite(dailyBudget)
      || dailyBudget < 0
      || dailyBudget > 99_999_999.99
      || (body.status !== undefined && body.status !== 'draft')
    ) {
      return NextResponse.json({ error: 'Datos de campana invalidos' }, { status: 400 });
    }

    const facebookCampaignId = providerId(body.facebook_campaign_id);
    const facebookAdsetId = providerId(body.facebook_adset_id);
    const facebookAdId = providerId(body.facebook_ad_id);
    if ([facebookCampaignId, facebookAdsetId, facebookAdId].some((value) => value === undefined)) {
      return NextResponse.json({ error: 'ID de proveedor invalido' }, { status: 400 });
    }

    const bannerUrl = httpsUrl(body.banner_url);
    const productImageUrl = httpsUrl(body.product_image_url);
    const referenceImageUrl = httpsUrl(body.reference_image_url);
    const aiPrompt = optionalText(body.ai_prompt, 10_000);
    const aiFeedback = optionalText(body.ai_feedback, 4_000);
    const aiScore = body.ai_score === undefined || body.ai_score === null ? null : body.ai_score;
    if (
      [bannerUrl, productImageUrl, referenceImageUrl, aiPrompt, aiFeedback].some((value) => value === undefined)
      || (aiScore !== null && (typeof aiScore !== 'number' || !Number.isFinite(aiScore) || aiScore < 0 || aiScore > 10))
    ) {
      return NextResponse.json({ error: 'Datos creativos invalidos' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: campaign, error: campaignError } = await supabase
      .from('ad_campaigns')
      .insert({
        tenant_id: authorization.tenant.tenantId,
        title,
        description,
        hook,
        caption,
        hashtags,
        daily_budget: Math.round(dailyBudget * 100) / 100,
        target_audience: targetAudience,
        copy_framework: copyFramework,
        hook_variants: variants,
        campaign_config: campaignConfig,
        status: 'draft',
        facebook_campaign_id: facebookCampaignId,
        facebook_adset_id: facebookAdsetId,
        facebook_ad_id: facebookAdId,
      })
      .select(CAMPAIGN_SELECT)
      .single();
    if (campaignError || !campaign) {
      console.error('Ad campaign creation failed:', campaignError?.code || 'invalid_result');
      return internalApiError();
    }

    if (bannerUrl || productImageUrl || referenceImageUrl) {
      const { error: creativeError } = await supabase.from('ad_creatives').insert({
        campaign_id: campaign.id,
        tenant_id: authorization.tenant.tenantId,
        banner_url: bannerUrl,
        product_image_url: productImageUrl,
        reference_image_url: referenceImageUrl,
        ai_prompt: aiPrompt,
        ai_score: aiScore,
        ai_feedback: aiFeedback,
      });
      if (creativeError) {
        const { error: rollbackError } = await supabase
          .from('ad_campaigns')
          .delete()
          .eq('id', campaign.id)
          .eq('tenant_id', authorization.tenant.tenantId);
        console.error('Ad creative creation failed:', creativeError.code || 'database_error');
        if (rollbackError) console.error('Ad campaign compensation failed:', rollbackError.code || 'database_error');
        return internalApiError();
      }
    }
    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch {
    console.error('Ad campaign creation failed');
    return internalApiError();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'ad-campaigns-write', 30);
    if ('response' in authorization) return authorization.response;
    const parsed = await readLimitedJsonObject(req, 32 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    if (typeof body.id !== 'string' || !UUID_PATTERN.test(body.id)) {
      return NextResponse.json({ error: 'ID de campana invalido' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    for (const [field, maxLength] of [['title', 200], ['description', 4_000]] as const) {
      if (body[field] !== undefined) {
        const value = optionalText(body[field], maxLength);
        if (value === undefined) return NextResponse.json({ error: 'Texto invalido' }, { status: 400 });
        updateData[field] = value;
      }
    }
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !MUTABLE_STATUSES.has(body.status)) {
        return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
      }
      updateData.status = body.status;
    }
    if (body.daily_budget !== undefined) {
      if (typeof body.daily_budget !== 'number' || !Number.isFinite(body.daily_budget)
          || body.daily_budget < 0 || body.daily_budget > 99_999_999.99) {
        return NextResponse.json({ error: 'Presupuesto invalido' }, { status: 400 });
      }
      updateData.daily_budget = Math.round(body.daily_budget * 100) / 100;
    }
    for (const field of ['facebook_campaign_id', 'facebook_adset_id', 'facebook_ad_id'] as const) {
      if (body[field] !== undefined) {
        const value = providerId(body[field]);
        if (value === undefined) return NextResponse.json({ error: 'ID de proveedor invalido' }, { status: 400 });
        updateData[field] = value;
      }
    }
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    const { data, error } = await createSupabaseAdmin()
      .from('ad_campaigns')
      .update(updateData)
      .eq('id', body.id)
      .eq('tenant_id', authorization.tenant.tenantId)
      .select(CAMPAIGN_SELECT)
      .maybeSingle();
    if (error) {
      console.error('Ad campaign update failed:', error.code || 'database_error');
      return internalApiError();
    }
    if (!data) return NextResponse.json({ error: 'Campana no encontrada' }, { status: 404 });
    return NextResponse.json({ success: true, campaign: data });
  } catch {
    console.error('Ad campaign update failed');
    return internalApiError();
  }
}
