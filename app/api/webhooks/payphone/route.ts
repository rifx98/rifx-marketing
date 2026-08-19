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

const MAX_WEBHOOK_BYTES = 64_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

type JsonRecord = Record<string, unknown>;
type ClaimedWebhook = Extract<WebhookClaim, { state: 'claimed' }>;

class PayPhoneProcessingError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asIdentifier(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const identifier = String(value).trim();
  return IDENTIFIER_PATTERN.test(identifier) ? identifier : '';
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
    throw new PayPhoneProcessingError('receipt_completion_failed');
  }
}

async function transitionSale(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  sale: JsonRecord,
  desiredStatus: 'completed' | 'cancelled',
): Promise<boolean> {
  const currentStatus = String(sale.status || '');
  if (currentStatus === desiredStatus) return false;

  // A cancellation callback must never downgrade an already completed charge.
  if (currentStatus === 'completed' && desiredStatus === 'cancelled') return false;
  if (!['pending', 'cancelled'].includes(currentStatus) || desiredStatus === 'cancelled' && currentStatus !== 'pending') {
    throw new PayPhoneProcessingError('invalid_sale_transition');
  }

  const { data, error } = await supabase
    .from('sales')
    .update({ status: desiredStatus })
    .eq('id', sale.id)
    .eq('tenant_id', sale.tenant_id)
    .eq('payphone_transaction_id', sale.payphone_transaction_id)
    .eq('client_transaction_id', sale.client_transaction_id)
    .eq('status', currentStatus)
    .select('id')
    .maybeSingle();

  if (error) throw new PayPhoneProcessingError('sale_update_failed');
  if (data) return true;

  // Resolve a concurrent, identical transition without repeating effects.
  const { data: latest, error: latestError } = await supabase
    .from('sales')
    .select('status')
    .eq('id', sale.id)
    .eq('tenant_id', sale.tenant_id)
    .maybeSingle();
  if (latestError || !latest || latest.status !== desiredStatus) {
    throw new PayPhoneProcessingError('sale_transition_race');
  }
  return false;
}

/** Browser/provider redirects are never allowed to mutate payment state. */
export async function GET() {
  return json(
    { error: 'Method not allowed' },
    405,
    { Allow: 'POST' },
  );
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

  const secret = process.env.PAYPHONE_WEBHOOK_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    console.error('[PayPhone] PAYPHONE_WEBHOOK_SECRET is missing or too short');
    return json({ error: 'Webhook unavailable' }, 503);
  }

  const signature = req.headers.get('x-payphone-signature-256') || '';
  if (!verifyHmacSha256(rawBody, signature, secret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: JsonRecord;
  try {
    payload = asRecord(JSON.parse(rawBody));
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const transactionId = asIdentifier(payload.transactionId);
  const clientTransactionId = asIdentifier(payload.clientTransactionId);
  if (!transactionId || !clientTransactionId) {
    return json({ error: 'Invalid transaction identity' }, 400);
  }

  const supabase = createSupabaseAdmin();
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id, tenant_id, conversation_id, amount, status, payphone_transaction_id, client_transaction_id')
    .eq('payphone_transaction_id', transactionId)
    .eq('client_transaction_id', clientTransactionId)
    .maybeSingle();

  if (saleError) {
    console.error('[PayPhone] Exact sale lookup failed:', saleError.code || 'database_error');
    return json({ error: 'Webhook persistence unavailable' }, 503);
  }
  if (!sale || !UUID_PATTERN.test(String(sale.tenant_id || ''))) {
    return json({ error: 'Transaction not found' }, 404);
  }

  const tenantId = String(sale.tenant_id).toLowerCase();
  const payloadSha256 = sha256Hex(rawBuffer);
  const claimResult = await claimWebhookEvent(supabase, {
    provider: 'payphone',
    eventKey: payloadSha256,
    eventName: 'sale_status',
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
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('tenant_id, payphone_token')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (configError) throw new PayPhoneProcessingError('tenant_config_lookup_failed');
    if (!config?.payphone_token || config.tenant_id !== tenantId) {
      throw new PayPhoneProcessingError('tenant_payphone_not_configured');
    }

    const providerResponse = await fetch(
      `https://pay.payphonetodoesposible.com/api/Sale/${encodeURIComponent(transactionId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.payphone_token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      },
    );
    if (!providerResponse.ok) {
      throw new PayPhoneProcessingError('provider_status_lookup_failed');
    }

    const providerData = asRecord(await providerResponse.json());
    const returnedTransactionId = asIdentifier(providerData.transactionId || providerData.id);
    const returnedClientId = asIdentifier(providerData.clientTransactionId);
    const returnedAmount = Number(providerData.amount);
    const statusCode = Number(providerData.statusCode);

    if (returnedTransactionId !== transactionId
        || returnedClientId !== clientTransactionId
        || !Number.isSafeInteger(returnedAmount)
        || returnedAmount !== Number(sale.amount)) {
      throw new PayPhoneProcessingError('provider_identity_mismatch');
    }

    let desiredStatus: 'completed' | 'cancelled';
    if (statusCode === 3) desiredStatus = 'completed';
    else if (statusCode === 2) desiredStatus = 'cancelled';
    else throw new PayPhoneProcessingError('provider_status_not_final');

    await transitionSale(supabase, sale as JsonRecord, desiredStatus);

    if (desiredStatus === 'completed' && sale.conversation_id) {
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ status: 'bought', updated_at: new Date().toISOString() })
        .eq('id', sale.conversation_id)
        .eq('tenant_id', tenantId);
      if (conversationError) {
        throw new PayPhoneProcessingError('conversation_update_failed');
      }
    }

    await finishOrThrow(supabase, claim, 'processed');
    return json({ status: 'ok' });
  } catch (error) {
    const code = error instanceof PayPhoneProcessingError ? error.code : 'processing_failed';
    await completeWebhookEvent(supabase, claim, 'failed', code);
    console.error('[PayPhone] Webhook processing failed:', code);
    return json({ error: 'Webhook processing failed' }, 503);
  }
}
