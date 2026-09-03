BEGIN;

CREATE TABLE IF NOT EXISTS public.team_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'Asesor' CHECK (role IN ('Administrador','Supervisor','Asesor')),
  status text NOT NULL DEFAULT 'Disponible' CHECK (status IN ('Disponible','Ocupado','Desconectado')),
  department text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_agents_tenant_status
  ON public.team_agents(tenant_id, status);

ALTER TABLE public.team_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_agents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES public.team_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS bot_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_agent_message_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_account_updated
  ON public.conversations(tenant_id, whatsapp_account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_agent
  ON public.conversations(tenant_id, assigned_agent_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_unread
  ON public.conversations(tenant_id, unread_count)
  WHERE unread_count > 0;

-- Asocia las conversaciones existentes al WhatsApp predeterminado del tenant.
UPDATE public.conversations c
SET whatsapp_account_id = wa.id
FROM public.whatsapp_accounts wa
WHERE c.whatsapp_account_id IS NULL
  AND wa.tenant_id = c.tenant_id
  AND wa.is_default = true;

COMMIT;
