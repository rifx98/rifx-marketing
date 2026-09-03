BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_tenant_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai','anthropic','gemini','compatible')),
  model text NOT NULL DEFAULT '',
  compatible_endpoint text,
  system_prompt text NOT NULL DEFAULT '',
  max_output_tokens integer NOT NULL DEFAULT 350 CHECK (max_output_tokens BETWEEN 32 AND 131072),
  api_key_encrypted text,
  credits_balance bigint NOT NULL DEFAULT 0 CHECK (credits_balance >= 0),
  credits_per_1k_input numeric(18,6) NOT NULL DEFAULT 1 CHECK (credits_per_1k_input >= 0),
  credits_per_1k_output numeric(18,6) NOT NULL DEFAULT 4 CHECK (credits_per_1k_output >= 0),
  min_credits_per_request bigint NOT NULL DEFAULT 1 CHECK (min_credits_per_request >= 0),
  provider_cost_input_per_1m numeric(18,8) NOT NULL DEFAULT 0 CHECK (provider_cost_input_per_1m >= 0),
  provider_cost_output_per_1m numeric(18,8) NOT NULL DEFAULT 0 CHECK (provider_cost_output_per_1m >= 0),
  sale_price_per_1000_credits numeric(18,8) NOT NULL DEFAULT 0 CHECK (sale_price_per_1000_credits >= 0),
  monthly_addon_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (monthly_addon_price >= 0),
  low_balance_threshold bigint NOT NULL DEFAULT 1000 CHECK (low_balance_threshold >= 0),
  hard_stop boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase','usage','bonus','refund','adjustment')),
  amount bigint NOT NULL,
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  reference_type text,
  reference_id text,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  conversation_id uuid,
  flow_key text,
  node_id text,
  source text NOT NULL DEFAULT 'flow',
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  credits bigint NOT NULL DEFAULT 0,
  provider_cost numeric(18,8) NOT NULL DEFAULT 0,
  sale_amount numeric(18,8) NOT NULL DEFAULT 0,
  latency_ms integer,
  provider_request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_tenant_created
  ON public.ai_credit_ledger(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_created
  ON public.ai_usage(tenant_id, created_at DESC);

ALTER TABLE public.ai_tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tenant_config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_ai_credit_delta(
  p_tenant_id uuid,
  p_type text,
  p_amount bigint,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS public.ai_credit_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.ai_tenant_config%ROWTYPE;
  v_new_balance bigint;
  v_ledger public.ai_credit_ledger%ROWTYPE;
BEGIN
  IF p_type NOT IN ('purchase','usage','bonus','refund','adjustment') THEN
    RAISE EXCEPTION 'Tipo de movimiento IA inválido';
  END IF;

  INSERT INTO public.ai_tenant_config(tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT * INTO v_config
  FROM public.ai_tenant_config
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  v_new_balance := v_config.credits_balance + p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Créditos IA insuficientes';
  END IF;

  UPDATE public.ai_tenant_config
  SET credits_balance = v_new_balance,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.ai_credit_ledger(
    tenant_id,type,amount,balance_after,reference_type,reference_id,description,created_by
  ) VALUES (
    p_tenant_id,p_type,p_amount,v_new_balance,p_reference_type,p_reference_id,p_description,p_created_by
  ) RETURNING * INTO v_ledger;

  RETURN v_ledger;
END;
$$;


CREATE OR REPLACE FUNCTION public.record_ai_usage_and_debit(
  p_usage_id uuid,
  p_tenant_id uuid,
  p_whatsapp_account_id uuid,
  p_conversation_id uuid,
  p_flow_key text,
  p_node_id text,
  p_source text,
  p_provider text,
  p_model text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_credits bigint,
  p_provider_cost numeric,
  p_sale_amount numeric,
  p_latency_ms integer,
  p_provider_request_id text
)
RETURNS public.ai_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.ai_tenant_config%ROWTYPE;
  v_usage public.ai_usage%ROWTYPE;
  v_new_balance bigint;
BEGIN
  SELECT * INTO v_config
  FROM public.ai_tenant_config
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuración IA no encontrada';
  END IF;

  v_new_balance := v_config.credits_balance - p_credits;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Créditos IA insuficientes';
  END IF;

  INSERT INTO public.ai_usage(
    id,tenant_id,whatsapp_account_id,conversation_id,flow_key,node_id,source,
    provider,model,input_tokens,output_tokens,credits,provider_cost,sale_amount,
    latency_ms,provider_request_id
  ) VALUES (
    p_usage_id,p_tenant_id,p_whatsapp_account_id,p_conversation_id,p_flow_key,p_node_id,
    COALESCE(p_source,'flow'),p_provider,p_model,p_input_tokens,p_output_tokens,p_credits,
    p_provider_cost,p_sale_amount,p_latency_ms,p_provider_request_id
  ) RETURNING * INTO v_usage;

  UPDATE public.ai_tenant_config
  SET credits_balance = v_new_balance,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.ai_credit_ledger(
    tenant_id,type,amount,balance_after,reference_type,reference_id,description
  ) VALUES (
    p_tenant_id,'usage',-p_credits,v_new_balance,'ai_usage',p_usage_id::text,
    'Consumo IA ' || p_provider || '/' || p_model
  );

  RETURN v_usage;
END;
$$;

COMMIT;
