import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// ESTADÍSTICAS DEL PANEL
// ============================================

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const tenant = await getTenantFromRequest(req);

    // Ingresos totales (ventas completadas)
    let salesQuery = supabase.from('sales').select('amount, created_at').eq('status', 'completed');
    if (tenant?.tenantId) salesQuery = salesQuery.eq('tenant_id', tenant.tenantId);
    const { data: completedSales } = await salesQuery;

    const totalRevenue = (completedSales || []).reduce((sum, s) => sum + s.amount, 0) / 100;
    const totalSales = completedSales?.length || 0;

    // Conversaciones activas
    let convQuery = supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'chatting');
    if (tenant?.tenantId) convQuery = convQuery.eq('tenant_id', tenant.tenantId);
    const { count: activeConversations } = await convQuery;

    // Ingresos por día (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyIncome: Record<string, number> = {};
    (completedSales || []).forEach((sale) => {
      const date = sale.created_at.split('T')[0]; // "2026-05-04"
      dailyIncome[date] = (dailyIncome[date] || 0) + sale.amount / 100;
    });

    // Ventas recientes (últimas 10)
    let recentQuery = supabase.from('sales').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(10);
    if (tenant?.tenantId) recentQuery = recentQuery.eq('tenant_id', tenant.tenantId);
    const { data: recentSales } = await recentQuery;

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
