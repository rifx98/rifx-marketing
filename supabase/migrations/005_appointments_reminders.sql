-- ============================================
-- RIFX Marketing — Appointments & Reminders
-- Phase 3: Tracks booked appointments, reminder status, and confirmation state.
-- ============================================

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,            -- Google Calendar event ID
  customer_name TEXT,
  phone_number TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  service TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create policy of service_role access if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'appointments' AND policyname = 'Service role full access on appointments'
  ) THEN
    CREATE POLICY "Service role full access on appointments" ON appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_conversation ON appointments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_time ON appointments(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
