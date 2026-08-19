import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

const MAX_BODY_CHARS = 16_384;
const MAX_ENDPOINT_LENGTH = 2_048;
const BASE64URL_KEY = /^[A-Za-z0-9_-]+={0,2}$/;
const EXACT_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);
const PUSH_HOST_SUFFIXES = [
  '.push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
];

interface ValidPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function isKnownPushHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return EXACT_PUSH_HOSTS.has(normalized) || PUSH_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function normalizePushEndpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > MAX_ENDPOINT_LENGTH) return null;

  try {
    const endpoint = new URL(raw);
    if (endpoint.protocol !== 'https:') return null;
    if (endpoint.username || endpoint.password || endpoint.hash) return null;
    if (endpoint.port && endpoint.port !== '443') return null;
    if (!isKnownPushHost(endpoint.hostname)) return null;
    return endpoint.toString();
  } catch {
    return null;
  }
}

function normalizePushKey(value: unknown, minLength: number, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (key.length < minLength || key.length > maxLength || !BASE64URL_KEY.test(key)) return null;
  return key;
}

function validateSubscription(input: unknown): ValidPushSubscription | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const subscription = input as Record<string, unknown>;
  const keys = subscription.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return null;
  const keyRecord = keys as Record<string, unknown>;

  const endpoint = normalizePushEndpoint(subscription.endpoint);
  const p256dh = normalizePushKey(keyRecord.p256dh, 80, 200);
  const auth = normalizePushKey(keyRecord.auth, 16, 128);
  return endpoint && p256dh && auth ? { endpoint, p256dh, auth } : null;
}

async function readJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_CHARS) return null;
  const raw = await req.text();
  if (!raw || raw.length > MAX_BODY_CHARS) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

// Insert-only ownership: an endpoint can never be reassigned to another tenant.
// Its existing owner may rotate the browser keys for the same endpoint.
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);

    const body = await readJsonBody(req);
    const subscription = validateSubscription(body?.subscription);
    if (!subscription) return json({ error: 'Suscripcion push invalida' }, 400);

    const supabase = createSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabase
      .from('push_subscriptions')
      .select('tenant_id')
      .eq('endpoint', subscription.endpoint)
      .limit(1)
      .maybeSingle();
    if (lookupError) return json({ error: 'No se pudo validar la suscripcion push' }, 500);

    if (existing) {
      if (existing.tenant_id !== tenant.tenantId) {
        return json({ error: 'Este endpoint push ya pertenece a otra cuenta' }, 409);
      }
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({ keys_p256dh: subscription.p256dh, keys_auth: subscription.auth })
        .eq('tenant_id', tenant.tenantId)
        .eq('endpoint', subscription.endpoint);
      if (updateError) return json({ error: 'No se pudo actualizar la suscripcion push' }, 500);
      return json({ success: true, created: false });
    }

    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        tenant_id: tenant.tenantId,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.p256dh,
        keys_auth: subscription.auth,
      });

    if (insertError?.code === '23505') {
      // A concurrent request won the unique endpoint insert. Re-read ownership
      // and never use upsert, which could transfer the endpoint across tenants.
      const { data: racedOwner } = await supabase
        .from('push_subscriptions')
        .select('tenant_id')
        .eq('endpoint', subscription.endpoint)
        .limit(1)
        .maybeSingle();
      if (racedOwner?.tenant_id !== tenant.tenantId) {
        return json({ error: 'Este endpoint push ya pertenece a otra cuenta' }, 409);
      }
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({ keys_p256dh: subscription.p256dh, keys_auth: subscription.auth })
        .eq('tenant_id', tenant.tenantId)
        .eq('endpoint', subscription.endpoint);
      if (!updateError) return json({ success: true, created: false });
    }
    if (insertError) return json({ error: 'No se pudo guardar la suscripcion push' }, 500);

    return json({ success: true, created: true }, 201);
  } catch {
    console.error('Push subscription save failed');
    return json({ error: 'No se pudo guardar la suscripcion push' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);

    const endpoint = normalizePushEndpoint(req.nextUrl.searchParams.get('endpoint'));
    if (!endpoint) return json({ error: 'Endpoint push invalido' }, 400);

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('tenant_id', tenant.tenantId)
      .eq('endpoint', endpoint);
    if (error) return json({ error: 'No se pudo eliminar la suscripcion push' }, 500);

    return json({ success: true });
  } catch {
    console.error('Push subscription delete failed');
    return json({ error: 'No se pudo eliminar la suscripcion push' }, 500);
  }
}
