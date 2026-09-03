BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'WhatsApp',
  provider text NOT NULL DEFAULT 'meta_cloud',
  phone_number text,
  phone_number_id text NOT NULL,
  business_account_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error')),
  is_default boolean NOT NULL DEFAULT false,
  legacy_config_backed boolean NOT NULL DEFAULT false,
  access_token_encrypted text,
  verify_token_encrypted text,
  app_secret_encrypted text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_tenant
  ON public.whatsapp_accounts(tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_accounts_one_default
  ON public.whatsapp_accounts(tenant_id)
  WHERE is_default = true;

ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_accounts FORCE ROW LEVEL SECURITY;

-- Migra la configuración actual como la primera cuenta del tenant.
-- Por seguridad NO duplica el access token en otra columna sin cifrar.
-- `legacy_config_backed = true` indica al servicio que puede resolver temporalmente
-- el token desde `config.whatsapp_token` para la cuenta predeterminada.
INSERT INTO public.whatsapp_accounts (
  tenant_id,
  name,
  phone_number,
  phone_number_id,
  is_default,
  legacy_config_backed
)
SELECT
  c.tenant_id,
  COALESCE(NULLIF(c.wa_display_phone, ''), 'WhatsApp principal'),
  NULLIF(c.wa_display_phone, ''),
  c.whatsapp_phone_id,
  true,
  true
FROM public.config c
WHERE c.whatsapp_phone_id IS NOT NULL
  AND c.whatsapp_phone_id <> ''
ON CONFLICT (tenant_id, phone_number_id) DO NOTHING;

COMMIT;
