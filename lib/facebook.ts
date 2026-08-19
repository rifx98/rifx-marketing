import { NextRequest } from 'next/server';
import { getTenantFromRequest } from './auth';
import { createSupabaseAdmin } from './supabase';
import { tenantCanUseFeature } from './feature-access';
import { readLimitedResponseJson } from './request-guards';

interface FacebookCredentials {
  tenantId: string;
  token: string;
  adAccountId: string;
  pageId?: string;
}

const META_ACCOUNT_ID_PATTERN = /^(?:act_)?[0-9]{5,30}$/;
const META_PAGE_ID_PATTERN = /^[0-9]{5,30}$/;

export async function fetchFacebookJson(
  input: string | URL,
  init: RequestInit = {},
  maxResponseBytes = 512 * 1024,
): Promise<Record<string, any>> {
  const url = input instanceof URL ? input : new URL(input);
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'graph.facebook.com'
    || url.port
    || url.username
    || url.password
  ) throw new Error('invalid_meta_endpoint');

  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const response = await fetch(url, {
    ...init,
    headers,
    redirect: 'error',
    signal: init.signal || AbortSignal.timeout(15_000),
  });
  const parsed = await readLimitedResponseJson(response, maxResponseBytes);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_meta_response');
  }
  const data = parsed as Record<string, any>;
  if (!response.ok && !data.error) throw new Error('meta_request_failed');
  return data;
}

export class FacebookCredentialsError extends Error {
  constructor(public readonly status: 401 | 403 | 409) {
    super(status === 401
      ? 'No autenticado'
      : status === 403
        ? 'Tu plan activo no incluye campañas'
        : 'Configura primero tus credenciales de Meta Ads');
  }
}

export function getFacebookPublicError(error: unknown): { error: string; status: number } {
  if (error instanceof FacebookCredentialsError) {
    return { error: error.message, status: error.status };
  }
  return { error: 'No se pudo completar la operación con Meta', status: 502 };
}

function decodeExtendedConfig(stored: string) {
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export async function getFacebookCredentials(req: NextRequest): Promise<FacebookCredentials> {
  const tenant = await getTenantFromRequest(req);
  
  if (!tenant?.tenantId) {
    throw new FacebookCredentialsError(401);
  }
  if (!tenantCanUseFeature(tenant, 'campaigns')) throw new FacebookCredentialsError(403);

  const supabase = createSupabaseAdmin();
  const { data: config } = await supabase
    .from('config')
    .select('openai_key')
    .eq('tenant_id', tenant.tenantId)
    .limit(1)
    .maybeSingle();

  if (config?.openai_key) {
    const extended = decodeExtendedConfig(config.openai_key);
    const token = extended.facebook_access_token;
    const adAccountId = extended.facebook_ad_account_id;
    const pageId = extended.facebook_page_id;

    if (
      typeof token === 'string'
      && token.length >= 20
      && token.length <= 4_096
      && !/[\u0000-\u001f\u007f]/.test(token)
      && typeof adAccountId === 'string'
      && META_ACCOUNT_ID_PATTERN.test(adAccountId)
      && (pageId === undefined || pageId === '' || (typeof pageId === 'string' && META_PAGE_ID_PATTERN.test(pageId)))
    ) {
      return { tenantId: tenant.tenantId, token, adAccountId, pageId: pageId || undefined };
    }
  }

  // No credentials found for this tenant — do NOT fall back to system env vars.
  // Each tenant must configure their own Meta API credentials.
  throw new FacebookCredentialsError(409);
}
