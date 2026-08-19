import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { verifyOAuthState } from '@/lib/auth';
import { tenantCanUseFeature, type PanelFeature } from '@/lib/feature-access';

export const SOCIAL_OAUTH_ACTION = 'social_connect' as const;
export const OAUTH_FETCH_TIMEOUT_MS = 10_000;
export const MAX_OAUTH_RESPONSE_BYTES = 256 * 1024;
export const MAX_OAUTH_REQUEST_BYTES = 32 * 1024;
export const MAX_OAUTH_CODE_LENGTH = 4_096;
export const MAX_OAUTH_STATE_LENGTH = 4_096;
export const MAX_PROVIDER_TOKEN_LENGTH = 16_384;
export const MAX_PROVIDER_ID_LENGTH = 256;
export const MAX_PROVIDER_NAME_LENGTH = 200;
export const MAX_PROFILE_URL_LENGTH = 2_048;
export const MAX_SOCIAL_ACCOUNTS = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9._:@+-]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export interface OAuthJsonResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
}

export function resolveOAuthAppOrigin(): string | null {
  const configured = process.env.APP_URL || (
    process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_APP_URL : undefined
  );
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function buildOAuthRedirectUri(origin: string, callbackPath: string): string {
  return new URL(callbackPath, origin).toString();
}

export function buildPanelRedirect(
  origin: string,
  tab: 'social' | 'settings',
  result: { error?: string; success?: string },
): URL {
  const redirect = new URL('/panel', origin);
  redirect.searchParams.set('tab', tab);
  if (result.error) redirect.searchParams.set('error', result.error);
  if (result.success) redirect.searchParams.set(result.success, 'true');
  return redirect;
}

export function isValidOAuthCode(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_OAUTH_CODE_LENGTH &&
    !CONTROL_CHARACTER_PATTERN.test(value);
}

export function isValidOAuthState(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_OAUTH_STATE_LENGTH &&
    STATE_PATTERN.test(value);
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function boundedProviderId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_PROVIDER_ID_LENGTH ||
    !PROVIDER_ID_PATTERN.test(normalized)
  ) return null;
  return normalized;
}

export function boundedProviderName(value: unknown, fallback = 'Connected account'): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_PROVIDER_NAME_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) return fallback;
  return normalized;
}

export function boundedProviderToken(value: unknown, optional = false): string | null {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    normalized.length < 8 ||
    normalized.length > MAX_PROVIDER_TOKEN_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) return null;
  return normalized;
}

export function boundedProfileUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_PROFILE_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function tokenExpiryFromSeconds(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 366 * 24 * 60 * 60) return null;
  return new Date(Date.now() + Math.floor(seconds) * 1_000).toISOString();
}

export async function verifySocialOAuthState(state: unknown): Promise<string | null> {
  if (!isValidOAuthState(state)) return null;
  const verifiedState = await verifyOAuthState(state);
  if (
    !verifiedState ||
    verifiedState.oauthAction !== SOCIAL_OAUTH_ACTION ||
    !isValidUuid(verifiedState.tenantId)
  ) return null;
  return verifiedState.tenantId;
}

export async function oauthTenantCanUseFeature(
  supabase: SupabaseClient,
  tenantId: string,
  feature: Extract<PanelFeature, 'social' | 'appointments'>,
): Promise<boolean> {
  if (!isValidUuid(tenantId)) return false;
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id,plan,plan_status,plan_expires_at,permission_overrides,is_admin,is_active,deleted_at')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant || tenant.is_active === false || tenant.deleted_at) return false;
  return tenantCanUseFeature({
    tenantId: tenant.id,
    plan: tenant.plan,
    planStatus: tenant.plan_status,
    planExpiresAt: tenant.plan_expires_at,
    permissionOverrides: tenant.permission_overrides || {},
    isAdmin: tenant.is_admin === true,
  }, feature);
}

async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) throw new Error('payload_too_large');
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new Error('invalid_payload');
  } finally {
    reader.releaseLock();
  }
}

export async function readLimitedJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_OAUTH_REQUEST_BYTES) return null;
  try {
    const raw = await readBodyWithLimit(req.body, MAX_OAUTH_REQUEST_BYTES);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchOAuthJson<T = Record<string, unknown>>(
  input: string | URL,
  init: RequestInit = {},
): Promise<OAuthJsonResult<T>> {
  const response = await fetch(input, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(OAUTH_FETCH_TIMEOUT_MS),
  });
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_OAUTH_RESPONSE_BYTES) {
    throw new Error('invalid_provider_response');
  }
  const raw = await readBodyWithLimit(response.body, MAX_OAUTH_RESPONSE_BYTES);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('invalid_provider_response');
  }
  if (!data || typeof data !== 'object') throw new Error('invalid_provider_response');
  return { ok: response.ok, status: response.status, data: data as T };
}
