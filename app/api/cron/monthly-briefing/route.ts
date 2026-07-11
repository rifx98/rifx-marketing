import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { validateCronAuth, cronUnauthorizedResponse } from '@/app/api/cron/auth';

// ============================================
// RESUMEN MENSUAL — corre el día 1 de cada mes.
// Agrega la actividad del mes anterior por tenant y la envía como
// notificación push (si está activada). El envío por email queda
// listo para conectarse en cuanto haya un proveedor configurado —
// por ahora el contenido completo del resumen se deja en los logs.
// ============================================

function decodeExtendedConfig(stored: string | null | undefined) {
  try {
    const parsed = JSON.parse(stored || '{}');
    return {
      monthly_briefing: !!parsed.monthly_briefing,
      push_notifications: !!parsed.push_notifications,
      email_alerts: !!parsed.email_alerts,
      alert_email: parsed.alert_email || '',
    };
  } catch {
    return { monthly_briefing: false, push_notifications: false, email_alerts: false, alert_email: '' };
  }
}

function previousMonthRange(): { since: string; until: string; label: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const label = firstOfPrevMonth.toLocaleDateString('es-EC', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { since: firstOfPrevMonth.toISOString(), until: firstOfThisMonth.toISOString(), label };
}

async function buildTenantSummary(supabase: any, tenantId: string, since: string, until: string) {
  const [{ count: newConversations }, { data: allConvs }, { count: appointmentsCount }, { data: sales }] = await Promise.all([
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since).lt('created_at', until),
    supabase.from('conversations').select('id').eq('tenant_id', tenantId),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since).lt('created_at', until),
    supabase.from('sales').select('amount').eq('tenant_id', tenantId).eq('status', 'completed').gte('created_at', since).lt('created_at', until),
  ]);

  // "messages" no siempre trae tenant_id poblado (los mensajes del bot de
  // WhatsApp se guardan por conversation_id) — se cuentan a traves de TODAS
  // las conversaciones del tenant (no solo las nuevas del mes) para incluir
  // mensajes de conversaciones que ya existian, filtrando por su propia fecha.
  const conversationIds = (allConvs || []).map((c: any) => c.id);
  let messagesCount = 0;
  if (conversationIds.length > 0) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .in('conversation_id', conversationIds)
      .gte('created_at', since)
      .lt('created_at', until);
    messagesCount = count || 0;
  }

  const revenueCents = (sales || []).reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

  return {
    newConversations: newConversations || 0,
    messagesCount,
    appointmentsCount: appointmentsCount || 0,
    revenue: revenueCents / 100,
  };
}

function composeSummaryText(tenantName: string, period: string, summary: Awaited<ReturnType<typeof buildTenantSummary>>): string {
  return (
    `📊 Resumen de ${period} para ${tenantName}\n\n` +
    `• Conversaciones nuevas: ${summary.newConversations}\n` +
    `• Mensajes recibidos: ${summary.messagesCount}\n` +
    `• Citas agendadas: ${summary.appointmentsCount}\n` +
    `• Ingresos registrados: $${summary.revenue.toFixed(2)}`
  );
}

export async function GET(req: NextRequest) {
  if (!validateCronAuth(req)) {
    return cronUnauthorizedResponse();
  }

  const supabase = createSupabaseAdmin();
  const { since, until, label } = previousMonthRange();

  const { data: configs } = await supabase
    .from('config')
    .select('tenant_id, openai_key');

  let sent = 0;
  let skipped = 0;

  for (const cfg of configs || []) {
    if (!cfg.tenant_id) { skipped++; continue; }
    const settings = decodeExtendedConfig(cfg.openai_key);
    if (!settings.monthly_briefing) { skipped++; continue; }

    try {
      const { data: tenant } = await supabase.from('tenants').select('company_name').eq('id', cfg.tenant_id).maybeSingle();
      const tenantName = tenant?.company_name || 'tu negocio';
      const summary = await buildTenantSummary(supabase, cfg.tenant_id, since, until);
      const text = composeSummaryText(tenantName, label, summary);

      console.log(`📊 [RESUMEN MENSUAL] tenant=${cfg.tenant_id}\n${text}`);

      // Nota: el envio por email del resumen mensual deberia gatillarse por
      // "monthly_briefing" (ya filtrado arriba), no por "email_alerts" —
      // eso queda pendiente de ajustar cuando se conecte el proveedor real,
      // ya que hoy sendAlertEmail solo loguea (no envia nada de verdad).
      if (settings.push_notifications) {
        const { triggerCriticalAlert } = await import('@/lib/alerts');
        await triggerCriticalAlert({
          tenantId: cfg.tenant_id,
          title: `📊 Tu resumen de ${label} está listo`,
          message: `${summary.newConversations} conversaciones · ${summary.appointmentsCount} citas · $${summary.revenue.toFixed(2)} en ingresos.`,
          url: '/panel',
        });
      }

      if (settings.alert_email) {
        console.log(`📧 [EMAIL PENDIENTE] Resumen mensual para ${settings.alert_email} — falta conectar proveedor de email.`);
      }

      sent++;
    } catch (err) {
      console.error(`⚠️ [RESUMEN MENSUAL] Error procesando tenant ${cfg.tenant_id}:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ success: true, period: label, sent, skipped });
}
