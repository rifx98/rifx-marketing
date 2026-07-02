import { createSupabaseAdmin } from '@/lib/supabase';

/**
 * Adquiere un lock distribuido para evitar ejecuciones concurrentes de un mismo cron.
 * Utiliza bloqueo optimista y expiración temporal de seguridad.
 */
export async function acquireLock(name: string, expireMinutes = 5): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expireMinutes * 60 * 1000);

  try {
    // 1. Intentar insertar un nuevo lock
    const { error: insertError } = await supabase
      .from('cron_locks')
      .insert({
        name,
        locked_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      });

    if (!insertError) {
      console.log(`[Lock] Lock adquirido exitosamente para: ${name}`);
      return true;
    }

    // Si la tabla no existe, continuar sin lock (graceful degradation)
    if (insertError.code === 'PGRST205' || (insertError.message && (insertError.message.includes('does not exist') || insertError.message.includes('relation')))) {
      console.warn(`[Lock] Tabla cron_locks no encontrada. Ejecutando sin lock. Ejecuta supabase-cron-schema.sql en Supabase.`);
      return true;
    }

    // 2. Si falla (ya existe el lock), verificar si ha expirado
    const { data: currentLock, error: selectError } = await supabase
      .from('cron_locks')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (selectError || !currentLock) {
      return false;
    }

    const lockExpires = new Date(currentLock.expires_at).getTime();
    if (lockExpires < now.getTime()) {
      console.warn(`[Lock] Lock de ${name} expirado detectado. Intentando reclamarlo...`);
      
      // Reclamación segura con cláusula condicional (optimistic locking)
      const { data: updatedLock, error: updateError } = await supabase
        .from('cron_locks')
        .update({
          locked_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .eq('name', name)
        .lt('expires_at', now.toISOString()) // Concurrency safe
        .select();

      if (!updateError && updatedLock && updatedLock.length > 0) {
        console.log(`[Lock] Lock expirado reclamado con éxito para: ${name}`);
        return true;
      }
    }

    console.warn(`[Lock] No se pudo adquirir el lock de ${name}. Ejecución simultánea omitida.`);
    return false;
  } catch (err) {
    console.error(`[Lock] Error crítico en acquireLock para ${name}:`, err);
    return false;
  }
}

/**
 * Libera el lock distribuido para que el cron pueda volver a ejecutarse en la siguiente llamada.
 */
export async function releaseLock(name: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  try {
    const { error } = await supabase
      .from('cron_locks')
      .delete()
      .eq('name', name);

    if (error) {
      console.error(`[Lock] Error al eliminar lock para ${name}:`, error.message);
    } else {
      console.log(`[Lock] Lock liberado exitosamente para: ${name}`);
    }
  } catch (err) {
    console.error(`[Lock] Error crítico en releaseLock para ${name}:`, err);
  }
}

export interface CronRunUpdate {
  finished_at: string;
  duration_seconds: number;
  found_count: number;
  processed_count: number;
  skipped_count: number;
  error_count: number;
  error_details: any[];
  processed_ids: string[];
  success: boolean;
}

/**
 * Inicia la grabación del log de ejecución de una tarea cron.
 */
export async function startRunLog(cronName: string): Promise<string> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  try {
    const { data, error } = await supabase
      .from('cron_runs')
      .insert({
        cron_name: cronName,
        started_at: now.toISOString(),
        success: false
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'No se obtuvo el ID tras la inserción');
    }
    return data.id;
  } catch (err) {
    console.error(`[RunLog] Error al registrar inicio de cron ${cronName}:`, err);
    return '';
  }
}

/**
 * Actualiza el registro de ejecución final con estadísticas y estados.
 */
export async function updateRunLog(id: string, updates: Partial<CronRunUpdate>): Promise<void> {
  if (!id) return;
  const supabase = createSupabaseAdmin();
  try {
    const { error } = await supabase
      .from('cron_runs')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error(`[RunLog] Error al actualizar log de cron ${id}:`, error.message);
    }
  } catch (err) {
    console.error(`[RunLog] Error crítico en updateRunLog para ${id}:`, err);
  }
}
