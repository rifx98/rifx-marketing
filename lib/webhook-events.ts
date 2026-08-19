import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type WebhookClaim =
  | { state: 'claimed'; eventId: string; ownerToken: string }
  | { state: 'duplicate' }
  | { state: 'busy' }
  | { state: 'conflict' }
  | { state: 'error'; code: string };

interface ClaimWebhookInput {
  provider: string;
  eventKey: string;
  eventName: string | null;
  tenantId: string | null;
  payloadSha256: string;
  leaseSeconds?: number;
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Compare an HMAC-SHA256 signature without leaking a length-dependent timing
 * signal. Malformed encodings are rejected before timingSafeEqual is called.
 */
export function verifyHmacSha256(
  rawBody: string,
  suppliedSignature: string,
  secret: string,
): boolean {
  if (!secret || !suppliedSignature) return false;

  const normalized = suppliedSignature
    .trim()
    .toLowerCase()
    .replace(/^sha256=/, '');

  if (!SHA256_HEX.test(normalized)) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const supplied = Buffer.from(normalized, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function claimWebhookEvent(
  supabase: SupabaseClient,
  input: ClaimWebhookInput,
): Promise<WebhookClaim> {
  const ownerToken = randomUUID();
  const { data, error } = await supabase.rpc('claim_webhook_event', {
    p_provider: input.provider,
    p_event_key: input.eventKey,
    p_event_name: input.eventName,
    p_tenant_id: input.tenantId,
    p_payload_sha256: input.payloadSha256,
    p_processing_token: ownerToken,
    p_lease_seconds: input.leaseSeconds ?? 120,
  });

  if (error) {
    console.error('[Webhook] Persistent claim failed:', error.code || 'database_error');
    return { state: 'error', code: error.code || 'database_error' };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const state = row?.claim_status;
  const eventId = row?.claimed_event_id;

  if (state === 'claimed' && typeof eventId === 'string') {
    return { state, eventId, ownerToken };
  }
  if (state === 'duplicate') return { state: 'duplicate' };
  if (state === 'busy') return { state: 'busy' };
  if (state === 'conflict') return { state: 'conflict' };

  console.error('[Webhook] Persistent claim returned an invalid result');
  return { state: 'error', code: 'invalid_claim_result' };
}

export async function completeWebhookEvent(
  supabase: SupabaseClient,
  claim: Extract<WebhookClaim, { state: 'claimed' }>,
  status: 'processed' | 'ignored' | 'failed',
  errorCode: string | null = null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('complete_webhook_event', {
    p_event_id: claim.eventId,
    p_processing_token: claim.ownerToken,
    p_status: status,
    p_error_code: errorCode?.slice(0, 120) || null,
  });

  if (error) {
    console.error('[Webhook] Persistent completion failed:', error.code || 'database_error');
    return false;
  }

  return data === true;
}
