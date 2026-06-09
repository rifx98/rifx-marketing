-- ============================================
-- RIFX Marketing — Appointments v2 Migration
-- Phase 3.5: Support additional statuses, 24h/2h/30m reminders, and unique tenant-event constraint.
-- ============================================

-- 1. Actualizar la restricción de estados permitidos en citas
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (
  status IN ('pending', 'confirmed', 'awaiting_reschedule', 'rescheduled', 'cancelled', 'completed', 'no_show', 'pending_completion')
);

-- 2. Agregar campos para recordatorios detallados y auditoría
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_30m_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_message TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 3. Eliminar la columna simplificada anterior (si existe)
ALTER TABLE appointments DROP COLUMN IF EXISTS reminder_sent;

-- 4. Agregar restricción de clave única compuesta para evitar colisiones entre tenants
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_tenant_event_unique;
ALTER TABLE appointments ADD CONSTRAINT appointments_tenant_event_unique UNIQUE (tenant_id, event_id);
