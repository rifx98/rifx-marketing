-- ==============================================================================
-- RIFX Marketing — Corrección de Restricciones para Citas Manuales y Multi-Recurso
-- Ejecuta este script en Supabase: Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Permitir que conversation_id sea opcional (NULL) para citas manuales/directas
DO $$
BEGIN
  ALTER TABLE public.appointments ALTER COLUMN conversation_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 2. Permitir que event_id sea opcional (NULL) si no hay Google Calendar conectado
DO $$
BEGIN
  ALTER TABLE public.appointments ALTER COLUMN event_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 3. Agregar columnas para soporte de especialistas y recursos
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS resource_id UUID,
  ADD COLUMN IF NOT EXISTS resource_name TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_30m_sent BOOLEAN DEFAULT false;

-- 4. Actualizar restricción de estados para admitir todos los estados del CRM
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK (
  status IN (
    'pending',
    'confirmed',
    'awaiting_reschedule',
    'rescheduled',
    'cancelled',
    'completed',
    'no_show',
    'pending_completion'
  )
);

-- 5. Crear tabla de Lista de Espera & Overbooking si aún no existe
CREATE TABLE IF NOT EXISTS public.appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  desired_date DATE NOT NULL,
  preferred_time_range TEXT DEFAULT 'any',
  service TEXT NOT NULL DEFAULT 'General',
  resource_id UUID,
  resource_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'cancelled', 'expired')),
  notes TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices y Seguridad RLS
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_date ON public.appointment_waitlist(tenant_id, desired_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.appointment_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_phone ON public.appointment_waitlist(tenant_id, phone_number);

ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_waitlist FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'appointment_waitlist' 
      AND policyname = 'Service role full access to waitlist'
  ) THEN
    CREATE POLICY "Service role full access to waitlist"
      ON public.appointment_waitlist FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
