import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { enforceTenantRateLimit, internalApiError } from '@/lib/request-guards';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET /api/panel/social/tracker - Fetch publications and logs securely for the tenant
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'social');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('social-tracker', tenant.tenantId, 90, 60_000);
    if (rateDenied) return rateDenied;

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId || !UUID_PATTERN.test(postId)) {
      return NextResponse.json({ error: 'Falta parámetro: postId' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Verify that the social post belongs to the authenticated tenant
    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('id')
      .eq('id', postId)
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post no encontrado o no autorizado' }, { status: 404 });
    }

    // 2. Fetch publications associated with this post
    let pubsData: any[] | null = null;
    let pubsErr: any = null;

    const primaryQuery = await supabase
      .from('social_publications')
      .select(`
        id,
        status,
        last_error,
        attempts,
        social_account_id,
        social_accounts!social_publications_social_account_id_fkey (
          platform,
          platform_username
        )
      `)
      .eq('post_id', postId)
      .eq('tenant_id', tenant.tenantId)
      .limit(100);

    pubsData = primaryQuery.data;
    pubsErr = primaryQuery.error;

    if (pubsErr) {
      // Fallback: direct lookup and manual join in case relationship name varies
      const simpleQuery = await supabase
        .from('social_publications')
        .select('id, status, last_error, attempts, social_account_id')
        .eq('post_id', postId)
        .eq('tenant_id', tenant.tenantId)
        .limit(100);

      if (!simpleQuery.error && simpleQuery.data) {
        const accountIds = simpleQuery.data.map((p: any) => p.social_account_id).filter(Boolean);
        const { data: accounts } = accountIds.length > 0
          ? await supabase
              .from('social_accounts')
              .select('id, platform, platform_username')
              .in('id', accountIds)
          : { data: [] };

        const accountMap = new Map((accounts || []).map((a: any) => [a.id, a]));
        pubsData = simpleQuery.data.map((p: any) => ({
          ...p,
          social_accounts: accountMap.get(p.social_account_id) || null,
        }));
        pubsErr = null;
      }
    }

    if (pubsErr) {
      console.error('Social publication tracker lookup failed:', pubsErr.code || 'database_error');
      return internalApiError();
    }

    const formattedPubs = (pubsData || []).map((p: any) => ({
      id: p.id,
      status: p.status,
      last_error: p.last_error,
      attempts: p.attempts || 0,
      max_attempts: 5,
      requires_reconciliation: p.status === 'dead',
      social_account_id: p.social_account_id,
      platform: p.social_accounts?.platform,
      platform_username: p.social_accounts?.platform_username || 'Cuenta'
    }));

    const pubIds = formattedPubs.map(p => p.id);
    let formattedLogs: any[] = [];

    // 3. Fetch logs for these publications
    if (pubIds.length > 0) {
      const { data: logsData, error: logsErr } = await supabase
        .from('social_logs')
        .select('id,publication_id,log_level,message,metadata,created_at')
        .in('publication_id', pubIds)
        .order('created_at', { ascending: true })
        .limit(500);

      if (logsErr) {
        console.error('Social tracker log lookup failed:', logsErr.code || 'database_error');
        return internalApiError();
      }

      formattedLogs = (logsData || []).map((l: any) => {
        const pub = formattedPubs.find(p => p.id === l.publication_id);
        return {
          ...l,
          platform: pub?.platform,
        };
      });
    }

    return NextResponse.json({
      success: true,
      publications: formattedPubs,
      logs: formattedLogs
    }, { headers: { 'Cache-Control': 'private, no-store' } });

  } catch {
    console.error('Social tracker request failed');
    return internalApiError();
  }
}
