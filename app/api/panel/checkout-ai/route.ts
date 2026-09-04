import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const amount = Number(body.amount);

    if (isNaN(amount) || amount < 1000 || amount % 1000 !== 0) {
      return NextResponse.json({ error: 'La cantidad debe ser múltiplo de 1000' }, { status: 400 });
    }

    // Usaremos un único Variant ID base (el de 1000 créditos) y multiplicaremos la cantidad
    const variantId = process.env.LEMONSQUEEZY_VARIANT_AI_1K || 'e25d28c0-a5b1-4035-938d-7ae9659a9064';
    const quantity = amount / 1000;

    const storeDomain = process.env.LEMONSQUEEZY_STORE_DOMAIN || 'rifxmarketing.lemonsqueezy.com';
    
    // Construir la URL de Checkout con Custom Data y Quantity
    const checkoutUrl = `https://${storeDomain}/checkout/buy/${variantId}?checkout[custom][tenant_id]=${tenant.tenantId}&checkout[custom][type]=ai_credits&checkout[custom][credits]=${amount}&checkout[quantity]=${quantity}`;

    return NextResponse.json({ 
      success: true,
      url: checkoutUrl
    });
  } catch (error) {
    console.error('Error in checkout-ai route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
