BEGIN;

-- 1. Table for outreach contacts & proposals
CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  business text NOT NULL CHECK (length(business) BETWEEN 1 AND 160),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  observation text NOT NULL CHECK (length(observation) BETWEEN 1 AND 1600),
  proposal text NOT NULL CHECK (length(proposal) BETWEEN 1 AND 2400),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  template_html text CHECK (length(template_html) <= 64000),
  delivery_status text NOT NULL DEFAULT 'draft' CHECK (delivery_status IN ('draft','sending','sent','uncertain')),
  stage text NOT NULL DEFAULT 'pending' CHECK (stage IN ('pending','replied','meeting','won','declined')),
  suppressed boolean NOT NULL DEFAULT false,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outreach_contacts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_contacts TO service_role;
CREATE INDEX IF NOT EXISTS outreach_contacts_tenant_created ON public.outreach_contacts(tenant_id, created_at DESC);

-- 2. Table for custom templates
CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  html text NOT NULL CHECK (length(html) BETWEEN 1 AND 64000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outreach_templates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_templates TO service_role;
CREATE INDEX IF NOT EXISTS outreach_templates_tenant ON public.outreach_templates(tenant_id, created_at DESC);

COMMIT;
