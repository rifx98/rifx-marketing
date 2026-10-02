import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { denyUnlessFeature } from '@/lib/feature-access';
import { buildBrainGraph } from '@/lib/brain-graph';
import { getTenantKnowledge, getAllKnowledge } from '@/lib/brain-knowledge-store';
import { getGlobalSalesIntelligence } from '@/lib/brain-sales-intelligence';


export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { code?: string; message?: string } | null;
};

async function optionalRows(
  label: string,
  request: PromiseLike<QueryResult>,
  warnings: string[],
): Promise<Record<string, unknown>[]> {
  const result = await request;
  if (result.error) {
    console.warn(`[brain] Optional source ${label} unavailable:`, result.error.code || 'database_error');
    warnings.push(label);
    return [];
  }
  return result.data || [];
}

export async function GET(req: NextRequest) {
  try {
    let tenant = await getTenantFromRequest(req);
    if (!tenant) {
      if (process.env.NODE_ENV !== 'production') {
        const supabase = createSupabaseAdmin();
        const { data: firstTenant } = await supabase.from('tenants').select('id, email, plan').limit(1).maybeSingle();
        if (firstTenant) {
          tenant = { tenantId: firstTenant.id, email: firstTenant.email, plan: 'master', planStatus: 'active', isAdmin: true };
        }
      }
    }
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    // Brain is strictly restricted to administrator users
    if (!tenant.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso restringido: El Cerebro IA es exclusivo para el panel de administración' },
        { status: 403 }
      );
    }
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    // Check query params for admin multi-tenant inspection - defaults to global across all users
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId');
    let targetTenantId: string | null = null;
    let isGlobalScope = true;
    let targetCompanyName: string | null = null;

    if (requestedTenantId && requestedTenantId !== 'all') {
      targetTenantId = requestedTenantId;
      isGlobalScope = false;
    }

    const supabase = createSupabaseAdmin();

    // Fetch company name if admin is inspecting another specific tenant
    if (tenant.isAdmin && targetTenantId && targetTenantId !== tenant.tenantId) {
      const { data: targetTenantRow } = await supabase
        .from('tenants')
        .select('company_name')
        .eq('id', targetTenantId)
        .maybeSingle();
      if (targetTenantRow?.company_name) {
        targetCompanyName = targetTenantRow.company_name;
      }
    }

    const warnings: string[] = [];

    // 1. Conversations
    let conversationsQuery = supabase
      .from('conversations')
      .select('id,customer_name,phone_number,status,intent,sales_stage,lead_score,last_objection,next_action,business_type,location,budget_range,service_interest,urgency_level,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(isGlobalScope ? 120 : 80);

    if (targetTenantId) {
      conversationsQuery = conversationsQuery.eq('tenant_id', targetTenantId);
    }

    const { data: conversations, error: conversationsError } = await conversationsQuery;

    if (conversationsError) {
      console.error('[brain] Conversation source failed:', conversationsError.code || 'database_error');
      return NextResponse.json(
        { error: 'No se pudo construir la memoria del CRM' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // 2. Messages
    const conversationIds = (conversations || []).map((row) => row.id).filter(Boolean);
    let messageRequest: PromiseLike<QueryResult>;
    if (conversationIds.length > 0) {
      let msgQuery = supabase
        .from('messages')
        .select('id,conversation_id,role,content,created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(isGlobalScope ? 320 : 240);

      if (targetTenantId) {
        msgQuery = msgQuery.eq('tenant_id', targetTenantId);
      }
      messageRequest = msgQuery as unknown as PromiseLike<QueryResult>;
    } else {
      messageRequest = Promise.resolve({ data: [], error: null });
    }

    // 3. Knowledge
    let knowQuery = supabase
      .from('knowledge_documents')
      .select('id,file_name,file_type,active,status,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(isGlobalScope ? 60 : 40);
    if (targetTenantId) {
      knowQuery = knowQuery.eq('tenant_id', targetTenantId);
    }

    // 4. Appointments
    let apptQuery = supabase
      .from('appointments')
      .select('id,conversation_id,customer_name,phone_number,scheduled_time,service,resource_name,status,created_at')
      .order('created_at', { ascending: false })
      .limit(isGlobalScope ? 80 : 50);
    if (targetTenantId) {
      apptQuery = apptQuery.eq('tenant_id', targetTenantId);
    }

    // 5. Sales
    let saleQuery = supabase
      .from('sales')
      .select('id,conversation_id,customer_name,amount,service,status,created_at')
      .order('created_at', { ascending: false })
      .limit(isGlobalScope ? 80 : 50);
    if (targetTenantId) {
      saleQuery = saleQuery.eq('tenant_id', targetTenantId);
    }

    // 6. Voice Calls
    let voiceQuery = supabase
      .from('voice_call_logs')
      .select('id,direction,from_number,to_number,duration_seconds,status,summary,created_at')
      .order('created_at', { ascending: false })
      .limit(isGlobalScope ? 60 : 40);
    if (targetTenantId) {
      voiceQuery = voiceQuery.eq('tenant_id', targetTenantId);
    }

    // 7. Ad Campaigns (Pautas Publicitarias)
    let campQuery = supabase
      .from('ad_campaigns')
      .select('id,title,description,hook,caption,hashtags,daily_budget,target_audience,copy_framework,hook_variants,campaign_config,status,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(isGlobalScope ? 40 : 20);
    if (targetTenantId) {
      campQuery = campQuery.eq('tenant_id', targetTenantId);
    }

    const [messages, knowledge, appointments, sales, voiceCalls, campaigns] = await Promise.all([
      optionalRows('messages', messageRequest, warnings),
      optionalRows('knowledge', knowQuery as unknown as PromiseLike<QueryResult>, warnings),
      optionalRows('appointments', apptQuery as unknown as PromiseLike<QueryResult>, warnings),
      optionalRows('sales', saleQuery as unknown as PromiseLike<QueryResult>, warnings),
      optionalRows('voiceCalls', voiceQuery as unknown as PromiseLike<QueryResult>, warnings),
      optionalRows('ad_campaigns', campQuery as unknown as PromiseLike<QueryResult>, warnings),
    ]);

    const coreLabel = isGlobalScope
      ? 'Cerebro IA Global · Red Multi-Tenant'
      : targetCompanyName
        ? `Cerebro CRM · ${targetCompanyName}`
        : 'Cerebro CRM';

    const coreSummary = isGlobalScope
      ? 'Memoria cognitiva conectada de toda la plataforma RIFX'
      : 'Memoria conectada del negocio';

    // Ingest custom brain rules and knowledge into 3D graph
    const customKnowledgeItems = targetTenantId
      ? await getTenantKnowledge(targetTenantId).catch(() => [])
      : await getAllKnowledge().catch(() => []);
    const formattedCustomKnowledge = customKnowledgeItems.map((item) => ({
      id: item.id,
      file_name: `[${item.category.toUpperCase()}] ${item.title}`,
      file_type: 'regla',
      active: item.active,
      status: 'ready',
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      content: item.content,
    }));
    const combinedKnowledge = [...(knowledge || []), ...formattedCustomKnowledge];

    const graph = buildBrainGraph({
      conversations: (conversations || []) as Record<string, unknown>[],
      messages,
      knowledge: combinedKnowledge,
      appointments,
      sales,
      voiceCalls,
      campaigns,
      coreLabel,
      coreSummary,
      scope: isGlobalScope ? 'global' : 'tenant',
    });


    const salesIntelligence = await getGlobalSalesIntelligence().catch(() => null);

    return NextResponse.json(
      {
        ...graph,
        salesIntelligence,
        warnings,
        scope: isGlobalScope ? 'global' : 'tenant',
        selectedTenantId: targetTenantId || 'all',

        companyName: targetCompanyName || null,
        limits: {
          conversations: isGlobalScope ? 120 : 80,
          messages: isGlobalScope ? 320 : 240,
          knowledge: isGlobalScope ? 60 : 40,
          appointments: isGlobalScope ? 80 : 50,
          sales: isGlobalScope ? 80 : 50,
          voiceCalls: isGlobalScope ? 60 : 40,
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[brain] Unexpected graph error:', error);
    return NextResponse.json(
      { error: 'Error interno al construir el cerebro del CRM' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
