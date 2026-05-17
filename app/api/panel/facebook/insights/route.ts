import { NextRequest, NextResponse } from 'next/server';

const FB_API_VERSION = 'v21.0';
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

function getEnv() {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  if (!token || !adAccountId) {
    throw new Error('Faltan credenciales de Facebook Marketing API');
  }
  return { token, adAccountId };
}

// GET - KPIs agregados de la cuenta + desglose por plataforma
export async function GET(req: NextRequest) {
  try {
    const { token, adAccountId } = getEnv();
    const { searchParams } = new URL(req.url);
    const datePreset = searchParams.get('date_preset') || 'last_30d';
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    // Construir parametros de fecha
    let dateParams = `date_preset=${datePreset}`;
    if (since && until) {
      dateParams = `time_range={"since":"${since}","until":"${until}"}`;
    }

    // 1. KPIs agregados de la cuenta
    const kpiFields = 'impressions,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,purchase_roas';
    const kpiUrl = `${FB_BASE}/${adAccountId}/insights?fields=${kpiFields}&${dateParams}&access_token=${token}`;
    const kpiRes = await fetch(kpiUrl);
    const kpiData = await kpiRes.json();

    if (kpiData.error) {
      return NextResponse.json({ error: kpiData.error.message }, { status: 400 });
    }

    const kpi = kpiData.data?.[0] || {};

    // Calcular ROAS y CPA
    const roas = kpi.purchase_roas?.[0]?.value ? parseFloat(kpi.purchase_roas[0].value).toFixed(2) : '0.00';
    const conversions = kpi.actions?.find(
      (a: any) => a.action_type === 'offsite_conversion' || a.action_type === 'purchase' || a.action_type === 'lead'
    );
    const conversionValue = conversions?.value || '0';
    const cpa = conversions && kpi.spend ? (parseFloat(kpi.spend) / parseInt(conversions.value)).toFixed(2) : '0.00';

    // 2. Desglose por plataforma (publisher_platform)
    const breakdownUrl = `${FB_BASE}/${adAccountId}/insights?fields=impressions,clicks,spend&breakdowns=publisher_platform&${dateParams}&access_token=${token}`;
    const breakdownRes = await fetch(breakdownUrl);
    const breakdownData = await breakdownRes.json();

    const platformBreakdown = (breakdownData.data || []).map((item: any) => ({
      platform: item.publisher_platform || 'unknown',
      impressions: item.impressions || '0',
      clicks: item.clicks || '0',
      spend: item.spend || '0.00',
    }));

    // Calcular porcentajes para el desglose
    const totalImpressions = platformBreakdown.reduce((sum: number, p: any) => sum + parseInt(p.impressions || '0'), 0);
    const platformWithPct = platformBreakdown.map((p: any) => ({
      ...p,
      percentage: totalImpressions > 0 ? Math.round((parseInt(p.impressions) / totalImpressions) * 100) : 0,
    }));

    // 3. Insights por dia (ultimos 7 dias) para grafico
    const dailyUrl = `${FB_BASE}/${adAccountId}/insights?fields=impressions,clicks,spend,actions&time_increment=1&date_preset=last_7d&access_token=${token}`;
    const dailyRes = await fetch(dailyUrl);
    const dailyData = await dailyRes.json();

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

    // 4. Top creatividades
    const creativesUrl = `${FB_BASE}/${adAccountId}/insights?fields=ad_name,impressions,clicks,ctr,spend,actions&level=ad&sort=impressions_descending&limit=5&${dateParams}&access_token=${token}`;
    const creativesRes = await fetch(creativesUrl);
    const creativesData = await creativesRes.json();

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

    return NextResponse.json({
      success: true,
      kpis: {
        impressions: kpi.impressions || '0',
        clicks: kpi.clicks || '0',
        ctr: kpi.ctr ? parseFloat(kpi.ctr).toFixed(2) : '0.00',
        cpc: kpi.cpc ? parseFloat(kpi.cpc).toFixed(2) : '0.00',
        cpm: kpi.cpm ? parseFloat(kpi.cpm).toFixed(2) : '0.00',
        spend: kpi.spend || '0.00',
        roas,
        conversions: conversionValue,
        cpa,
      },
      platformBreakdown: platformWithPct,
      dailyInsights,
      topCreatives,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
