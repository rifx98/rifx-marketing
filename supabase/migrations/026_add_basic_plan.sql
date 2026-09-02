-- Migration: 026_add_basic_plan.sql

-- 1. Actualizar restricciones (CHECK constraints) en tabla tenants
DO $$
DECLARE
    plan_constraint_name text;
    pending_plan_constraint_name text;
BEGIN
    -- Encontrar el nombre del constraint de plan
    SELECT conname INTO plan_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%plan IN%';
    
    IF plan_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.tenants DROP CONSTRAINT ' || plan_constraint_name;
    END IF;

    -- Recrear el constraint con el plan 'basic'
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_check 
        CHECK (plan IN ('trial', 'basic', 'start', 'advanced', 'plus', 'master'));

    -- Encontrar el nombre del constraint de pending_plan
    SELECT conname INTO pending_plan_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%pending_plan IN%';
    
    IF pending_plan_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.tenants DROP CONSTRAINT ' || pending_plan_constraint_name;
    END IF;

    -- Recrear el constraint con el plan 'basic'
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_pending_plan_check 
        CHECK (pending_plan IS NULL OR pending_plan IN ('trial', 'basic', 'start', 'advanced', 'plus', 'master'));
END $$;

-- 2. Agregar configuración JSONB para el menú del bot estático en public.config
ALTER TABLE public.config 
ADD COLUMN IF NOT EXISTS bot_menu_config JSONB DEFAULT '{
  "welcome_message": "¡Hola! Gracias por contactarnos. ¿En qué podemos ayudarte hoy?",
  "buttons": [
    { "id": "btn_services", "title": "Servicios" },
    { "id": "btn_contact", "title": "Hablar con Asesor" }
  ],
  "responses": {
    "btn_services": "Nuestros servicios incluyen soluciones personalizadas para tu empresa.",
    "btn_contact": "En un momento un asesor humano se conectará contigo. Por favor, espera."
  }
}'::jsonb;
