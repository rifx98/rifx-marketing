const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    realtime: {
      transport: { send: () => {}, close: () => {} }
    }
  });
  
  const { data: config, error } = await supabase
    .from('config')
    .select('*')
    .eq('tenant_id', '26db5d82-84e2-4af5-9458-add284631021')
    .single();
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Config openai_key field:', config.openai_key);
  }
}

run();
