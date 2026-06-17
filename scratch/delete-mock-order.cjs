const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

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

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', convId)
    .like('content', '__ORDER_DATA__:%');
  
  if (error) {
    console.error('Delete error:', error);
  } else {
    console.log('Cleaned mock orders from conversation history.');
  }
}

run().catch(console.error);
