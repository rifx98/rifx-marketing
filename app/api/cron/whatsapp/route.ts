import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyGitHubActionsOidcToken } from '@/lib/github-actions-oidc';
import { safeEqualSecrets } from '@/lib/security';
import { startRunLog, updateRunLog } from '@/services/cron/lock';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_MESSAGES_PER_RUN = 3;
// Leave enough of Hobby's 60-second function window to persist leases and the
// run log even after a slow processor request or an OIDC key refresh.
const RUN_BUDGET_MS = 45_000;
const MAX_BEARER_BYTES = 8 * 1024;

interface ClaimedIngress {
  ingress_id: string;
  tenant_id: string;
  provider_message_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
}

function readBearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get('authorization');
  if (!authorization || Buffer.byteLength(authorization, 'utf8') > MAX_BEARER_BYTES + 16) {
    return null;
  }
  return authorization.match(/^Bearer\s+([^\s]+)$/i)?.[1] || null;
}

async function isAuthorizedWorkerRequest(req: NextRequest): Promise<boolean> {
  const suppliedToken = readBearerToken(req);
  if (!suppliedToken) return false;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && safeEqualSecrets(suppliedToken, cronSecret)) return true;

  return verifyGitHubActionsOidcToken(suppliedToken);
}

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: 'No autorizado' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

function resolveWebhookUrl(req: NextRequest): URL | null {
  const configuredOrigin = process.env.APP_URL?.trim()
    || (process.env.NODE_ENV !== 'production' ? req.nextUrl.origin : '');
  if (!configuredOrigin) return null;

  try {
    const origin = new URL(configuredOrigin);
    if (origin.username || origin.password) return null;
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') return null;
    if (!['http:', 'https:'].includes(origin.protocol)) return null;
    return new URL('/api/whatsapp', origin.origin);
  } catch {
    return null;
  }
}

async function completeIngress(
  ingressId: string,
  ownerToken: string,
  succeeded: boolean,
  errorCode: string | null,
  retrySeconds: number,
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc('complete_whatsapp_ingress', {
    p_ingress_id: ingressId,
    p_processing_token: ownerToken,
    p_succeeded: succeeded,
    p_error_code: errorCode,
    p_retry_seconds: retrySeconds,
  });
  if (error || data !== true) {
    console.error('[WhatsApp Worker] Unable to finalize ingress lease');
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  // The immediate Vercel trigger uses CRON_SECRET. The free scheduled fallback
  // uses a short-lived GitHub OIDC token bound to one repository and workflow.
  // There is deliberately no development bypass for this durable worker.
  if (!(await isAuthorizedWorkerRequest(req))) return unauthorizedResponse();

  const workerSecret = process.env.WHATSAPP_WORKER_SECRET || process.env.CRON_SECRET;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const webhookUrl = resolveWebhookUrl(req);
  if (!workerSecret || !appSecret || !webhookUrl) {
    console.error('[WhatsApp Worker] Required worker configuration is unavailable');
    return NextResponse.json(
      { success: false, error: 'Worker unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const runId = await startRunLog('whatsapp');
  if (!runId) {
    return NextResponse.json(
      { success: false, error: 'Worker run log unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const startedAt = Date.now();
  let processed = 0;
  let errors = 0;
  let stoppedOnLeaseError = false;

  for (let index = 0; index < MAX_MESSAGES_PER_RUN; index += 1) {
    const remainingBudget = RUN_BUDGET_MS - (Date.now() - startedAt);
    // Do not claim ownership when there is too little time left to perform a
    // provider call and durably finalize the lease.
    if (remainingBudget < 10_000) break;

    const ownerToken = randomUUID();
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.rpc('claim_whatsapp_ingress', {
      p_processing_token: ownerToken,
      p_lease_seconds: 120,
    });
    if (error) {
      console.error('[WhatsApp Worker] Unable to claim durable ingress');
      errors += 1;
      stoppedOnLeaseError = true;
      break;
    }

    const claim = (Array.isArray(data) ? data[0] : data) as ClaimedIngress | null;
    if (!claim?.ingress_id) break;

    const rawBody = JSON.stringify(claim.payload);
    const signature = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    let succeeded = false;
    let errorCode: string | null = null;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workerSecret}`,
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature,
          'x-rifx-whatsapp-worker': '1',
        },
        body: rawBody,
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(42_000, Math.max(1_000, remainingBudget - 3_000))),
      });
      succeeded = response.ok;
      errorCode = succeeded ? null : `processor_http_${response.status}`;
      await response.body?.cancel();
    } catch {
      errorCode = 'processor_request_failed';
    }

    const attempts = Math.max(1, Number(claim.attempt_count) || 1);
    const retrySeconds = Math.min(3600, 15 * (2 ** Math.min(attempts - 1, 8)));
    const finalized = await completeIngress(
      claim.ingress_id,
      ownerToken,
      succeeded,
      errorCode,
      retrySeconds,
    );
    if (!finalized) {
      errors += 1;
      stoppedOnLeaseError = true;
      break;
    }

    if (succeeded) processed += 1;
    else errors += 1;
  }

  const supabase = createSupabaseAdmin();
  const { count, error: countError } = await supabase
    .from('whatsapp_ingress')
    .select('id', { count: 'exact', head: true })
    .in('status', ['queued', 'retry', 'processing']);

  const processingSucceeded = errors === 0 && !stoppedOnLeaseError && !countError;
  const runLogged = await updateRunLog(runId, {
    finished_at: new Date().toISOString(),
    duration_seconds: (Date.now() - startedAt) / 1000,
    found_count: processed + errors,
    processed_count: processed,
    skipped_count: 0,
    error_count: errors + (countError ? 1 : 0),
    error_details: processingSucceeded ? [] : [{ code: 'whatsapp_worker_incomplete' }],
    processed_ids: [],
    success: processingSucceeded,
  });
  const success = processingSucceeded && runLogged;
  return NextResponse.json({
    success,
    processed,
    errors,
    remaining: countError ? null : (count || 0),
    executionTime: `${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
  }, {
    status: success ? 200 : (!runLogged || stoppedOnLeaseError || countError ? 503 : 500),
    headers: { 'Cache-Control': 'no-store' },
  });
}
