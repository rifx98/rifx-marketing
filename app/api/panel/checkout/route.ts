import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// LEMON SQUEEZY CHECKOUT — Crear sesión de pago
// ============================================

const VARIANT_MAP: Record<string, string> = {
  start: process.env.LEMONSQUEEZY_VARIANT_START || '',
  advanced: process.env.LEMONSQUEEZY_VARIANT_ADVANCED || '',
  plus: process.env.LEMONSQUEEZY_VARIANT_PLUS || '',
  master: process.env.LEMONSQUEEZY_VARIANT_MASTER || '',
};

const PLAN_PRICES: Record<string, number> = {
  start: 4900,
  advanced: 10900,
  plus: 18900,
  master: 39900,
};

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { plan } = await req.json();
    const variantId = VARIANT_MAP[plan];

    if (!variantId || variantId === 'PENDING') {
      return NextResponse.json({ 
        error: 'Plan no configurado aún. Contacta al administrador.' 
      }, { status: 400 });
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return NextResponse.json({ error: 'Pasarela de pagos no configurada' }, { status: 500 });
    }

    // Crear checkout session en Lemon Squeezy
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              custom: {
                tenant_id: tenant.tenantId,
                plan: plan,
              },
            },
            product_options: {
              enabled_variants: [parseInt(variantId)],
              redirect_url: `${req.nextUrl.origin}/panel?payment=success`,
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: storeId },
            },
            variant: {
              data: { type: 'variants', id: variantId },
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error Lemon Squeezy checkout:', JSON.stringify(data.errors || data));
      return NextResponse.json({ 
        error: 'Error creando sesión de pago' 
      }, { status: 500 });
    }

    const checkoutUrl = data.data.attributes.url;
    console.log(`💳 Checkout creado para tenant ${tenant.tenantId} - Plan: ${plan} - URL: ${checkoutUrl}`);

    return NextResponse.json({ checkoutUrl });
  } catch (error: any) {
    console.error('❌ Error en checkout:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
