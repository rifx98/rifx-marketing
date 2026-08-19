import { NextRequest } from 'next/server';
import { validateCronAuth, cronUnauthorizedResponse, cronSuccessResponse, cronErrorResponse } from '../auth';
import { acquireLock, releaseLock, startRunLog, updateRunLog, type CronLockHandle } from '@/services/cron/lock';
import { runCleanupMedia } from '@/services/cron/cleanup-media';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/cleanup-media - Ejecuta la limpieza de archivos de storage y base de datos expirados.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // 1. Validar autorización
  if (!validateCronAuth(req)) {
    return cronUnauthorizedResponse();
  }

  const cronName = 'cleanup-media';
  let runId = '';
  let lock: CronLockHandle | null = null;

  try {
    // 2. Adquirir lock distribuido (5 minutos de expiración)
    lock = await acquireLock(cronName, 5);
    if (!lock) {
      console.log('[Cleanup Media Cron] Omitiendo ejecución por bloqueo activo.');
      return cronSuccessResponse({
        processed: 0,
        skipped: 0,
        errors: 0,
        executionTime: '0.0s',
        remaining: 0
      });
    }

    // 3. Registrar el inicio de la ejecución en la DB
    runId = await startRunLog(cronName);

    // 4. Ejecutar el servicio
    const result = await runCleanupMedia({
      startTime
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const executionTimeStr = `${duration.toFixed(1)}s`;

    // 5. Registrar el fin y estadísticas en la DB
    await updateRunLog(runId, {
      finished_at: new Date().toISOString(),
      duration_seconds: duration,
      found_count: result.found,
      processed_count: result.processed,
      skipped_count: result.skipped,
      error_count: result.errors,
      error_details: result.errorDetails,
      processed_ids: result.processedIds,
      success: result.errors === 0
    });

    // 6. Liberar el lock
    await releaseLock(lock);
    lock = null;

    // 7. Devolver respuesta estandarizada
    return cronSuccessResponse({
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
      executionTime: executionTimeStr,
      remaining: result.remaining
    });
  } catch (err: any) {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const executionTimeStr = `${duration.toFixed(1)}s`;

    console.error(`❌ [Cleanup Media Cron] Error crítico:`, err);

    if (runId) {
      await updateRunLog(runId, {
        finished_at: new Date().toISOString(),
        duration_seconds: duration,
        error_count: 1,
        error_details: [{ error: err.message || err }],
        success: false
      });
    }

    if (lock) {
      await releaseLock(lock);
      lock = null;
    }

    return cronErrorResponse(err.message || 'Error en el controlador de limpieza de medios', executionTimeStr);
  }
}

/**
 * GET /api/cron/cleanup-media - Soporte para peticiones GET.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
