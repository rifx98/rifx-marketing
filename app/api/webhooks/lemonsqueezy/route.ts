import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import {
  claimWebhookEvent,
  completeWebhookEvent,
  sha256Hex,
  verifyHmacSha256,
  type WebhookClaim,
} from '@/lib/webhook-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_WEBHOOK_BYTES = 1_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_ID_PATTERN = /^[1-9][0-9]{0,39}$/;

const LIMITS: Record<string, { contacts: number; storage: number }> = {
  start: { contacts: 1_000, storage: 250 * 1024 * 1024 },
  plus: { contacts: 20_000, storage: 1024 * 1024 * 1024 },
  master: { contacts: 50_000, storage: 2048 * 1024 * 1024 },
};

const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_resumed',
  'subscription_paused',
  'subscription_unpaused',
]);

const PAYMENT_STATUSES: Record<string, 'completed' | 'failed' | 'refunded'> = {
  subscription_payment_success: 'completed',
  subscription_payment_failed: 'failed',
  subscription_payment_refunded: 'refunded',
};

type JsonRecord = Record<string, unknown>;
type ClaimedWebhook = Extract<WebhookClaim, { state: 'claimed' }>;
type SubscriptionTransition = 'applied' | 'stale';

class WebhookProcessingError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().slice(0, maxLength);
}

function asIsoDate(value: unknown): string | null {
  const raw = asString(value, 100);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function asProviderId(value: unknown): string | null {
  const candidate = asString(value, 40);
  return PROVIDER_ID_PATTERN.test(candidate) ? candidate : null;
}

function getPlanFromVariantId(variantId: string): string | null {
  const variants: Record<string, string> = {};
  if (process.env.LEMONSQUEEZY_VARIANT_START) {
    variants[process.env.LEMONSQUEEZY_VARIANT_START] = 'start';
  }
  if (process.env.LEMONSQUEEZY_VARIANT_PLUS) {
    variants[process.env.LEMONSQUEEZY_VARIANT_PLUS] = 'plus';
  }
  if (process.env.LEMONSQUEEZY_VARIANT_MASTER) {
    variants[process.env.LEMONSQUEEZY_VARIANT_MASTER] = 'master';
  }
  return variants[variantId] || null;
}

function getVariantId(attributes: JsonRecord): string {
  const direct = asString(attributes.variant_id);
  if (direct) return direct;
  return asString(asRecord(attributes.first_subscription_item).variant_id);
}

function mapSubscriptionStatus(value: unknown): 'active' | 'cancelled' | 'expired' | null {
  const status = asString(value, 30).toLowerCase();
  if (status === 'active' || status === 'on_trial') return 'active';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'expired' || status === 'paused' || status === 'past_due' || status === 'unpaid') return 'expired';
  return null;
}

function json(body: JsonRecord, status = 200, extraHeaders?: Record<string, string>): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function finishOrThrow(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  claim: ClaimedWebhook,
  status: 'processed' | 'ignored',
  errorCode: string | null = null,
): Promise<void> {
  if (!await completeWebhookEvent(supabase, claim, status, errorCode)) {
    throw new WebhookProcessingError('receipt_completion_failed');
  }
}

async function processSubscriptionEvent(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  tenantId: string,
  subscriptionId: string,
  attributes: JsonRecord,
): Promise<SubscriptionTransition> {
  const plan = getPlanFromVariantId(getVariantId(attributes));
  const status = mapSubscriptionStatus(attributes.status);
  const eventTimestamp = asIsoDate(attributes.updated_at);
  if (!plan || !status || !LIMITS[plan] || !eventTimestamp) {
    throw new WebhookProcessingError('invalid_subscription_mapping');
  }

  const startedAt = asIsoDate(attributes.created_at);
  const expiresAt = asIsoDate(attributes.ends_at) || asIsoDate(attributes.renews_at);
  const { data, error } = await supabase.rpc('apply_lemonsqueezy_subscription_event', {
    p_tenant_id: tenantId,
    p_subscription_id: subscriptionId,
    p_event_timestamp: eventTimestamp,
    p_plan: plan,
    p_plan_status: status,
    p_plan_started_at: startedAt,
    p_plan_expires_at: expiresAt,
  });

  if (error) {
    throw new WebhookProcessingError('subscription_transition_failed');
  }
  if (data === 'conflict') {
    throw new WebhookProcessingError('subscription_binding_conflict');
  }
  if (data !== 'applied' && data !== 'stale') {
    throw new WebhookProcessingError('invalid_subscription_transition');
  }

  return data;
}

async function persistPaymentEvent(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  tenantId: string,
  providerPaymentId: string,
  plan: string,
  amount: number,
  currency: string,
  desiredStatus: 'completed' | 'failed' | 'refunded',
): Promise<void> {
  const payment = {
    tenant_id: tenantId,
    amount,
    currency,
    status: desiredStatus,
    provider: 'lemonsqueezy',
    provider_payment_id: providerPaymentId,
    payment_method: 'lemonsqueezy',
    transaction_id: providerPaymentId,
    plan,
  };

  const { error: insertError } = await supabase.from('payments').insert(payment);
  if (!insertError) return;
  if (insertError.code !== '23505') {
    throw new WebhookProcessingError('payment_insert_failed');
  }

  const { data: existing, error: readError } = await supabase
    .from('payments')
    .select('id, tenant_id, amount, currency, plan, status')
    .eq('provider', 'lemonsqueezy')
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle();

  if (readError || !existing) {
    throw new WebhookProcessingError('payment_identity_read_failed');
  }

  const identityMatches = existing.tenant_id === tenantId
    && Number(existing.amount) === amount
    && String(existing.currency).toUpperCase() === currency
    && existing.plan === plan;
  if (!identityMatches) {
    throw new WebhookProcessingError('payment_identity_conflict');
  }

  const statusRank: Record<string, number> = {
    pending: 0,
    failed: 1,
    completed: 2,
    refunded: 3,
  };
  if ((statusRank[desiredStatus] ?? -1) <= (statusRank[existing.status] ?? -1)) return;

  const { error: updateError } = await supabase
    .from('payments')
    .update({ status: desiredStatus })
    .eq('id', existing.id)
    .eq('tenant_id', tenantId)
    .eq('status', existing.status);

  if (updateError) {
    throw new WebhookProcessingError('payment_status_update_failed');
  }
}

export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return json({ error: 'Payload too large' }, 413);
  }

  const rawBuffer = Buffer.from(await req.arrayBuffer());
  if (rawBuffer.length === 0 || rawBuffer.length > MAX_WEBHOOK_BYTES) {
    return json({ error: rawBuffer.length === 0 ? 'Empty payload' : 'Payload too large' }, rawBuffer.length === 0 ? 400 : 413);
  }
  const rawBody = rawBuffer.toString('utf8');

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';
  const expectedStoreId = asProviderId(process.env.LEMONSQUEEZY_STORE_ID);
  if (!secret || !expectedStoreId) {
    console.error('[LemonSqueezy] Webhook configuration is incomplete');
    return json({ error: 'Webhook unavailable' }, 503);
  }

  if (!verifyHmacSha256(rawBody, req.headers.get('x-signature') || '', secret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: JsonRecord;
  try {
    body = asRecord(JSON.parse(rawBody));
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const meta = asRecord(body.meta);
  const data = asRecord(body.data);
  const attributes = asRecord(data.attributes);
  const customData = asRecord(meta.custom_data);
  const eventName = asString(meta.event_name, 100).toLowerCase();
  const storeId = asProviderId(attributes.store_id);
  const tenantCandidate = asString(customData.tenant_id, 50);
  const tenantId = UUID_PATTERN.test(tenantCandidate) ? tenantCandidate.toLowerCase() : null;
  const payloadSha256 = sha256Hex(rawBuffer);
  const supabase = createSupabaseAdmin();

  const claimResult = await claimWebhookEvent(supabase, {
    provider: 'lemonsqueezy',
    eventKey: payloadSha256,
    eventName: eventName || null,
    tenantId,
    payloadSha256,
  });

  if (claimResult.state === 'duplicate') {
    return json({ status: 'accepted' });
  }
  if (claimResult.state === 'busy') {
    return json({ error: 'Webhook already processing' }, 503, { 'Retry-After': '5' });
  }
  if (claimResult.state === 'conflict') {
    return json({ error: 'Webhook identity conflict' }, 409);
  }
  if (claimResult.state === 'error') {
    return json({ error: 'Webhook persistence unavailable' }, 503);
  }

  const claim = claimResult;
  try {
    if (!eventName) {
      await finishOrThrow(supabase, claim, 'ignored', 'missing_event_name');
      return json({ status: 'ignored' });
    }
    if (!tenantId) {
      await finishOrThrow(supabase, claim, 'ignored', 'invalid_tenant_id');
      return json({ status: 'ignored' });
    }
    if (storeId !== expectedStoreId) {
      await finishOrThrow(supabase, claim, 'ignored', 'invalid_store_id');
      return json({ status: 'ignored' });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, lemonsqueezy_subscription_id')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantError) throw new WebhookProcessingError('tenant_lookup_failed');
    if (!tenant) {
      await finishOrThrow(supabase, claim, 'ignored', 'tenant_not_found');
      return json({ status: 'ignored' });
    }

    if (SUBSCRIPTION_EVENTS.has(eventName)) {
      const subscriptionId = asProviderId(data.id);
      if (asString(data.type, 50) !== 'subscriptions' || !subscriptionId) {
        throw new WebhookProcessingError('invalid_subscription_identity');
      }

      const transition = await processSubscriptionEvent(
        supabase,
        tenantId,
        subscriptionId,
        attributes,
      );
      if (transition === 'stale') {
        await finishOrThrow(supabase, claim, 'ignored', 'stale_subscription_event');
        return json({ status: 'ignored' });
      }
    } else if (PAYMENT_STATUSES[eventName]) {
      const providerPaymentId = asProviderId(data.id);
      const subscriptionId = asProviderId(attributes.subscription_id);
      const plan = getPlanFromVariantId(getVariantId(attributes));
      const amount = Number(attributes.subtotal);
      const currency = asString(attributes.currency, 3).toUpperCase();

      if (asString(data.type, 50) !== 'subscription-invoices'
          || !providerPaymentId
          || !subscriptionId
          || !plan
          || !Number.isSafeInteger(amount)
          || amount < 0
          || amount > 1_000_000_000
          || !/^[A-Z]{3}$/.test(currency)) {
        throw new WebhookProcessingError('invalid_payment_payload');
      }
      if (tenant.lemonsqueezy_subscription_id !== subscriptionId) {
        throw new WebhookProcessingError('subscription_binding_conflict');
      }

      await persistPaymentEvent(
        supabase,
        tenantId,
        providerPaymentId,
        plan,
        amount,
        currency,
        PAYMENT_STATUSES[eventName],
      );
    } else if (eventName === 'order_created') {
      const orderType = asString(customData.type, 50);
      const creditsAmount = Number(customData.credits);
      const status = asString(attributes.status, 30).toLowerCase();

      if (asString(data.type, 50) !== 'orders' || status !== 'paid') {
        throw new WebhookProcessingError('invalid_order_payload');
      }

      if (orderType === 'ai_credits' && Number.isSafeInteger(creditsAmount) && creditsAmount > 0) {
        const { error: creditError } = await supabase.rpc('increment_ai_credits', {
          p_tenant_id: tenantId,
          p_amount: creditsAmount,
          p_note: `Compra de paquete de ${creditsAmount} créditos (Orden: ${data.id})`,
          p_user_id: null
        });

        if (creditError) {
          throw new WebhookProcessingError('credit_allocation_failed');
        }

        // Registrar el pago en la tabla payments también
        const providerPaymentId = asProviderId(data.id);
        const amountStr = String(attributes.total);
        const amountCents = amountStr ? Math.round(parseFloat(amountStr) * 100) : 0;
        const currency = asString(attributes.currency, 3).toUpperCase();
        
        if (providerPaymentId) {
           await persistPaymentEvent(
             supabase,
             tenantId,
             providerPaymentId,
             'ai_credits',
             amountCents,
             currency || 'USD',
             'completed'
           );
        }
      } else {
         await finishOrThrow(supabase, claim, 'ignored', 'unsupported_order_type');
         return json({ status: 'ignored' });
      }
    } else {
      await finishOrThrow(supabase, claim, 'ignored', 'unsupported_event');
      return json({ status: 'ignored' });
    }

    await finishOrThrow(supabase, claim, 'processed');
    return json({ status: 'ok' });
  } catch (error) {
    const code = error instanceof WebhookProcessingError ? error.code : 'processing_failed';
    await completeWebhookEvent(supabase, claim, 'failed', code);
    console.error('[LemonSqueezy] Webhook processing failed:', code);
    return json({ error: 'Webhook processing failed' }, 503);
  }
}
