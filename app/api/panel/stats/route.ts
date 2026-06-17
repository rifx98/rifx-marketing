import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// ESTADÍSTICAS DEL PANEL (INCLUYENDO CITAS)
// ============================================

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Ingresos totales (ventas completadas)
    const { data: completedSales } = await supabase
      .from('sales')
      .select('amount, created_at')
      .eq('status', 'completed')
      .eq('tenant_id', tenant.tenantId);

    const totalRevenue = (completedSales || []).reduce((sum, s) => sum + s.amount, 0) / 100;
    const totalSales = completedSales?.length || 0;

    // 2. Conversaciones activas
    const { count: activeConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'chatting')
      .eq('tenant_id', tenant.tenantId);

    // 3. Ingresos por día (últimos 30 días)
    const dailyIncome: Record<string, number> = {};
    (completedSales || []).forEach((sale) => {
      const date = sale.created_at.split('T')[0];
      dailyIncome[date] = (dailyIncome[date] || 0) + sale.amount / 100;
    });

    // 4. Ventas recientes (últimas 10)
    const { data: recentSales } = await supabase
      .from('sales')
      .select('*')
      .eq('status', 'completed')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 5. Estadísticas de Citas (SaaS Dashboard)
    const { data: appts } = await supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenant.tenantId);

    const totalAppts = appts?.length || 0;
    const pending = appts?.filter(a => a.status === 'pending').length || 0;
    const confirmed = appts?.filter(a => a.status === 'confirmed').length || 0;
    const awaiting_reschedule = appts?.filter(a => a.status === 'awaiting_reschedule').length || 0;
    const rescheduled = appts?.filter(a => a.status === 'rescheduled').length || 0;
    const cancelled = appts?.filter(a => a.status === 'cancelled').length || 0;
    const completed = appts?.filter(a => a.status === 'completed').length || 0;
    const noShow = appts?.filter(a => a.status === 'no_show').length || 0;
    const pendingCompletion = appts?.filter(a => a.status === 'pending_completion').length || 0;

    // Indicadores corregidos según especificaciones del usuario:
    // - Confirmation Rate = confirmed / total
    // - Attendance Rate = completed / (completed + no_show)
    // - Cancellation Rate = cancelled / total
    // - Rescheduling Rate = rescheduled / total
    const confirmationRate = totalAppts > 0 ? (confirmed / totalAppts) * 100 : 0;
    const attendanceDenominator = completed + noShow;
    const attendanceRate = attendanceDenominator > 0 ? (completed / attendanceDenominator) * 100 : 0;
    const cancellationRate = totalAppts > 0 ? (cancelled / totalAppts) * 100 : 0;
    const reschedulingRate = totalAppts > 0 ? (rescheduled / totalAppts) * 100 : 0;

    // 6. 🆕 Estadísticas del Funnel de Ventas (Sales Agent)
    const { data: allConvs } = await supabase
      .from('conversations')
      .select('sales_stage, lead_score')
      .eq('tenant_id', tenant.tenantId);

    const salesStages = ['new_lead', 'discovery', 'qualified', 'proposal', 'objection', 'closing', 'won', 'lost'];
    const funnelCounts: Record<string, number> = {};
    for (const s of salesStages) {
      funnelCounts[s] = (allConvs || []).filter(c => c.sales_stage === s).length;
    }
    const allScores = (allConvs || []).map(c => c.lead_score || 0);
    const avgLeadScore = allScores.length > 0 ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length) : 0;
    const hotLeads = allScores.filter(s => s >= 70).length;
    const warmLeads = allScores.filter(s => s >= 40 && s <= 69).length;
    const coldLeads = allScores.filter(s => s >= 0 && s <= 39).length;

    return NextResponse.json({
      totalRevenue,
      totalSales,
      activeConversations: activeConversations || 0,
      dailyIncome,
      recentSales: (recentSales || []).map((s) => ({
        id: s.id,
        customer: s.customer_name,
        amount: s.amount / 100,
        service: s.service,
        time: getTimeAgo(s.created_at),
        status: s.status,
      })),
      salesFunnel: {
        ...funnelCounts,
        avgLeadScore,
        hotLeads,
        warmLeads,
        coldLeads,
      },
      appointmentStats: {
        total: totalAppts,
        pending,
        confirmed,
        awaiting_reschedule,
        rescheduled,
        cancelled,
        completed,
        noShow,
        pendingCompletion,
        rates: {
          confirmationRate,
          attendanceRate,
          cancellationRate,
          reschedulingRate
        }
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo stats:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}
