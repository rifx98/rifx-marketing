const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
const convId = '1e8b7e1c-4ff8-4625-bdae-506a55cc0e0e';

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    realtime: {
      transport: {
        send: () => {},
        close: () => {}
      }
    }
  });

  // First let's remove any __ORDER_DATA__:null message to avoid skipping
  const { error: delErr } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', convId)
    .like('content', '__ORDER_DATA__:%');
  if (delErr) {
    console.error('Delete error:', delErr);
    return;
  }

  // Insert mock order metadata
  const mockOrder = {
    name: "Bryan Alex",
    phone: "593987654321",
    address: "Av. Shyris N34-12 y Eloy Alfaro, sector La Carolina",
    city: "Quito",
    product_id: "12345",
    quantity: 2,
    price: 25,
    payment_type: "contra_entrega",
    status: "pending"
  };

  const { data, error } = await supabase.from('messages').insert({
    conversation_id: convId,
    role: 'assistant',
    content: `__ORDER_DATA__:${JSON.stringify(mockOrder)}`,
    tenant_id: tenantId
  }).select();

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Inserted mock order message:', data);
  }
}

run().catch(console.error);
