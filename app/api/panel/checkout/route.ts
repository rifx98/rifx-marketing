import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';

const LEMON_API_BASE = 'https://api.lemonsqueezy.com/v1';
const PROVIDER_TIMEOUT_MS = 10_000;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;
const PROVIDER_ID_PATTERN = /^[1-9][0-9]{0,39}$/;

const VARIANT_MAP: Record<string, string> = {
  start: process.env.LEMONSQUEEZY_VARIANT_START || '',
  plus: process.env.LEMONSQUEEZY_VARIANT_PLUS || '',
  master: process.env.LEMONSQUEEZY_VARIANT_MASTER || '',
};

type JsonObject = Record<string, unknown>;

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      ...extraHeaders,
    },
  });
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function providerId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return PROVIDER_ID_PATTERN.test(normalized) ? normalized : null;
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

async function readRequestObject(req: NextRequest): Promise<JsonObject | null> {
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null;

  try {
    const parsed: unknown = JSON.parse(await readStreamWithLimit(req.body, MAX_REQUEST_BYTES));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as JsonObject;
  } catch {
    return null;
  }
}

async function lemonRequest(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: JsonObject }> {
  const response = await fetch(`${LEMON_API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error('invalid_provider_response');
  }
  const raw = await readStreamWithLimit(response.body, MAX_PROVIDER_RESPONSE_BYTES);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('invalid_provider_response');
  }
  return { ok: response.ok, status: response.status, data: asObject(data) };
}

function configuredAppOrigin(req: NextRequest): string | null {
  const configured = process.env.APP_URL || (
    process.env.NODE_ENV !== 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
      : ''
  );
  try {
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function safeProviderUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4_096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Historial real de pagos, poblado únicamente por webhooks verificados.
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, currency, status, provider, plan, created_at')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Checkout payment history lookup failed:', error.code || 'database_error');
      return json({ error: 'No se pudo consultar el historial de pagos' }, 500);
    }
    return json({ payments: data || [] });
  } catch {
    console.error('Checkout payment history request failed');
    return json({ error: 'No se pudo consultar el historial de pagos' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);

    const limit = await checkRateLimit(
      rateLimitKey('billing-checkout', tenant.tenantId),
      5,
      5 * 60_000,
    );
    if (limit.unavailable) {
      return json({ error: 'La gestión de pagos no está disponible temporalmente' }, 503);
    }
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil(limit.retryAfterMs / 1_000));
      return json(
        { error: 'Demasiados intentos de gestión de pagos' },
        429,
        { 'Retry-After': String(retryAfter) },
      );
    }

    const body = await readRequestObject(req);
    const plan = typeof body?.plan === 'string' ? body.plan : '';
    const variantId = providerId(VARIANT_MAP[plan]);
    if (!variantId) {
      return json({ error: 'Plan no disponible' }, 400);
    }

    if (tenant.plan === plan && tenant.planStatus === 'active') {
      return json({ alreadyActive: true, plan });
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
    const storeId = providerId(process.env.LEMONSQUEEZY_STORE_ID);
    const appOrigin = configuredAppOrigin(req);
    if (!apiKey || !storeId || !appOrigin) {
      console.error('Lemon Squeezy checkout configuration is incomplete');
      return json({ error: 'Pasarela de pagos no configurada' }, 503);
    }

    const supabase = createSupabaseAdmin();
    const { data: billingOwner, error: billingError } = await supabase
      .from('tenants')
      .select('lemonsqueezy_subscription_id')
      .eq('id', tenant.tenantId)
      .maybeSingle();
    if (billingError || !billingOwner) {
      console.error('Billing owner lookup failed:', billingError?.code || 'not_found');
      return json({ error: 'No se pudo validar la suscripción' }, 500);
    }

    const subscriptionId = providerId(billingOwner.lemonsqueezy_subscription_id);
    if (subscriptionId) {
      // Existing subscriptions change variants through the provider API. A
      // second checkout would create a duplicate subscription for the tenant.
      const result = await lemonRequest(`/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: { variant_id: Number(variantId) },
          },
        }),
      });
      if (!result.ok) {
        console.error('Lemon Squeezy subscription update rejected:', result.status);
        return json({ error: 'El proveedor no pudo cambiar el plan' }, 502);
      }

      const subscription = asObject(result.data.data);
      const attributes = asObject(subscription.attributes);
      if (subscription.type !== 'subscriptions' || providerId(subscription.id) !== subscriptionId) {
        return json({ error: 'Respuesta inválida del proveedor de pagos' }, 502);
      }

      if (providerId(attributes.variant_id) === variantId) {
        return json({
          accepted: true,
          pendingWebhook: true,
          action: 'change_plan',
          requestedPlan: plan,
          authoritativeSource: 'verified_payment_webhook',
          pollAfterMs: 2_000,
        }, 202);
      }

      // PayPal subscriptions may require the provider's customer portal.
      const portalUrl = safeProviderUrl(
        asObject(attributes.urls).customer_portal_update_subscription,
      );
      if (portalUrl) {
        return json({ checkoutUrl: portalUrl, requiresCustomerPortal: true });
      }
      return json({ error: 'El proveedor no confirmó el cambio de plan' }, 502);
    }

    const result = await lemonRequest('/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: tenant.email,
              custom: { tenant_id: tenant.tenantId },
            },
            product_options: {
              enabled_variants: [Number(variantId)],
              redirect_url: `${appOrigin}/panel?payment=success`,
            },
            expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          },
          relationships: {
            store: { data: { type: 'stores', id: storeId } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    });
    if (!result.ok) {
      console.error('Lemon Squeezy checkout creation rejected:', result.status);
      return json({ error: 'No se pudo crear la sesión de pago' }, 502);
    }

    const checkout = asObject(result.data.data);
    const checkoutUrl = safeProviderUrl(asObject(checkout.attributes).url);
    if (checkout.type !== 'checkouts' || !checkoutUrl) {
      return json({ error: 'Respuesta inválida del proveedor de pagos' }, 502);
    }
    return json({ checkoutUrl });
  } catch {
    console.error('Lemon Squeezy checkout request failed');
    return json({ error: 'La pasarela de pagos no está disponible temporalmente' }, 503);
  }
}
