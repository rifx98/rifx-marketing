import { createSupabaseAdmin } from '@/lib/supabase';

export interface CleanupMediaResult {
  found: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: any[];
  processedIds: string[];
  remaining: number;
}

/**
 * Servicio encargado de limpiar imágenes y videos antiguos del almacenamiento (storage) y la base de datos.
 */
export async function runCleanupMedia(options: {
  tenantId?: string;
  startTime: number;
}): Promise<CleanupMediaResult> {
  const supabase = createSupabaseAdmin();
  const result: CleanupMediaResult = {
    found: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    processedIds: [],
    remaining: 0
  };

  try {
    // 1. Obtener días de retención desde la configuración global o del tenant
    let configQuery = supabase.from('config').select('media_retention_days');
    
    if (options.tenantId) {
      configQuery = configQuery.eq('tenant_id', options.tenantId);
    }
    
    const { data: config, error: configError } = await configQuery.limit(1).maybeSingle();
    
    if (configError) {
      throw new Error(`Error al leer configuración de retención: ${configError.message}`);
    }

    const retentionDays = config?.media_retention_days || 0;
    if (retentionDays <= 0) {
      console.log('[Cleanup Media Service] Limpieza desactivada (Días de retención = 0).');
      return result;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    // 2. Limpieza del storage bucket 'chat_media'
    const { data: files, error: filesError } = await supabase.storage.from('chat_media').list();
    
    if (filesError) {
      throw new Error(`Error al listar archivos de storage: ${filesError.message}`);
    }

    if (files && files.length > 0) {
      const filesToDelete = files.filter(f => {
        // Extraer timestamp del nombre (ej: 1715467000000_imagen.jpg)
        const tsMatch = f.name.match(/^(\d+)_/);
        if (tsMatch) {
          const ts = parseInt(tsMatch[1]);
          return ts < cutoffTimestamp;
        }
        return false;
      }).map(f => f.name);

      result.found += filesToDelete.length;

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage.from('chat_media').remove(filesToDelete);
        if (deleteError) {
          throw new Error(`Error al eliminar archivos de storage: ${deleteError.message}`);
        }
        result.processed += filesToDelete.length;
        console.log(`[Cleanup Media Service] Eliminados ${filesToDelete.length} archivos antiguos de storage.`);
      }
    }

    // 3. Limpieza y marcado de mensajes en la DB
    let msgQuery = supabase
      .from('messages')
      .select('id, content')
      .lt('created_at', cutoffDate.toISOString())
      .like('content', '%![%');

    if (options.tenantId) {
      msgQuery = msgQuery.eq('tenant_id', options.tenantId);
    }

    const { data: messages, error: msgsError } = await msgQuery;

    if (msgsError) {
      throw new Error(`Error al buscar mensajes expirados: ${msgsError.message}`);
    }

    if (messages && messages.length > 0) {
      result.found += messages.length;
      let updatedCount = 0;

      for (const msg of messages) {
        // Timeout check
        const elapsed = (Date.now() - options.startTime) / 1000;
        if (elapsed > 8.0) {
          console.warn(`[Cleanup Media Service] Timeout preventivo en procesado de mensajes. Transcurrido: ${elapsed}s`);
          result.remaining = messages.length - messages.indexOf(msg);
          break;
        }

        const imgMatch = msg.content?.match(/^!\[.*\]\((.*)\)(?:\n([\s\S]*))?/);
        if (imgMatch) {
          const textContent = imgMatch[2] || '';
          const newContent = textContent 
            ? `[Imagen adjunta caducada]\n${textContent}` 
            : '[Imagen adjunta caducada]';
          
          const { error: updateErr } = await supabase
            .from('messages')
            .update({ content: newContent })
            .eq('id', msg.id);

          if (updateErr) {
            result.errors++;
            result.errorDetails.push({ messageId: msg.id, error: updateErr.message });
          } else {
            updatedCount++;
            result.processedIds.push(msg.id);
          }
        } else {
          result.skipped++;
        }
      }
      result.processed += updatedCount;
      console.log(`[Cleanup Media Service] Mensajes actualizados en DB: ${updatedCount}`);
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push({ error: err.message || err });
    console.error('[Cleanup Media Service] Error crítico:', err);
  }

  return result;
}
