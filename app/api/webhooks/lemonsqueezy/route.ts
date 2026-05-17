import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// ============================================
// LEMON SQUEEZY WEBHOOK — Confirmación de pagos
// ============================================

// Verify HMAC signature from Lemon Squeezy
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

// Map Lemon Squeezy variant IDs to plan names
function getPlanFromVariantId(variantId: string): string | null {
  const map: Record<string, string> = {};
  if (process.env.LEMONSQUEEZY_VARIANT_START) map[process.env.LEMONSQUEEZY_VARIANT_START] = 'start';
  if (process.env.LEMONSQUEEZY_VARIANT_ADVANCED) map[process.env.LEMONSQUEEZY_VARIANT_ADVANCED] = 'advanced';
  if (process.env.LEMONSQUEEZY_VARIANT_PLUS) map[process.env.LEMONSQUEEZY_VARIANT_PLUS] = 'plus';
  if (process.env.LEMONSQUEEZY_VARIANT_MASTER) map[process.env.LEMONSQUEEZY_VARIANT_MASTER] = 'master';
  return map[variantId] || null;
}

const LIMITS: Record<string, { contacts: number; storage: number }> = {
  trial:    { contacts: 200,   storage: 100 * 1024 * 1024 },
  start:    { contacts: 1000,  storage: 250 * 1024 * 1024 },
  advanced: { contacts: 10000, storage: 500 * 1024 * 1024 },
  plus:     { contacts: 20000, storage: 1024 * 1024 * 1024 },
  master:   { contacts: 50000, storage: 2048 * 1024 * 1024 },
};

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature') || '';
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';

    // Verify webhook signature
    if (!secret || !signature) {
      console.error('❌ Webhook: Missing signature or secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const isValid = verifySignature(rawBody, signature, secret);
      if (!isValid) {
        console.error('❌ Webhook: Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch (e) {
      console.error('❌ Webhook: Signature verification failed:', e);
      return NextResponse.json({ error: 'Signature error' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventName = body.meta?.event_name;
    const customData = body.meta?.custom_data || {};
    const tenantId = customData.tenant_id;
    const planFromCustom = customData.plan;

    console.log(`📥 Lemon Squeezy webhook: ${eventName} | tenant: ${tenantId || 'unknown'}`);

    const supabase = createSupabaseAdmin();

    // Handle subscription events
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const subscriptionData = body.data?.attributes;
      const variantId = String(subscriptionData?.variant_id || '');
      const status = subscriptionData?.status; // active, cancelled, expired, etc.
      const plan = planFromCustom || getPlanFromVariantId(variantId);

      if (!tenantId || !plan) {
        console.error('❌ Webhook: Missing tenant_id or plan', { tenantId, plan, variantId });
        return NextResponse.json({ status: 'skipped - missing data' });
      }

      const limits = LIMITS[plan] || LIMITS['trial'];

      // Update tenant with new plan
      const { error } = await supabase
        .from('tenants')
        .update({
          plan,
          plan_status: status === 'active' ? 'active' : status === 'cancelled' ? 'cancelled' : 'active',
          plan_started_at: new Date().toISOString(),
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          storage_limit_bytes: limits.storage,
          contact_limit: limits.contacts,
          ls_subscription_id: String(body.data?.id || ''),
          ls_customer_id: String(subscriptionData?.customer_id || ''),
        })
        .eq('id', tenantId);

      if (error) {
        console.error('❌ Error updating tenant plan:', error.message);
      } else {
        console.log(`✅ Plan actualizado: tenant ${tenantId} → ${plan} (${status})`);
      }
    }

    // Handle payment success
    if (eventName === 'subscription_payment_success') {
      const paymentData = body.data?.attributes;
      const amount = paymentData?.subtotal || 0;
      const currency = paymentData?.currency || 'USD';

      if (tenantId) {
        // Record payment in payments table (create if not exists)
        await supabase.from('payments').insert({
          tenant_id: tenantId,
          amount: amount,
          currency: currency,
          status: 'completed',
          provider: 'lemonsqueezy',
          provider_payment_id: String(body.data?.id || ''),
          plan: planFromCustom || 'unknown',
          created_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) {
            // If payments table doesn't exist, just log
            console.log('⚠️ Could not record payment (table may not exist):', error.message);
          } else {
            console.log(`💰 Pago registrado: tenant ${tenantId} - $${amount / 100} ${currency}`);
          }
        });
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('❌ Error en webhook Lemon Squeezy:', error);
    // Still return 200 to prevent retries on parse errors
    return NextResponse.json({ status: 'error', message: error.message });
  }
}
