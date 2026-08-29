import { NextRequest, NextResponse } from 'next/server';
import { getDailySmsStats } from '@/lib/sms-limiter';
import { requireAdminPermission } from '@/lib/admin-rbac';

/**
 * GET /api/admin/sms-stats
 * Muestra estadísticas de uso de SMS para monitorear el gasto
 */
export async function GET(req: NextRequest) {
  // Solo admins pueden ver estas estadísticas
  const auth = await requireAdminPermission(req, 'dashboard.read');
  if (!auth.ok) {
    return auth.response;
  }

  const stats = getDailySmsStats();

  // Calcular estimación de costo
  const SMS_COST = 0.0079; // USD por SMS (Ecuador)
  const costToday = stats.count * SMS_COST;
  const projectedMonthlyCost = costToday * 30; // Estimación simple

  return NextResponse.json({
    today: {
      date: stats.date,
      count: stats.count,
      limit: stats.limit,
      remaining: stats.limit - stats.count,
      percentage: Math.round((stats.count / stats.limit) * 100),
    },
    costs: {
      today: `$${costToday.toFixed(2)} USD`,
      projectedMonthly: `$${projectedMonthlyCost.toFixed(2)} USD`,
      perSms: `$${SMS_COST} USD`,
    },
    limits: {
      perIp: '2 SMS / 15 min',
      perPhone: '2 SMS / 15 min',
      globalDaily: `${stats.limit} SMS / día`,
    },
    twilioCredit: {
      initial: '$15.50 USD',
      smsAvailable: Math.floor(15.50 / SMS_COST),
      daysRemaining: Math.floor((15.50 / SMS_COST) / stats.limit),
    },
  });
}
