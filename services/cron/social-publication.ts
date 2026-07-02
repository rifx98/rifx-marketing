import { createSupabaseAdmin } from '@/lib/supabase';

export interface SocialPublicationResult {
  found: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: any[];
  processedIds: string[];
  remaining: number;
}

/**
 * Servicio encargado de buscar y ejecutar la publicación de posts/reels en redes sociales que fueron programados.
 */
export async function runSocialPublications(options: {
  tenantId?: string;
  batchSize?: number;
  startTime: number;
  originUrl: string;
}): Promise<SocialPublicationResult> {
  const supabase = createSupabaseAdmin();
  const now = new Date();

  const batchSize = options.batchSize || parseInt(process.env.MESSAGE_BATCH_SIZE || '5');
  const startTime = options.startTime;

  const result: SocialPublicationResult = {
    found: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    processedIds: [],
    remaining: 0
  };

  try {
    // 1. Buscar publicaciones de redes sociales programadas pendientes que deban publicarse ya
    let query = supabase
      .from('social_publications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true });

    // Filtrado seguro por tenant (SaaS multi-tenant readiness)
    if (options.tenantId) {
      const { data: tenantPosts, error: postErr } = await supabase
        .from('social_posts')
        .select('id')
        .eq('tenant_id', options.tenantId);

      if (postErr) throw postErr;

      const postIds = (tenantPosts || []).map(p => p.id);
      if (postIds.length === 0) {
        return result; // No hay posts para este tenant
      }
      query = query.in('post_id', postIds);
    }

    const { data: pubs, error } = await query;

    if (error) {
      throw new Error(`Error al buscar publicaciones en DB: ${error.message}`);
    }

    if (!pubs || pubs.length === 0) {
      console.log('[Social Publications Service] No hay publicaciones programadas pendientes para procesar.');
      return result;
    }

    result.found = pubs.length;

    // 2. Limitar al tamaño de lote
    const itemsToProcess = pubs.slice(0, batchSize);
    result.remaining = Math.max(0, pubs.length - batchSize);

    // 3. Procesar secuencialmente monitoreando el tiempo de ejecución
    for (const pub of itemsToProcess) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 8.0) { // 2s de margen sobre el límite de 10s de Vercel Hobby
        console.warn(`[Social Publications Service] Timeout preventivo activado. Transcurridos: ${elapsed}s. Suspendiendo lote.`);
        result.remaining += itemsToProcess.length - itemsToProcess.indexOf(pub);
        break;
      }

      try {
        console.log(`[Social Publications Service] Disparando worker para publicación: ${pub.id}`);

        // Llamar internamente al worker por POST enviando la firma de bypass de desarrollo para evitar re-validación
        const response = await fetch(`${options.originUrl}/api/panel/social/worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Dev-Worker-Signature': 'local_secret_development_bypass'
          },
          body: JSON.stringify({ publicationId: pub.id })
        });

        const resData = await response.json();
        if (!response.ok || resData.error) {
          throw new Error(resData.error || `Error status: ${response.status}`);
        }

        result.processed++;
        result.processedIds.push(pub.id);
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push({ publicationId: pub.id, error: err.message || err });
        console.error(`[Social Publications Service] Error al procesar publicación ${pub.id}:`, err);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push({ error: err.message || err });
    console.error('[Social Publications Service] Error general:', err);
  }

  return result;
}
