import { randomUUID } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase';

export interface CronLockHandle {
  name: string;
  ownerToken: string;
}

function validateLockInput(name: string, expireMinutes: number): void {
  if (!/^[a-z0-9:_-]{1,100}$/i.test(name)) {
    throw new Error('Invalid distributed lock name');
  }
  if (!Number.isFinite(expireMinutes) || expireMinutes <= 0 || expireMinutes > 60) {
    throw new Error('Invalid distributed lock expiration');
  }
}

/**
 * Acquire a distributed lock and return the ownership token needed to release
 * it. A database/schema/permission error throws and therefore fails closed.
 * A null result only means another worker currently owns a valid lock.
 */
export async function acquireLock(
  name: string,
  expireMinutes = 5,
): Promise<CronLockHandle | null> {
  validateLockInput(name, expireMinutes);

  const supabase = createSupabaseAdmin();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expireMinutes * 60 * 1000);
  const ownerToken = randomUUID();
  const acquiredBy = process.env.VERCEL_REGION || 'cron-worker';

  try {
    const { data: insertedLock, error: insertError } = await supabase
      .from('cron_locks')
      .insert({
        name,
        locked_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        owner_token: ownerToken,
        acquired_by: acquiredBy,
      })
      .select('name, owner_token')
      .single();

    if (!insertError && insertedLock?.owner_token === ownerToken) {
      console.log(`[Lock] Acquired: ${name}`);
      return { name, ownerToken };
    }

    // Only a primary-key collision means another worker owns the lock. Missing
    // migrations, permissions, network failures, and malformed results stop the
    // cron instead of silently running without mutual exclusion.
    if (insertError?.code !== '23505') {
      console.error(`[Lock] Insert failed for ${name}:`, insertError?.code || 'invalid_insert_result');
      throw new Error('Distributed lock unavailable');
    }

    const { data: currentLock, error: selectError } = await supabase
      .from('cron_locks')
      .select('name, expires_at')
      .eq('name', name)
      .maybeSingle();

    if (selectError) {
      console.error(`[Lock] Read failed for ${name}:`, selectError.code || 'database_error');
      throw new Error('Distributed lock unavailable');
    }
    if (!currentLock) {
      // The row disappeared between INSERT and SELECT. Do not execute unless
      // this worker can prove ownership; a later invocation can acquire it.
      return null;
    }

    const lockExpires = new Date(currentLock.expires_at).getTime();
    if (!Number.isFinite(lockExpires)) {
      console.error(`[Lock] Invalid expiration stored for ${name}`);
      throw new Error('Distributed lock unavailable');
    }

    if (lockExpires < now.getTime()) {
      const { data: reclaimedLock, error: reclaimError } = await supabase
        .from('cron_locks')
        .update({
          locked_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          owner_token: ownerToken,
          acquired_by: acquiredBy,
        })
        .eq('name', name)
        .lt('expires_at', now.toISOString())
        .select('name, owner_token')
        .maybeSingle();

      if (reclaimError) {
        console.error(`[Lock] Reclaim failed for ${name}:`, reclaimError.code || 'database_error');
        throw new Error('Distributed lock unavailable');
      }

      if (reclaimedLock?.owner_token === ownerToken) {
        console.log(`[Lock] Reclaimed expired lock: ${name}`);
        return { name, ownerToken };
      }
    }

    console.warn(`[Lock] Busy; skipped concurrent execution: ${name}`);
    return null;
  } catch (error) {
    console.error(`[Lock] Acquisition failed for ${name}`);
    throw error instanceof Error ? error : new Error('Distributed lock unavailable');
  }
}

/** Release only the lock still owned by this worker. */
export async function releaseLock(lock: CronLockHandle): Promise<boolean> {
  const supabase = createSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('cron_locks')
      .delete()
      .eq('name', lock.name)
      .eq('owner_token', lock.ownerToken)
      .select('name');

    if (error) {
      console.error(`[Lock] Release failed for ${lock.name}:`, error.code || 'database_error');
      return false;
    }
    if (!data || data.length !== 1) {
      console.warn(`[Lock] Ownership changed; lock not released: ${lock.name}`);
      return false;
    }

    console.log(`[Lock] Released: ${lock.name}`);
    return true;
  } catch (error) {
    console.error(`[Lock] Release failed for ${lock.name}:`, error);
    return false;
  }
}

export interface CronRunUpdate {
  finished_at: string;
  duration_seconds: number;
  found_count: number;
  processed_count: number;
  skipped_count: number;
  error_count: number;
  error_details: unknown[];
  processed_ids: string[];
  success: boolean;
}

export async function startRunLog(cronName: string): Promise<string> {
  const supabase = createSupabaseAdmin();
  const now = new Date();

  try {
    const { data, error } = await supabase
      .from('cron_runs')
      .insert({
        cron_name: cronName,
        started_at: now.toISOString(),
        success: false,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Cron run ID was not returned');
    }
    return data.id;
  } catch (error) {
    console.error(`[RunLog] Could not record start for ${cronName}:`, error);
    return '';
  }
}

export async function updateRunLog(
  id: string,
  updates: Partial<CronRunUpdate>,
): Promise<boolean> {
  if (!id) return false;

  const supabase = createSupabaseAdmin();
  try {
    const { error } = await supabase
      .from('cron_runs')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error(`[RunLog] Could not update ${id}:`, error.code || 'database_error');
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[RunLog] Could not update ${id}:`, error);
    return false;
  }
}
