import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// ============================================
// PAYPHONE WEBHOOK — Notificación de pagos
// ============================================

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const transactionId = searchParams.get('id');
  const clientTransactionId = searchParams.get('clientTransactionId');

  if (!transactionId && !clientTransactionId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  try {
    // First, find the sale to determine the tenant
    const { data: sale } = await supabase
      .from('sales')
      .select('*, conversations(*)')
      .eq('payphone_transaction_id', String(transactionId))
      .single();

    // Resolve config using the sale's tenant_id (or conversation's tenant_id)
    const saleTenantId = sale?.tenant_id || sale?.conversations?.tenant_id || null;
    let configQuery = supabase.from('config').select('*');
    if (saleTenantId) {
      configQuery = configQuery.eq('tenant_id', saleTenantId);
    }
    const { data: config } = await configQuery.limit(1).single();
    const token = config?.payphone_token || process.env.PAYPHONE_TOKEN;

    // Consultar estado de la transacción en PayPhone
    const ppResponse = await fetch(
      `https://pay.payphonetodoesposible.com/api/Sale/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const ppData = await ppResponse.json();

    // statusCode 3 = Aprobada, 2 = Cancelada
    if (ppData.statusCode === 3) {
      if (sale) {
        // Marcar venta como completada
        await supabase
          .from('sales')
          .update({ status: 'completed' })
          .eq('id', sale.id);

        // Marcar conversación como "bought"
        if (sale.conversation_id) {
          await supabase
            .from('conversations')
            .update({ status: 'bought', updated_at: new Date().toISOString() })
            .eq('id', sale.conversation_id);
        }

        // Enviar mensaje de confirmación por WhatsApp
        const whatsappToken = config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
        const phoneId = config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (whatsappToken && phoneId) {
          const amountDollars = sale.amount / 100;
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: sale.phone_number,
              type: 'text',
              text: {
                body: `✅ ¡Pago confirmado!\n\n🎉 Hemos recibido tu pago de $${amountDollars} por "${sale.service}".\n\nNuestro equipo se pondrá en contacto contigo en las próximas 24 horas para iniciar tu proyecto.\n\n¡Gracias por confiar en RIFX Marketing! 🚀`,
              },
            }),
          });

          // Guardar el mensaje de confirmación en el historial
          if (sale.conversation_id) {
            await supabase.from('messages').insert({
              conversation_id: sale.conversation_id,
              role: 'assistant',
              content: `✅ ¡Pago confirmado! Se recibió $${amountDollars} por "${sale.service}". Nuestro equipo se pondrá en contacto en 24 horas. ¡Gracias por confiar en RIFX! 🚀`,
            });
          }
        }

        console.log(`💰 Venta completada: ${sale.customer_name} - $${sale.amount / 100} - ${sale.service}`);
      }
    } else if (ppData.statusCode === 2) {
      // Pago cancelado
      await supabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('payphone_transaction_id', String(transactionId));

      console.log(`❌ Pago cancelado: transacción ${transactionId}`);
    }

    // Redirigir a una página de agradecimiento (opcional)
    return NextResponse.json({ status: 'processed', paymentStatus: ppData.transactionStatus });
  } catch (error) {
    console.error('❌ Error en webhook PayPhone:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
