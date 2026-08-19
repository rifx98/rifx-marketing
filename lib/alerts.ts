import webpush from 'web-push';
import { createSupabaseAdmin } from '@/lib/supabase';
import { isAllowedPushEndpoint } from '@/lib/push-security';

// ============================================
// ALERTAS CRÍTICAS — Push funcional. No se simula el envío por email:
// mientras no exista un proveedor real, solo se registra el estado del canal
// sin incluir destinatarios ni contenido del cliente.
// ============================================

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@rifx.online';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
}

interface CriticalAlertParams {
  tenantId: string;
  title: string;
  message: string;
  url?: string;
}

// Dispara una alerta crítica para un tenant: envía push si tiene
// push_notifications activado. El canal de correo se reporta como no
// disponible hasta que exista una integración real.
export async function triggerCriticalAlert(params: CriticalAlertParams): Promise<void> {
  const { tenantId, title, message, url } = params;
  try {
    const supabase = createSupabaseAdmin();
    const { data: config } = await supabase
      .from('config')
      .select('email_alerts, push_notifications, alert_email')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (config?.push_notifications === true) {
      await sendPushToTenant(tenantId, { title, body: message, url });
    }

    if (config?.email_alerts === true && config.alert_email) {
      await reportUnavailableEmailChannel();
    }
  } catch {
    console.error('[Critical Alert] Delivery failed');
  }
}

async function sendPushToTenant(tenantId: string, payload: { title: string; body: string; url?: string }): Promise<void> {
  ensureVapid();
  if (!vapidConfigured) {
    console.warn('⚠️ [PUSH] VAPID no configurado, se omite el envío.');
    return;
  }

  const supabase = createSupabaseAdmin();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('tenant_id', tenantId)
    .limit(101);

  if (!subs || subs.length === 0) return;
  if (subs.length > 100) {
    console.error('[Push] Subscription safety limit exceeded');
    return;
  }
  if (subs.some((subscription) => !isAllowedPushEndpoint(subscription.endpoint))) {
    console.error('[Push] Unsafe stored endpoint rejected');
    return;
  }

  const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/panel' });

  await Promise.all(subs.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        body
      );
    } catch (err: any) {
      // Suscripción expirada/invalida — se limpia para no reintentar en vano.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('endpoint', sub.endpoint);
      } else {
        console.error('⚠️ [PUSH] No se pudo enviar una suscripción del tenant');
      }
    }
  }));
}

async function reportUnavailableEmailChannel(): Promise<void> {
  console.warn('[Email] Provider not configured; delivery skipped');
}
