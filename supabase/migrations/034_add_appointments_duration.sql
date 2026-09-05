-- ============================================
-- RIFX Marketing — Add duration_minutes to appointments
-- Phase 3.7: Support custom appointment durations (15m, 30m, 45m, 1h, 1.5h, 2h, etc.)
-- ============================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;

CREATE INDEX IF NOT EXISTS idx_appointments_duration ON public.appointments(duration_minutes);
