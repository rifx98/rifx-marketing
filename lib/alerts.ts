import webpush from 'web-push';
import { createSupabaseAdmin } from '@/lib/supabase';

// ============================================
// ALERTAS CRÍTICAS — Push ya funcional. El envío por
// email queda pendiente hasta conectar un proveedor
// (Resend u otro) — mientras tanto solo se loguea.
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

function decodeExtendedAlertConfig(stored: string | null | undefined) {
  try {
    const parsed = JSON.parse(stored || '{}');
    return {
      email_alerts: !!parsed.email_alerts,
      push_notifications: !!parsed.push_notifications,
      alert_email: parsed.alert_email || '',
    };
  } catch {
    return { email_alerts: false, push_notifications: false, alert_email: '' };
  }
}

interface CriticalAlertParams {
  tenantId: string;
  title: string;
  message: string;
  url?: string;
}

// Dispara una alerta crítica para un tenant: envía push si tiene
// push_notifications activado y correo si tiene email_alerts activado
// (el correo queda pendiente de proveedor — ver sendAlertEmail).
export async function triggerCriticalAlert(params: CriticalAlertParams): Promise<void> {
  const { tenantId, title, message, url } = params;
  try {
    const supabase = createSupabaseAdmin();
    const { data: config } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    const settings = decodeExtendedAlertConfig(config?.openai_key);

    console.log(`🚨 [CRITICAL ALERT] tenant=${tenantId} | ${title}: ${message}`);

    if (settings.push_notifications) {
      await sendPushToTenant(tenantId, { title, body: message, url });
    }

    if (settings.email_alerts) {
      await sendAlertEmail(settings.alert_email, title, message);
    }
  } catch (err) {
    console.error('⚠️ [CRITICAL ALERT] Error disparando alerta:', err);
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
    .select('*')
    .eq('tenant_id', tenantId);

  if (!subs || subs.length === 0) return;

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
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.error('⚠️ [PUSH] Error enviando a una suscripción:', err?.message || err);
      }
    }
  }));
}

// Placeholder hasta conectar un proveedor de email real (Resend, etc.)
// No lanza error — solo deja constancia de que la alerta debió enviarse.
async function sendAlertEmail(toEmail: string, title: string, message: string): Promise<void> {
  if (!toEmail) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`📧 [EMAIL PENDIENTE] Se enviaría a ${toEmail} — "${title}": ${message} (falta conectar proveedor de email)`);
    return;
  }
  // TODO: una vez conectado RESEND_API_KEY, enviar el correo real aquí.
}
