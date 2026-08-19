import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import {
  cronErrorResponse,
  cronSuccessResponse,
  cronUnauthorizedResponse,
  validateCronAuth,
} from '@/app/api/cron/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { isAllowedPushEndpoint } from '@/lib/push-security';
import {
  acquireLock,
  releaseLock,
  startRunLog,
  updateRunLog,
  type CronLockHandle,
} from '@/services/cron/lock';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_NAME = 'monthly-briefing';
const LOCK_MINUTES = 10;
const BATCH_SIZE = 100;
const MAX_BATCHES = 5;
const MAX_RUNTIME_MS = 45_000;
const PUSH_CONCURRENCY = 8;
const MAX_PUSH_SUBSCRIPTIONS = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BriefingRow {
  tenantId: string;
  pushRequested: boolean;
  emailRequested: boolean;
  newConversations: number;
  messagesCount: number;
  appointmentsCount: number;
  revenueCents: number;
}

interface PushDeliveryResult {
  code:
    | 'delivered'
    | 'partially_delivered'
    | 'not_configured'
    | 'no_subscriptions'
    | 'unsafe_subscription'
    | 'subscription_limit_exceeded'
    | 'subscription_lookup_failed'
    | 'delivery_failed';
  delivered: number;
  failed: number;
}

let vapidConfigured = false;
let vapidConfigurationAttempted = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  if (vapidConfigurationAttempted) return false;
  vapidConfigurationAttempted = true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:soporte@rifx.online';
  if (!publicKey || !privateKey) return false;

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch {
    return false;
  }
}

function previousMonthRange(now = new Date()): {
  periodStart: string;
  periodEnd: string;
  periodKey: string;
} {
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const toDate = (value: Date) => value.toISOString().slice(0, 10);
  return {
    periodStart: toDate(periodStart),
    periodEnd: toDate(periodEnd),
    periodKey: toDate(periodStart).slice(0, 7),
  };
}

function safeCount(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseBriefingRow(value: unknown): BriefingRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const tenantId = typeof row.briefing_tenant_id === 'string'
    ? row.briefing_tenant_id
    : '';
  const newConversations = safeCount(row.new_conversations);
  const messagesCount = safeCount(row.messages_count);
  const appointmentsCount = safeCount(row.appointments_count);
  const revenueCents = safeCount(row.revenue_cents);

  if (
    !UUID_PATTERN.test(tenantId)
    || typeof row.push_requested !== 'boolean'
    || typeof row.email_requested !== 'boolean'
    || newConversations === null
    || messagesCount === null
    || appointmentsCount === null
    || revenueCents === null
  ) return null;

  return {
    tenantId,
    pushRequested: row.push_requested,
    emailRequested: row.email_requested,
    newConversations,
    messagesCount,
    appointmentsCount,
    revenueCents,
  };
}

function buildPushPayload(row: BriefingRow, periodKey: string): string {
  const revenue = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(row.revenueCents / 100);

  return JSON.stringify({
    title: 'Tu resumen mensual esta listo',
    body: `${row.newConversations} conversaciones · ${row.messagesCount} mensajes · ${row.appointmentsCount} citas · ${revenue}`,
    url: '/panel',
    tag: `monthly-briefing:${periodKey}`,
  });
}

async function sendPush(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  row: BriefingRow,
  periodKey: string,
): Promise<PushDeliveryResult> {
  if (!configureVapid()) {
    return { code: 'not_configured', delivered: 0, failed: 0 };
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('tenant_id', row.tenantId)
    .limit(MAX_PUSH_SUBSCRIPTIONS + 1);
  if (error) {
    return { code: 'subscription_lookup_failed', delivered: 0, failed: 1 };
  }
  if (!subscriptions?.length) {
    return { code: 'no_subscriptions', delivered: 0, failed: 0 };
  }
  if (subscriptions.length > MAX_PUSH_SUBSCRIPTIONS) {
    return { code: 'subscription_limit_exceeded', delivered: 0, failed: 1 };
  }
  if (subscriptions.some((subscription) => !isAllowedPushEndpoint(subscription.endpoint))) {
    return { code: 'unsafe_subscription', delivered: 0, failed: 1 };
  }

  const payload = buildPushPayload(row, periodKey);
  let delivered = 0;
  let failed = 0;

  for (let offset = 0; offset < subscriptions.length; offset += PUSH_CONCURRENCY) {
    const chunk = subscriptions.slice(offset, offset + PUSH_CONCURRENCY);
    await Promise.all(chunk.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys_p256dh,
              auth: subscription.keys_auth,
            },
          },
          payload,
          { TTL: 86_400, urgency: 'normal', timeout: 10_000 },
        );
        delivered += 1;
      } catch (sendError: unknown) {
        const statusCode = typeof sendError === 'object' && sendError !== null
          && 'statusCode' in sendError
          ? Number((sendError as { statusCode?: unknown }).statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('tenant_id', row.tenantId)
            .eq('endpoint', subscription.endpoint);
        }
        failed += 1;
      }
    }));
  }

  if (delivered > 0 && failed === 0) return { code: 'delivered', delivered, failed };
  if (delivered > 0) return { code: 'partially_delivered', delivered, failed };
  return { code: 'delivery_failed', delivered, failed };
}

async function completeDelivery(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  row: BriefingRow,
  periodStart: string,
  status: 'completed' | 'skipped' | 'failed',
  pushDelivered: boolean,
  emailUnavailable: boolean,
  errorCode: string | null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('complete_monthly_briefing_delivery', {
    p_tenant_id: row.tenantId,
    p_period_start: periodStart,
    p_status: status,
    p_push_delivered: pushDelivered,
    p_email_channel_unavailable: emailUnavailable,
    p_error_code: errorCode,
  });
  return !error && data === true;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (!validateCronAuth(req)) return cronUnauthorizedResponse();

  const supabase = createSupabaseAdmin();
  const { periodStart, periodEnd, periodKey } = previousMonthRange();
  let lock: CronLockHandle | null = null;
  let runId = '';
  let found = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let emailUnavailable = 0;

  try {
    lock = await acquireLock(CRON_NAME, LOCK_MINUTES);
    if (!lock) {
      return cronSuccessResponse({
        processed: 0,
        skipped: 0,
        errors: 0,
        executionTime: '0.0s',
        remaining: 0,
      });
    }

    runId = await startRunLog(CRON_NAME);
    if (!runId) throw new Error('run_log_unavailable');

    for (let batchNumber = 0; batchNumber < MAX_BATCHES; batchNumber += 1) {
      if (Date.now() - startedAt >= MAX_RUNTIME_MS) break;
      const { data, error } = await supabase.rpc('claim_monthly_briefing_batch', {
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_limit: BATCH_SIZE,
      });
      if (error || !Array.isArray(data)) throw new Error('briefing_claim_failed');
      if (data.length === 0) break;

      const rows = data.map(parseBriefingRow);
      if (rows.some((row) => row === null)) throw new Error('invalid_briefing_batch');
      const validRows = rows as BriefingRow[];
      found += validRows.length;

      for (let offset = 0; offset < validRows.length; offset += PUSH_CONCURRENCY) {
        const chunk = validRows.slice(offset, offset + PUSH_CONCURRENCY);
        await Promise.all(chunk.map(async (row) => {
          const requestedEmailUnavailable = row.emailRequested;
          if (requestedEmailUnavailable) emailUnavailable += 1;

          let status: 'completed' | 'skipped' | 'failed' = 'skipped';
          let pushDelivered = false;
          let errorCode: string | null = requestedEmailUnavailable
            ? 'email_channel_unconfigured'
            : null;

          if (row.pushRequested) {
            const result = await sendPush(supabase, row, periodKey);
            pushDelivered = result.delivered > 0;
            if (result.code === 'delivered') {
              status = 'completed';
              sent += 1;
            } else if (result.code === 'partially_delivered') {
              status = 'completed';
              errorCode = 'push_partial_failure';
              sent += 1;
              errors += 1;
            } else if (result.code === 'no_subscriptions') {
              status = 'skipped';
              errorCode = errorCode || result.code;
              skipped += 1;
            } else {
              status = 'failed';
              errorCode = result.code;
              errors += 1;
            }
          } else {
            skipped += 1;
          }

          const completed = await completeDelivery(
            supabase,
            row,
            periodStart,
            status,
            pushDelivered,
            requestedEmailUnavailable,
            errorCode,
          );
          if (!completed) errors += 1;
        }));
      }

      if (validRows.length < BATCH_SIZE) break;
    }

    const { count: remaining, error: remainingError } = await supabase
      .from('monthly_briefing_deliveries')
      .select('tenant_id', { count: 'exact', head: true })
      .eq('period_start', periodStart)
      .in('status', ['pending', 'processing', 'failed']);
    if (remainingError) throw new Error('briefing_remaining_count_failed');

    const durationSeconds = (Date.now() - startedAt) / 1_000;
    const runLogged = await updateRunLog(runId, {
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      found_count: found,
      processed_count: sent,
      skipped_count: skipped,
      error_count: errors,
      error_details: emailUnavailable > 0
        ? [{ code: 'email_channel_unconfigured', count: emailUnavailable }]
        : [],
      processed_ids: [],
      success: errors === 0 && (remaining || 0) === 0,
    });
    if (!runLogged) throw new Error('run_log_completion_failed');

    await releaseLock(lock);
    lock = null;

    const successful = errors === 0 && (remaining || 0) === 0;
    return NextResponse.json(
      {
        success: successful,
        period: periodKey,
        processed: sent,
        skipped,
        errors,
        emailChannelUnavailable: emailUnavailable,
        executionTime: `${durationSeconds.toFixed(1)}s`,
        remaining: remaining || 0,
        timestamp: new Date().toISOString(),
      },
      {
        status: successful ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    const durationSeconds = (Date.now() - startedAt) / 1_000;
    if (runId) {
      await updateRunLog(runId, {
        finished_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        found_count: found,
        processed_count: sent,
        skipped_count: skipped,
        error_count: errors + 1,
        error_details: [{ code: 'monthly_briefing_failed' }],
        processed_ids: [],
        success: false,
      });
    }
    if (lock) await releaseLock(lock);
    console.error('[Monthly Briefing Cron] Execution failed');
    return cronErrorResponse('No se pudo completar el resumen mensual', `${durationSeconds.toFixed(1)}s`);
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
