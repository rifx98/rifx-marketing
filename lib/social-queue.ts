import { createHash } from 'crypto';
import { jwtVerify, type JWTPayload } from 'jose';
import { safeEqualSecrets } from '@/lib/security';

const QSTASH_API_ORIGIN = 'https://qstash.upstash.io';
const QSTASH_PUBLISH_TIMEOUT_MS = 7_000;
const MAX_QSTASH_RESPONSE_BYTES = 32 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SocialQueueConfig {
  token: string;
  workerSecret: string;
  workerUrl: string;
  currentSigningKey: string;
  nextSigningKey: string;
}

export interface SocialDispatchResult {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
}

export function getSocialWorkerUrl(fallbackOrigin?: string): string | null {
  const configuredOrigin = process.env.APP_URL
    || (process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_APP_URL : undefined)
    || (process.env.NODE_ENV !== 'production' ? fallbackOrigin : undefined);
  if (!configuredOrigin) return null;

  try {
    const origin = new URL(configuredOrigin);
    if (!['http:', 'https:'].includes(origin.protocol)) return null;
    if (origin.username || origin.password || origin.search || origin.hash) return null;
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') return null;
    return new URL('/api/panel/social/worker', `${origin.origin}/`).toString();
  } catch {
    return null;
  }
}

export function hasAnySocialQueueEnvironment(): boolean {
  return Boolean(
    process.env.QSTASH_TOKEN
    || process.env.QSTASH_CURRENT_SIGNING_KEY
    || process.env.QSTASH_NEXT_SIGNING_KEY,
  );
}

export function getSocialQueueConfig(fallbackOrigin?: string): SocialQueueConfig | null {
  const token = process.env.QSTASH_TOKEN?.trim() || '';
  const workerSecret = (process.env.SOCIAL_WORKER_SECRET || process.env.CRON_SECRET)?.trim() || '';
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() || '';
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim() || '';
  const workerUrl = getSocialWorkerUrl(fallbackOrigin);

  if (
    !token
    || !workerSecret
    || !workerUrl
    || !currentSigningKey
    || !nextSigningKey
    || (process.env.NODE_ENV === 'production' && workerSecret.length < 32)
  ) {
    return null;
  }

  return {
    token,
    workerSecret,
    workerUrl,
    currentSigningKey,
    nextSigningKey,
  };
}

async function readBoundedJson(response: Response): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_QSTASH_RESPONSE_BYTES) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_QSTASH_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function dispatchSocialPublication(
  config: SocialQueueConfig,
  publicationId: string,
  dispatchToken: string,
): Promise<SocialDispatchResult> {
  if (!UUID_RE.test(publicationId) || !UUID_RE.test(dispatchToken)) {
    return { ok: false, errorCode: 'invalid_dispatch_identity' };
  }

  try {
    const response = await fetch(
      `${QSTASH_API_ORIGIN}/v2/publish/${encodeURIComponent(config.workerUrl)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '4',
          'Upstash-Retry-Delay': 'min(60000, pow(2, retried) * 5000)',
          'Upstash-Timeout': '55s',
          'Upstash-Deduplication-Id': `social-${publicationId}-${dispatchToken}`,
          'Upstash-Label': 'rifx-social-publication',
          'Upstash-Flow-Control-Key': 'rifx-social-publication',
          'Upstash-Flow-Control-Value': 'parallelism=5',
          'Upstash-Forward-X-Worker-Secret': config.workerSecret,
          'Upstash-Redact-Fields': 'header[Upstash-Forward-X-Worker-Secret]',
        },
        body: JSON.stringify({ publicationId }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(QSTASH_PUBLISH_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, errorCode: `qstash_http_${response.status}` };
    }

    const payload = await readBoundedJson(response);
    const messageId = typeof payload?.messageId === 'string' ? payload.messageId.trim() : '';
    if (!messageId || messageId.length > 200) {
      return { ok: false, errorCode: 'qstash_invalid_response' };
    }
    return { ok: true, messageId };
  } catch {
    return { ok: false, errorCode: 'qstash_unavailable' };
  }
}

function bodyDigest(rawBody: string): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('base64url');
}

function normalizedBase64Url(value: string): string {
  return value.replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
}

async function verifyWithKey(
  signature: string,
  key: string,
): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(
      signature,
      new TextEncoder().encode(key),
      {
        algorithms: ['HS256'],
        issuer: 'Upstash',
        clockTolerance: 5,
      },
    );
    return verified.payload;
  } catch {
    return null;
  }
}

export async function verifyQstashRequest(
  signature: string | null,
  rawBody: string,
  config: SocialQueueConfig,
): Promise<boolean> {
  if (!signature || signature.length > 4_096) return false;

  let payload = await verifyWithKey(signature, config.currentSigningKey);
  if (!payload) payload = await verifyWithKey(signature, config.nextSigningKey);
  if (!payload) return false;

  const signedBody = typeof payload.body === 'string' ? normalizedBase64Url(payload.body) : '';
  const expectedBody = bodyDigest(rawBody);
  return (
    payload.sub === config.workerUrl
    && typeof payload.iat === 'number'
    && typeof payload.nbf === 'number'
    && typeof payload.exp === 'number'
    && payload.exp >= payload.nbf
    && payload.exp - payload.iat <= 10 * 60
    && typeof payload.jti === 'string'
    && payload.jti.length > 0
    && payload.jti.length <= 200
    && safeEqualSecrets(signedBody, expectedBody)
  );
}
