-- ============================================
-- RIFX Marketing — Migration 034: Appointment Briefing & Chat Context
-- Phase 6: Stores AI-generated context and conversation briefing for sales advisors
-- ============================================

-- Ensure confirmation_message and notes exist for storing AI briefing
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_message TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.appointments.confirmation_message IS 'Almacena el briefing estructurado con IA (Motivo, Contexto del chat, Recomendación de qué decirle al cliente)';
COMMENT ON COLUMN public.conversations.notes IS 'Notas y contexto sincronizado de la conversación para seguimiento comercial';
