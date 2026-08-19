import { readLimitedResponseJson } from '@/lib/request-guards';

export type SocialProviderFailureDisposition = 'retry' | 'dead' | 'ambiguous';

export class SocialProviderError extends Error {
  readonly code: string;
  readonly disposition: SocialProviderFailureDisposition;

  constructor(code: string, disposition: SocialProviderFailureDisposition) {
    super(code);
    this.name = 'SocialProviderError';
    this.code = code;
    this.disposition = disposition;
  }
}

function safeCodePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_:-]/gu, '_').slice(0, 60);
}

export function providerHttpError(
  provider: string,
  phase: string,
  status: number,
  ambiguous = false,
): SocialProviderError {
  const disposition: SocialProviderFailureDisposition = ambiguous
    ? 'ambiguous'
    : status === 429 || status >= 500 ? 'retry' : 'dead';
  return new SocialProviderError(
    `${safeCodePart(provider)}_${safeCodePart(phase)}_http_${status}`,
    disposition,
  );
}

export function providerNetworkError(
  provider: string,
  phase: string,
  ambiguous = false,
): SocialProviderError {
  return new SocialProviderError(
    `${safeCodePart(provider)}_${safeCodePart(phase)}_network`,
    ambiguous ? 'ambiguous' : 'retry',
  );
}

export function providerInvalidResponse(
  provider: string,
  phase: string,
  ambiguous = false,
): SocialProviderError {
  return new SocialProviderError(
    `${safeCodePart(provider)}_${safeCodePart(phase)}_invalid_response`,
    ambiguous ? 'ambiguous' : 'retry',
  );
}

export async function readProviderJson(
  response: Response,
  provider: string,
  phase: string,
  ambiguous = false,
): Promise<Record<string, any>> {
  try {
    const payload = await readLimitedResponseJson(response, 256 * 1024);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw providerInvalidResponse(provider, phase, ambiguous);
    }
    return payload as Record<string, any>;
  } catch (error) {
    if (error instanceof SocialProviderError) throw error;
    throw providerInvalidResponse(provider, phase, ambiguous);
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new SocialProviderError('provider_deadline_exceeded', 'ambiguous');
  }
}

export async function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new SocialProviderError('provider_deadline_exceeded', 'ambiguous'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function assertProviderUploadUrl(
  rawUrl: unknown,
  allowedHostSuffixes: string[],
): string {
  if (typeof rawUrl !== 'string' || rawUrl.length > 4_096) {
    throw new SocialProviderError('provider_invalid_upload_url', 'dead');
  }
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const allowed = allowedHostSuffixes.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || !allowed
    ) {
      throw new Error('invalid');
    }
    return parsed.toString();
  } catch {
    throw new SocialProviderError('provider_invalid_upload_url', 'dead');
  }
}
