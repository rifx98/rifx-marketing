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

    const variantId = process.env.LEMONSQUEEZY_VARIANT_AI_1K || 'e25d28c0-a5b1-4035-938d-7ae9659a9064';
    const quantity = amount / 1000;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;

    if (!storeId || !apiKey) {
      return NextResponse.json({ error: 'La pasarela de pagos no está configurada' }, { status: 503 });
    }

    const appOrigin = process.env.APP_URL || req.nextUrl.origin;
    
    // Generar checkout usando la API oficial para permitir redirección
    const result = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: tenant.email || '',
              custom: { tenant_id: tenant.tenantId, type: 'ai_credits', credits: amount }
            },
            product_options: {
              redirect_url: `${appOrigin}/panel?payment=success`,
              receipt_button_text: 'Volver al Panel',
              receipt_link_url: `${appOrigin}/panel?payment=success`,
            },
            expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          },
          relationships: {
            store: { data: { type: 'stores', id: storeId } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    });

    if (!result.ok) {
      const errorText = await result.text();
      console.error('Error de LemonSqueezy API:', errorText);
      return NextResponse.json({ error: 'No se pudo crear la sesión de pago' }, { status: 502 });
    }

    const checkoutData = await result.json();
    let checkoutUrl = checkoutData?.data?.attributes?.url;

    // Workaround para quantity: si la API no permite mandarlo directamente, lo adjuntamos a la url generada
    if (checkoutUrl && quantity > 1) {
      checkoutUrl += `&checkout[quantity]=${quantity}`;
    }

    if (!checkoutUrl) {
      return NextResponse.json({ error: 'Respuesta inválida del proveedor de pagos' }, { status: 502 });
    }

    return NextResponse.json({ 
      success: true,
      url: checkoutUrl
    });
  } catch (error) {
    console.error('Error in checkout-ai route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
