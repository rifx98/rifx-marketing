import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// ESTADÍSTICAS DEL PANEL
// ============================================

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    // Ingresos totales (ventas completadas)
    const { data: completedSales } = await supabase
      .from('sales')
      .select('amount, created_at')
      .eq('status', 'completed')
      .eq('tenant_id', tenant.tenantId);

    const totalRevenue = (completedSales || []).reduce((sum, s) => sum + s.amount, 0) / 100;
    const totalSales = completedSales?.length || 0;

    // Conversaciones activas
    const { count: activeConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'chatting')
      .eq('tenant_id', tenant.tenantId);

    // Ingresos por día (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyIncome: Record<string, number> = {};
    (completedSales || []).forEach((sale) => {
      const date = sale.created_at.split('T')[0]; // "2026-05-04"
      dailyIncome[date] = (dailyIncome[date] || 0) + sale.amount / 100;
    });

    // Ventas recientes (últimas 10)
    const { data: recentSales } = await supabase
      .from('sales')
      .select('*')
      .eq('status', 'completed')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

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
