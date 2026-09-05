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
    
    // Generar URL de checkout directamente usando los query parameters de Lemon Squeezy
    // Esto evita problemas de autenticación de API o IDs de variantes numéricos faltantes
    const storeDomain = process.env.LEMONSQUEEZY_STORE_DOMAIN || 'rifxmarketing.lemonsqueezy.com';
    const baseUrl = `https://${storeDomain}/checkout/buy/${variantId}`;
    const url = new URL(baseUrl);
    
    // Datos de usuario
    if (tenant.email) {
      url.searchParams.append('checkout[email]', tenant.email);
    }
    
    // Custom data para el Webhook
    url.searchParams.append('checkout[custom][tenant_id]', tenant.tenantId);
    url.searchParams.append('checkout[custom][type]', 'ai_credits');
    url.searchParams.append('checkout[custom][credits]', amount.toString());
    
    // Cantidad si es mayor a 1
    if (quantity > 1) {
      url.searchParams.append('checkout[quantity]', quantity.toString());
    }

    return NextResponse.json({ 
      success: true,
      url: url.toString()
    });
  } catch (error) {
    console.error('Error in checkout-ai route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
