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
