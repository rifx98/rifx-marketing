import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'rifx-sovereign-secret-key-2026-change-in-production'
);

export interface TenantPayload {
  tenantId: string;
  email: string;
  plan: string;
  isAdmin: boolean;
}

// Sign a JWT token for a tenant
export async function signToken(payload: TenantPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // 30 days
    .sign(JWT_SECRET);
}

// Verify and decode a JWT token
export async function verifyToken(token: string): Promise<TenantPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TenantPayload;
  } catch {
    return null;
  }
}

// Extract tenant from request headers (Authorization: Bearer <token>)
export async function getTenantFromRequest(req: NextRequest): Promise<TenantPayload | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  return verifyToken(token);
}

// Plan limits
export const PLAN_LIMITS: Record<string, { contacts: number; storage: number; members: number; bots: number }> = {
  trial:    { contacts: 200,    storage: 100 * 1024 * 1024,  members: 1,  bots: 1 },  // 100MB
  start:    { contacts: 1000,   storage: 250 * 1024 * 1024,  members: 5,  bots: 1 },  // 250MB
  advanced: { contacts: 10000,  storage: 500 * 1024 * 1024,  members: 5,  bots: 1 },  // 500MB
  plus:     { contacts: 20000,  storage: 1024 * 1024 * 1024, members: 5,  bots: 1 },  // 1GB
  master:   { contacts: 50000,  storage: 2048 * 1024 * 1024, members: 10, bots: 5 },  // 2GB
};
