export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'compatible';

export type AIConfig = {
  tenant_id: string;
  enabled: boolean;
  provider: AIProvider;
  model: string;
  compatible_endpoint: string | null;
  system_prompt: string;
  max_output_tokens: number;
  api_key_encrypted: string | null;
  credits_balance: number;
  credits_per_1k_input: number;
  credits_per_1k_output: number;
  min_credits_per_request: number;
  provider_cost_input_per_1m: number;
  provider_cost_output_per_1m: number;
  sale_price_per_1000_credits: number;
  monthly_addon_price: number;
  low_balance_threshold: number;
  hard_stop: boolean;
};

export type AIProviderResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  requestId?: string;
};
