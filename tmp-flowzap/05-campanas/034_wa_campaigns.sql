BEGIN;

CREATE TABLE IF NOT EXISTS public.wa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled','failed')),
  template_name text,
  template_language text,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  segment_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{"queued":0,"sent":0,"delivered":0,"read":0,"replied":0,"failed":0}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  contact_id uuid,
  phone text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','sent','delivered','read','replied','failed','cancelled','excluded')),
  provider_message_id text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_tenant_status
  ON public.wa_campaigns(tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_claim
  ON public.wa_campaign_recipients(campaign_id, status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_provider_id
  ON public.wa_campaign_recipients(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaign_recipients FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_wa_campaign_batch(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.wa_campaign_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT r.id
    FROM public.wa_campaign_recipients r
    WHERE r.tenant_id = p_tenant_id
      AND r.campaign_id = p_campaign_id
      AND r.status = 'queued'
      AND r.next_attempt_at <= now()
    ORDER BY r.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 500))
  )
  UPDATE public.wa_campaign_recipients r
  SET status = 'processing',
      locked_at = now(),
      attempt_count = r.attempt_count + 1,
      updated_at = now()
  FROM picked
  WHERE r.id = picked.id
  RETURNING r.*;
END;
$$;

COMMIT;
