-- Migration: Add Global AI Settings
ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS global_ai_config jsonb NOT NULL DEFAULT '{"enabled": false, "provider": "", "model": "", "apiKey": ""}'::jsonb;
