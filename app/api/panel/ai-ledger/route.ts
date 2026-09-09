import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { getAiCreditsSummary } from '@/lib/ai-credits';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    
    // 1. Get recent ledgers from table `ai_credit_ledger` (singular)
    const { data: ledgers, error: ledgerError } = await supabase
      .from('ai_credit_ledger')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (ledgerError) {
      console.error('[ai-ledger] Error fetching AI ledger:', ledgerError.message);
    }

    // 2. Compute live monthly summary
    const summary = await getAiCreditsSummary(supabase, tenant.tenantId);

    // 3. Determine active provider & AI configured status
    const [{ data: configRow }, { data: platformSettings }] = await Promise.all([
      supabase.from('config').select('openai_key').eq('tenant_id', tenant.tenantId).maybeSingle(),
      supabase.from('platform_settings').select('global_ai_config').limit(1).maybeSingle(),
    ]);

    let extConfig: Record<string, any> = {};
    try {
      if (configRow?.openai_key) {
        extConfig = JSON.parse(configRow.openai_key);
      }
    } catch {
      extConfig = { openai_key: configRow?.openai_key || '' };
    }

    let activeProvider = 'none';
    if (extConfig.gemini_key && String(extConfig.gemini_key).trim().length > 5) {
      activeProvider = 'Gemini';
    } else if (extConfig.groq_key && String(extConfig.groq_key).trim().length > 5) {
      activeProvider = 'Groq';
    } else if (extConfig.openai_key && String(extConfig.openai_key).trim().length > 5 && !extConfig.openai_key.includes('{')) {
      activeProvider = 'OpenAI';
    } else if (platformSettings?.global_ai_config?.enabled && platformSettings?.global_ai_config?.apiKey) {
      activeProvider = 'Plataforma';
    }

    const aiConfigured = activeProvider !== 'none';

    return NextResponse.json({ 
      ledgers: ledgers || [],
      balance: summary.balance,
      stats: {
        used_this_month: summary.usedThisMonth,
        ai_queries: summary.aiQueriesCount,
        provider_cost: summary.providerCostEstimate,
      },
      ai_configured: aiConfigured,
      active_provider: activeProvider,
    });
  } catch (error) {
    console.error('Error in ai-ledger route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
