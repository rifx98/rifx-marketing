import { NextRequest, NextResponse } from 'next/server';
import { validateCronAuth, cronUnauthorizedResponse } from '../auth';
import {
  CRON_HEALTH_POLICIES,
  CRITICAL_CRON_NAMES,
  CronHealthResult,
  evaluateCronRun,
} from '@/lib/cron-health';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const systemVersion = '2.3.0 (SaaS Unified Cron System)';
const CRON_RUN_FIELDS =
  'started_at, finished_at, duration_seconds, processed_count, skipped_count, error_count, success';

/**
 * GET /api/cron/health - Devuelve el estado general del sistema de tareas programadas.
 */
export async function GET(req: NextRequest) {
  if (!validateCronAuth(req)) {
    return cronUnauthorizedResponse();
  }

  const supabase = createSupabaseAdmin();

  try {
    const cronChecks = await Promise.all(
      CRITICAL_CRON_NAMES.map(async (name) => {
        const { data: lastRun, error } = await supabase
          .from('cron_runs')
          .select(CRON_RUN_FIELDS)
          .eq('cron_name', name)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const result: CronHealthResult = error
          ? {
              status: 'error',
              max_age_seconds:
                CRON_HEALTH_POLICIES[name].maxAgeMs / 1_000,
            }
          : evaluateCronRun(name, lastRun);

        return [name, result] as const;
      }),
    );

    const crons = Object.fromEntries(cronChecks) as Record<
      (typeof CRITICAL_CRON_NAMES)[number],
      CronHealthResult
    >;
    const { data: activeLocks, error: locksError } = await supabase
      .from('cron_locks')
      .select('name, locked_at, expires_at');
    const [queueCountResult, oldestQueueResult, socialQueueResult] = await Promise.all([
      supabase
        .from('whatsapp_ingress')
        .select('id', { count: 'exact', head: true })
        .in('status', ['queued', 'retry', 'processing']),
      supabase
        .from('whatsapp_ingress')
        .select('created_at')
        .in('status', ['queued', 'retry', 'processing'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.rpc('get_social_publication_health'),
    ]);

    const issues: Array<{ name: string; status: string }> = cronChecks
      .filter(([, result]) => !['healthy', 'running'].includes(result.status))
      .map(([name, result]) => ({ name, status: result.status }));
    if (locksError) {
      issues.push({ name: 'cron-locks', status: 'error' });
    }
    const oldestQueuedAt = oldestQueueResult.data?.created_at
      ? Date.parse(oldestQueueResult.data.created_at)
      : null;
    const whatsappQueueStale = oldestQueuedAt !== null
      && Number.isFinite(oldestQueuedAt)
      && Date.now() - oldestQueuedAt > 10 * 60_000;
    if (queueCountResult.error || oldestQueueResult.error) {
      issues.push({ name: 'whatsapp-queue', status: 'error' });
    } else if (whatsappQueueStale) {
      issues.push({ name: 'whatsapp-queue', status: 'stale' });
    }

    const socialQueue = socialQueueResult.data && typeof socialQueueResult.data === 'object'
      ? socialQueueResult.data as Record<string, unknown>
      : null;
    const socialDead = Number(socialQueue?.dead || 0);
    const socialExpiredLeases = Number(socialQueue?.expired_leases || 0);
    const socialOldestDueAt = typeof socialQueue?.oldest_due_at === 'string'
      ? Date.parse(socialQueue.oldest_due_at)
      : null;
    const socialQueueStale = socialOldestDueAt !== null
      && Number.isFinite(socialOldestDueAt)
      && Date.now() - socialOldestDueAt > 5 * 60_000;
    if (socialQueueResult.error || !socialQueue) {
      issues.push({ name: 'social-publication-queue', status: 'error' });
    } else {
      if (socialDead > 0) issues.push({ name: 'social-publication-dead-letter', status: 'failed' });
      if (socialExpiredLeases > 0) issues.push({ name: 'social-publication-leases', status: 'stale' });
      if (socialQueueStale) issues.push({ name: 'social-publication-queue', status: 'stale' });
    }

    const overallHealthy = issues.length === 0;
    return NextResponse.json(
      {
        success: overallHealthy,
        status: overallHealthy ? 'healthy' : 'unhealthy',
        systemVersion,
        timestamp: new Date().toISOString(),
        activeLocks: locksError ? [] : activeLocks ?? [],
        queues: {
          whatsapp: {
            pending: queueCountResult.error ? null : (queueCountResult.count || 0),
            oldest_queued_at: oldestQueueResult.error
              ? null
              : oldestQueueResult.data?.created_at || null,
            status: queueCountResult.error || oldestQueueResult.error
              ? 'error'
              : whatsappQueueStale ? 'stale' : 'healthy',
          },
          social: {
            pending: socialQueueResult.error ? null : Number(socialQueue?.pending || 0),
            due: socialQueueResult.error ? null : Number(socialQueue?.due || 0),
            processing: socialQueueResult.error ? null : Number(socialQueue?.processing || 0),
            dead: socialQueueResult.error ? null : socialDead,
            expired_leases: socialQueueResult.error ? null : socialExpiredLeases,
            oldest_due_at: socialQueueResult.error ? null : socialQueue?.oldest_due_at || null,
            status: socialQueueResult.error || !socialQueue
              ? 'error'
              : socialDead > 0 ? 'dead-letter'
                : socialExpiredLeases > 0 || socialQueueStale ? 'stale' : 'healthy',
          },
        },
        crons,
        issues,
      },
      {
        status: overallHealthy ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    console.error('[Health Check] Unable to determine cron health');
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        systemVersion,
        error: 'Health status unavailable',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}

/**
 * POST /api/cron/health - Soporte para peticiones POST.
 */
export async function POST(req: NextRequest) {
  return GET(req);
}
