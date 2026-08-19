import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

// Retired fail-closed endpoint. A successful browser redirect is not proof of
// payment: only a verified payment-provider webhook may activate a plan, renew
// a trial, change limits or issue authorization reflecting a new entitlement.
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return json({ error: 'No autenticado' }, 401);

    return json({
      error: 'La activacion local de planes fue retirada. El plan se actualizara automaticamente despues de que un webhook firmado confirme el pago.',
      code: 'LOCAL_PLAN_ACTIVATION_RETIRED',
      requiredFlow: 'checkout_then_verified_webhook',
    }, 410);
  } catch {
    console.error('Retired plan activation endpoint failed');
    return json({ error: 'No se pudo validar la solicitud de activacion' }, 500);
  }
}
