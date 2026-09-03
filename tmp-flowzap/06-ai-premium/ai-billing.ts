import type { AIConfig } from './ai-types';

export function approximateTokens(text: string) {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

export function calculateCredits(config: AIConfig, inputTokens: number, outputTokens: number) {
  const raw = (inputTokens / 1000) * Number(config.credits_per_1k_input || 0)
    + (outputTokens / 1000) * Number(config.credits_per_1k_output || 0);
  return Math.max(Number(config.min_credits_per_request || 0), Math.ceil(raw));
}

export function calculateProviderCost(config: AIConfig, inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * Number(config.provider_cost_input_per_1m || 0)
    + (outputTokens / 1_000_000) * Number(config.provider_cost_output_per_1m || 0);
}

export function calculateSaleAmount(config: AIConfig, credits: number) {
  return (credits / 1000) * Number(config.sale_price_per_1000_credits || 0);
}
