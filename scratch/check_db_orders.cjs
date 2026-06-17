const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';

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

  // Fetch all conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenantId);

  console.log(`Total conversations: ${conversations ? conversations.length : 0}`);

  const convIds = (conversations || []).map(c => c.id);
  
  if (convIds.length === 0) {
    console.log('No conversations found.');
    return;
  }

  // Fetch messages with __ORDER_DATA__
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', convIds)
    .like('content', '__ORDER_DATA__:%');

  console.log(`Total __ORDER_DATA__ messages: ${messages ? messages.length : 0}`);

  messages.forEach(m => {
    const conv = conversations.find(c => c.id === m.conversation_id);
    console.log(`Conv: ${conv ? conv.customer_name : 'Unknown'} (Status: ${conv ? conv.status : 'N/A'}, Phone: ${conv ? conv.phone_number : 'N/A'})`);
    console.log(`  Content: ${m.content}`);
  });
}

run().catch(console.error);
