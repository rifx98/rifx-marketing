import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFacebookJson,
  getFacebookCredentials,
  getFacebookPublicError,
} from '@/lib/facebook';
import { createSupabaseAdmin } from '@/lib/supabase';
import { enforceTenantRateLimit } from '@/lib/request-guards';

const FB_API_VERSION = 'v21.0';
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Calcula el rango [since, until] del periodo actual y del periodo anterior
// de igual duracion, para poder comparar (semana vs semana anterior, mes vs
// mes anterior).
function computePeriodRanges(period: 'week' | 'month') {
  const days = period === 'month' ? 30 : 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentUntil = new Date(today);
  const currentSince = new Date(today);
  currentSince.setDate(currentSince.getDate() - (days - 1));

  const previousUntil = new Date(currentSince);
  previousUntil.setDate(previousUntil.getDate() - 1);
  const previousSince = new Date(previousUntil);
  previousSince.setDate(previousSince.getDate() - (days - 1));

  return {
    days,
    current: { since: toDateStr(currentSince), until: toDateStr(currentUntil) },
    previous: { since: toDateStr(previousSince), until: toDateStr(previousUntil) },
  };
}

async function fetchKpisForRange(adAccountId: string, token: string, since: string, until: string) {
  const kpiFields = 'impressions,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,purchase_roas';
  const url = `${FB_BASE}/${adAccountId}/insights?fields=${kpiFields}&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
  const data = await fetchFacebookJson(url);
  if (data.error) throw new Error('meta_insights_rejected');

  const kpi = data.data?.[0] || {};
  const roas = kpi.purchase_roas?.[0]?.value ? parseFloat(kpi.purchase_roas[0].value).toFixed(2) : '0.00';
  const conversions = kpi.actions?.find(
    (a: any) => a.action_type === 'offsite_conversion' || a.action_type === 'purchase' || a.action_type === 'lead'
  );
  const conversionValue = conversions?.value || '0';
  const spend = kpi.spend || '0.00';
  const cpa = conversions && spend ? (parseFloat(spend) / parseInt(conversions.value)).toFixed(2) : '0.00';
  const clicks = kpi.clicks || '0';
  const impressions = kpi.impressions || '0';
  const conversionRate = parseInt(clicks) > 0 ? ((parseInt(conversionValue) / parseInt(clicks)) * 100).toFixed(2) : '0.00';

  return {
    impressions,
    clicks,
    ctr: kpi.ctr ? parseFloat(kpi.ctr).toFixed(2) : '0.00',
    cpc: kpi.cpc ? parseFloat(kpi.cpc).toFixed(2) : '0.00',
    cpm: kpi.cpm ? parseFloat(kpi.cpm).toFixed(2) : '0.00',
    spend,
    roas,
    conversions: conversionValue,
    conversionRate,
    cpa,
  };
}

async function fetchAppointmentsAndRevenue(tenantId: string, since: string, until: string) {
  const supabase = createSupabaseAdmin();
  const sinceIso = `${since}T00:00:00.000Z`;
  const untilIso = `${until}T23:59:59.999Z`;

  const [appointmentsResult, salesResult] = await Promise.all([
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    supabase
      .from('sales')
      .select('amount', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
  ]);

  if (appointmentsResult.error || salesResult.error) throw new Error('analytics_lookup_failed');
  const sales = salesResult.data || [];
  if ((salesResult.count || 0) > sales.length) throw new Error('analytics_window_too_large');

  const revenue = sales.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0) / 100;
  return { appointments: appointmentsResult.count || 0, revenue };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Construye alertas accionables comparando el periodo actual contra el anterior.
function buildAlerts(current: any, previous: any, days: number): Array<{ severity: 'critical' | 'warning' | 'info'; metric: string; message: string }> {
  const alerts: Array<{ severity: 'critical' | 'warning' | 'info'; metric: string; message: string }> = [];

  const ctrCurrent = parseFloat(current.kpis.ctr);
  const ctrPrevious = parseFloat(previous.kpis.ctr);
  if (ctrPrevious > 0 && ctrCurrent < ctrPrevious * 0.8) {
    alerts.push({
      severity: 'warning',
      metric: 'CTR',
      message: `El CTR cayó ${Math.round((1 - ctrCurrent / ctrPrevious) * 100)}% vs el período anterior. Revisá la creatividad, puede estar agotada.`,
    });
  }

  const spend = parseFloat(current.kpis.spend);
  const revenue = current.revenue;
  if (spend > 0 && revenue < spend) {
    alerts.push({
      severity: 'critical',
      metric: 'ROI',
      message: `Estás gastando más de lo que generás en ingresos este período ($${spend.toFixed(2)} gastado vs $${revenue.toFixed(2)} generado).`,
    });
  }

  if (spend > 0 && current.appointments === 0) {
    alerts.push({
      severity: 'critical',
      metric: 'Citas',
      message: `0 citas agendadas en los últimos ${days} días pese a tener $${spend.toFixed(2)} de gasto activo. Revisá que el formulario/WhatsApp de agendamiento funcione.`,
    });
  } else if (current.appointments > 0 && previous.appointments > 0) {
    const costPerApptCurrent = spend / current.appointments;
    const costPerApptPrevious = parseFloat(previous.kpis.spend) / previous.appointments;
    if (costPerApptPrevious > 0 && costPerApptCurrent > costPerApptPrevious * 1.3) {
      alerts.push({
        severity: 'critical',
        metric: 'Costo por cita',
        message: `El costo por cita subió ${Math.round((costPerApptCurrent / costPerApptPrevious - 1) * 100)}% vs el período anterior. Considerá pausar el conjunto de anuncios con peor rendimiento.`,
      });
    }
  }

  return alerts;
}

// GET - KPIs comparativos (periodo actual vs anterior) + citas + ingresos + alertas
export async function GET(req: NextRequest) {
  try {
    const { tenantId, token, adAccountId } = await getFacebookCredentials(req);
    const rateDenied = await enforceTenantRateLimit('facebook-insights', tenantId, 30, 60_000);
    if (rateDenied) return rateDenied;

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') === 'month' ? 'month' : 'week';
    const ranges = computePeriodRanges(period);

    const [currentKpis, previousKpis, currentExtra, previousExtra] = await Promise.all([
      fetchKpisForRange(adAccountId, token, ranges.current.since, ranges.current.until),
      fetchKpisForRange(adAccountId, token, ranges.previous.since, ranges.previous.until),
      fetchAppointmentsAndRevenue(tenantId, ranges.current.since, ranges.current.until),
      fetchAppointmentsAndRevenue(tenantId, ranges.previous.since, ranges.previous.until),
    ]);

    const current = { kpis: currentKpis, ...currentExtra };
    const previous = { kpis: previousKpis, ...previousExtra };

    // Desglose por plataforma (periodo actual)
    const breakdownUrl = `${FB_BASE}/${adAccountId}/insights?fields=impressions,clicks,spend&breakdowns=publisher_platform&time_range={"since":"${ranges.current.since}","until":"${ranges.current.until}"}&access_token=${token}`;
    const breakdownData = await fetchFacebookJson(breakdownUrl);
    const platformBreakdownRaw = (breakdownData.data || []).map((item: any) => ({
      platform: item.publisher_platform || 'unknown',
      impressions: item.impressions || '0',
      clicks: item.clicks || '0',
      spend: item.spend || '0.00',
    }));
    const totalImpressions = platformBreakdownRaw.reduce((sum: number, p: any) => sum + parseInt(p.impressions || '0'), 0);
    const platformBreakdown = platformBreakdownRaw
      .map((p: any) => ({
        ...p,
        percentage: totalImpressions > 0 ? Math.round((parseInt(p.impressions) / totalImpressions) * 1000) / 10 : 0,
      }))
      .sort((a: any, b: any) => parseInt(b.impressions) - parseInt(a.impressions));

    // Insights por dia para el grafico de tendencia (7 dias en semanal, 30 en mensual)
    const dailyUrl = `${FB_BASE}/${adAccountId}/insights?fields=impressions,clicks,spend,actions&time_increment=1&time_range={"since":"${ranges.current.since}","until":"${ranges.current.until}"}&access_token=${token}`;
    const dailyData = await fetchFacebookJson(dailyUrl);
    const dailyInsights = (dailyData.data || []).map((day: any) => {
      const dayConversions = day.actions?.find(
        (a: any) => a.action_type === 'offsite_conversion' || a.action_type === 'purchase' || a.action_type === 'lead'
      );
      return {
        date: day.date_start,
        impressions: day.impressions || '0',
        clicks: day.clicks || '0',
        spend: day.spend || '0.00',
        conversions: dayConversions?.value || '0',
      };
    });

    // Top creatividades (periodo actual)
    const creativesUrl = `${FB_BASE}/${adAccountId}/insights?fields=ad_name,impressions,clicks,ctr,spend,actions&level=ad&sort=impressions_descending&limit=5&time_range={"since":"${ranges.current.since}","until":"${ranges.current.until}"}&access_token=${token}`;
    const creativesData = await fetchFacebookJson(creativesUrl);
    const topCreatives = (creativesData.data || []).map((ad: any) => {
      const adConversions = ad.actions?.find(
        (a: any) => a.action_type === 'offsite_conversion' || a.action_type === 'purchase' || a.action_type === 'lead'
      );
      return {
        name: ad.ad_name || 'Sin nombre',
        impressions: ad.impressions || '0',
        clicks: ad.clicks || '0',
        ctr: ad.ctr ? parseFloat(ad.ctr).toFixed(2) : '0.00',
        spend: ad.spend || '0.00',
        conversions: adConversions?.value || '0',
      };
    });

    const alerts = buildAlerts(current, previous, ranges.days);

    return NextResponse.json({
      success: true,
      period,
      ranges,
      current,
      previous,
      deltas: {
        impressions: pctChange(parseInt(current.kpis.impressions), parseInt(previous.kpis.impressions)),
        clicks: pctChange(parseInt(current.kpis.clicks), parseInt(previous.kpis.clicks)),
        conversionRate: pctChange(parseFloat(current.kpis.conversionRate), parseFloat(previous.kpis.conversionRate)),
        revenue: pctChange(current.revenue, previous.revenue),
        appointments: pctChange(current.appointments, previous.appointments),
      },
      platformBreakdown,
      dailyInsights,
      topCreatives,
      alerts,
      // Compat con el shape viejo que ya consume el frontend existente
      kpis: current.kpis,
    });
  } catch (error: any) {
    const failure = getFacebookPublicError(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
