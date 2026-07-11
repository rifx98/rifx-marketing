-- ============================================
-- RIFX Marketing — Tablas de Locks y Logs de Cron
-- ============================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

-- 1. Tabla para Locks de Tareas Programadas (Evita ejecuciones concurrentes)
CREATE TABLE IF NOT EXISTS cron_locks (
  name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Habilitar RLS y políticas
ALTER TABLE cron_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access locks" ON cron_locks;
CREATE POLICY "Service role full access locks" ON cron_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Tabla para Logs y Monitoreo de Ejecución de Cron
CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_seconds NUMERIC,
  found_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  processed_ids TEXT[] DEFAULT '{}',
  success BOOLEAN DEFAULT false
);

-- Habilitar RLS y políticas
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access runs" ON cron_runs;
CREATE POLICY "Service role full access runs" ON cron_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cron_runs_name ON cron_runs(cron_name);
CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at ON cron_runs(started_at);
