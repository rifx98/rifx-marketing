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

// Extrae conversaciones iniciadas (WhatsApp / Messenger / Instagram DM) reportadas por Meta
function extractMessagingConversations(actions?: Array<{ action_type: string; value: string | number }>): number {
  if (!actions || !Array.isArray(actions)) return 0;

  // 1. Métrica estándar oficial de Meta: conversaciones de mensajería iniciadas
  const convStarted = actions.find(a => 
    a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
    a.action_type === 'onsite_conversion.messaging_conversation_started' ||
    a.action_type === 'messaging_conversation_started_7d'
  );
  if (convStarted && convStarted.value) {
    const val = parseInt(String(convStarted.value), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Conexiones totales de mensajería (nuevos contactos de chat)
  const totalMessaging = actions.find(a => 
    a.action_type === 'onsite_conversion.total_messaging_connection' ||
    a.action_type === 'total_messaging_connection'
  );
  if (totalMessaging && totalMessaging.value) {
    const val = parseInt(String(totalMessaging.value), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. Primeras respuestas de mensajería
  const firstReply = actions.find(a => 
    a.action_type === 'onsite_conversion.messaging_first_reply' ||
    a.action_type === 'messaging_first_reply'
  );
  if (firstReply && firstReply.value) {
    const val = parseInt(String(firstReply.value), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Contactos y mensajes directos
  const contact = actions.find(a => 
    a.action_type === 'contact' ||
    a.action_type === 'contact_total' ||
    a.action_type === 'messages' ||
    a.action_type === 'conversation'
  );
  if (contact && contact.value) {
    const val = parseInt(String(contact.value), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  return 0;
}

// Extrae el costo por conversación desde cost_per_action_type o calcula spend / conversaciones
function extractCostPerConversation(
  costPerAction?: Array<{ action_type: string; value: string | number }>,
  spend?: string,
  conversations?: number
): string {
  if (costPerAction && Array.isArray(costPerAction)) {
    const costAction = costPerAction.find(a => 
      a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
      a.action_type === 'onsite_conversion.total_messaging_connection' ||
      a.action_type === 'onsite_conversion.messaging_first_reply' ||
      a.action_type.includes('messaging_conversation_started') ||
      a.action_type.includes('total_messaging_connection')
    );
    if (costAction && costAction.value) {
      const val = parseFloat(String(costAction.value));
      if (!isNaN(val) && val > 0) return val.toFixed(2);
    }
  }

  if (conversations && conversations > 0 && spend) {
    const s = parseFloat(spend);
    if (!isNaN(s) && s > 0) {
      return (s / conversations).toFixed(2);
    }
  }
  return '0.00';
}

// Extrae conversiones totales combinando compras web, leads web y conversaciones de mensajería
function extractAllConversions(actions?: Array<{ action_type: string; value: string | number }>): {
  totalConversions: number;
  conversations: number;
  leads: number;
  purchases: number;
} {
  if (!actions || !Array.isArray(actions)) {
    return { totalConversions: 0, conversations: 0, leads: 0, purchases: 0 };
  }

  const conversations = extractMessagingConversations(actions);

  const purchaseAction = actions.find(a => 
    a.action_type === 'purchase' || 
    a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
    a.action_type === 'omni_purchase'
  );
  const purchases = purchaseAction ? (parseInt(String(purchaseAction.value), 10) || 0) : 0;

  const leadAction = actions.find(a => 
    a.action_type === 'lead' || 
    a.action_type === 'offsite_conversion.fb_pixel_lead' ||
    a.action_type === 'onsite_conversion.lead_grouped' ||
    a.action_type === 'leadgen_grouped'
  );
  const leads = leadAction ? (parseInt(String(leadAction.value), 10) || 0) : 0;

  const offsiteAction = actions.find(a => a.action_type === 'offsite_conversion');
  const offsite = offsiteAction ? (parseInt(String(offsiteAction.value), 10) || 0) : 0;

  let totalConversions = purchases + leads;
  if (totalConversions === 0 && offsite > 0) {
    totalConversions = offsite;
  }
  if (conversations > 0) {
    if (leads > 0 && leads === conversations) {
      totalConversions = Math.max(totalConversions, conversations);
    } else {
      totalConversions += conversations;
    }
  }

  return { totalConversions, conversations, leads, purchases };
}

function determineCampaignResult(
  objective: string,
  actions?: Array<{ action_type: string; value: string | number }>,
  costPerAction?: Array<{ action_type: string; value: string | number }>,
  spend?: string,
  clicks?: string,
  impressions?: string
): {
  resultType: string;
  resultLabel: string;
  resultLabelEn: string;
  resultCount: number;
  costPerResult: string;
} {
  const extracted = extractAllConversions(actions);
  const sp = parseFloat(spend || '0');

  // 1. Mensajes / Conversaciones (WhatsApp, Messenger, IG)
  if (extracted.conversations > 0) {
    const cost = extractCostPerConversation(costPerAction, spend, extracted.conversations);
    return {
      resultType: 'conversations',
      resultLabel: 'Conversaciones iniciadas',
      resultLabelEn: 'Conversations started',
      resultCount: extracted.conversations,
      costPerResult: cost,
    };
  }

  // 2. Clientes potenciales (Leads)
  if (extracted.leads > 0 || (objective && objective.toUpperCase().includes('LEAD'))) {
    const leadCostAction = costPerAction?.find(a => 
      a.action_type === 'lead' || 
      a.action_type.includes('lead')
    );
    const cost = leadCostAction && leadCostAction.value 
      ? parseFloat(String(leadCostAction.value)).toFixed(2)
      : (extracted.leads > 0 && sp > 0 ? (sp / extracted.leads).toFixed(2) : '0.00');
    return {
      resultType: 'leads',
      resultLabel: 'Clientes potenciales',
      resultLabelEn: 'Leads',
      resultCount: extracted.leads,
      costPerResult: cost,
    };
  }

  // 3. Compras (Purchases)
  if (extracted.purchases > 0 || (objective && (objective.toUpperCase().includes('SALES') || objective.toUpperCase().includes('CONVERSION')))) {
    const purchaseCostAction = costPerAction?.find(a => 
      a.action_type === 'purchase' || 
      a.action_type.includes('purchase')
    );
    const cost = purchaseCostAction && purchaseCostAction.value
      ? parseFloat(String(purchaseCostAction.value)).toFixed(2)
      : (extracted.purchases > 0 && sp > 0 ? (sp / extracted.purchases).toFixed(2) : '0.00');
    return {
      resultType: 'purchases',
      resultLabel: 'Compras en sitio web',
      resultLabelEn: 'Website purchases',
      resultCount: extracted.purchases,
      costPerResult: cost,
    };
  }

  // 4. Conversiones totales
  if (extracted.totalConversions > 0) {
    const cost = sp > 0 ? (sp / extracted.totalConversions).toFixed(2) : '0.00';
    return {
      resultType: 'conversions',
      resultLabel: 'Conversiones',
      resultLabelEn: 'Conversions',
      resultCount: extracted.totalConversions,
      costPerResult: cost,
    };
  }

  // 5. Clics en el enlace / Tráfico
  const clk = parseInt(clicks || '0', 10);
  if (clk > 0 || (objective && objective.toUpperCase().includes('TRAFFIC'))) {
    const cost = sp > 0 && clk > 0 ? (sp / clk).toFixed(2) : '0.00';
    return {
      resultType: 'clicks',
      resultLabel: 'Clics en el enlace',
      resultLabelEn: 'Link clicks',
      resultCount: clk,
      costPerResult: cost,
    };
  }

  // 6. Impresiones
  const imp = parseInt(impressions || '0', 10);
  const cost = sp > 0 && imp > 0 ? ((sp / imp) * 1000).toFixed(2) : '0.00';
  return {
    resultType: 'impressions',
    resultLabel: 'Impresiones',
    resultLabelEn: 'Impressions',
    resultCount: imp,
    costPerResult: cost,
  };
}

async function fetchKpisForRange(adAccountId: string, token: string, since: string, until: string) {
  const kpiFields = 'impressions,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,purchase_roas';
  const url = `${FB_BASE}/${adAccountId}/insights?fields=${kpiFields}&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
  const data = await fetchFacebookJson(url);
  if (data.error) throw new Error('meta_insights_rejected');

  const kpi = data.data?.[0] || {};
  const roas = kpi.purchase_roas?.[0]?.value ? parseFloat(kpi.purchase_roas[0].value).toFixed(2) : '0.00';
  
  const extracted = extractAllConversions(kpi.actions);
  const spend = kpi.spend || '0.00';
  const conversions = String(extracted.totalConversions);
  const conversations = String(extracted.conversations);
  const costPerConversation = extractCostPerConversation(kpi.cost_per_action_type, spend, extracted.conversations);
  
  const cpa = extracted.totalConversions > 0 && spend 
    ? (parseFloat(spend) / extracted.totalConversions).toFixed(2) 
    : '0.00';
  const clicks = kpi.clicks || '0';
  const impressions = kpi.impressions || '0';
  const conversionRate = parseInt(clicks) > 0 
    ? ((extracted.totalConversions / parseInt(clicks)) * 100).toFixed(2) 
    : '0.00';

  return {
    impressions,
    clicks,
    ctr: kpi.ctr ? parseFloat(kpi.ctr).toFixed(2) : '0.00',
    cpc: kpi.cpc ? parseFloat(kpi.cpc).toFixed(2) : '0.00',
    cpm: kpi.cpm ? parseFloat(kpi.cpm).toFixed(2) : '0.00',
    spend,
    roas,
    conversions,
    conversations,
    costPerConversation,
    conversionRate,
    cpa,
  };
}

async function fetchAppointmentsAndRevenue(tenantId: string, since: string, until: string) {
  const supabase = createSupabaseAdmin();
  const sinceIso = `${since}T00:00:00.000Z`;
  const untilIso = `${until}T23:59:59.999Z`;

  const [appointmentsResult, salesResult, conversationsResult] = await Promise.all([
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
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
  ]);

  if (appointmentsResult.error || salesResult.error) throw new Error('analytics_lookup_failed');
  const sales = salesResult.data || [];
  if ((salesResult.count || 0) > sales.length) throw new Error('analytics_window_too_large');

  const revenue = sales.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0) / 100;
  return {
    appointments: appointmentsResult.count || 0,
    revenue,
    crmConversations: conversationsResult?.count || 0,
  };
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
  const conversations = parseInt(current.kpis.conversations || '0', 10);

  if (spend > 0 && revenue < spend) {
    if (conversations > 0 || current.appointments > 0) {
      alerts.push({
        severity: 'info',
        metric: 'Captación de Clientes',
        message: `Tus anuncios generaron ${conversations} conversaciones de clientes y ${current.appointments} citas con $${spend.toFixed(2)} de inversión. Registra las ventas completadas en el CRM para calcular tu ROI neto.`,
      });
    } else {
      alerts.push({
        severity: 'critical',
        metric: 'ROI',
        message: `Estás gastando más de lo que generás en ingresos este período ($${spend.toFixed(2)} gastado vs $${revenue.toFixed(2)} generado).`,
      });
    }
  }

  if (spend > 0 && current.appointments === 0 && conversations === 0) {
    alerts.push({
      severity: 'critical',
      metric: 'Citas y Contactos',
      message: `0 citas y 0 conversaciones en los últimos ${days} días pese a tener $${spend.toFixed(2)} de gasto activo. Revisá que el botón de WhatsApp y anuncios estén activos.`,
    });
  } else if (current.appointments > 0 && previous.appointments > 0) {
    const costPerApptCurrent = spend / current.appointments;
    const costPerApptPrevious = parseFloat(previous.kpis.spend) / previous.appointments;
    if (costPerApptPrevious > 0 && costPerApptCurrent > costPerApptPrevious * 1.3) {
      alerts.push({
        severity: 'warning',
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
    const { tenantId, token, adAccountId: defaultAdAccountId } = await getFacebookCredentials(req);
    const rateDenied = await enforceTenantRateLimit('facebook-insights', tenantId, 30, 60_000);
    if (rateDenied) return rateDenied;

    const { searchParams } = new URL(req.url);
    const requestedAdAccountId = searchParams.get('ad_account_id');
    const adAccountId = (requestedAdAccountId && /^(?:act_)?[0-9]{5,30}$/.test(requestedAdAccountId))
      ? (requestedAdAccountId.startsWith('act_') ? requestedAdAccountId : `act_${requestedAdAccountId}`)
      : defaultAdAccountId;

    const period = searchParams.get('period') === 'month' ? 'month' : 'week';
    const rawCampaignId = searchParams.get('campaign_id');
    const isFilteredByCampaign = Boolean(rawCampaignId && rawCampaignId !== 'all' && /^[0-9]{5,30}$/.test(rawCampaignId));
    const targetId = isFilteredByCampaign ? rawCampaignId! : adAccountId;
    const ranges = computePeriodRanges(period);

    const [currentKpis, previousKpis, currentExtra, previousExtra, campaignsInsightsData, allCampaignsData] = await Promise.all([
      fetchKpisForRange(targetId, token, ranges.current.since, ranges.current.until),
      fetchKpisForRange(targetId, token, ranges.previous.since, ranges.previous.until).catch(() => ({
        impressions: '0', clicks: '0', ctr: '0.00', cpc: '0.00', cpm: '0.00',
        spend: '0.00', roas: '0.00', conversions: '0', conversations: '0',
        costPerConversation: '0.00', conversionRate: '0.00', cpa: '0.00',
      })),
      fetchAppointmentsAndRevenue(tenantId, ranges.current.since, ranges.current.until),
      fetchAppointmentsAndRevenue(tenantId, ranges.previous.since, ranges.previous.until),
      fetchFacebookJson(`${FB_BASE}/${adAccountId}/insights?fields=campaign_id,campaign_name,objective,impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type&level=campaign&time_range={"since":"${ranges.current.since}","until":"${ranges.current.until}"}&access_token=${token}`).catch(() => ({ data: [] })),
      fetchFacebookJson(`${FB_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective&limit=50&access_token=${token}`).catch(() => ({ data: [] })),
    ]);

    const current = { kpis: currentKpis, ...currentExtra };
    const previous = { kpis: previousKpis, ...previousExtra };

    const statusMap = new Map<string, string>();
    const nameMap = new Map<string, string>();
    const objectiveMap = new Map<string, string>();
    if (Array.isArray(allCampaignsData.data)) {
      for (const c of allCampaignsData.data) {
        if (c.id) {
          statusMap.set(c.id, c.status || 'PAUSED');
          if (c.name) nameMap.set(c.id, c.name);
          if (c.objective) objectiveMap.set(c.id, c.objective);
        }
      }
    }

    const campaignsBreakdown: any[] = [];
    const seenCampaignIds = new Set<string>();

    for (const item of (campaignsInsightsData.data || [])) {
      if (!item.campaign_id) continue;
      seenCampaignIds.add(item.campaign_id);
      const extracted = extractAllConversions(item.actions);
      const obj = item.objective || objectiveMap.get(item.campaign_id) || 'OUTCOME_TRAFFIC';
      const res = determineCampaignResult(
        obj,
        item.actions,
        item.cost_per_action_type,
        item.spend,
        item.clicks,
        item.impressions
      );
      const sp = item.spend || '0.00';
      const clk = parseInt(item.clicks || '0', 10);
      const conversionRate = clk > 0 ? ((extracted.totalConversions / clk) * 100).toFixed(2) : '0.00';
      const costPerConv = extractCostPerConversation(item.cost_per_action_type, sp, extracted.conversations);

      campaignsBreakdown.push({
        id: item.campaign_id,
        name: item.campaign_name || nameMap.get(item.campaign_id) || 'Sin nombre',
        status: statusMap.get(item.campaign_id) || 'ACTIVE',
        objective: obj,
        spend: sp,
        impressions: item.impressions || '0',
        clicks: item.clicks || '0',
        ctr: item.ctr ? parseFloat(item.ctr).toFixed(2) : '0.00',
        cpc: item.cpc ? parseFloat(item.cpc).toFixed(2) : '0.00',
        conversions: String(extracted.totalConversions),
        conversations: String(extracted.conversations),
        costPerConversation: costPerConv,
        resultType: res.resultType,
        resultLabel: res.resultLabel,
        resultLabelEn: res.resultLabelEn,
        resultCount: res.resultCount,
        costPerResult: res.costPerResult,
        conversionRate,
      });
    }

    if (Array.isArray(allCampaignsData.data)) {
      for (const c of allCampaignsData.data) {
        if (c.id && !seenCampaignIds.has(c.id)) {
          seenCampaignIds.add(c.id);
          campaignsBreakdown.push({
            id: c.id,
            name: c.name || 'Sin nombre',
            status: c.status || 'PAUSED',
            objective: c.objective || 'OUTCOME_TRAFFIC',
            spend: '0.00',
            impressions: '0',
            clicks: '0',
            ctr: '0.00',
            cpc: '0.00',
            conversions: '0',
            conversations: '0',
            costPerConversation: '0.00',
            resultType: 'conversations',
            resultLabel: 'Conversaciones iniciadas',
            resultLabelEn: 'Conversations started',
            resultCount: 0,
            costPerResult: '0.00',
            conversionRate: '0.00',
          });
        }
      }
    }

    // Desglose por plataforma (periodo actual para targetId)
    let platformBreakdown: any[] = [];
    try {
      const breakdownUrl = `${FB_BASE}/${targetId}/insights?fields=impressions,clicks,spend&breakdowns=publisher_platform&time_range={"since":"${ranges.current.since}","until":"${ranges.current.until}"}&access_token=${token}`;
      const breakdownData = await fetchFacebookJson(breakdownUrl);
      const platformBreakdownRaw = (breakdownData.data || []).map((item: any) => ({
        platform: item.publisher_platform || 'unknown',
        impressions: item.impressions || '0',
        clicks: item.clicks || '0',
        spend: item.spend || '0.00',
      }));
      const totalImpressions = platformBreakdownRaw.reduce((sum: number, p: any) => sum + parseInt(p.impressions || '0'), 0);
      platformBreakdown = platformBreakdownRaw
        .map((p: any) => ({
          ...p,
          percentage: totalImpressions > 0 ? Math.round((parseInt(p.impressions) / totalImpressions) * 1000) / 10 : 0,
        }))
        .sort((a: any, b: any) => parseInt(b.impressions) - parseInt(a.impressions));
    } catch {
      platformBreakdown = [];
    }

    // Insights por dia para el grafico de tendencia (7 dias en semanal, 30 en mensual)
    let dailyInsights: any[] = [];
    try {
      const dailyUrl = `${FB_BASE}/${targetId}/insights?fields=impressions,clicks,spend,actions&time_increment=1&time_range={"since":"${ranges.current.since}","until":"${ranges.current.until}"}&access_token=${token}`;
      const dailyData = await fetchFacebookJson(dailyUrl);
      dailyInsights = (dailyData.data || []).map((day: any) => {
        const extracted = extractAllConversions(day.actions);
        return {
          date: day.date_start,
          impressions: day.impressions || '0',
          clicks: day.clicks || '0',
          spend: day.spend || '0.00',
          conversions: String(extracted.totalConversions),
          conversations: String(extracted.conversations),
        };
      });
    } catch {
      dailyInsights = [];
    }

    // Top creatividades reales de Meta con imagen, copy y métricas
    let topCreatives: any[] = [];
    try {
      const adsUrl = `${FB_BASE}/${adAccountId}/ads?fields=id,name,status,campaign_id,campaign{id,name},creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id},insights.date_preset(maximum){impressions,clicks,ctr,spend,actions}&limit=50&access_token=${token}`;
      const adsData = await fetchFacebookJson(adsUrl);

      let rawAds = Array.isArray(adsData.data) ? adsData.data : [];

      if (isFilteredByCampaign) {
        const filtered = rawAds.filter(
          (a: any) => a.campaign_id === targetId || a.campaign?.id === targetId
        );
        if (filtered.length > 0) {
          rawAds = filtered;
        } else {
          try {
            const campAdsUrl = `${FB_BASE}/${targetId}/ads?fields=id,name,status,campaign_id,campaign{id,name},creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id},insights.date_preset(maximum){impressions,clicks,ctr,spend,actions}&limit=50&access_token=${token}`;
            const campAdsData = await fetchFacebookJson(campAdsUrl);
            if (Array.isArray(campAdsData.data) && campAdsData.data.length > 0) {
              rawAds = campAdsData.data;
            }
          } catch {}
        }
      }

      topCreatives = rawAds.map((ad: any) => {
        const c = ad.creative || {};
        const ins = ad.insights?.data?.[0] || {};
        const extracted = extractAllConversions(ins.actions);
        const adSpend = ins.spend || '0.00';
        const costPerConv = extractCostPerConversation(ins.cost_per_action_type || [], adSpend, extracted.conversations);

        const thumbnail = c.thumbnail_url 
          || c.image_url 
          || c.object_story_spec?.video_data?.image_url 
          || c.object_story_spec?.link_data?.picture 
          || null;

        const bodyText = c.body 
          || c.object_story_spec?.video_data?.message 
          || c.object_story_spec?.link_data?.message 
          || '';

        const headline = c.title 
          || c.object_story_spec?.link_data?.name 
          || (c.name && !c.name.includes('2026-') && !c.name.includes('2025-') ? c.name : null)
          || ad.name;

        const videoId = c.video_id 
          || c.object_story_spec?.video_data?.video_id 
          || null;
        const isVideo = Boolean(videoId || c.object_story_spec?.video_data);

        const videoEmbedUrl = videoId
          ? `https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F${videoId}%2F&show_text=false&autoplay=true`
          : null;
        const videoWatchUrl = videoId
          ? `https://www.facebook.com/reel/${videoId}/`
          : null;

        return {
          id: ad.id,
          name: ad.name || 'Sin nombre',
          status: ad.status || 'ACTIVE',
          campaign: ad.campaign?.name || 'Campaña',
          campaignId: ad.campaign_id || ad.campaign?.id || '',
          headline: headline || ad.name,
          body: bodyText,
          thumbnail,
          isVideo,
          videoId,
          videoEmbedUrl,
          videoWatchUrl,
          impressions: ins.impressions || '0',
          clicks: ins.clicks || '0',
          ctr: ins.ctr ? parseFloat(ins.ctr).toFixed(2) : '0.00',
          spend: adSpend,
          conversions: String(extracted.totalConversions),
          conversations: String(extracted.conversations),
          costPerConversation: costPerConv,
        };
      });

      topCreatives.sort((a: any, b: any) => {
        const spendDiff = parseFloat(b.spend) - parseFloat(a.spend);
        if (spendDiff !== 0) return spendDiff;
        return parseInt(b.impressions || '0', 10) - parseInt(a.impressions || '0', 10);
      });
    } catch {
      topCreatives = [];
    }

    const alerts = buildAlerts(current, previous, ranges.days);
    const activeCampaignName = isFilteredByCampaign
      ? (nameMap.get(targetId) || campaignsBreakdown.find((b: any) => b.id === targetId)?.name || 'Campaña seleccionada')
      : null;

    return NextResponse.json({
      success: true,
      period,
      selectedCampaignId: isFilteredByCampaign ? targetId : 'all',
      selectedCampaignName: activeCampaignName,
      campaigns: campaignsBreakdown,
      campaignsBreakdown,
      ranges,
      current,
      previous,
      deltas: {
        impressions: pctChange(parseInt(current.kpis.impressions), parseInt(previous.kpis.impressions)),
        clicks: pctChange(parseInt(current.kpis.clicks), parseInt(previous.kpis.clicks)),
        conversations: pctChange(parseInt(current.kpis.conversations || '0'), parseInt(previous.kpis.conversations || '0')),
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
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error: any) {
    const failure = getFacebookPublicError(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
