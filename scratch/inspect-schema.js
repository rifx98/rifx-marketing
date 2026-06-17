const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Let's run a query to check existing tables in the database
  const { data, error } = await supabase.rpc('get_tables_info');
  if (error) {
    console.log('Error calling get_tables_info RPC:', error.message);
    
    // Fallback: try querying some common table names to see if they exist
    const commonTables = ['sales', 'conversations', 'messages', 'config', 'tenants', 'orders', 'dropi_orders', 'pedidos'];
    for (const t of commonTables) {
      const { data: d, error: e } = await supabase.from(t).select('*').limit(1);
      if (e) {
        console.log(`Table '${t}' does not exist or error:`, e.message);
      } else {
        console.log(`Table '${t}' exists! Sample:`, d);
      }
    }
  } else {
    console.log('Tables info:', data);
  }
}

run();
