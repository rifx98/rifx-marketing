import { randomUUID } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase';
import {
  dispatchSocialPublication,
  getSocialQueueConfig,
  getSocialWorkerUrl,
} from '@/lib/social-queue';

export interface SocialPublicationResult {
  found: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ publicationId?: string; code: string }>;
  processedIds: string[];
  remaining: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boundedBatchSize(value?: number): number {
  const configured = value ?? Number.parseInt(process.env.SOCIAL_DISPATCH_BATCH_SIZE || '10', 10);
  if (!Number.isFinite(configured)) return 10;
  return Math.max(1, Math.min(50, Math.trunc(configured)));
}

async function dispatchLocally(
  workerUrl: string,
  workerSecret: string,
  publicationId: string,
): Promise<{ ok: boolean; messageId?: string; errorCode?: string }> {
  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': workerSecret,
      },
      body: JSON.stringify({ publicationId }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(55_000),
    });
    await response.body?.cancel().catch(() => undefined);
    return response.ok
      ? { ok: true, messageId: `local-${randomUUID()}` }
      : { ok: false, errorCode: `local_worker_http_${response.status}` };
  } catch {
    return { ok: false, errorCode: 'local_worker_unavailable' };
  }
}

/**
 * Atomically claims due rows and only dispatches short authenticated QStash
 * messages. Provider uploads never execute inside the scheduler invocation.
 */
export async function runSocialPublications(options: {
  tenantId?: string;
  batchSize?: number;
  startTime: number;
  originUrl: string;
}): Promise<SocialPublicationResult> {
  const supabase = createSupabaseAdmin();
  const batchSize = boundedBatchSize(options.batchSize);
  const result: SocialPublicationResult = {
    found: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    processedIds: [],
    remaining: 0,
  };

  const queueConfig = getSocialQueueConfig(options.originUrl);
  if (process.env.NODE_ENV === 'production' && !queueConfig) {
    throw new Error('social_queue_configuration_missing');
  }
  const workerSecret = process.env.SOCIAL_WORKER_SECRET || process.env.CRON_SECRET;
  const localWorkerUrl = getSocialWorkerUrl(options.originUrl);
  if (!queueConfig && (!workerSecret || !localWorkerUrl)) {
    throw new Error('social_worker_configuration_missing');
  }

  const { data: recoveryData, error: recoveryError } = await supabase.rpc(
    'recover_expired_social_publications',
    { p_limit: 100 },
  );
  if (recoveryError) throw new Error('social_worker_recovery_unavailable');
  const recovery = Array.isArray(recoveryData) ? recoveryData[0] : recoveryData;
  const recoveredDead = Number(recovery?.dead_count || 0);
  if (recoveredDead > 0) {
    result.skipped += recoveredDead;
    result.errorDetails.push({ code: 'expired_provider_leases_dead_lettered' });
  }

  const dispatchToken = randomUUID();
  const { data: claimedRows, error: claimError } = await supabase.rpc(
    'claim_due_social_dispatches',
    {
      p_dispatch_token: dispatchToken,
      p_limit: batchSize,
      p_tenant_id: options.tenantId || null,
      p_lease_seconds: 120,
    },
  );
  if (claimError) throw new Error('social_dispatch_claim_unavailable');

  const publicationIds = (Array.isArray(claimedRows) ? claimedRows : [])
    .map((row) => row?.publication_id)
    .filter((id): id is string => typeof id === 'string' && UUID_RE.test(id));
  result.found = publicationIds.length;
  if (publicationIds.length === 0) return result;

  const dispatchResults = await Promise.all(publicationIds.map(async (publicationId) => {
    if (Date.now() - options.startTime > 20_000) {
      return { publicationId, ok: false, errorCode: 'scheduler_time_budget_exhausted' };
    }
    const dispatched = queueConfig
      ? await dispatchSocialPublication(queueConfig, publicationId, dispatchToken)
      : await dispatchLocally(localWorkerUrl!, workerSecret!, publicationId);
    return { publicationId, ...dispatched };
  }));

  await Promise.all(dispatchResults.map(async (dispatch) => {
    const { data: completed, error } = await supabase.rpc('complete_social_dispatch', {
      p_publication_id: dispatch.publicationId,
      p_dispatch_token: dispatchToken,
      p_succeeded: dispatch.ok,
      p_qstash_message_id: dispatch.ok ? dispatch.messageId : null,
      p_error_message: dispatch.ok ? null : dispatch.errorCode || 'social_dispatch_failed',
    });

    if (error || completed !== true) {
      result.errors += 1;
      result.errorDetails.push({
        publicationId: dispatch.publicationId,
        code: 'social_dispatch_completion_failed',
      });
      return;
    }
    if (!dispatch.ok) {
      result.errors += 1;
      result.errorDetails.push({
        publicationId: dispatch.publicationId,
        code: dispatch.errorCode || 'social_dispatch_failed',
      });
      return;
    }
    result.processed += 1;
    result.processedIds.push(dispatch.publicationId);
  }));

  const { data: healthData, error: healthError } = await supabase.rpc('get_social_publication_health');
  if (!healthError && healthData && typeof healthData === 'object') {
    result.remaining = Number((healthData as Record<string, unknown>).due || 0);
  }
  return result;
}
