import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { headFile, isTenantOwnedR2Key } from '@/lib/r2';
import { denyUnlessFeature } from '@/lib/feature-access';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';
import {
  getSocialQueueConfig,
  hasAnySocialQueueEnvironment,
} from '@/lib/social-queue';

const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_SOCIAL_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_ACCOUNTS_PER_POST = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

async function rollbackPost(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  tenantId: string,
  postId: string,
  publicationIds: string[],
) {
  if (publicationIds.length > 0) {
    await supabase
      .from('social_publications')
      .update({ status: 'failed', last_error: 'Publication setup failed' })
      .eq('tenant_id', tenantId)
      .eq('post_id', postId)
      .in('id', publicationIds);
  }
  const { error } = await supabase
    .from('social_posts')
    .delete()
    .eq('id', postId)
    .eq('tenant_id', tenantId);
  if (error) console.error('[Social Publish] Rollback could not delete post');
}

// Persist the complete fan-out in Postgres. The authenticated scheduler claims
// due rows and dispatches them to QStash; the browser never owns production
// delivery and an external enqueue failure cannot lose an accepted post.
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);
    const featureDenied = denyUnlessFeature(tenant, 'social');
    if (featureDenied) return featureDenied;
    const rateLimited = await enforceTenantRateLimit('social-publish', tenant.tenantId, 20, 60_000);
    if (rateLimited) return rateLimited;

    const bodyResult = await readLimitedJsonObject(req, MAX_REQUEST_BYTES);
    if (!bodyResult.ok) return bodyResult.response;
    const {
      videoStoragePath,
      caption,
      title,
      platformAccountIds,
      scheduledAt,
      videoType,
    } = bodyResult.body;

    if (
      typeof caption !== 'string'
      || !Array.isArray(platformAccountIds)
      || platformAccountIds.length === 0
      || platformAccountIds.length > MAX_ACCOUNTS_PER_POST
    ) {
      return json({ error: 'Faltan parámetros requeridos' }, 400);
    }
    const accountIds = Array.from(new Set(platformAccountIds.filter(
      (id: unknown): id is string => typeof id === 'string' && UUID_RE.test(id),
    )));
    if (
      accountIds.length !== platformAccountIds.length
      || caption.length > 5_000
      || (title !== undefined && typeof title !== 'string')
      || String(title || '').length > 300
      || (videoType !== undefined && !['short', 'long'].includes(String(videoType)))
    ) {
      return json({ error: 'Parámetros de publicación inválidos' }, 400);
    }

    const requestedRunAt = scheduledAt ? new Date(String(scheduledAt)).getTime() : Date.now();
    if (
      !Number.isFinite(requestedRunAt)
      || requestedRunAt < Date.now() - 60_000
      || requestedRunAt > Date.now() + 366 * 24 * 60 * 60_000
    ) {
      return json({ error: 'Fecha programada inválida' }, 400);
    }
    const normalizedSchedule = new Date(requestedRunAt).toISOString();

    if (!isTenantOwnedR2Key(videoStoragePath, tenant.tenantId)) {
      return json({ error: 'Ruta de video fuera del tenant autenticado' }, 403);
    }
    let metadata;
    try {
      metadata = await headFile(videoStoragePath);
    } catch {
      return json({ error: 'El video indicado no existe o no está disponible' }, 400);
    }
    const contentLength = Number(metadata.ContentLength || 0);
    if (
      contentLength <= 0
      || contentLength > MAX_SOCIAL_VIDEO_BYTES
      || !ALLOWED_VIDEO_TYPES.has(String(metadata.ContentType || '').toLowerCase())
    ) {
      return json({ error: 'El objeto subido no cumple tipo o tamaño permitido' }, 400);
    }

    const queueConfig = getSocialQueueConfig(req.nextUrl.origin);
    if (
      (process.env.NODE_ENV === 'production' && !queueConfig)
      || (hasAnySocialQueueEnvironment() && !queueConfig)
    ) {
      return json({ error: 'Cola social no configurada de forma segura' }, 503);
    }

    const supabase = createSupabaseAdmin();
    const { data: reservation, error: reservationError } = await supabase
      .from('storage_upload_reservations')
      .select('size_bytes, status')
      .eq('tenant_id', tenant.tenantId)
      .eq('object_key', videoStoragePath)
      .maybeSingle();
    if (
      reservationError
      || !reservation
      || reservation.status !== 'completed'
      || Number(reservation.size_bytes) !== contentLength
    ) {
      return json({ error: 'La subida no fue confirmada contra la cuota del tenant' }, 409);
    }

    const { data: ownedAccounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('id, platform')
      .eq('tenant_id', tenant.tenantId)
      .in('id', accountIds);
    if (accountsError || !ownedAccounts || ownedAccounts.length !== accountIds.length) {
      return json({ error: 'Una o más cuentas sociales no pertenecen al tenant' }, 403);
    }

    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        tenant_id: tenant.tenantId,
        title: String(title || '').trim(),
        caption: caption.trim(),
        video_storage_path: videoStoragePath,
        video_public_url: null,
        video_type: videoType || 'short',
      })
      .select('id')
      .single();
    if (postError || !post) {
      console.error('[Social Publish] Post insertion failed');
      return json({ error: 'No se pudo crear la publicación social' }, 500);
    }

    const { data: publications, error: publicationsError } = await supabase
      .from('social_publications')
      .insert(accountIds.map((accountId) => ({
        post_id: post.id,
        social_account_id: accountId,
        status: 'pending',
        attempts: 0,
        scheduled_at: normalizedSchedule,
        available_at: normalizedSchedule,
        dispatch_after: normalizedSchedule,
      })))
      .select('id');
    const publicationIds = publications?.map((publication) => publication.id) || [];
    if (publicationsError || publicationIds.length !== accountIds.length) {
      await rollbackPost(supabase, tenant.tenantId, post.id, publicationIds);
      return json({ error: 'No se pudieron crear todas las publicaciones por canal' }, 500);
    }

    return json({
      success: true,
      postId: post.id,
      publicationIds,
      queued: Boolean(queueConfig),
      scheduledAt: normalizedSchedule,
    }, 201);
  } catch {
    console.error('[Social Publish] Request failed');
    return json({ error: 'No se pudo crear la publicación social' }, 500);
  }
}
