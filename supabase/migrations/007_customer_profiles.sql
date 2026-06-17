-- ============================================
-- RIFX Marketing — Memoria a Largo Plazo
-- ============================================

CREATE TABLE IF NOT EXISTS customer_profiles (
  phone_number TEXT PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name TEXT,
  business_type TEXT,
  location TEXT,
  budget_range TEXT,
  service_interest TEXT,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- Crear política para backend
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_profiles' AND policyname = 'Service role full access on customer_profiles'
  ) THEN
    CREATE POLICY "Service role full access on customer_profiles" ON customer_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Poblar la memoria a largo plazo con los datos existentes de conversaciones
INSERT INTO customer_profiles (phone_number, tenant_id, customer_name, business_type, location, budget_range, service_interest, last_interaction, updated_at)
SELECT 
  phone_number, 
  tenant_id, 
  MAX(customer_name) as customer_name,
  MAX(business_type) as business_type,
  MAX(location) as location,
  MAX(budget_range) as budget_range,
  MAX(service_interest) as service_interest,
  MAX(updated_at) as last_interaction,
  NOW() as updated_at
FROM conversations
GROUP BY phone_number, tenant_id
ON CONFLICT (phone_number) 
DO UPDATE SET 
  business_type = COALESCE(EXCLUDED.business_type, customer_profiles.business_type),
  location = COALESCE(EXCLUDED.location, customer_profiles.location),
  budget_range = COALESCE(EXCLUDED.budget_range, customer_profiles.budget_range),
  service_interest = COALESCE(EXCLUDED.service_interest, customer_profiles.service_interest),
  last_interaction = EXCLUDED.last_interaction,
  updated_at = NOW();
