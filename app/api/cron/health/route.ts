import { NextRequest, NextResponse } from 'next/server';
import { validateCronAuth, cronUnauthorizedResponse } from '../auth';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/health - Devuelve el estado general del sistema de tareas programadas.
 */
export async function GET(req: NextRequest) {
  // 1. Validar autorización
  if (!validateCronAuth(req)) {
    return cronUnauthorizedResponse();
  }

  const supabase = createSupabaseAdmin();
  const systemVersion = '2.1.0 (SaaS Unified Cron System)';

  try {
    const cronNames = ['appointments', 'messages', 'cold-leads', 'cleanup-media'];
    const cronsStatus: Record<string, any> = {};

    // 2. Consultar la última ejecución de cada cron registrado
    for (const name of cronNames) {
      const { data: lastRun, error } = await supabase
        .from('cron_runs')
        .select('*')
        .eq('cron_name', name)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        cronsStatus[name] = { status: 'error', error: error.message };
      } else if (!lastRun) {
        cronsStatus[name] = { status: 'never_executed' };
      } else {
        cronsStatus[name] = {
          status: lastRun.success ? 'healthy' : 'failed',
          last_run_at: lastRun.started_at,
          duration: `${parseFloat(lastRun.duration_seconds || 0).toFixed(1)}s`,
          processed: lastRun.processed_count,
          skipped: lastRun.skipped_count,
          errors: lastRun.error_count,
          recent_errors: lastRun.error_details || []
        };
      }
    }

    // 3. Consultar locks activos en el sistema (por si hay locks pegados que necesiten liberación)
    const { data: activeLocks } = await supabase
      .from('cron_locks')
      .select('*');

    return NextResponse.json({
      success: true,
      status: 'healthy',
      systemVersion,
      timestamp: new Date().toISOString(),
      activeLocks: activeLocks || [],
      crons: cronsStatus
    });
  } catch (err: any) {
    console.error('❌ [Health Check] Error al obtener historial de ejecuciones:', err);
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      systemVersion,
      error: err.message || err,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/cron/health - Soporte para peticiones POST.
 */
export async function POST(req: NextRequest) {
  return GET(req);
}
