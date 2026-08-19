import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { enforceTenantRateLimit, internalApiError } from '@/lib/request-guards';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Spreadsheet applications may execute cells beginning with these
  // characters as formulas. Prefixing an apostrophe keeps exports as data.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getEcuadorDepartment(city: string): string {
  const c = city.toLowerCase().trim();
  if (c.includes('quito') || c.includes('sangolqui') || c.includes('ruminahui')) return 'Pichincha';
  if (c.includes('guayaquil') || c.includes('milagro') || c.includes('daule') || c.includes('samborondon') || c.includes('duran')) return 'Guayas';
  if (c.includes('cuenca')) return 'Azuay';
  if (c.includes('manta') || c.includes('portoviejo') || c.includes('chone') || c.includes('el carmen') || c.includes('montecristi')) return 'Manabí';
  if (c.includes('santo domingo')) return 'Santo Domingo de los Tsáchilas';
  if (c.includes('machala') || c.includes('pasaje') || c.includes('santa rosa') || c.includes('huaquillas')) return 'El Oro';
  if (c.includes('loja')) return 'Loja';
  if (c.includes('ambato')) return 'Tungurahua';
  if (c.includes('esmeraldas')) return 'Esmeraldas';
  if (c.includes('quevedo') || c.includes('babahoyo')) return 'Los Ríos';
  if (c.includes('riobamba')) return 'Chimborazo';
  if (c.includes('ibarra')) return 'Imbabura';
  if (c.includes('santa elena') || c.includes('la libertad') || c.includes('salinas')) return 'Santa Elena';
  if (c.includes('tulcan')) return 'Carchi';
  if (c.includes('nueva loja') || c.includes('lago agrio')) return 'Sucumbíos';
  if (c.includes('tena')) return 'Napo';
  if (c.includes('puyo')) return 'Pastaza';
  if (c.includes('macas')) return 'Morona Santiago';
  if (c.includes('zamora')) return 'Zamora Chinchipe';
  if (c.includes('puerto baquerizo') || c.includes('galapagos') || c.includes('santa cruz')) return 'Galápagos';
  if (c.includes('latacunga')) return 'Cotopaxi';
  if (c.includes('guaranda')) return 'Bolívar';
  if (c.includes('azogues')) return 'Cañar';
  if (c.includes('francisco de orellana') || c.includes('coca')) return 'Orellana';
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function boundedText(value: unknown, fallback = '', maxLength = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function boundedPositiveNumber(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function parseDateFilter(value: string | null, endOfDay = false): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid_date_filter');
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('invalid_date_filter');
  }
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'orders');
    if (featureDenied) return featureDenied;
    const rateDenied = await enforceTenantRateLimit('orders-export', tenant.tenantId, 4, 60_000);
    if (rateDenied) return rateDenied;

    let fromDate: string | null;
    let toDate: string | null;
    try {
      fromDate = parseDateFilter(req.nextUrl.searchParams.get('from'));
      toDate = parseDateFilter(req.nextUrl.searchParams.get('to'), true);
    } catch {
      return NextResponse.json({ error: 'Filtros de fecha inválidos' }, { status: 400 });
    }
    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json({ error: 'El rango de fechas es inválido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: config, error: configError } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();
    if (configError) return internalApiError();

    let defaultProductId = '';
    let defaultPrice = 50;
    try {
      const parsed: unknown = JSON.parse(config?.openai_key || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const values = parsed as Record<string, unknown>;
        defaultProductId = boundedText(values.dropi_default_product_id, '', 120);
        defaultPrice = boundedPositiveNumber(values.dropi_default_price, 50, 1_000_000);
      }
    } catch {}

    const pageSize = 500;
    const maxOrders = 5_000;
    const orderMessages: Array<{ conversation_id: string; content: string }> = [];
    for (let offset = 0; offset <= maxOrders; offset += pageSize) {
      let query = supabase
        .from('messages')
        .select('conversation_id, content')
        .eq('tenant_id', tenant.tenantId)
        .like('content', '__ORDER_DATA__:%')
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (fromDate) query = query.gte('created_at', fromDate);
      if (toDate) query = query.lte('created_at', toDate);
      const { data: page, error: pageError } = await query;
      if (pageError) return internalApiError();
      orderMessages.push(...(page || []));
      if ((page || []).length < pageSize) break;
    }
    if (orderMessages.length > maxOrders) {
      return NextResponse.json(
        { error: 'El resultado supera 5.000 pedidos; usa los filtros from y to (AAAA-MM-DD).' },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const conversationIds = [...new Set(orderMessages.map(message => message.conversation_id))];
    const conversationsById = new Map<string, { customer_name: string | null; phone_number: string | null }>();
    for (let index = 0; index < conversationIds.length; index += 200) {
      const ids = conversationIds.slice(index, index + 200);
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, customer_name, phone_number')
        .eq('tenant_id', tenant.tenantId)
        .in('id', ids);
      if (conversationsError) return internalApiError();
      for (const conversation of conversations || []) {
        conversationsById.set(conversation.id, conversation);
      }
    }

    const orders: any[] = [];
    for (const orderMessage of orderMessages) {
      if (typeof orderMessage.content !== 'string' || orderMessage.content.length > 64 * 1024) continue;
      const json = orderMessage.content.slice('__ORDER_DATA__:'.length);
      if (!json || json === 'null') continue;
      try {
        const parsed: unknown = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const details = parsed as Record<string, unknown>;
        const conversation = conversationsById.get(orderMessage.conversation_id);
        orders.push({
          customer_name: boundedText(details.name, conversation?.customer_name || 'Cliente', 160),
          phone_number: boundedText(details.phone, conversation?.phone_number || '', 32),
          address: boundedText(details.address, 'Dirección de entrega', 300),
          city: boundedText(details.city, 'Quito', 120),
          departamento: boundedText(details.departamento, '', 120),
          product_id: boundedText(details.product_id, defaultProductId || 'DEFAULT_PRODUCT', 120),
          quantity: boundedPositiveNumber(details.quantity, 1, 10_000),
          price: boundedPositiveNumber(details.price, defaultPrice, 1_000_000),
          payment_type: boundedText(details.payment_type, 'contra_entrega', 40),
        });
      } catch {
        // Ignore only the malformed historical row; never include partial data.
      }
    }

    // 5. Generate CSV
    const csvHeaders = [
      'NOMBRES',
      'APELLIDOS',
      'DIRECCIÓN Y BARRIO',
      'DEPARTAMENTO',
      'CIUDAD',
      'TELÉFONO',
      'ID PRODUCTO',
      'CANTIDAD',
      'PRECIO TOTAL (SIN PUNTOS NI COMAS)',
      'CON RECAUDO',
      'NOTA',
      'EMAIL (OPCIONAL)',
      'ID DE VARIABLE (OPCIONAL)',
      'CODIGO POSTAL (OPCIONAL)',
      'TRANSPORTADORA (OPCIONAL)',
      'CEDULA (OPCIONAL)',
      'COLONIA (OBLIGATORIO SOLO PARA QUIKEN)',
      'SEGURO (SOLO APLICA PARA ENVIA)'
    ];

    const csvRows = orders.map(order => {
      // Split names into NOMBRES and APELLIDOS
      const nameParts = (order.customer_name || '').trim().split(/\s+/);
      const nombres = nameParts[0] || 'Cliente';
      const apellidos = nameParts.slice(1).join(' ') || '.';

      // Resolve city and department
      const ciudad = order.city || 'Quito';
      const departamento = order.departamento || getEcuadorDepartment(ciudad);

      // Clean phone number (remove code prefix if present, but Dropi Ecuador accepts local numbers)
      let phone = (order.phone_number || order.phone || '').replace(/[^0-9]/g, '');
      if (phone.startsWith('593')) {
        phone = '0' + phone.substring(3);
      }

      // Default product and pricing
      const productId = order.product_id || defaultProductId || 'DEFAULT_PRODUCT';
      const quantity = order.quantity || 1;
      const unitPrice = order.price || defaultPrice || 50;
      const totalPrice = quantity * unitPrice;

      // Recaudo: cash on delivery (contra_entrega) -> "Si", prepaid -> "No"
      const conRecaudo = (order.payment_type === 'contra_entrega' || !order.payment_type) ? 'Si' : 'No';

      const nota = `Pedido WhatsApp - Ref ${productId}`;

      return [
        escapeCsv(nombres),
        escapeCsv(apellidos),
        escapeCsv(order.address || 'Direccion de entrega'),
        escapeCsv(departamento),
        escapeCsv(ciudad),
        escapeCsv(phone),
        escapeCsv(productId),
        escapeCsv(quantity),
        escapeCsv(Math.round(totalPrice)),
        escapeCsv(conRecaudo),
        escapeCsv(nota),
        '', // EMAIL
        '', // ID DE VARIABLE
        '', // CODIGO POSTAL
        '', // TRANSPORTADORA
        '', // CEDULA
        '', // COLONIA
        ''  // SEGURO
      ].join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n');
    
    // Return CSV file download
    return new NextResponse('\ufeff' + csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=dropi_ecuador_orders_${new Date().toISOString().slice(0, 10)}.csv`,
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      }
    });

  } catch {
    console.error('Order export request failed');
    return internalApiError();
  }
}
