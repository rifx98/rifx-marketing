import { createSupabaseAdmin } from '@/lib/supabase';
import { deleteFile, isTenantOwnedR2Key } from '@/lib/r2';

export interface CleanupMediaResult {
  found: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ tenantId?: string; error: string }>;
  processedIds: string[];
  remaining: number;
}

async function cleanupTenant(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  tenantId: string,
  retentionDays: number,
  startTime: number,
  result: CleanupMediaResult
) {
  if (retentionDays <= 0) return;
  if ((Date.now() - startTime) / 1000 > 8) {
    result.remaining += 1;
    return;
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const { data: files, error: listError } = await supabase.storage
    .from('chat_media')
    .list(tenantId, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (listError) throw new Error(`Storage list failed: ${listError.message}`);

  const pathsToDelete = (files || [])
    .filter(file => {
      const match = file.name.match(/^(\d+)_/);
      return match ? Number(match[1]) < cutoff.getTime() : false;
    })
    .map(file => `${tenantId}/${file.name}`);
  result.found += pathsToDelete.length;
  if (pathsToDelete.length > 0) {
    const { error } = await supabase.storage.from('chat_media').remove(pathsToDelete);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
    result.processed += pathsToDelete.length;
  }

  // Messages do not carry tenant_id consistently; establish ownership through
  // the already tenant-scoped conversation IDs.
  const { data: conversations, error: conversationError } = await supabase
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1000);
  if (conversationError) throw new Error(`Conversation lookup failed: ${conversationError.message}`);
  const conversationIds = (conversations || []).map(item => item.id);
  if (conversationIds.length === 0) return;

  const { data: messages, error: messageError } = await supabase
    .from('messages')
    .select('id, content')
    .in('conversation_id', conversationIds)
    .lt('created_at', cutoff.toISOString())
    .like('content', '%![%')
    .limit(500);
  if (messageError) throw new Error(`Message lookup failed: ${messageError.message}`);

  for (const message of messages || []) {
    if ((Date.now() - startTime) / 1000 > 8) {
      result.remaining += (messages || []).length - (messages || []).indexOf(message);
      break;
    }
    const match = message.content?.match(/^!\[.*\]\((.*)\)(?:\n([\s\S]*))?/);
    if (!match) {
      result.skipped += 1;
      continue;
    }
    const replacement = match[2] ? `[Imagen adjunta caducada]\n${match[2]}` : '[Imagen adjunta caducada]';
    const { error } = await supabase.from('messages').update({ content: replacement }).eq('id', message.id);
    if (error) {
      result.errors += 1;
      result.errorDetails.push({ tenantId, error: error.message });
    } else {
      result.processed += 1;
      result.processedIds.push(message.id);
    }
  }
}

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
    remaining: 0,
  };

  // Remove abandoned direct-upload objects after their atomic reservation
  // expires. A failed R2 deletion keeps the reservation for a later retry.
  const { data: abandonedUploads, error: abandonedError } = await supabase
    .from('storage_upload_reservations')
    .select('tenant_id, object_key')
    .in('status', ['reserved', 'expired'])
    .lt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(20);
  if (abandonedError) {
    result.errors += 1;
    result.errorDetails.push({ error: 'Abandoned upload lookup failed' });
  } else {
    for (const upload of abandonedUploads || []) {
      if ((Date.now() - options.startTime) / 1000 > 8) {
        result.remaining += 1;
        break;
      }
      if (!isTenantOwnedR2Key(upload.object_key, upload.tenant_id)) {
        result.errors += 1;
        result.errorDetails.push({ tenantId: upload.tenant_id, error: 'Invalid reserved object key' });
        continue;
      }
      try {
        await deleteFile(upload.object_key);
        const { data: released, error: releaseError } = await supabase.rpc('release_tenant_storage_object', {
          p_tenant_id: upload.tenant_id,
          p_object_key: upload.object_key,
        });
        if (releaseError || released !== true) throw new Error('Reservation release failed');
        result.processed += 1;
      } catch {
        result.errors += 1;
        result.errorDetails.push({ tenantId: upload.tenant_id, error: 'Abandoned upload cleanup failed' });
      }
    }
  }

  let query = supabase.from('config').select('tenant_id, media_retention_days').not('tenant_id', 'is', null);
  if (options.tenantId) query = query.eq('tenant_id', options.tenantId);
  const { data: configurations, error } = await query.order('tenant_id').limit(1000);
  if (error) {
    return { ...result, errors: 1, errorDetails: [{ error: error.message }] };
  }

  for (const config of configurations || []) {
    try {
      await cleanupTenant(
        supabase,
        config.tenant_id,
        Number(config.media_retention_days || 0),
        options.startTime,
        result
      );
    } catch (error) {
      result.errors += 1;
      result.errorDetails.push({
        tenantId: config.tenant_id,
        error: error instanceof Error ? error.message : 'Unknown cleanup error',
      });
    }
  }

  return result;
}
