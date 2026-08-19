# 🔧 Ejecutar Migración de Base de Datos

## Opción 1: Supabase Dashboard (Recomendado)

1. Ve a: https://supabase.com/dashboard/project/enbezuxcljmdsmtzqktp/editor
2. Clic en **SQL Editor** (en el menú izquierdo)
3. Clic en **New Query**
4. Copia y pega el siguiente SQL:

```sql
-- Add phone number field to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_tenants_phone ON tenants(phone) WHERE phone IS NOT NULL;

-- Add constraint to ensure either email or phone is present
ALTER TABLE tenants
ADD CONSTRAINT tenants_email_or_phone_check
CHECK (email IS NOT NULL OR phone IS NOT NULL);

COMMENT ON COLUMN tenants.phone IS 'Phone number in E.164 format (+593984123456)';
COMMENT ON COLUMN tenants.phone_verified IS 'Whether the phone number has been verified via OTP';
COMMENT ON COLUMN tenants.phone_verified_at IS 'When the phone was verified';
```

5. Clic en **Run** (o presiona `Ctrl+Enter`)
6. Verifica que diga "Success. No rows returned"

## Opción 2: Usando psql

```bash
psql "postgresql://postgres.enbezuxcljmdsmtzqktp:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -f supabase/migrations/add_phone_auth.sql
```

## Verificación

Ejecuta esta query para confirmar que los campos se agregaron:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN ('phone', 'phone_verified', 'phone_verified_at');
```

Deberías ver:
```
column_name        | data_type                   | is_nullable
-------------------+-----------------------------+-------------
phone              | character varying           | YES
phone_verified     | boolean                     | YES
phone_verified_at  | timestamp with time zone    | YES
```
