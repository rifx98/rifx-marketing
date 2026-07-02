import { NextRequest } from 'next/server';
import { validateCronAuth, cronUnauthorizedResponse, cronSuccessResponse, cronErrorResponse } from '../auth';
import { acquireLock, releaseLock, startRunLog, updateRunLog } from '@/services/cron/lock';
import { runAppointmentReminders } from '@/services/cron/appointment-reminder';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/appointments - Ejecuta las tareas programadas de citas.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // 1. Validar autorización
  if (!validateCronAuth(req)) {
    return cronUnauthorizedResponse();
  }

  const cronName = 'appointments';
  let runId = '';

  try {
    // 2. Adquirir lock distribuido para evitar ejecución simultánea (5 minutos de expiración)
    const hasLock = await acquireLock(cronName, 5);
    if (!hasLock) {
      console.log('[Appointments Cron] Omitiendo ejecución por bloqueo activo.');
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
    const result = await runAppointmentReminders({
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
    await releaseLock(cronName);

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

    console.error(`❌ [Appointments Cron] Error crítico:`, err);

    if (runId) {
      await updateRunLog(runId, {
        finished_at: new Date().toISOString(),
        duration_seconds: duration,
        error_count: 1,
        error_details: [{ error: err.message || err }],
        success: false
      });
    }

    await releaseLock(cronName);

    return cronErrorResponse(err.message || 'Error en el controlador de citas', executionTimeStr);
  }
}

/**
 * GET /api/cron/appointments - Soporte para peticiones GET (conveniente para pruebas y runners sencillos).
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
