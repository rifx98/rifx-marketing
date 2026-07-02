import { NextRequest, NextResponse } from 'next/server';

/**
 * Valida la autenticación de la petición cron utilizando el header Authorization.
 */
export function validateCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // En desarrollo local, permitir bypass si no se ha configurado la variable
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    console.log('⚠️ Ejecución de cron en desarrollo local sin CRON_SECRET.');
    return true;
  }

  if (!cronSecret) {
    console.error('❌ Error: CRON_SECRET no está configurada en las variables de entorno.');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Devuelve una respuesta estándar HTTP 401.
 */
export function cronUnauthorizedResponse() {
  return NextResponse.json({
    success: false,
    error: 'No autorizado'
  }, { status: 401 });
}

/**
 * Estructura estándar de respuesta exitosa.
 */
export function cronSuccessResponse(stats: {
  processed: number;
  skipped: number;
  errors: number;
  executionTime: string;
  remaining: number;
}) {
  return NextResponse.json({
    success: true,
    ...stats,
    timestamp: new Date().toISOString()
  });
}

/**
 * Estructura estándar de respuesta de error.
 */
export function cronErrorResponse(errorMsg: string, executionTime = '0.0s') {
  return NextResponse.json({
    success: false,
    processed: 0,
    skipped: 0,
    errors: 1,
    error: errorMsg,
    executionTime,
    remaining: 0,
    timestamp: new Date().toISOString()
  }, { status: 500 });
}

/**
 * Ejecuta una acción y la reintenta con backoff exponencial si ocurre un fallo de red o error HTTP transitorio (429, 5xx).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 500,
  backoffFactor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const status = error?.status || error?.response?.status || error?.statusCode;
    // Si no tiene código de estado (error de red) o es transitorio (429, 5xx), reintentar
    const isTransient = !status || status === 429 || (status >= 500 && status <= 599);

    if (retries > 0 && isTransient) {
      console.warn(`[Retry] Error transitorio detectado (${error.message || error}). Reintentando en ${delay}ms... (Restan ${retries} intentos)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
}
