import type { SupabaseClient } from '@supabase/supabase-js';
import { getSafeAIConfig } from './ai-service';

export async function getAISummary(db: SupabaseClient, tenantId: string, month = new Date().toISOString().slice(0, 7)) {
  const start = `${month}-01T00:00:00.000Z`;
  const next = new Date(`${month}-01T00:00:00.000Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);

  const [config, usageResult] = await Promise.all([
    getSafeAIConfig(db, tenantId),
    db.from('ai_usage').select('credits,provider_cost,sale_amount,input_tokens,output_tokens').eq('tenant_id', tenantId).gte('created_at', start).lt('created_at', next.toISOString()),
  ]);
  if (usageResult.error) throw usageResult.error;

  const usage = usageResult.data || [];
  const creditsUsed = usage.reduce((sum, row) => sum + Number(row.credits || 0), 0);
  const providerCost = usage.reduce((sum, row) => sum + Number(row.provider_cost || 0), 0);
  const usageRevenue = usage.reduce((sum, row) => sum + Number(row.sale_amount || 0), 0);
  const addon = config.enabled ? Number(config.monthly_addon_price || 0) : 0;

  return {
    month,
    config,
    creditsAvailable: Number(config.credits_balance || 0),
    creditsUsed,
    calls: usage.length,
    providerCost,
    usageRevenue,
    monthlyAddonRevenue: addon,
    estimatedRevenue: usageRevenue + addon,
    estimatedMargin: usageRevenue + addon - providerCost,
    lowBalance: Number(config.credits_balance || 0) <= Number(config.low_balance_threshold || 0),
  };
}
