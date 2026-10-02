-- ==============================================================================
-- RIFX Marketing — Migración: Agente de Voz y Llamadas con ElevenLabs
-- Tablas para configuración de agente de voz, voces clonadas y registros de llamadas.
-- ==============================================================================

-- 1. Tabla de Configuración de Agente de Voz por Tenant
CREATE TABLE IF NOT EXISTS public.voice_agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL DEFAULT 'Asistente de Ventas RIFX',
  elevenlabs_api_key TEXT,
  agent_id TEXT,
  voice_id TEXT NOT NULL DEFAULT '21m00Tcm4TlvDq8ikWAM', -- Rachel (Español/Multilingüe)
  voice_name TEXT NOT NULL DEFAULT 'Rachel (Cálida y Profesional)',
  language TEXT NOT NULL DEFAULT 'es',
  system_prompt TEXT DEFAULT 'Eres un asesor comercial experto de la empresa. Tu objetivo es atender con calidez y profesionalismo, responder dudas sobre los servicios, calificar las necesidades del cliente y agendar una llamada o cita de seguimiento si muestra interés.',
  first_message TEXT DEFAULT '¡Hola! Gracias por comunicarte. Soy el asesor inteligente de la empresa, ¿en qué te puedo ayudar hoy?',
  twilio_phone_number TEXT,
  twilio_phone_sid TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  inbound_enabled BOOLEAN NOT NULL DEFAULT true,
  outbound_enabled BOOLEAN NOT NULL DEFAULT true,
  call_cost_per_minute NUMERIC(10, 4) NOT NULL DEFAULT 0.25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla de Voces Clonadas del Tenant
CREATE TABLE IF NOT EXISTS public.voice_clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sample_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla de Registro de Llamadas (Call Logs)
CREATE TABLE IF NOT EXISTS public.voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  call_sid TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound', 'web_test')),
  from_number TEXT,
  to_number TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled')),
  transcript TEXT,
  summary TEXT,
  recording_url TEXT,
  credits_deducted NUMERIC(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_voice_agent_settings_tenant ON public.voice_agent_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_clones_tenant ON public.voice_clones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_tenant ON public.voice_call_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_call_sid ON public.voice_call_logs(call_sid);

-- Habilitar RLS
ALTER TABLE public.voice_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_clones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de aislamiento por tenant
DO $$
BEGIN
  DROP POLICY IF EXISTS "tenant_voice_agent_settings_policy" ON public.voice_agent_settings;
  CREATE POLICY "tenant_voice_agent_settings_policy" ON public.voice_agent_settings
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());

  DROP POLICY IF EXISTS "tenant_voice_clones_policy" ON public.voice_clones;
  CREATE POLICY "tenant_voice_clones_policy" ON public.voice_clones
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());

  DROP POLICY IF EXISTS "tenant_voice_call_logs_policy" ON public.voice_call_logs;
  CREATE POLICY "tenant_voice_call_logs_policy" ON public.voice_call_logs
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
EXCEPTION
  WHEN others THEN NULL;
END $$;
