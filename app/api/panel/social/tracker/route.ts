import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// GET /api/panel/social/tracker - Fetch publications and logs securely for the tenant
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
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
      console.warn(`⚠️ [Social Tracker API] Social post ${postId} not found or does not belong to tenant ${tenant.tenantId}`);
      return NextResponse.json({ error: 'Post no encontrado o no autorizado' }, { status: 404 });
    }

    // 2. Fetch publications associated with this post
    const { data: pubsData, error: pubsErr } = await supabase
      .from('social_publications')
      .select(`
        id,
        status,
        last_error,
        social_account_id,
        social_accounts (
          platform,
          platform_username
        )
      `)
      .eq('post_id', postId);

    if (pubsErr) {
      console.error('❌ [Social Tracker API] Error fetching publications:', pubsErr.message);
      return NextResponse.json({ error: 'Error al obtener publicaciones' }, { status: 500 });
    }

    const formattedPubs = (pubsData || []).map((p: any) => ({
      id: p.id,
      status: p.status,
      last_error: p.last_error,
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
        .select('*')
        .in('publication_id', pubIds)
        .order('created_at', { ascending: true });

      if (logsErr) {
        console.error('❌ [Social Tracker API] Error fetching logs:', logsErr.message);
        return NextResponse.json({ error: 'Error al obtener logs' }, { status: 500 });
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
    });

  } catch (error: any) {
    console.error('❌ [Social Tracker API] GET Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
