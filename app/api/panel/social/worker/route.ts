import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';
import { triggerCriticalAlert } from '@/lib/alerts';
import { MetaPublishingService } from '@/services/social/meta';
import { YouTubePublishingService } from '@/services/social/youtube';
import { TikTokPublishingService } from '@/services/social/tiktok';
import { SocialProviderError } from '@/services/social/provider-error';
import { deleteFile, getDownloadPresignedUrl, headFile, isTenantOwnedR2Key } from '@/lib/r2';
import { getTenantFromRequest } from '@/lib/auth';
import { safeEqualSecrets } from '@/lib/security';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  getSocialQueueConfig,
  verifyQstashRequest,
} from '@/lib/social-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WORKER_LEASE_SECONDS = 90;
const PROVIDER_TIMEOUT_MS = 45_000;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_SOCIAL_VIDEO_BYTES = 100 * 1024 * 1024;
const FRESH_MEDIA_URL_SECONDS = 2 * 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);

type FailureDisposition = 'retry' | 'dead' | 'ambiguous';

class PublicationFailure extends Error {
  readonly code: string;
  readonly disposition: FailureDisposition;

  constructor(code: string, disposition: FailureDisposition) {
    super(code);
    this.name = 'PublicationFailure';
    this.code = code;
    this.disposition = disposition;
  }
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      ...extraHeaders,
    },
  });
}

async function readWorkerBody(req: NextRequest): Promise<{ raw: string; body: Record<string, unknown> } | null> {
  const contentType = req.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return null;
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null;
  if (!req.body) return null;

  const reader = req.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return { raw, body: parsed as Record<string, unknown> };
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function workerFailure(error: unknown, providerStarted: boolean): PublicationFailure {
  if (error instanceof PublicationFailure) return error;
  if (error instanceof SocialProviderError) {
    return new PublicationFailure(error.code, error.disposition);
  }
  if (providerStarted) {
    return new PublicationFailure('provider_outcome_ambiguous', 'ambiguous');
  }
  return new PublicationFailure('social_worker_pre_provider_failure', 'retry');
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(3_600, 30 * (2 ** Math.max(0, Math.min(attempt - 1, 7))));
}

async function writeLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  publicationId: string,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('social_logs').insert({
    publication_id: publicationId,
    log_level: level,
    message: message.slice(0, 1_000),
    metadata,
  });
  if (error) console.error('[Social Worker] Failed to write social log');
}

async function checkAndCleanupVideo(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  postId: string,
  videoStoragePath: string,
  tenantId: string,
) {
  if (!isTenantOwnedR2Key(videoStoragePath, tenantId)) {
    console.error('[Social Worker] Refusing cross-tenant storage deletion');
    return;
  }
  const { data: publications, error } = await supabase
    .from('social_publications')
    .select('status, last_error_code')
    .eq('post_id', postId);
  if (error) throw error;
  const allFinished = Boolean(publications?.length) && publications?.every((item) => (
    item.status === 'published'
    || item.status === 'failed'
    || (item.status === 'dead' && !String(item.last_error_code || '').includes('ambiguous'))
  ));
  if (!allFinished) return;

  await deleteFile(videoStoragePath);
  const { data: released, error: releaseError } = await supabase.rpc('release_tenant_storage_object', {
    p_tenant_id: tenantId,
    p_object_key: videoStoragePath,
  });
  if (releaseError || released !== true) {
    console.error('[Social Worker] Storage usage reconciliation is pending');
  }
}

async function publishToProvider(
  publicationId: string,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  post: any,
  account: any,
  accessToken: string,
  mediaUrl: string,
  contentType: string,
  signal: AbortSignal,
): Promise<string> {
  const providerLog = async (message: string, level?: 'info' | 'warning' | 'error') => {
    await writeLog(supabase, publicationId, message, level || 'info');
  };

  if (account.platform === 'facebook') {
    if (post.video_type === 'long') {
      const result = await MetaPublishingService.publishFacebookVideo(
        account.platform_user_id,
        accessToken,
        mediaUrl,
        post.caption,
        post.title,
        signal,
      );
      return result.id;
    }
    const result = await MetaPublishingService.publishFacebookReel(
      account.platform_user_id,
      accessToken,
      mediaUrl,
      post.caption,
      signal,
    );
    return result.id;
  }

  if (account.platform === 'instagram') {
    const result = await MetaPublishingService.publishInstagramReel(
      account.platform_user_id,
      accessToken,
      mediaUrl,
      post.caption,
      providerLog,
      signal,
    );
    return result.id;
  }

  if (account.platform === 'youtube') {
    const result = await YouTubePublishingService.publishShort(
      accessToken,
      mediaUrl,
      post.title || 'RIFX Video',
      post.caption,
      providerLog,
      signal,
      contentType,
    );
    return result.id;
  }

  if (account.platform === 'tiktok') {
    const result = await TikTokPublishingService.publishVideo(
      accessToken,
      mediaUrl,
      post.caption,
      providerLog,
      signal,
      contentType,
    );
    return result.id;
  }

  throw new PublicationFailure('unsupported_social_platform', 'dead');
}

export async function POST(req: NextRequest) {
  const parsedBody = await readWorkerBody(req);
  if (!parsedBody) return json({ error: 'Solicitud inválida' }, 400);

  const queueConfig = getSocialQueueConfig(req.nextUrl.origin);
  const qstashSignature = req.headers.get('upstash-signature');
  const configuredWorkerSecret = process.env.SOCIAL_WORKER_SECRET || process.env.CRON_SECRET;
  const forwardedSecretValid = safeEqualSecrets(
    req.headers.get('x-worker-secret'),
    configuredWorkerSecret,
  );

  let isInternalWorker = false;
  if (qstashSignature) {
    if (
      !queueConfig
      || !forwardedSecretValid
      || !(await verifyQstashRequest(qstashSignature, parsedBody.raw, queueConfig))
    ) {
      return json({ error: 'Firma de cola no autorizada' }, 401);
    }
    isInternalWorker = true;
  } else if (process.env.NODE_ENV !== 'production' && forwardedSecretValid) {
    isInternalWorker = true;
  }

  const requestingTenant = isInternalWorker ? null : await getTenantFromRequest(req);
  if (!isInternalWorker && !requestingTenant?.tenantId) {
    return json({ error: 'No autorizado' }, 401);
  }
  if (!isInternalWorker && process.env.NODE_ENV === 'production') {
    return json({ error: 'El worker de producción solo acepta entregas firmadas de la cola' }, 503);
  }
  if (requestingTenant) {
    const featureDenied = denyUnlessFeature(requestingTenant, 'social');
    if (featureDenied) return featureDenied;
  }

  const publicationId = typeof parsedBody.body.publicationId === 'string'
    ? parsedBody.body.publicationId
    : '';
  if (!UUID_RE.test(publicationId)) return json({ error: 'ID de publicación inválido' }, 400);

  const supabase = createSupabaseAdmin();
  const { data: publication, error: publicationError } = await supabase
    .from('social_publications')
    .select('id, tenant_id, post_id, social_account_id, status, attempts, max_attempts, scheduled_at')
    .eq('id', publicationId)
    .maybeSingle();
  if (publicationError) return json({ error: 'Cola social temporalmente no disponible' }, 503, { 'Retry-After': '5' });
  if (!publication) return json({ error: 'Publicación no encontrada' }, 404);
  if (requestingTenant?.tenantId && requestingTenant.tenantId !== publication.tenant_id) {
    return json({ error: 'Publicación fuera del tenant autorizado' }, 403);
  }

  const [postResult, accountResult, ownerResult] = await Promise.all([
    supabase
      .from('social_posts')
      .select('id, tenant_id, title, caption, video_storage_path, video_type')
      .eq('id', publication.post_id)
      .eq('tenant_id', publication.tenant_id)
      .maybeSingle(),
    supabase
      .from('social_accounts')
      .select('id, tenant_id, platform, platform_user_id, encrypted_access_token, encryption_iv, encryption_tag')
      .eq('id', publication.social_account_id)
      .eq('tenant_id', publication.tenant_id)
      .maybeSingle(),
    isInternalWorker
      ? supabase
          .from('tenants')
          .select('id, plan, plan_status, plan_expires_at, is_admin, permission_overrides, is_active, deleted_at')
          .eq('id', publication.tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const post = postResult.data;
  const account = accountResult.data;
  if (postResult.error || accountResult.error || !post || !account) {
    return json({ error: 'Dependencias de publicación no disponibles' }, 503, { 'Retry-After': '5' });
  }

  const leaseToken = randomUUID();
  const { data: claimData, error: claimError } = await supabase.rpc('claim_social_publication', {
    p_publication_id: publicationId,
    p_lease_token: leaseToken,
    p_lease_seconds: WORKER_LEASE_SECONDS,
  });
  if (claimError) {
    console.error('[Social Worker] Atomic claim unavailable');
    return json({ error: 'Cola social temporalmente no disponible' }, 503, { 'Retry-After': '5' });
  }
  const claim = Array.isArray(claimData) ? claimData[0] : claimData;
  const claimState = typeof claim?.claim_state === 'string' ? claim.claim_state : '';
  const currentAttempts = Number(claim?.attempt_count || 0);
  if (claimState !== 'claimed') {
    const terminal = ['published', 'failed', 'dead', 'dead_ambiguous'].includes(claimState);
    return json({
      success: terminal,
      status: claimState || 'unavailable',
    }, claimState === 'missing' ? 404 : 200);
  }

  let providerStarted = false;
  try {
    if (isInternalWorker) {
      const ownerTenant = ownerResult.data;
      if (
        ownerResult.error
        || !ownerTenant
        || ownerTenant.is_active === false
        || ownerTenant.deleted_at
      ) {
        throw new PublicationFailure('tenant_unavailable', 'dead');
      }
      const featureDenied = denyUnlessFeature({
        tenantId: ownerTenant.id,
        plan: ownerTenant.plan,
        planStatus: ownerTenant.plan_status,
        planExpiresAt: ownerTenant.plan_expires_at,
        isAdmin: ownerTenant.is_admin === true,
        permissionOverrides: ownerTenant.permission_overrides && typeof ownerTenant.permission_overrides === 'object'
          ? ownerTenant.permission_overrides
          : {},
      }, 'social');
      if (featureDenied) {
        throw new PublicationFailure('social_feature_unavailable', 'dead');
      }
    }

    if (!isTenantOwnedR2Key(post.video_storage_path, post.tenant_id)) {
      throw new PublicationFailure('invalid_tenant_storage_path', 'dead');
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(
        account.encrypted_access_token,
        account.encryption_iv,
        account.encryption_tag,
      );
    } catch {
      triggerCriticalAlert({
        tenantId: account.tenant_id,
        title: 'Cuenta social desconectada',
        message: `No se pudo publicar en ${account.platform}. Reconecta la cuenta desde el panel.`,
        url: '/panel',
      }).catch(() => undefined);
      throw new PublicationFailure('social_token_decryption_failed', 'dead');
    }

    let mediaMetadata;
    try {
      mediaMetadata = await headFile(post.video_storage_path);
    } catch {
      throw new PublicationFailure('social_media_temporarily_unavailable', 'retry');
    }
    const contentLength = Number(mediaMetadata.ContentLength || 0);
    if (
      contentLength <= 0
      || contentLength > MAX_SOCIAL_VIDEO_BYTES
      || !ALLOWED_VIDEO_TYPES.has(String(mediaMetadata.ContentType || '').toLowerCase())
    ) {
      throw new PublicationFailure('invalid_social_media_object', 'dead');
    }

    let freshMediaUrl: string;
    try {
      freshMediaUrl = await getDownloadPresignedUrl(post.video_storage_path, FRESH_MEDIA_URL_SECONDS);
    } catch {
      throw new PublicationFailure('social_media_signing_unavailable', 'retry');
    }

    const { data: providerMarked, error: providerMarkError } = await supabase.rpc(
      'mark_social_provider_started',
      {
        p_publication_id: publicationId,
        p_lease_token: leaseToken,
      },
    );
    if (providerMarkError || providerMarked !== true) {
      throw new PublicationFailure('social_worker_lease_lost', 'retry');
    }
    providerStarted = true;

    await writeLog(supabase, publicationId, `Iniciando intento #${currentAttempts} en ${account.platform}`);
    const externalMediaId = await publishToProvider(
      publicationId,
      supabase,
      post,
      account,
      accessToken,
      freshMediaUrl,
      String(mediaMetadata.ContentType || '').toLowerCase(),
      AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    );
    const { data: completedState, error: completionError } = await supabase.rpc(
      'complete_social_publication',
      {
        p_publication_id: publicationId,
        p_lease_token: leaseToken,
        p_outcome: 'published',
        p_external_media_id: externalMediaId,
        p_error_code: null,
        p_error_message: null,
        p_retry_seconds: 30,
      },
    );
    if (completionError || completedState !== 'published') {
      console.error('[Social Worker] Provider succeeded but durable completion failed');
      return json({ error: 'No se pudo confirmar el resultado del proveedor' }, 503, { 'Retry-After': '5' });
    }

    await writeLog(supabase, publicationId, `Publicación exitosa en ${account.platform}`);
    await checkAndCleanupVideo(supabase, post.id, post.video_storage_path, post.tenant_id).catch(() => undefined);
    return json({ success: true, status: 'published', mediaId: externalMediaId });
  } catch (error) {
    const failure = workerFailure(error, providerStarted);
    const outcome = failure.disposition === 'retry' ? 'retry' : 'dead';
    const retrySeconds = retryDelaySeconds(currentAttempts);
    await writeLog(
      supabase,
      publicationId,
      `La publicación falló (${failure.code})`,
      'error',
      { disposition: failure.disposition, attempt: currentAttempts },
    );
    const { data: completedState, error: completionError } = await supabase.rpc(
      'complete_social_publication',
      {
        p_publication_id: publicationId,
        p_lease_token: leaseToken,
        p_outcome: outcome,
        p_external_media_id: null,
        p_error_code: failure.code,
        p_error_message: failure.disposition === 'ambiguous'
          ? 'Provider outcome is ambiguous; reconcile before retrying'
          : 'Social publication failed',
        p_retry_seconds: retrySeconds,
      },
    );
    if (completionError || completedState === 'lease_lost') {
      console.error('[Social Worker] Durable failure completion failed');
      return json({ error: 'No se pudo confirmar el estado del worker' }, 503, { 'Retry-After': '5' });
    }

    if (completedState === 'retry') {
      return json(
        { error: 'Error temporal de publicación', status: 'retry' },
        503,
        { 'Retry-After': String(retrySeconds) },
      );
    }

    if (failure.disposition !== 'ambiguous') {
      await checkAndCleanupVideo(supabase, post.id, post.video_storage_path, post.tenant_id).catch(() => undefined);
    }
    return json({ success: false, status: 'dead', requiresReconciliation: failure.disposition === 'ambiguous' });
  }
}
