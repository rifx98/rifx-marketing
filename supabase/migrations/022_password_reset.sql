-- Agrega soporte para el restablecimiento de contraseña de inquilinos
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS reset_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_reset_token ON public.tenants (reset_token);
