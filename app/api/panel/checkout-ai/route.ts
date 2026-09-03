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

    // Mapear la cantidad a un Variant ID de Lemon Squeezy
    let variantId = '';
    
    if (amount === 1000) {
      variantId = process.env.LEMONSQUEEZY_VARIANT_AI_1K || 'dummy_1k';
    } else if (amount === 5000) {
      variantId = process.env.LEMONSQUEEZY_VARIANT_AI_5K || 'dummy_5k';
    } else if (amount === 10000) {
      variantId = process.env.LEMONSQUEEZY_VARIANT_AI_10K || 'dummy_10k';
    } else {
      return NextResponse.json({ error: 'Paquete de créditos inválido' }, { status: 400 });
    }

    // Si tuviéramos un Store ID en .env, podríamos usar la API REST (api.lemonsqueezy.com/v1/checkouts).
    // Para simplificar y dado que usan Lemon.js, podemos devolver la URL de checkout estructurada
    // con el custom_data incrustado, y Lemon.js la abrirá.
    
    const storeDomain = process.env.LEMONSQUEEZY_STORE_DOMAIN || 'rifx-marketing.lemonsqueezy.com';
    
    // Construir la URL de Checkout con Custom Data
    const checkoutUrl = `https://${storeDomain}/checkout/buy/${variantId}?checkout[custom][tenant_id]=${tenant.tenantId}&checkout[custom][type]=ai_credits&checkout[custom][credits]=${amount}`;

    return NextResponse.json({ 
      success: true,
      url: checkoutUrl
    });
  } catch (error) {
    console.error('Error in checkout-ai route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
