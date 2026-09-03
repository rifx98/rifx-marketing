import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '../01-whatsapp-multinumero/secret-crypto';
import { approximateTokens, calculateCredits, calculateProviderCost, calculateSaleAmount } from './ai-billing';
import { callAIProvider } from './ai-provider-client';
import type { AIConfig, AIProvider } from './ai-types';

export async function getAIConfig(db: SupabaseClient, tenantId: string): Promise<AIConfig> {
  await db.from('ai_tenant_config').upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id', ignoreDuplicates: true });
  const { data, error } = await db.from('ai_tenant_config').select('*').eq('tenant_id', tenantId).single();
  if (error) throw error;
  return data as AIConfig;
}

export async function getSafeAIConfig(db: SupabaseClient, tenantId: string) {
  const config = await getAIConfig(db, tenantId);
  const { api_key_encrypted, ...safe } = config;
  return { ...safe, apiKeyConfigured: Boolean(api_key_encrypted) };
}

export async function saveAIConfig(db: SupabaseClient, tenantId: string, input: {
  enabled?: boolean;
  provider?: AIProvider;
  model?: string;
  compatibleEndpoint?: string | null;
  systemPrompt?: string;
  maxOutputTokens?: number;
  apiKey?: string;
  creditsPer1kInput?: number;
  creditsPer1kOutput?: number;
  minCreditsPerRequest?: number;
  providerCostInputPer1m?: number;
  providerCostOutputPer1m?: number;
  salePricePer1000Credits?: number;
  monthlyAddonPrice?: number;
  lowBalanceThreshold?: number;
  hardStop?: boolean;
}) {
  const patch: Record<string, unknown> = { tenant_id: tenantId, updated_at: new Date().toISOString() };
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.provider) patch.provider = input.provider;
  if (input.model !== undefined) patch.model = input.model.trim();
  if (input.compatibleEndpoint !== undefined) patch.compatible_endpoint = input.compatibleEndpoint?.trim() || null;
  if (input.systemPrompt !== undefined) patch.system_prompt = input.systemPrompt;
  if (input.maxOutputTokens !== undefined) patch.max_output_tokens = Math.max(32, Math.min(131072, input.maxOutputTokens));
  if (input.apiKey?.trim()) patch.api_key_encrypted = encryptSecret(input.apiKey.trim());
  if (input.creditsPer1kInput !== undefined) patch.credits_per_1k_input = Math.max(0, input.creditsPer1kInput);
  if (input.creditsPer1kOutput !== undefined) patch.credits_per_1k_output = Math.max(0, input.creditsPer1kOutput);
  if (input.minCreditsPerRequest !== undefined) patch.min_credits_per_request = Math.max(0, Math.floor(input.minCreditsPerRequest));
  if (input.providerCostInputPer1m !== undefined) patch.provider_cost_input_per_1m = Math.max(0, input.providerCostInputPer1m);
  if (input.providerCostOutputPer1m !== undefined) patch.provider_cost_output_per_1m = Math.max(0, input.providerCostOutputPer1m);
  if (input.salePricePer1000Credits !== undefined) patch.sale_price_per_1000_credits = Math.max(0, input.salePricePer1000Credits);
  if (input.monthlyAddonPrice !== undefined) patch.monthly_addon_price = Math.max(0, input.monthlyAddonPrice);
  if (input.lowBalanceThreshold !== undefined) patch.low_balance_threshold = Math.max(0, Math.floor(input.lowBalanceThreshold));
  if (input.hardStop !== undefined) patch.hard_stop = input.hardStop;

  const { error } = await db.from('ai_tenant_config').upsert(patch, { onConflict: 'tenant_id' });
  if (error) throw error;
  return getSafeAIConfig(db, tenantId);
}

export async function addAICredits(db: SupabaseClient, tenantId: string, amount: number, input: {
  type?: 'purchase'|'bonus'|'refund'|'adjustment';
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdBy?: string | null;
} = {}) {
  const integerAmount = Math.trunc(amount);
  if (!integerAmount) throw new Error('El movimiento de créditos no puede ser 0.');
  const { data, error } = await db.rpc('apply_ai_credit_delta', {
    p_tenant_id: tenantId,
    p_type: input.type || 'purchase',
    p_amount: integerAmount,
    p_reference_type: input.referenceType || null,
    p_reference_id: input.referenceId || null,
    p_description: input.description || null,
    p_created_by: input.createdBy || null,
  });
  if (error) throw error;
  return data;
}

export async function executeTenantAI(db: SupabaseClient, tenantId: string, prompt: string, meta: {
  whatsappAccountId?: string;
  conversationId?: string;
  flowKey?: string;
  nodeId?: string;
  source?: string;
  model?: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
} = {}) {
  const config = await getAIConfig(db, tenantId);
  if (!config.enabled) throw new Error('FlowZap AI está desactivado para esta empresa.');
  const apiKey = decryptSecret(config.api_key_encrypted);
  if (!apiKey) throw new Error('No hay API Key configurada para esta empresa.');
  if (!prompt.trim()) throw new Error('El prompt está vacío.');

  const estimatedInput = approximateTokens(`${meta.systemPrompt ?? config.system_prompt}\n${prompt}`);
  const estimatedOutput = Number(meta.maxOutputTokens || config.max_output_tokens || 350);
  const estimatedCredits = calculateCredits(config, estimatedInput, estimatedOutput);
  if (config.hard_stop && Number(config.credits_balance) < estimatedCredits) throw new Error('Créditos IA insuficientes.');

  const started = Date.now();
  const result = await callAIProvider(config, apiKey, prompt, meta);
  if (!result.text) throw new Error('El proveedor IA devolvió una respuesta vacía.');

  const inputTokens = result.inputTokens || estimatedInput;
  const outputTokens = result.outputTokens || approximateTokens(result.text);
  const credits = calculateCredits(config, inputTokens, outputTokens);
  const providerCost = calculateProviderCost(config, inputTokens, outputTokens);
  const saleAmount = calculateSaleAmount(config, credits);

  const usageId = crypto.randomUUID();
  const { error: debitError } = await db.rpc('record_ai_usage_and_debit', {
    p_usage_id: usageId,
    p_tenant_id: tenantId,
    p_whatsapp_account_id: meta.whatsappAccountId || null,
    p_conversation_id: meta.conversationId || null,
    p_flow_key: meta.flowKey || null,
    p_node_id: meta.nodeId || null,
    p_source: meta.source || 'flow',
    p_provider: config.provider,
    p_model: meta.model || config.model,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_credits: credits,
    p_provider_cost: providerCost,
    p_sale_amount: saleAmount,
    p_latency_ms: Date.now() - started,
    p_provider_request_id: result.requestId || null,
  });
  if (debitError) throw debitError;

  const refreshed = await getAIConfig(db, tenantId);
  return {
    text: result.text,
    credits,
    creditsRemaining: Number(refreshed.credits_balance),
    usage: { inputTokens, outputTokens, providerCost, saleAmount, provider: config.provider, model: meta.model || config.model },
  };
}
