import { SupabaseClient } from '@supabase/supabase-js';

export interface DeductCreditsResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

export interface AiCreditsSummary {
  balance: number;
  usedThisMonth: number;
  aiQueriesCount: number;
  providerCostEstimate: string;
}

/**
 * Deduct AI credits atomically from a tenant's balance.
 * Uses the PostgreSQL RPC function `increment_ai_credits` with negative amount.
 */
export async function deductAiCredits(
  supabase: SupabaseClient,
  tenantId: string,
  creditsToDeduct: number = 1,
  reference: string = 'Consulta de IA',
  userId?: string
): Promise<DeductCreditsResult> {
  if (!tenantId || creditsToDeduct <= 0) {
    return { success: false, newBalance: 0, error: 'invalid_params' };
  }

  try {
    const actorId = userId || tenantId;
    const { data: newBalance, error: rpcError } = await supabase.rpc('increment_ai_credits', {
      p_tenant_id: tenantId,
      p_amount: -creditsToDeduct,
      p_note: reference,
      p_user_id: actorId,
    });

    if (rpcError) {
      console.error(`[ai-credits] Error deduciendo créditos para tenant ${tenantId}:`, rpcError.message);
      return { success: false, newBalance: 0, error: rpcError.message };
    }

    const numericBalance = Number(newBalance);
    console.log(`💳 [ai-credits] -${creditsToDeduct} crédito(s) para tenant ${tenantId}. Nuevo saldo: ${numericBalance} (${reference})`);
    return { success: true, newBalance: isNaN(numericBalance) ? 0 : numericBalance };
  } catch (err: any) {
    console.error(`[ai-credits] Excepción deduciendo créditos para tenant ${tenantId}:`, err?.message || err);
    return { success: false, newBalance: 0, error: err?.message || 'unknown_error' };
  }
}

/**
 * Check if a tenant has enough AI credits to perform an AI query.
 * Checks tenant's `ai_credits_balance` or if platform settings has global AI enabled.
 */
export async function hasAvailableCredits(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ hasCredits: boolean; balance: number; isGlobalAi: boolean }> {
  try {
    const [{ data: tenant }, { data: platformSettings }] = await Promise.all([
      supabase.from('tenants').select('ai_credits_balance, is_admin').eq('id', tenantId).maybeSingle(),
      supabase.from('platform_settings').select('global_ai_config').limit(1).maybeSingle(),
    ]);

    const balance = Number(tenant?.ai_credits_balance) || 0;
    const isGlobalAi = !!(platformSettings?.global_ai_config?.enabled && platformSettings?.global_ai_config?.apiKey);

    // If tenant has positive balance OR platform provides global AI for admins/all
    const hasCredits = balance > 0 || isGlobalAi;

    return { hasCredits, balance, isGlobalAi };
  } catch (err) {
    console.error('[ai-credits] Error verificando saldo de créditos:', err);
    return { hasCredits: true, balance: 0, isGlobalAi: false };
  }
}

/**
 * Get aggregated credit usage stats for the current calendar month.
 */
export async function getAiCreditsSummary(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AiCreditsSummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    const [{ data: tenant }, { data: ledgers }] = await Promise.all([
      supabase.from('tenants').select('ai_credits_balance').eq('id', tenantId).maybeSingle(),
      supabase
        .from('ai_credit_ledger')
        .select('amount, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfMonth),
    ]);

    const balance = Number(tenant?.ai_credits_balance) || 0;

    let usedThisMonth = 0;
    let aiQueriesCount = 0;

    for (const item of ledgers || []) {
      const amt = Number(item.amount);
      if (amt < 0) {
        usedThisMonth += Math.abs(amt);
        aiQueriesCount += 1;
      }
    }

    // Standard baseline estimate: ~$0.0020 USD per typical query
    const providerCostEstimate = `$${(usedThisMonth * 0.002).toFixed(4)}`;

    return {
      balance,
      usedThisMonth,
      aiQueriesCount,
      providerCostEstimate,
    };
  } catch (err) {
    console.error('[ai-credits] Error calculando resumen de créditos:', err);
    return {
      balance: 0,
      usedThisMonth: 0,
      aiQueriesCount: 0,
      providerCostEstimate: '$0.0000',
    };
  }
}
