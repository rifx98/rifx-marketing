import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

const JWT_ISSUER = 'rifx-marketing';
const ACCESS_AUDIENCE = 'rifx-panel';
const OAUTH_STATE_AUDIENCE = 'rifx-oauth-state';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return new TextEncoder().encode('dummy_build_secret_only_for_compilation_purposes');
    }
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Add it to .env.local');
  }
  const isCloudDeployment = Boolean(process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('localhost'));
  if (process.env.NODE_ENV === 'production' && isCloudDeployment && Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('FATAL: JWT_SECRET must contain at least 32 bytes in production');
  }
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    return new TextEncoder().encode(secret.padEnd(32, '#'));
  }
  return new TextEncoder().encode(secret);
}

export type OAuthAction = 'meta_ads_connect' | 'whatsapp_connect' | 'social_connect';

export interface TenantPayload {
  tenantId: string;
  email?: string;
  plan?: string;
  planStatus?: string;
  planExpiresAt?: string | null;
  permissionOverrides?: Record<string, string | null>;
  storageLimitBytes?: number;
  storageUsedBytes?: number;
  contactLimit?: number;
  isAdmin?: boolean;
  adminRole?: string;
  adminCanEditPlans?: boolean;
  purpose?: string;
  sessionVersion?: number;
  iat?: number;
  tokenUse?: 'access' | 'oauth_state';
  oauthAction?: OAuthAction;
}

// Sign a short-lived access token for a tenant.
export async function signToken(payload: TenantPayload): Promise<string> {
  const { purpose: _purpose, tokenUse: _tokenUse, ...safePayload } = payload;
  return new SignJWT({ ...safePayload, tokenUse: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setJti(randomUUID())
    .setExpirationTime('8h')
    .sign(getJwtSecret());
}

export async function signOAuthState(
  payload: { tenantId: string; oauthAction?: OAuthAction },
): Promise<string> {
  return new SignJWT({
    tenantId: payload.tenantId,
    oauthAction: payload.oauthAction,
    purpose: 'oauth_state',
    tokenUse: 'oauth_state',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(OAUTH_STATE_AUDIENCE)
    .setJti(randomUUID())
    .setExpirationTime('5m')
    .sign(getJwtSecret());
}

// Verify and decode an access token. OAuth state tokens are deliberately rejected.
export async function verifyToken(token: string): Promise<TenantPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: ACCESS_AUDIENCE,
      clockTolerance: 5,
    });
    if (payload.tokenUse !== 'access' || typeof payload.tenantId !== 'string') return null;
    return payload as unknown as TenantPayload;
  } catch {
    return null;
  }
}

export async function verifyOAuthState(token: string): Promise<TenantPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: OAUTH_STATE_AUDIENCE,
      clockTolerance: 5,
    });
    if (
      payload.tokenUse !== 'oauth_state' ||
      payload.purpose !== 'oauth_state' ||
      typeof payload.tenantId !== 'string'
    ) return null;
    return payload as unknown as TenantPayload;
  } catch {
    return null;
  }
}

// Extract tenant from request headers (Authorization: Bearer <token>)
export async function getTenantFromRequest(req: NextRequest): Promise<TenantPayload | null> {
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  const cookieToken = req.cookies.get('rifx_session')?.value;
  // Browser sessions use the HttpOnly cookie. Bearer auth remains available
  // for non-browser callers, but an invalid header must not shadow a valid
  // protected cookie.
  const decoded = await verifyToken(cookieToken || '') || await verifyToken(bearerToken || '');
  if (!decoded?.tenantId) return null;

  // Rehydrate authorization data so deletion, demotion and password rotation
  // take effect without waiting for the access token to expire.
  const supabase = createSupabaseAdmin();
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', decoded.tenantId)
    .maybeSingle();

  if (error || !tenant || tenant.deleted_at || tenant.is_active === false) return null;
  const currentSessionVersion = Number(tenant.session_version || 0);
  if (Number(decoded.sessionVersion || 0) !== currentSessionVersion) return null;

  return {
    tenantId: tenant.id,
    email: tenant.email,
    plan: tenant.plan,
    planStatus: tenant.plan_status || undefined,
    planExpiresAt: tenant.plan_expires_at || null,
    permissionOverrides: tenant.permission_overrides && typeof tenant.permission_overrides === 'object'
      ? tenant.permission_overrides
      : {},
    storageLimitBytes: Number(tenant.storage_limit_bytes || 0),
    storageUsedBytes: Number(tenant.storage_used_bytes || 0),
    contactLimit: Number(tenant.contact_limit || 0),
    isAdmin: tenant.is_admin === true,
    adminRole: tenant.admin_role || 'full',
    adminCanEditPlans: tenant.admin_can_edit_plans !== false,
    sessionVersion: currentSessionVersion,
    iat: typeof decoded.iat === 'number' ? decoded.iat : undefined,
    tokenUse: 'access',
  };
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('rifx_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

// Plan limits
export const PLAN_LIMITS: Record<string, { contacts: number; storage: number; members: number; bots: number }> = {
  trial:    { contacts: 200,    storage: 100 * 1024 * 1024,  members: 1,  bots: 1 },  // 100MB
  start:    { contacts: 1000,   storage: 250 * 1024 * 1024,  members: 5,  bots: 1 },  // 250MB
  advanced: { contacts: 20000,  storage: 1024 * 1024 * 1024, members: 5,  bots: 1 },  // 1GB (alias for plus)
  plus:     { contacts: 20000,  storage: 1024 * 1024 * 1024, members: 5,  bots: 1 },  // 1GB
  master:   { contacts: 50000,  storage: 2048 * 1024 * 1024, members: 10, bots: 5 },  // 2GB
};
