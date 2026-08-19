import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function nonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function getTimeAgo(value: unknown): string {
  if (typeof value !== 'string') return '';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_tenant_dashboard_stats', {
      p_tenant_id: tenant.tenantId,
    });
    if (error || !data) {
      console.error('Dashboard aggregate lookup failed:', error?.code || 'invalid_result');
      return NextResponse.json(
        { error: 'No se pudieron consultar las estadísticas' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const aggregate = asObject(data);
    const appointmentCounts = asObject(aggregate.appointmentCounts);
    const total = nonNegativeNumber(appointmentCounts.total);
    const confirmed = nonNegativeNumber(appointmentCounts.confirmed);
    const cancelled = nonNegativeNumber(appointmentCounts.cancelled);
    const rescheduled = nonNegativeNumber(appointmentCounts.rescheduled);
    const completed = nonNegativeNumber(appointmentCounts.completed);
    const noShow = nonNegativeNumber(appointmentCounts.noShow);
    const attendanceDenominator = completed + noShow;

    const recentSales = Array.isArray(aggregate.recentSales)
      ? aggregate.recentSales.slice(0, 10).map((rawSale) => {
          const sale = asObject(rawSale);
          return {
            id: typeof sale.id === 'string' ? sale.id : '',
            customer: typeof sale.customer === 'string' ? sale.customer : '',
            amount: nonNegativeNumber(sale.amount),
            service: typeof sale.service === 'string' ? sale.service : '',
            time: getTimeAgo(sale.createdAt),
            status: typeof sale.status === 'string' ? sale.status : 'completed',
          };
        })
      : [];

    return NextResponse.json({
      totalRevenue: nonNegativeNumber(aggregate.totalRevenue),
      totalSales: nonNegativeNumber(aggregate.totalSales),
      activeConversations: nonNegativeNumber(aggregate.activeConversations),
      dailyIncome: asObject(aggregate.dailyIncome),
      recentSales,
      salesFunnel: asObject(aggregate.salesFunnel),
      appointmentStats: {
        total,
        pending: nonNegativeNumber(appointmentCounts.pending),
        confirmed,
        awaiting_reschedule: nonNegativeNumber(appointmentCounts.awaiting_reschedule),
        rescheduled,
        cancelled,
        completed,
        noShow,
        pendingCompletion: nonNegativeNumber(appointmentCounts.pendingCompletion),
        rates: {
          confirmationRate: total > 0 ? (confirmed / total) * 100 : 0,
          attendanceRate: attendanceDenominator > 0 ? (completed / attendanceDenominator) * 100 : 0,
          cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
          reschedulingRate: total > 0 ? (rescheduled / total) * 100 : 0,
        },
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    console.error('Dashboard statistics request failed');
    return NextResponse.json(
      { error: 'No se pudieron consultar las estadísticas' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
