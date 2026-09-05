-- ============================================
-- RIFX Marketing — Appointments Multi-Resource & Waitlist Migration
-- Phase 3.6: Support multi-resource/specialist assignment and automated waitlist.
-- ============================================

-- 1. Agregar soporte de recurso/especialista en citas
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.team_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resource_name TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_resource ON public.appointments(tenant_id, resource_id);

-- 2. Crear tabla de Lista de Espera (Waitlist & Overbooking)
CREATE TABLE IF NOT EXISTS public.appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  desired_date DATE NOT NULL,
  preferred_time_range TEXT DEFAULT 'any', -- 'any', 'morning', 'afternoon', '10:00 - 12:00'
  service TEXT NOT NULL DEFAULT 'General',
  resource_id UUID REFERENCES public.team_agents(id) ON DELETE SET NULL,
  resource_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'cancelled', 'expired')),
  notes TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices de búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_date ON public.appointment_waitlist(tenant_id, desired_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.appointment_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_phone ON public.appointment_waitlist(tenant_id, phone_number);

-- 4. Seguridad RLS
ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_waitlist FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to waitlist"
  ON public.appointment_waitlist FOR ALL TO service_role USING (true) WITH CHECK (true);
