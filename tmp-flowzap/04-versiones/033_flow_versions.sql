BEGIN;

CREATE TABLE IF NOT EXISTS public.flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  flow_key text NOT NULL,
  flow_name text NOT NULL,
  schema_version integer NOT NULL DEFAULT 2,
  version_number integer NOT NULL,
  kind text NOT NULL DEFAULT 'draft' CHECK (kind IN ('draft','published','restored')),
  flow_data jsonb NOT NULL,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, flow_key, version_number)
);

CREATE INDEX IF NOT EXISTS idx_flow_versions_tenant_flow
  ON public.flow_versions(tenant_id, flow_key, version_number DESC);

ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_versions FORCE ROW LEVEL SECURITY;

COMMIT;
