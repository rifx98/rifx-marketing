const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const CRON_HEALTH_POLICIES = {
  appointments: { maxAgeMs: 45 * MINUTE_MS },
  messages: { maxAgeMs: 15 * MINUTE_MS },
  whatsapp: { maxAgeMs: 5 * MINUTE_MS },
  'cold-leads': { maxAgeMs: 36 * HOUR_MS },
  'cleanup-media': { maxAgeMs: 36 * HOUR_MS },
  'monthly-briefing': { maxAgeMs: 35 * DAY_MS },
} as const;

export type CriticalCronName = keyof typeof CRON_HEALTH_POLICIES;

export const CRITICAL_CRON_NAMES = Object.keys(
  CRON_HEALTH_POLICIES,
) as CriticalCronName[];

const MAX_RUNNING_AGE_MS = 10 * MINUTE_MS;

export type CronHealthStatus =
  | 'healthy'
  | 'running'
  | 'failed'
  | 'never_executed'
  | 'stale'
  | 'error';

export interface CronRunSnapshot {
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | string | null;
  processed_count: number | null;
  skipped_count: number | null;
  error_count: number | null;
  success: boolean | null;
}

export interface CronHealthResult {
  status: CronHealthStatus;
  max_age_seconds: number;
  last_run_at?: string;
  duration_seconds?: number;
  processed?: number;
  skipped?: number;
  errors?: number;
}

function finiteNumber(value: number | string | null): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function evaluateCronRun(
  cronName: CriticalCronName,
  run: CronRunSnapshot | null,
  nowMs = Date.now(),
): CronHealthResult {
  const maxAgeMs = CRON_HEALTH_POLICIES[cronName].maxAgeMs;
  const base = { max_age_seconds: maxAgeMs / 1_000 };

  if (!run) {
    return { ...base, status: 'never_executed' };
  }

  const startedAtMs = Date.parse(run.started_at);
  if (!Number.isFinite(startedAtMs) || startedAtMs > nowMs + MINUTE_MS) {
    return { ...base, status: 'error' };
  }

  const details = {
    ...base,
    last_run_at: new Date(startedAtMs).toISOString(),
    duration_seconds: finiteNumber(run.duration_seconds),
    processed: finiteNumber(run.processed_count),
    skipped: finiteNumber(run.skipped_count),
    errors: finiteNumber(run.error_count),
  };

  if (!run.finished_at) {
    return {
      ...details,
      status: nowMs - startedAtMs <= MAX_RUNNING_AGE_MS ? 'running' : 'stale',
    };
  }

  const finishedAtMs = Date.parse(run.finished_at);
  if (
    !Number.isFinite(finishedAtMs) ||
    finishedAtMs < startedAtMs ||
    finishedAtMs > nowMs + MINUTE_MS
  ) {
    return { ...details, status: 'error' };
  }

  if (run.success !== true) {
    return { ...details, status: 'failed' };
  }

  return {
    ...details,
    status: nowMs - startedAtMs > maxAgeMs ? 'stale' : 'healthy',
  };
}
