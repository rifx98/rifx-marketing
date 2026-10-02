-- ==============================================================================
-- RIFX Marketing — Migración 038: Agregar twilio_phone_sid para Aprovisionamiento SaaS
-- ==============================================================================

ALTER TABLE IF EXISTS public.voice_agent_settings
ADD COLUMN IF NOT EXISTS twilio_phone_sid TEXT;
