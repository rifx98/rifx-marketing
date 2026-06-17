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
  
  const { data: configs, error } = await supabase.from('config').select('*');
  if (error) {
    console.error('Error fetching configs:', error.message);
  } else {
    console.log('Configs in DB:');
    configs.forEach(c => {
      console.log(`- tenant_id: ${c.tenant_id}`);
      console.log(`  whatsapp_phone_id: ${c.whatsapp_phone_id}`);
      console.log(`  whatsapp_token: ${c.whatsapp_token ? (c.whatsapp_token.substring(0, 15) + '...') : 'null'}`);
    });
  }

  const { data: tenants, error: tErr } = await supabase.from('tenants').select('id, company_name');
  if (tErr) {
    console.error('Error fetching tenants:', tErr.message);
  } else {
    console.log('\nTenants in DB:');
    tenants.forEach(t => {
      console.log(`- id: ${t.id}, name: ${t.company_name}`);
    });
  }
}

run();
