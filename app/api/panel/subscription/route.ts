import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';

const LEMON_API_BASE = 'https://api.lemonsqueezy.com/v1';
const PROVIDER_TIMEOUT_MS = 8_000;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;

type LifecycleAction = 'cancel_subscription' | 'reactivate_subscription';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function normalizeSubscriptionId(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    value = String(value);
  }
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return /^[1-9][0-9]{0,39}$/.test(id) ? id : null;
}

async function readStreamWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('payload_too_large');
      raw += decoder.decode(value, { stream: true });
    }
    return raw + decoder.decode();
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new Error('invalid_payload');
  } finally {
    reader.releaseLock();
  }
}

async function readAction(req: NextRequest): Promise<string> {
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return '';
  try {
    const parsed: unknown = JSON.parse(await readStreamWithLimit(req.body, MAX_REQUEST_BYTES));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
    const action = (parsed as Record<string, unknown>).action;
    return typeof action === 'string' ? action : '';
  } catch {
    return '';
  }
}

async function requestLemonLifecycleChange(
  subscriptionId: string,
  action: LifecycleAction,
  apiKey: string,
): Promise<boolean> {
  const isCancellation = action === 'cancel_subscription';
  const response = await fetch(`${LEMON_API_BASE}/subscriptions/${subscriptionId}`, {
    method: isCancellation ? 'DELETE' : 'PATCH',
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
      ...(isCancellation ? {} : { 'Content-Type': 'application/vnd.api+json' }),
    },
    body: isCancellation
      ? undefined
      : JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: { cancelled: false },
          },
        }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) return false;
  if (response.status === 204) return true;

  // Lemon Squeezy uses JSON:API resources. Bind a successful response to the
  // same subscription ID instead of accepting an unrelated upstream payload.
  try {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) return false;
    const payload = JSON.parse(await readStreamWithLimit(response.body, MAX_PROVIDER_RESPONSE_BYTES));
    return payload?.data?.type === 'subscriptions' && String(payload.data.id) === subscriptionId;
  } catch {
    return false;
  }
}

// Subscription state is informational here. Authoritative changes are written
// only by verified payment-provider webhooks.
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('tenants')
      .select('plan, plan_status, plan_started_at, plan_expires_at, pending_plan, storage_limit_bytes, storage_used_bytes, contact_limit')
      .eq('id', tenant.tenantId)
      .maybeSingle();

    if (error) return json({ error: 'No se pudo consultar la suscripcion' }, 500);
    if (!data) return json({ error: 'Cuenta no encontrada' }, 404);

    return json({
      plan: data.plan,
      planStatus: data.plan_status,
      planStartedAt: data.plan_started_at,
      planExpiresAt: data.plan_expires_at,
      pendingPlan: data.pending_plan,
      storageLimitBytes: data.storage_limit_bytes,
      storageUsedBytes: data.storage_used_bytes,
      contactLimit: data.contact_limit,
      authoritativeSource: 'verified_payment_webhook',
    });
  } catch {
    console.error('Subscription lookup failed');
    return json({ error: 'No se pudo consultar la suscripcion' }, 500);
  }
}

// Browser requests can ask Lemon Squeezy to change subscription lifecycle, but
// they never mutate local billing state. The signed webhook remains the only
// authority that updates plan/status/limits in the database.
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);

    const limit = await checkRateLimit(
      rateLimitKey('billing-lifecycle', tenant.tenantId),
      10,
      5 * 60_000,
    );
    if (limit.unavailable) {
      return json({ error: 'La gestión de suscripciones no está disponible temporalmente' }, 503);
    }
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil(limit.retryAfterMs / 1_000));
      return NextResponse.json(
        { error: 'Demasiados intentos de gestión de suscripciones' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'Retry-After': String(retryAfter),
          },
        },
      );
    }

    const action = await readAction(req);

    if (action === 'update_plan') {
      return json({
        error: 'El plan no puede cambiarse desde el navegador. Inicia el checkout; el cambio se aplicara unicamente cuando llegue un webhook firmado del proveedor.',
        code: 'PROVIDER_CONFIRMATION_REQUIRED',
        requiredFlow: 'checkout_then_verified_webhook',
      }, 409);
    }

    if (action === 'cancel_subscription' || action === 'reactivate_subscription') {
      const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
      if (!apiKey) {
        return json({ error: 'La gestion de suscripciones no esta disponible temporalmente' }, 503);
      }

      // The provider ID is read only from the authenticated tenant row. A
      // browser-supplied ID is never accepted, preventing cross-tenant changes.
      const supabase = createSupabaseAdmin();
      const { data: billingOwner, error: billingError } = await supabase
        .from('tenants')
        .select('lemonsqueezy_subscription_id')
        .eq('id', tenant.tenantId)
        .maybeSingle();
      if (billingError) {
        return json({ error: 'No se pudo validar la suscripcion del proveedor' }, 500);
      }
      const subscriptionId = normalizeSubscriptionId(billingOwner?.lemonsqueezy_subscription_id);
      if (!subscriptionId) {
        return json({
          error: 'Esta cuenta no tiene una suscripcion administrable por el proveedor',
          code: 'PROVIDER_SUBSCRIPTION_NOT_LINKED',
        }, 409);
      }

      let accepted = false;
      try {
        accepted = await requestLemonLifecycleChange(subscriptionId, action, apiKey);
      } catch {
        return json({ error: 'El proveedor de suscripciones no esta disponible temporalmente' }, 503);
      }
      if (!accepted) {
        return json({
          error: 'El proveedor no pudo aceptar el cambio de suscripcion',
          code: 'PROVIDER_CHANGE_REJECTED',
        }, 502);
      }

      return json({
        accepted: true,
        pendingWebhook: true,
        action: action === 'cancel_subscription' ? 'cancel' : 'reactivate',
        authoritativeSource: 'verified_payment_webhook',
        pollAfterMs: 2_000,
      }, 202);
    }

    return json({
      error: 'Este endpoint ya no acepta mutaciones locales de suscripcion.',
      code: 'LOCAL_BILLING_MUTATIONS_RETIRED',
    }, 410);
  } catch {
    console.error('Subscription mutation request failed');
    return json({ error: 'No se pudo procesar la solicitud de suscripcion' }, 500);
  }
}
