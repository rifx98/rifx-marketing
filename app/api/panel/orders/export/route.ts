import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
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

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Fetch tenant config row
    const { data: config } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    let extConfig = {
      openai_key: '', gemini_key: '', groq_key: '',
      dropi_default_product_id: '', dropi_default_price: 50
    };
    try {
      const p = JSON.parse(config?.openai_key || '{}');
      extConfig = { ...extConfig, ...p };
    } catch {
      extConfig.openai_key = config?.openai_key || '';
    }

    // Resolve API key for LLM fallback
    let groqKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
    let openAiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

    // 2. Fetch all conversations for the tenant
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenant.tenantId);

    if (!conversations || conversations.length === 0) {
      return new NextResponse('No conversations found', { status: 404 });
    }

    // 3. Fetch messages for all these conversations
    const convIds = conversations.map(c => c.id);
    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });

    const messagesByConv: Record<string, any[]> = {};
    (allMessages || []).forEach(m => {
      if (!messagesByConv[m.conversation_id]) {
        messagesByConv[m.conversation_id] = [];
      }
      messagesByConv[m.conversation_id].push(m);
    });

    const orders: any[] = [];
    const client = (groqKey || openAiKey) ? new OpenAI({
      apiKey: groqKey || openAiKey,
      baseURL: groqKey ? 'https://api.groq.com/openai/v1' : undefined
    }) : null;

    // 4. Process each conversation
    for (const conv of conversations) {
      const msgs = messagesByConv[conv.id] || [];
      
      // Check if there is an existing __ORDER_DATA__ message (confirmed orders logged by the bot)
      let orderMsg = msgs.find(m => m.content?.startsWith('__ORDER_DATA__:'));
      let orderDetails: any = null;

      if (orderMsg) {
        const jsonStr = orderMsg.content.substring('__ORDER_DATA__:'.length);
        if (jsonStr !== 'null') {
          try {
            orderDetails = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse order json from message:', e);
          }
        }
      }

      if (orderDetails) {
        orders.push({
          ...orderDetails,
          customer_name: orderDetails.name || conv.customer_name || 'Cliente',
          phone_number: orderDetails.phone || conv.phone_number || ''
        });
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
      const productId = order.product_id || extConfig.dropi_default_product_id || 'DEFAULT_PRODUCT';
      const quantity = order.quantity || 1;
      const unitPrice = order.price || extConfig.dropi_default_price || 50;
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
        'Content-Disposition': `attachment; filename=dropi_ecuador_orders_${new Date().toISOString().slice(0, 10)}.csv`
      }
    });

  } catch (error: any) {
    console.error('❌ Error exporting orders:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
